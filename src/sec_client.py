"""SEC EDGAR access with fair-access throttling, retries, and compatible disk caching."""

from __future__ import annotations

from datetime import date, datetime, timezone
import json
import os
from pathlib import Path
import re
import time
from typing import Any, Iterable

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from src.utils import CACHE_DIR, ensure_directories, utc_now_iso


DEFAULT_SEC_USER_AGENT = "SEC Financial Report Agent contact@example.com"
# Retained as a public constant for callers that imported it in the MVP.
SEC_USER_AGENT = os.getenv("SEC_USER_AGENT", DEFAULT_SEC_USER_AGENT)
TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
SUBMISSIONS_FILE_URL = "https://data.sec.gov/submissions/{name}"
COMPANYFACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
ARCHIVES_BASE_URL = "https://www.sec.gov/Archives/edgar/data"
SUPPORTED_DISCOVERY_FORMS = ("10-K", "10-Q", "8-K", "S-1", "424B4")


class SECClientError(RuntimeError):
    """Raised when SEC data cannot be retrieved or interpreted."""


class SECRequestError(SECClientError):
    """Structured SEC request failure with status and retry context."""

    def __init__(
        self,
        message: str,
        *,
        url: str,
        status_code: int | None = None,
        retriable: bool = False,
    ) -> None:
        super().__init__(message)
        self.url = url
        self.status_code = status_code
        self.retriable = retriable

    def as_dict(self) -> dict[str, Any]:
        return {
            "error": self.__class__.__name__,
            "message": str(self),
            "url": self.url,
            "status_code": self.status_code,
            "retriable": self.retriable,
        }


