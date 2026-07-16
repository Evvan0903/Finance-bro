from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from src.chart_generator import build_chart_metadata, generate_charts
from src.citations import build_source_records, cite_summary
from src.forecast_engine import build_forecast_assumptions, forecast_scenarios
from src.metrics_calculator import calculate_metrics
from src.report_generator import generate_pdf_report, generate_research_html_report
from src.report_qa import apply_qa_results, run_report_qa
from src.research_object import build_research_object
from src.valuation_engine import build_valuation_assumptions, calculate_valuation


@pytest.fixture
def report_bundle(tmp_path):
    raw = pd.DataFrame(
        {
            "revenue": [100.0, 120.0],
            "gross_profit": [40.0, 50.0],
            "operating_income": [20.0, 24.0],
            "pretax_income": [18.0, 22.0],
            "tax_expense": [3.6, 4.4],
            "net_income": [14.4, 17.6],
            "operating_cash_flow": [22.0, 27.0],
            "capex": [5.0, 6.0],
            "cash": [20.0, 22.0],
            "assets": [200.0, 220.0],
            "liabilities": [110.0, 120.0],
            "equity": [90.0, 100.0],
            "current_assets": [60.0, 66.0],
            "current_liabilities": [30.0, 33.0],
            "total_debt_reported": [50.0, 52.0],
            "diluted_shares": [10.0, 10.0],
            "depreciation_and_amortization": [4.0, 4.5],
        },
        index=pd.Index([2023, 2024], name="fiscal_year"),
    )
    annual = calculate_metrics(raw)
    quarterly_raw = raw.copy()
    quarterly_raw.index = pd.Index(["2024-Q2", "2024-Q3"], name="fiscal_quarter")
    quarterly = calculate_metrics(quarterly_raw, periodicity="quarterly")
    assumptions = build_forecast_assumptions(annual)
    forecasts = forecast_scenarios(annual, assumptions)
    valuation = calculate_valuation(
        forecasts, build_valuation_assumptions(annual), annual
    )
    filing = {
        "form": "10-K",
        "base_form": "10-K",
        "filing_date": "2025-02-15",
        "report_date": "2024-12-31",
        "accession_number": "0000000000-25-000001",
        "filing_url": "https://www.sec.gov/Archives/edgar/data/1/000000000025000001/example.htm",
        "source_type": "SEC_FILING",
    }
    sources = build_source_records([filing])
    summary = cite_summary(
        {
            "Executive Summary": "Revenue and cash flow increased in the latest period.",
            "Financial Performance": "Revenue growth remained positive.",
            "Profitability and Margin": "Operating margin remained positive.",
            "Balance Sheet and Liquidity": "Cash and debt are shown in the cited filing.",
            "Cash Flow Quality": "Free cash flow was positive.",
            "Watch Points": "Monitor revenue growth and cash conversion.",
        },
        sources,
        filing["accession_number"],
    )
    charts = generate_charts(annual, quarterly, forecasts, as_of_date="2024")
    chart_metadata = build_chart_metadata(charts, source_ids=["S1"], as_of_date="2024")
    provenance = [
        {
            "metric": "revenue",
            "value": 120.0,
            "period_kind": "annual",
            "fiscal_year": 2024,
            "fiscal_period": "FY",
            "unit": "USD",
            "currency": "USD",
            "source_type": "SEC_XBRL",
            "accession_number": filing["accession_number"],
            "source_url": filing["filing_url"],
            "taxonomy_tag": "RevenueFromContractWithCustomerExcludingAssessedTax",
        }
    ]
    research = build_research_object(
        company={
            "name": "Fixture Corp",
            "ticker": "FIX",
            "cik": "0000000001",
            "form": "10-K",
            "filing_date": "2025-02-15",
            "report_date": "2024-12-31",
            "accession_number": filing["accession_number"],
            "filing_url": filing["filing_url"],
            "sic": "3571",
            "sic_description": "Technology",
            "exchange": "Nasdaq",
        },
        filings=[filing],
        annual_metrics=annual,
        quarterly_metrics=quarterly,
        normalized_facts=provenance,
        summary=summary,
        summary_source="Rule-based summary",
        filing_sections=[],
        forecast_assumptions=assumptions,
        forecast_financials=forecasts,
        valuation=valuation,
        chart_metadata=chart_metadata,
        limitations=[],
    )
    qa = run_report_qa(research, annual_metrics=annual, quarterly_metrics=quarterly)
    apply_qa_results(research, qa)
    return research, charts, qa, tmp_path


def test_baseline_chart_keys_and_source_footnotes(report_bundle):
    _, charts, _, _ = report_bundle
    assert {"revenue", "net_income", "margins", "cash_debt", "cash_flow"}.issubset(charts)
    assert all("Source:" in figure.layout.annotations[0].text for figure in charts.values())
    assert "forecast_revenue" in charts


def test_html_renders_ten_sections_and_citations(report_bundle):
    research, charts, _, _ = report_bundle
    html = generate_research_html_report(research, charts)
    assert "Institutional-Style Equity Research Report" in html
    assert "Section 10" in html
    assert "Forecast and Scenarios" in html
    assert "Valuation Assessment" in html
    assert "[S1]" in html
    assert "plotly.js" in html


def test_qa_runs_and_scores(report_bundle):
    _, _, qa, _ = report_bundle
    assert qa["maximum_score"] == 100
    assert qa["citation_validation"]["coverage"] >= 0.85
    assert qa["citation_validation"]["passed"] is True
    assert qa["citation_validation"]["minimum_required_coverage"] == pytest.approx(0.85)
    assert not qa["critical_errors"]


def test_pdf_renders_structurally(report_bundle):
    pypdf = pytest.importorskip("pypdf")
    pytest.importorskip("reportlab")
    research, _, _, tmp_path = report_bundle
    path = generate_pdf_report(research, tmp_path / "fixture.pdf", charts=None)
    reader = pypdf.PdfReader(str(path))
    assert len(reader.pages) >= 3
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    assert "Institutional-Style Equity Research Report" in text
    assert "Appendix and Sources" in text
