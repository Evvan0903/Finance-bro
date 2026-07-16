"""Create and validate human-readable report source records and citation markers."""

from __future__ import annotations

import re
from typing import Any, Iterable

from src.utils import utc_now_iso


CITATION_PATTERN = re.compile(r"\[(S\d+)\]")


def build_source_records(
    filings: Iterable[dict[str, Any]],
    *,
    external_sources: Iterable[dict[str, Any]] | None = None,
    user_inputs: Iterable[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Build a de-duplicated source ledger from actual URLs and identifiers only."""
    candidates: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for filing in filings:
        accession = str(filing.get("accession_number") or "")
        url = str(filing.get("filing_url") or filing.get("url") or "")
        if not url:
            continue
        key = (accession, url)
        if key in seen:
            continue
        seen.add(key)
        form = filing.get("form") or filing.get("filing_form") or "SEC filing"
        candidates.append(
            {
                "source_title": f"SEC {form} filed {filing.get('filing_date') or 'date unavailable'}",
                "source_type": filing.get("source_type") or "SEC_FILING",
                "filing_form": form,
                "filing_date": filing.get("filing_date"),
                "reporting_period": filing.get("report_date") or filing.get("reporting_period"),
                "accession_number": accession,
                "url": url,
                "retrieved_at": filing.get("retrieved_at") or utc_now_iso(),
            }
        )
    for source in list(external_sources or []) + list(user_inputs or []):
        url = str(source.get("url") or "")
        title = str(source.get("source_title") or source.get("title") or "")
        if not url and source.get("source_type") != "USER_INPUT":
            continue
        key = (title, url)
        if key in seen:
            continue
        seen.add(key)
        candidates.append(
            {
                "source_title": title or "User-entered assumption",
                "source_type": source.get("source_type") or "PUBLIC_THIRD_PARTY",
                "filing_form": source.get("filing_form"),
                "filing_date": source.get("filing_date"),
                "reporting_period": source.get("reporting_period"),
                "accession_number": source.get("accession_number"),
                "url": url,
                "retrieved_at": source.get("retrieved_at") or utc_now_iso(),
            }
        )
    for index, source in enumerate(candidates, start=1):
        source["source_id"] = f"S{index}"
    return candidates


def source_id_for_accession(sources: list[dict[str, Any]], accession_number: str | None) -> str | None:
    if not accession_number:
        return None
    return next(
        (
            str(source["source_id"])
            for source in sources
            if source.get("accession_number") == accession_number
        ),
        None,
    )


def add_citation(text: str, source_id: str | None) -> str:
    """Append one source marker unless the text already contains it."""
    if not source_id or not text:
        return text
    marker = f"[{source_id}]"
    return text if marker in text else f"{text.rstrip()} {marker}"


def cite_summary(
    summary: dict[str, str],
    sources: list[dict[str, Any]],
    preferred_accession: str | None = None,
) -> dict[str, str]:
    """Cite deterministic financial commentary to the filing underlying its facts."""
    source_id = source_id_for_accession(sources, preferred_accession)
    if source_id is None and sources:
        source_id = str(sources[0]["source_id"])
    return {section: add_citation(text, source_id) for section, text in summary.items()}


def citation_ids(text: str) -> set[str]:
    return set(CITATION_PATTERN.findall(text or ""))


def validate_citation_markers(
    texts: Iterable[str], sources: list[dict[str, Any]]
) -> dict[str, Any]:
    """Check marker validity and calculate text-level citation coverage."""
    valid = {str(source.get("source_id")) for source in sources}
    material = [text for text in texts if isinstance(text, str) and len(text.strip()) >= 20]
    cited = 0
    invalid: set[str] = set()
    for text in material:
        identifiers = citation_ids(text)
        if identifiers & valid:
            cited += 1
        invalid.update(identifiers - valid)
    return {
        "material_text_count": len(material),
        "cited_text_count": cited,
        "coverage": cited / len(material) if material else 1.0,
        "invalid_citation_ids": sorted(invalid),
        "passed": not invalid and (cited == len(material) if material else True),
    }