class SECClient:
    """Retrieve official SEC data while respecting fair-access guidance."""

    def __init__(
        self,
        cache_dir: Path = CACHE_DIR,
        cache_ttl_seconds: int = 24 * 60 * 60,
        timeout_seconds: int = 30,
        min_request_interval_seconds: float = 0.12,
        max_retries: int = 3,
    ) -> None:
        ensure_directories()
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_ttl_seconds = max(0, int(cache_ttl_seconds))
        self.timeout_seconds = timeout_seconds
        self.min_request_interval_seconds = max(0.11, float(min_request_interval_seconds))
        self.user_agent = os.getenv("SEC_USER_AGENT", DEFAULT_SEC_USER_AGENT).strip()
        if not self.user_agent:
            raise SECClientError("SEC_USER_AGENT must identify the application and provide contact information.")
        self.session = requests.Session()
        retry = Retry(
            total=max_retries,
            connect=max_retries,
            read=max_retries,
            status=max_retries,
            backoff_factor=0.5,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=frozenset({"GET"}),
            respect_retry_after_header=True,
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount("https://", adapter)
        self.session.headers.update(
            {
                "User-Agent": self.user_agent,
                "Accept-Encoding": "gzip, deflate",
                "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
            }
        )
        self._last_request_at = 0.0

    def _cache_path(self, cache_key: str, suffix: str = ".json") -> Path:
        safe_key = "".join(character for character in cache_key if character.isalnum() or character in "-_")
        if not safe_key:
            raise SECClientError("Cache key must contain at least one safe character.")
        return self.cache_dir / f"{safe_key}{suffix}"

    def _metadata_path(self, cache_key: str, suffix: str = ".json") -> Path:
        return self._cache_path(cache_key, suffix).with_suffix(f"{suffix}.meta.json")

    def _cache_age_seconds(self, path: Path) -> float:
        return max(0.0, time.time() - path.stat().st_mtime)

    def _read_cached_text(
        self,
        cache_key: str,
        suffix: str,
        *,
        allow_stale: bool = False,
    ) -> str | None:
        path = self._cache_path(cache_key, suffix)
        if not path.exists():
            return None
        if not allow_stale and self._cache_age_seconds(path) > self.cache_ttl_seconds:
            return None
        try:
            return path.read_text(encoding="utf-8")
        except OSError:
            return None

    def _read_cache(self, cache_key: str, *, allow_stale: bool = False) -> dict[str, Any] | None:
        raw = self._read_cached_text(cache_key, ".json", allow_stale=allow_stale)
        if raw is None:
            return None
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            return None
        return payload if isinstance(payload, dict) else None

    def _write_cache(
        self,
        cache_key: str,
        payload: dict[str, Any] | str,
        *,
        url: str,
        suffix: str = ".json",
    ) -> None:
        path = self._cache_path(cache_key, suffix)
        text = json.dumps(payload, separators=(",", ":")) if isinstance(payload, dict) else payload
        path.write_text(text, encoding="utf-8")
        metadata = {
            "cache_key": cache_key,
            "url": url,
            "retrieved_at": utc_now_iso(),
            "ttl_seconds": self.cache_ttl_seconds,
            "content_type": "application/json" if suffix == ".json" else "text/html",
        }
        self._metadata_path(cache_key, suffix).write_text(
            json.dumps(metadata, indent=2, sort_keys=True), encoding="utf-8"
        )

    def cache_metadata(self, cache_key: str, suffix: str = ".json") -> dict[str, Any]:
        """Return cache freshness metadata without reading from the network."""
        path = self._cache_path(cache_key, suffix)
        if not path.exists():
            return {"exists": False, "fresh": False, "cache_key": cache_key}
        metadata: dict[str, Any] = {}
        meta_path = self._metadata_path(cache_key, suffix)
        if meta_path.exists():
            try:
                metadata = json.loads(meta_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                metadata = {}
        age = self._cache_age_seconds(path)
        return {
            **metadata,
            "exists": True,
            "fresh": age <= self.cache_ttl_seconds,
            "age_seconds": age,
            "path": str(path),
        }

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self.min_request_interval_seconds:
            time.sleep(self.min_request_interval_seconds - elapsed)

    def _request(self, url: str) -> requests.Response:
        self._throttle()
        try:
            response = self.session.get(url, timeout=self.timeout_seconds)
            self._last_request_at = time.monotonic()
        except requests.RequestException as exc:
            raise SECRequestError(
                f"SEC request failed for {url}: {exc}", url=url, retriable=True
            ) from exc
        if response.status_code >= 400:
            retriable = response.status_code == 429 or response.status_code >= 500
            raise SECRequestError(
                f"SEC returned HTTP {response.status_code} for {url}.",
                url=url,
                status_code=response.status_code,
                retriable=retriable,
            )
        return response

    def get_json(self, url: str, cache_key: str) -> dict[str, Any]:
        """Get SEC JSON, preferring fresh cache and falling back to stale cache on errors."""
        cached = self._read_cache(cache_key)
        if cached is not None:
            return cached
        try:
            response = self._request(url)
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("root JSON value is not an object")
        except (SECRequestError, ValueError, requests.JSONDecodeError) as exc:
            stale = self._read_cache(cache_key, allow_stale=True)
            if stale is not None:
                return stale
            if isinstance(exc, SECRequestError):
                raise
            raise SECRequestError(
                f"SEC returned invalid JSON for {url}: {exc}", url=url, retriable=False
            ) from exc
        self._write_cache(cache_key, payload, url=url)
        return payload

    def get_text(self, url: str, cache_key: str) -> str:
        """Get filing HTML with the same cache, throttle, timeout, and stale fallback policy."""
        cached = self._read_cached_text(cache_key, ".html")
        if cached is not None:
            return cached
        try:
            response = self._request(url)
            text = response.text
            if not text.strip():
                raise ValueError("empty filing document")
        except (SECRequestError, ValueError) as exc:
            stale = self._read_cached_text(cache_key, ".html", allow_stale=True)
            if stale is not None:
                return stale
            if isinstance(exc, SECRequestError):
                raise
            raise SECRequestError(
                f"SEC returned an invalid filing document for {url}: {exc}",
                url=url,
                retriable=False,
            ) from exc
        self._write_cache(cache_key, text, url=url, suffix=".html")
        return text

    def get_ticker_mapping(self) -> dict[str, dict[str, Any]]:
        """Return SEC ticker records keyed by uppercase ticker."""
        raw = self.get_json(TICKERS_URL, "company_tickers")
        return {
            record["ticker"].upper(): record
            for record in raw.values()
            if isinstance(record, dict) and record.get("ticker")
        }

    def ticker_to_company(self, ticker: str) -> dict[str, Any]:
        """Map a ticker to its SEC company name and zero-padded CIK."""
        ticker = ticker.strip().upper()
        record = self.get_ticker_mapping().get(ticker)
        if not record:
            raise SECClientError(f"Ticker '{ticker}' was not found in the SEC ticker mapping.")
        return {
            "ticker": ticker,
            "name": record["title"],
            "cik": str(record["cik_str"]).zfill(10),
        }

    def get_submissions(self, cik: str) -> dict[str, Any]:
        """Return the SEC submissions document for a company."""
        cik = str(cik).zfill(10)
        return self.get_json(SUBMISSIONS_URL.format(cik=cik), f"submissions_{cik}")

    def get_company_facts(self, cik: str) -> dict[str, Any]:
        """Return the SEC XBRL companyfacts document for a company."""
        cik = str(cik).zfill(10)
        return self.get_json(COMPANYFACTS_URL.format(cik=cik), f"companyfacts_{cik}")

    @staticmethod
    def filing_url(cik: str, accession_number: str, primary_document: str | None = None) -> str:
        """Construct a filing document or filing index URL from verified SEC identifiers."""
        cik_no_zeros = str(int(str(cik)))
        accession_compact = accession_number.replace("-", "")
        filename = primary_document or f"{accession_number}-index.html"
        return f"{ARCHIVES_BASE_URL}/{cik_no_zeros}/{accession_compact}/{filename}"

    @staticmethod
    def filing_index_json_url(cik: str, accession_number: str) -> str:
        cik_no_zeros = str(int(str(cik)))
        accession_compact = accession_number.replace("-", "")
        return f"{ARCHIVES_BASE_URL}/{cik_no_zeros}/{accession_compact}/index.json"

    @classmethod
    def discover_filings(
        cls,
        submissions: dict[str, Any],
        forms: Iterable[str] | None = None,
        *,
        start_date: str | date | None = None,
        end_date: str | date | None = None,
        include_amendments: bool = True,
    ) -> list[dict[str, Any]]:
        """Discover recent 10-K, 10-Q, 8-K, S-1, and 424B4 filings with provenance."""
        requested = {form.upper() for form in (forms or SUPPORTED_DISCOVERY_FORMS)}
        recent = submissions.get("filings", {}).get("recent", {})
        cik = str(submissions.get("cik", "")).zfill(10)
        keys = (
            "accessionNumber",
            "filingDate",
            "reportDate",
            "acceptanceDateTime",
            "act",
            "form",
            "fileNumber",
            "filmNumber",
            "items",
            "size",
            "isXBRL",
            "isInlineXBRL",
            "primaryDocument",
            "primaryDocDescription",
        )
        record_count = len(recent.get("form", []))
        output: list[dict[str, Any]] = []
        start = str(start_date) if start_date else None
        end = str(end_date) if end_date else None
        for index in range(record_count):
            row = {
                key: recent.get(key, [None] * record_count)[index]
                if index < len(recent.get(key, []))
                else None
                for key in keys
            }
            form = str(row.get("form") or "").upper()
            base_form = form[:-2] if form.endswith("/A") else form
            is_amendment = form.endswith("/A")
            if base_form not in requested or (is_amendment and not include_amendments):
                continue
            filing_date = str(row.get("filingDate") or "")
            if start and filing_date < start:
                continue
            if end and filing_date > end:
                continue
            accession = str(row.get("accessionNumber") or "")
            primary_document = str(row.get("primaryDocument") or "")
            if not accession:
                continue
            output.append(
                {
                    "form": form,
                    "base_form": base_form,
                    "is_amendment": is_amendment,
                    "filing_date": filing_date,
                    "report_date": row.get("reportDate") or "",
                    "acceptance_datetime": row.get("acceptanceDateTime") or "",
                    "accession_number": accession,
                    "primary_document": primary_document,
                    "primary_document_description": row.get("primaryDocDescription") or "",
                    "items": row.get("items") or "",
                    "is_xbrl": bool(row.get("isXBRL")),
                    "is_inline_xbrl": bool(row.get("isInlineXBRL")),
                    "filing_url": cls.filing_url(cik, accession, primary_document or None),
                    "filing_index_url": cls.filing_url(cik, accession),
                    "filing_index_json_url": cls.filing_index_json_url(cik, accession),
                    "source_type": "SEC_FILING",
                }
            )
        return sorted(
            output,
            key=lambda item: (item["filing_date"], item["acceptance_datetime"]),
            reverse=True,
        )

    @classmethod
    def latest_filing(
        cls,
        submissions: dict[str, Any],
        form: str,
        *,
        include_amendments: bool = False,
    ) -> dict[str, Any]:
        filings = cls.discover_filings(
            submissions, [form], include_amendments=include_amendments
        )
        if not filings:
            raise SECClientError(f"No recent {form} filing was found for this company.")
        return filings[0]

    @classmethod
    def latest_10k(cls, submissions: dict[str, Any]) -> dict[str, Any]:
        """Backward-compatible latest annual filing lookup."""
        return cls.latest_filing(submissions, "10-K")

    def get_filing_html(self, filing: dict[str, Any]) -> str:
        """Retrieve the primary filing document using its verified SEC URL."""
        url = str(filing.get("filing_url") or "")
        accession = str(filing.get("accession_number") or "")
        if not url or not accession:
            raise SECClientError("Filing URL and accession number are required.")
        return self.get_text(url, f"filing_{accession.replace('-', '')}")

    def discover_exhibits(self, filing: dict[str, Any]) -> list[dict[str, Any]]:
        """Discover likely exhibit files from the SEC filing directory index."""
        index_url = str(filing.get("filing_index_json_url") or "")
        accession = str(filing.get("accession_number") or "")
        cik = str(filing.get("cik") or "")
        if not index_url and cik and accession:
            index_url = self.filing_index_json_url(cik, accession)
        if not index_url or not accession:
            return []
        payload = self.get_json(index_url, f"filing_index_{accession.replace('-', '')}")
        directory = payload.get("directory", {})
        parent = str(directory.get("name") or "").strip("/")
        items = directory.get("item", [])
        exhibits: list[dict[str, Any]] = []
        pattern = re.compile(r"(?:^|[-_])(ex(?:hibit)?[-_]?\d+|ex99|99[-_.]?\d+)", re.IGNORECASE)
        for item in items if isinstance(items, list) else []:
            name = str(item.get("name") or "")
            if not name or not pattern.search(name):
                continue
            url = f"https://www.sec.gov/Archives/{parent}/{name}" if parent else ""
            exhibits.append(
                {
                    "name": name,
                    "size": item.get("size"),
                    "last_modified": item.get("last-modified"),
                    "url": url,
                    "source_type": "SEC_FILING_EXHIBIT",
                    "accession_number": accession,
                }
            )
        return exhibits
