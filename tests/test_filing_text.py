from __future__ import annotations

from src.filing_text_extractor import extract_filing_sections, html_to_text


def test_extract_10k_sections_with_provenance():
    html = """
    <html><body>
      <h2>Item 1. Business</h2><p>{business}</p>
      <h2>Item 1A. Risk Factors</h2><p>{risks}</p>
      <h2>Item 1B. Unresolved Staff Comments</h2>
      <h2>Item 7. Management's Discussion and Analysis</h2><p>{mda}</p>
      <h2>Item 7A. Quantitative and Qualitative Disclosures About Market Risk</h2><p>{market}</p>
      <h2>Item 8. Financial Statements</h2><p>{statements}</p>
      <h2>Item 9. Changes in and Disagreements</h2>
    </body></html>
    """.format(
        business="Business description " * 50,
        risks="Risk discussion " * 50,
        mda="Management analysis " * 50,
        market="Market risk analysis " * 50,
        statements="Financial statement discussion " * 50,
    )
    filing = {
        "form": "10-K",
        "base_form": "10-K",
        "filing_date": "2025-02-15",
        "report_date": "2024-12-31",
        "accession_number": "0000000000-25-000001",
        "filing_url": "https://www.sec.gov/example",
    }
    sections = extract_filing_sections(html, filing)
    names = {section["section_name"] for section in sections}
    assert "Item 1 - Business" in names
    assert "Item 1A - Risk Factors" in names
    assert "Item 7 - Management's Discussion and Analysis" in names
    assert all(section["accession_number"] == filing["accession_number"] for section in sections)
    assert all(section["character_range"]["end"] > section["character_range"]["start"] for section in sections)


def test_html_to_text_removes_scripts():
    text = html_to_text("<html><script>secret()</script><p>Visible text</p></html>")
    assert "Visible text" in text
    assert "secret" not in text
