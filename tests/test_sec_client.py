from __future__ import annotations

import json

from src.sec_client import SECClient


def test_ticker_to_cik_mapping(tmp_path):
    client = SECClient(cache_dir=tmp_path)
    client.get_ticker_mapping = lambda: {
        "AAPL": {"ticker": "AAPL", "title": "Apple Inc.", "cik_str": 320193}
    }
    assert client.ticker_to_company("aapl") == {
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "cik": "0000320193",
    }


def test_sec_url_construction():
    url = SECClient.filing_url(
        "0000320193", "0000320193-25-000079", "aapl-20250927.htm"
    )
    assert url == "https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm"
    assert SECClient.filing_index_json_url("0000320193", "0000320193-25-000079").endswith(
        "/000032019325000079/index.json"
    )


def test_filing_discovery_and_type_filters(submissions_aapl):
    filings = SECClient.discover_filings(submissions_aapl, ["10-Q", "8-K"])
    assert [filing["base_form"] for filing in filings] == ["10-Q", "8-K"]
    assert filings[0]["accession_number"] == "0000320193-25-000073"
    assert filings[0]["filing_url"].startswith("https://www.sec.gov/Archives/")


def test_filing_date_filter(submissions_aapl):
    filings = SECClient.discover_filings(
        submissions_aapl, ["10-K", "10-Q", "8-K"], start_date="2025-08-01"
    )
    assert {filing["base_form"] for filing in filings} == {"10-K", "10-Q"}


def test_amendment_detection(submissions_aapl):
    recent = submissions_aapl["filings"]["recent"]
    for key in recent:
        recent[key].append(recent[key][-1])
    recent["form"][-1] = "8-K/A"
    recent["accessionNumber"][-1] = "0000320193-25-000071"
    amendments = SECClient.discover_filings(submissions_aapl, ["8-K"])
    assert any(filing["is_amendment"] for filing in amendments)
    originals = SECClient.discover_filings(
        submissions_aapl, ["8-K"], include_amendments=False
    )
    assert all(not filing["is_amendment"] for filing in originals)


def test_cache_metadata_sidecar(tmp_path):
    client = SECClient(cache_dir=tmp_path, cache_ttl_seconds=3600)
    client._write_cache("fixture", {"ok": True}, url="https://www.sec.gov/example.json")
    assert client._read_cache("fixture") == {"ok": True}
    metadata = client.cache_metadata("fixture")
    assert metadata["exists"] and metadata["fresh"]
    assert metadata["url"] == "https://www.sec.gov/example.json"


def test_nvda_semiconductor_fixture_has_expected_filings(submissions_nvda):
    forms = {item["base_form"] for item in SECClient.discover_filings(submissions_nvda)}
    assert {"10-K", "10-Q"}.issubset(forms)


def test_jpm_bank_fixture_has_expected_filings(submissions_jpm):
    forms = {item["base_form"] for item in SECClient.discover_filings(submissions_jpm)}
    assert {"10-K", "10-Q"}.issubset(forms)
