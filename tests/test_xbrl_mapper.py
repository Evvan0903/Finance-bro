from __future__ import annotations

from copy import deepcopy

from src.xbrl_mapper import (
    extract_financial_metrics,
    extract_financial_metrics_with_provenance,
    extract_quarterly_financial_metrics,
)


def test_annual_comparatives_do_not_collapse_under_filing_fy(company_facts_fixture):
    annual = extract_financial_metrics(company_facts_fixture, years=5)
    assert list(annual.index) == [2022, 2023, 2024]
    assert annual["revenue"].to_dict() == {2022: 80.0, 2023: 100.0, 2024: 120.0}


def test_quarterly_selects_discrete_not_ytd(company_facts_fixture):
    quarterly = extract_quarterly_financial_metrics(company_facts_fixture)
    assert quarterly.loc["2025-Q1", "revenue"] == 30
    assert quarterly.loc["2025-Q2", "revenue"] == 40


def test_quarterly_derives_from_ytd_when_direct_missing(company_facts_fixture):
    fixture = deepcopy(company_facts_fixture)
    facts = fixture["facts"]["us-gaap"]["RevenueFromContractWithCustomerExcludingAssessedTax"]["units"]["USD"]
    facts[:] = [fact for fact in facts if fact.get("frame") != "CY2025Q2"]
    quarterly = extract_quarterly_financial_metrics(fixture)
    assert quarterly.loc["2025-Q2", "revenue"] == 40
    provenance = quarterly.attrs["provenance"]
    derived = next(record for record in provenance if record["metric"] == "revenue" and record["fiscal_period"] == "Q2")
    assert derived["source_type"] == "SYSTEM_CALCULATION"
    assert "derived_from_year_to_date" in derived["ambiguity_flags"]


def test_provenance_contains_required_fields(company_facts_fixture):
    _, _, records = extract_financial_metrics_with_provenance(company_facts_fixture)
    record = next(item for item in records if item["metric"] == "revenue")
    required = {
        "metric",
        "value",
        "unit",
        "period_start",
        "period_end",
        "fiscal_year",
        "fiscal_period",
        "form",
        "filing_date",
        "accession_number",
        "source_url",
        "source_type",
        "taxonomy_tag",
        "retrieved_at",
        "confidence",
        "ambiguity_flags",
    }
    assert required.issubset(record)
