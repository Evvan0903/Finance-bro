"""Focused SEC filing-section extraction that preserves filing provenance."""

from __future__ import annotations

import re
from typing import Any

from bs4 import BeautifulSoup

from src.sec_client import SECClient, SECClientError


SECTION_SPECS: dict[str, list[dict[str, Any]]] = {
    "10-K": [
        {"name": "Item 1 - Business", "start": r"\bitem\s+1[.\s:-]+business\b", "end": r"\bitem\s+1a[.\s:-]+risk\s+factors\b"},
        {"name": "Item 1A - Risk Factors", "start": r"\bitem\s+1a[.\s:-]+risk\s+factors\b", "end": r"\bitem\s+1b[.\s:-]+"},
        {"name": "Item 7 - Management's Discussion and Analysis", "start": r"\bitem\s+7[.\s:-]+management(?:'|’)?s\s+discussion\s+and\s+analysis\b", "end": r"\bitem\s+7a[.\s:-]+"},
        {"name": "Item 7A - Market Risk", "start": r"\bitem\s+7a[.\s:-]+quantitative\s+and\s+qualitative\s+disclosures\s+about\s+market\s+risk\b", "end": r"\bitem\s+8[.\s:-]+"},
        {"name": "Item 8 - Financial Statements", "start": r"\bitem\s+8[.\s:-]+financial\s+statements", "end": r"\bitem\s+9[.\s:-]+"},
    ],
    "10-Q": [
        {"name": "10-Q MD&A", "start": r"\bitem\s+2[.\s:-]+management(?:'|’)?s\s+discussion\s+and\s+analysis\b", "end": r"\bitem\s+3[.\s:-]+"},
        {"name": "10-Q Risk Factor Updates", "start": r"\bitem\s+1a[.\s:-]+risk\s+factors\b", "end": r"\bitem\s+2[.\s:-]+"},
    ],
    "S-1": [
        {"name": "S-1 Business", "start": r"(?:^|\n)\s*business\s*(?:\n|$)", "end": r"(?:^|\n)\s*(?:risk\s+factors|management)\s*(?:\n|$)"},
        {"name": "S-1 Risk Factors", "start": r"(?:^|\n)\s*risk\s+factors\s*(?:\n|$)", "end": r"(?:^|\n)\s*(?:use\s+of\s+proceeds|dividend\s+policy|capitalization)\s*(?:\n|$)"},
        {"name": "S-1 MD&A", "start": r"management(?:'|’)?s\s+discussion\s+and\s+analysis", "end": r"(?:^|\n)\s*(?:business|directors\s+and\s+executive\s+officers)\s*(?:\n|$)"},
    ],
    "8-K": [
        {"name": "8-K Material Update", "start": r"\bitem\s+[1-9]\.[0-9]{2}\b", "end": r"\bsignatures\b"},
    ],
}


def html_to_text(html: str) -> str:
    """Convert filing HTML to readable text while retaining section-heading line breaks."""
    soup = BeautifulSoup(html, "html.parser")
    for element in soup(["script", "style", "noscript", "svg"]):
        element.decompose()
    raw = soup.get_text("\n")
    lines = [re.sub(r"[\t\xa0 ]+", " ", line).strip() for line in raw.splitlines()]
    output: list[str] = []
    blank = False
    for line in lines:
        if line:
            output.append(line)
            blank = False
        elif output and not blank:
            output.append("")
            blank = True
    return "\n".join(output).strip()


def _best_section(text: str, start_pattern: str, end_pattern: str) -> tuple[int, int, str] | None:
    starts = list(re.finditer(start_pattern, text, flags=re.IGNORECASE | re.MULTILINE))
    candidates: list[tuple[int, int, str]] = []
    for match in starts:
        end_match = re.search(
            end_pattern, text[match.end() :], flags=re.IGNORECASE | re.MULTILINE
        )
        end = match.end() + end_match.start() if end_match else min(len(text), match.start() + 120_000)
        if end <= match.start():
            continue
        excerpt = text[match.start() : end].strip()
        if len(excerpt) >= 200:
            candidates.append((match.start(), end, excerpt))
    if not candidates:
        return None
    # Table-of-contents matches are usually very short; choose the richest bounded section.
    return max(candidates, key=lambda candidate: len(candidate[2]))


def extract_filing_sections(
    html: str,
    filing: dict[str, Any],
    *,
    max_characters_per_section: int = 80_000,
) -> list[dict[str, Any]]:
    """Extract configured sections from a 10-K, 10-Q, S-1, 424B4, or 8-K document."""
    text = html_to_text(html)
    raw_form = str(filing.get("base_form") or filing.get("form") or "").upper()
    form = "S-1" if raw_form in {"S-1", "424B4"} else raw_form
    specs = SECTION_SPECS.get(form, [])
    sections: list[dict[str, Any]] = []
    for spec in specs:
        match = _best_section(text, spec["start"], spec["end"])
        if not match:
            continue
        start, end, excerpt = match
        truncated = len(excerpt) > max_characters_per_section
        excerpt = excerpt[:max_characters_per_section]
        matched_heading = excerpt.splitlines()[0][:240] if excerpt else spec["name"]
        sections.append(
            {
                "section_name": spec["name"],
                "filing_type": filing.get("form") or raw_form,
                "filing_date": filing.get("filing_date"),
                "reporting_period": filing.get("report_date"),
                "accession_number": filing.get("accession_number"),
                "source_url": filing.get("filing_url"),
                "source_type": "SEC_FILING_TEXT",
                "extracted_text": excerpt,
                "extraction_confidence": "high" if len(excerpt) >= 2_000 else "medium",
                "character_range": {"start": start, "end": min(end, start + len(excerpt))},
                "document_anchor": matched_heading,
                "truncated": truncated,
            }
        )
    if form == "8-K" and not sections and text:
        sections.append(
            {
                "section_name": "8-K Material Update",
                "filing_type": filing.get("form") or raw_form,
                "filing_date": filing.get("filing_date"),
                "reporting_period": filing.get("report_date"),
                "accession_number": filing.get("accession_number"),
                "source_url": filing.get("filing_url"),
                "source_type": "SEC_FILING_TEXT",
                "extracted_text": text[:max_characters_per_section],
                "extraction_confidence": "low",
                "character_range": {"start": 0, "end": min(len(text), max_characters_per_section)},
                "document_anchor": "8-K filing body",
                "truncated": len(text) > max_characters_per_section,
            }
        )
    return sections


def extract_sections_from_filings(
    client: SECClient,
    filings: list[dict[str, Any]],
    *,
    max_filings: int = 4,
) -> tuple[list[dict[str, Any]], list[str]]:
    """Fetch and extract a bounded set of filings without making text analysis mandatory."""
    sections: list[dict[str, Any]] = []
    limitations: list[str] = []
    for filing in filings[:max_filings]:
        try:
            html = client.get_filing_html(filing)
            extracted = extract_filing_sections(html, filing)
            if extracted:
                sections.extend(extracted)
            else:
                limitations.append(
                    f"No configured sections were confidently extracted from {filing.get('form')} "
                    f"filed {filing.get('filing_date')}."
                )
        except SECClientError as exc:
            limitations.append(
                f"Filing text unavailable for {filing.get('form')} filed "
                f"{filing.get('filing_date')}: {exc}"
            )
    return sections, limitations
