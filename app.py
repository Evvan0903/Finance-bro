"""Streamlit orchestration for source-backed institutional-style equity research."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd
import streamlit as st
from dotenv import load_dotenv

from src.chart_generator import build_chart_metadata, generate_charts
from src.citations import build_source_records
from src.filing_text_extractor import extract_sections_from_filings
from src.forecast_engine import build_forecast_assumptions, forecast_scenarios
from src.llm_summary import generate_summary
from src.metrics_calculator import calculate_metrics, latest_kpis
from src.report_generator import (
    PDFExportError,
    generate_html_report,
    generate_pdf_report,
)
from src.report_qa import apply_qa_results, run_report_qa
from src.research_object import build_research_object
from src.sec_client import SECClient, SECClientError
from src.utils import (
    PDF_OUTPUTS_DIR,
    REPORTS_DIR,
    clean_for_json,
    ensure_directories,
    format_currency,
    format_percent,
    format_ratio,
)
from src.valuation_engine import (
    ValuationError,
    build_valuation_assumptions,
    calculate_valuation,
)
from src.xbrl_mapper import extract_financial_metrics_with_provenance


DISCLAIMER = (
    "This institutional-style research report is generated from public filings and visible "
    "assumptions for educational and analytical purposes only. It is not investment advice, "
    "and it is not affiliated with or endorsed by any financial institution."
)


def escape_streamlit_markdown(text: str) -> str:
    """Keep currency symbols from being interpreted as inline math."""
    return text.replace("$", r"\$")


def is_generic_template_warning(submissions: dict) -> bool:
    """Conservatively identify issuers requiring tested sector-specific accounting logic."""
    sic = str(submissions.get("sic", ""))
    description = str(submissions.get("sicDescription", "")).lower()
    keywords = ("bank", "insurance", "reit", "real estate investment trust")
    return sic.startswith("6") or any(keyword in description for keyword in keywords)


def _filings_for_scope(submissions: dict[str, Any], scope: str) -> list[dict[str, Any]]:
    forms_by_scope = {
        "annual": ["10-K"],
        "annual_and_quarterly": ["10-K", "10-Q"],
        "full": ["10-K", "10-Q", "8-K", "S-1", "424B4"],
    }
    discovered = SECClient.discover_filings(
        submissions, forms_by_scope.get(scope, forms_by_scope["annual_and_quarterly"])
    )
    limits = {"10-K": 2, "10-Q": 8, "8-K": 4, "S-1": 2, "424B4": 2}
    selected: list[dict[str, Any]] = []
    counts: dict[str, int] = {}
    cik = str(submissions.get("cik", "")).zfill(10)
    for filing in discovered:
        base_form = str(filing.get("base_form"))
        if counts.get(base_form, 0) >= limits.get(base_form, 1):
            continue
        filing["cik"] = cik
        selected.append(filing)
        counts[base_form] = counts.get(base_form, 0) + 1
    return selected


def _filings_for_text(filings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    for form in ("10-K", "10-Q", "8-K", "S-1", "424B4"):
        match = next((filing for filing in filings if filing.get("base_form") == form), None)
        if match:
            selected.append(match)
    return selected[:4]


def build_report(
    ticker: str,
    *,
    filing_scope: str = "annual_and_quarterly",
    include_filing_text: bool = False,
    forecast_years: int = 3,
    forecast_overrides: dict[str, dict[str, float]] | None = None,
    valuation_inputs: dict[str, Any] | None = None,
    create_pdf: bool = False,
) -> dict[str, Any]:
    """Run the staged SEC retrieval, calculation, narrative, QA, and export pipeline."""
    client = SECClient()
    statuses: dict[str, dict[str, Any]] = {}
    company = client.ticker_to_company(ticker)
    statuses["company_identified"] = {"passed": True, "detail": f"{company['name']} ({company['ticker']})"}
    submissions = client.get_submissions(company["cik"])
    statuses["submissions_retrieved"] = {"passed": True, "detail": "SEC submissions retrieved"}
    filing = client.latest_10k(submissions)
    filings = _filings_for_scope(submissions, filing_scope)
    if not any(item.get("accession_number") == filing.get("accession_number") for item in filings):
        filing["cik"] = company["cik"]
        filings.insert(0, filing)
    company.update(filing)
    company["sic"] = submissions.get("sic", "Data unavailable")
    company["sic_description"] = submissions.get("sicDescription", "Data unavailable")
    exchanges = submissions.get("exchanges") or []
    company["exchange"] = exchanges[0] if exchanges else "Data unavailable"
    company["sector"] = "Data unavailable"

    company_facts = client.get_company_facts(company["cik"])
    annual_financials, quarterly_financials, normalized_facts = (
        extract_financial_metrics_with_provenance(company_facts, years=5, quarters=12)
    )
    if annual_financials.empty:
        raise SECClientError("No usable annual 10-K XBRL facts were found for this company.")
    annual_metrics = calculate_metrics(annual_financials, valuation_inputs, periodicity="annual")
    quarterly_metrics = (
        calculate_metrics(quarterly_financials, periodicity="quarterly")
        if filing_scope != "annual" and not quarterly_financials.empty
        else pd.DataFrame()
    )
    statuses["xbrl_normalized"] = {
        "passed": True,
        "detail": f"{len(annual_metrics)} annual and {len(quarterly_metrics)} quarterly periods",
    }
    statuses["metrics_calculated"] = {"passed": True, "detail": "Deterministic metrics calculated"}

    filing_sections: list[dict[str, Any]] = []
    limitations: list[str] = []
    if include_filing_text:
        filing_sections, text_limitations = extract_sections_from_filings(
            client, _filings_for_text(filings), max_filings=4
        )
        limitations.extend(text_limitations)
        statuses["filing_text_extracted"] = {
            "passed": bool(filing_sections),
            "detail": f"{len(filing_sections)} filing sections extracted" if filing_sections else "No filing sections extracted",
        }
    else:
        limitations.append("Filing-text extraction was not requested for this run.")
        statuses["filing_text_extracted"] = {"passed": False, "detail": "Optional step not requested"}

    forecast_assumptions = build_forecast_assumptions(
        annual_metrics,
        forecast_years=forecast_years,
        user_overrides=forecast_overrides,
    )
    forecast_financials = forecast_scenarios(annual_metrics, forecast_assumptions)
    statuses["forecast_completed"] = {
        "passed": bool(forecast_financials.get("base")),
        "detail": "Bull/base/bear mechanical scenarios calculated",
    }
    try:
        valuation_assumptions = build_valuation_assumptions(annual_metrics, valuation_inputs)
        valuation = calculate_valuation(forecast_financials, valuation_assumptions, annual_metrics)
        valuation_passed = valuation.get("scenarios", {}).get("base", {}).get("status") == "Calculated"
        statuses["valuation_completed"] = {
            "passed": valuation_passed,
            "detail": "DCF calculated; per-share output requires diluted shares" if valuation_passed else "Valuation inputs were insufficient",
        }
    except ValuationError as exc:
        valuation = {
            "title": "Valuation Assessment",
            "research_view": "No Buy, Hold, or Sell rating is generated.",
            "scenarios": {},
            "model_implied_value_range": {"low": None, "high": None},
            "limitations": [str(exc)],
        }
        limitations.append(str(exc))
        statuses["valuation_completed"] = {"passed": False, "detail": str(exc)}

    summary, summary_source = generate_summary(annual_metrics, company, filing_sections)
    charts = generate_charts(
        annual_metrics,
        quarterly_metrics,
        forecast_financials,
        as_of_date=str(annual_metrics.index[-1]),
    )
    provisional_sources = build_source_records(filings)
    source_ids = [source["source_id"] for source in provisional_sources]
    chart_metadata = build_chart_metadata(
        charts, source_ids=source_ids, as_of_date=str(annual_metrics.index[-1])
    )
    research_object = build_research_object(
        company=company,
        filings=filings,
        annual_metrics=annual_metrics,
        quarterly_metrics=quarterly_metrics,
        normalized_facts=normalized_facts,
        summary=summary,
        summary_source=summary_source,
        filing_sections=filing_sections,
        forecast_assumptions=forecast_assumptions,
        forecast_financials=forecast_financials,
        valuation=valuation,
        chart_metadata=chart_metadata,
        limitations=limitations,
    )
    qa_results = run_report_qa(
        research_object,
        annual_metrics=annual_metrics,
        quarterly_metrics=quarterly_metrics,
    )
    apply_qa_results(research_object, qa_results)
    statuses["citations_validated"] = {
        "passed": qa_results["citation_validation"]["passed"],
        "detail": f"Coverage {qa_results['citation_validation']['coverage']:.0%}",
    }
    statuses["qa_completed"] = {
        "passed": not qa_results["critical_errors"],
        "detail": f"{qa_results['quality_label']} · {qa_results['overall_score']}/100",
    }
    html_report = generate_html_report(
        company, annual_metrics, charts, summary, research_object=research_object
    )
    pdf_path: Path | None = None
    pdf_error: str | None = None
    if create_pdf:
        try:
            pdf_path = generate_pdf_report(research_object, charts=charts)
        except PDFExportError as exc:
            pdf_error = str(exc)
            research_object["limitations"].append(pdf_error)
    statuses["export_ready"] = {
        "passed": True,
        "detail": "HTML ready" + ("; PDF ready" if pdf_path else "; PDF optional/unavailable"),
    }
    return {
        "company": company,
        "metrics": annual_metrics,
        "quarterly_metrics": quarterly_metrics,
        "normalized_facts": normalized_facts,
        "filings": filings,
        "filing_sections": filing_sections,
        "charts": charts,
        "summary": research_object["management_commentary"]["analytical_summary"],
        "summary_source": summary_source,
        "forecast_assumptions": forecast_assumptions,
        "forecast_financials": forecast_financials,
        "valuation": valuation,
        "research_object": research_object,
        "qa_results": qa_results,
        "html_report": html_report,
        "pdf_path": pdf_path,
        "pdf_error": pdf_error,
        "statuses": statuses,
        "show_industry_warning": is_generic_template_warning(submissions),
    }


def display_overview(company: dict) -> None:
    """Display filing and company metadata."""
    st.subheader("Company Overview")
    left, right = st.columns(2)
    with left:
        st.write(f"**Company name:** {company['name']}")
        st.write(f"**Ticker:** {company['ticker']}")
        st.write(f"**CIK:** {company['cik']}")
        st.write(f"**Industry:** {company['sic_description']}")
    with right:
        st.write(f"**Latest filing type:** {company['form']}")
        st.write(f"**Filing date:** {company['filing_date']}")
        st.write(f"**Report date:** {company['report_date']}")
        st.link_button("Open SEC filing", company["filing_url"])


def display_kpis(metrics: pd.DataFrame) -> None:
    """Display the latest annual KPI cards."""
    kpis = latest_kpis(metrics)
    first_row = st.columns(4)
    first_row[0].metric("Revenue", format_currency(kpis.get("revenue")))
    first_row[1].metric("Net Income", format_currency(kpis.get("net_income")))
    first_row[2].metric("Net Margin", format_percent(kpis.get("net_margin")))
    first_row[3].metric("Free Cash Flow", format_currency(kpis.get("free_cash_flow")))
    second_row = st.columns(4)
    second_row[0].metric("Cash", format_currency(kpis.get("cash")))
    second_row[1].metric("Total Debt", format_currency(kpis.get("total_debt")))
    second_row[2].metric("Current Ratio", format_ratio(kpis.get("current_ratio")))
    second_row[3].metric("ROIC", format_percent(kpis.get("return_on_invested_capital")))


def _display_statuses(statuses: dict[str, dict[str, Any]]) -> None:
    st.subheader("Report Workflow Status")
    columns = st.columns(4)
    labels = {
        "company_identified": "Company identified",
        "submissions_retrieved": "SEC submissions retrieved",
        "xbrl_normalized": "XBRL normalized",
        "filing_text_extracted": "Filing text extracted",
        "metrics_calculated": "Metrics calculated",
        "forecast_completed": "Forecast completed",
        "valuation_completed": "Valuation completed",
        "citations_validated": "Citations validated",
        "qa_completed": "QA completed",
        "export_ready": "Export ready",
    }
    for index, (key, status) in enumerate(statuses.items()):
        icon = "✅" if status["passed"] else "⚠️"
        columns[index % 4].markdown(f"{icon} **{labels.get(key, key)}**  \n{status['detail']}")


def display_report(result: dict) -> None:
    """Render a completed report while preserving the five baseline chart keys."""
    company = result["company"]
    metrics = result["metrics"]
    charts = result["charts"]
    research = result["research_object"]
    if result["show_industry_warning"]:
        st.warning(
            "This issuer has limited specialized-sector support. Bank, insurer, and REIT metrics "
            "remain incomplete until sector-specific extraction and reconciliation tests pass."
        )
    _display_statuses(result["statuses"])
    display_kpis(metrics)
    tabs = st.tabs(
        ["Dashboard", "Financials", "Filing Insights", "Forecast & Valuation", "QA & Export"]
    )
    with tabs[0]:
        display_overview(company)
        st.subheader("Three-Point Research View")
        for item in research["investment_thesis"]:
            st.info(escape_streamlit_markdown(item["point"]))
        left, right = st.columns(2)
        left.plotly_chart(charts["revenue"], width="stretch")
        right.plotly_chart(charts["net_income"], width="stretch")
        st.plotly_chart(charts["margins"], width="stretch")
        left, right = st.columns(2)
        left.plotly_chart(charts["cash_debt"], width="stretch")
        right.plotly_chart(charts["cash_flow"], width="stretch")
        for key in ("free_cash_flow", "quarterly_revenue", "forecast_revenue"):
            if key in charts:
                st.plotly_chart(charts[key], width="stretch")
    with tabs[1]:
        st.subheader("Annual Actuals (A)")
        st.dataframe(metrics.sort_index(ascending=False), width="stretch")
        st.subheader("Quarterly Actuals (A)")
        if result["quarterly_metrics"].empty:
            st.info("Quarterly data unavailable for the selected scope.")
        else:
            st.dataframe(result["quarterly_metrics"].sort_index(ascending=False), width="stretch")
        st.subheader("Analytical Narrative")
        st.caption(result["summary_source"])
        for section, text in result["summary"].items():
            st.markdown(f"**{section}**")
            st.write(escape_streamlit_markdown(text))
    with tabs[2]:
        if not result["filing_sections"]:
            st.info("No filing-text sections were extracted for this run.")
        for section in result["filing_sections"]:
            with st.expander(
                f"{section['filing_type']} · {section['section_name']} · {section['filing_date']}"
            ):
                st.caption(
                    f"Accession {section['accession_number']} · confidence {section['extraction_confidence']}"
                )
                st.write(section["extracted_text"][:5_000])
                st.link_button("Open source filing", section["source_url"])
    with tabs[3]:
        st.subheader("Visible Forecast Assumptions")
        assumption_rows = []
        for scenario, assumptions in result["forecast_assumptions"]["scenarios"].items():
            for name, payload in assumptions.items():
                assumption_rows.append(
                    {
                        "Scenario": scenario.title(),
                        "Assumption": name,
                        "Value": payload["value"],
                        "Source": payload["source"],
                    }
                )
        st.dataframe(pd.DataFrame(assumption_rows), width="stretch")
        st.subheader("Forecast Financials (E)")
        forecast_rows = [row for rows in result["forecast_financials"].values() for row in rows]
        st.dataframe(pd.DataFrame(forecast_rows), width="stretch")
        st.subheader("Valuation Assessment")
        st.write(result["valuation"].get("research_view"))
        st.json(clean_for_json(result["valuation"].get("model_implied_value_range", {})))
        st.caption("No Buy, Hold, or Sell rating is generated.")
    with tabs[4]:
        qa = result["qa_results"]
        st.metric("QA Score", f"{qa['overall_score']}/100", qa["quality_label"])
        st.dataframe(pd.DataFrame(qa["checks"]), width="stretch")
        st.subheader("Limitations")
        for limitation in research["limitations"]:
            st.warning(limitation)
        st.download_button(
            "Download HTML Report",
            data=result["html_report"],
            file_name=f"{company['ticker']}_SEC_financial_report.html",
            mime="text/html",
            type="primary",
        )
        st.download_button(
            "Download Structured Report JSON",
            data=json.dumps(clean_for_json(research), indent=2),
            file_name=f"{company['ticker']}_structured_report.json",
            mime="application/json",
        )
        st.download_button(
            "Download QA Summary JSON",
            data=json.dumps(clean_for_json(qa), indent=2),
            file_name=f"{company['ticker']}_qa_summary.json",
            mime="application/json",
        )
        if result["pdf_path"] and Path(result["pdf_path"]).exists():
            st.download_button(
                "Download PDF Report",
                data=Path(result["pdf_path"]).read_bytes(),
                file_name=Path(result["pdf_path"]).name,
                mime="application/pdf",
            )
        elif result["pdf_error"]:
            st.info(result["pdf_error"])
        st.caption(DISCLAIMER)


def main() -> None:
    """Configure and run the incremental Streamlit workflow."""
    load_dotenv()
    ensure_directories()
    st.set_page_config(page_title="SEC Financial Report Agent", page_icon="📊", layout="wide")
    st.title("SEC Financial Report Agent")
    st.write(
        "Generate a source-backed institutional-style research report from SEC filings, "
        "transparent scenarios, and reproducible calculations."
    )
    with st.form("ticker_form"):
        ticker = st.text_input("U.S. public-company ticker", value="AAPL", max_chars=12).strip().upper()
        filing_scope_label = st.selectbox(
            "Filing scope",
            ["Annual + quarterly", "Annual only", "Full SEC scope"],
        )
        include_filing_text = st.checkbox("Extract filing text (slower; requires filing HTML)", value=False)
        create_pdf = st.checkbox("Create PDF export", value=True)
        with st.expander("Optional forecast and valuation assumptions"):
            use_forecast_override = st.checkbox("Override base-case forecast assumptions")
            base_growth = st.number_input("Base revenue growth (%)", value=5.0, step=0.5)
            base_margin = st.number_input("Base operating margin (%)", value=20.0, step=0.5)
            discount_rate = st.number_input("DCF discount rate (%)", value=9.0, step=0.25)
            terminal_growth = st.number_input("Terminal growth rate (%)", value=2.5, step=0.25)
            share_price = st.number_input("Current share price (optional user input)", value=0.0, min_value=0.0)
            diluted_shares = st.number_input("Diluted shares (optional user input)", value=0.0, min_value=0.0)
        submitted = st.form_submit_button("Generate Research Report", type="primary")

    if submitted:
        if not ticker:
            st.error("Enter a ticker before generating a report.")
            return
        scope = {
            "Annual only": "annual",
            "Annual + quarterly": "annual_and_quarterly",
            "Full SEC scope": "full",
        }[filing_scope_label]
        overrides = (
            {"base": {"revenue_growth": base_growth / 100, "operating_margin": base_margin / 100}}
            if use_forecast_override
            else None
        )
        valuation_inputs = {
            "discount_rate": discount_rate / 100,
            "terminal_growth_rate": terminal_growth / 100,
        }
        if share_price > 0:
            valuation_inputs["share_price"] = share_price
        if diluted_shares > 0:
            valuation_inputs["diluted_shares"] = diluted_shares
        try:
            with st.spinner(f"Retrieving SEC data and analyzing {ticker}..."):
                result = build_report(
                    ticker,
                    filing_scope=scope,
                    include_filing_text=include_filing_text,
                    forecast_overrides=overrides,
                    valuation_inputs=valuation_inputs,
                    create_pdf=create_pdf,
                )
                report_path = REPORTS_DIR / f"{ticker}_SEC_financial_report.html"
                report_path.write_text(result["html_report"], encoding="utf-8")
                st.session_state["report_result"] = result
        except SECClientError as exc:
            st.error(str(exc))
            return
        except Exception as exc:
            st.exception(exc)
            return
    if "report_result" in st.session_state:
        display_report(st.session_state["report_result"])


if __name__ == "__main__":
    main()
