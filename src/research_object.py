"""Build the single structured research object shared by narrative and exports."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

import pandas as pd

from src.citations import build_source_records, cite_summary, source_id_for_accession
from src.config_loader import load_config
from src.metrics_calculator import FORMULA_DEFINITIONS
from src.utils import clean_for_json, dataframe_records, utc_now_iso


RESEARCH_OBJECT_KEYS = (
    "report_metadata",
    "company_profile",
    "filings_used",
    "historical_annual_financials",
    "historical_quarterly_financials",
    "segment_analysis",
    "operating_kpis",
    "management_commentary",
    "risk_factors",
    "industry_analysis",
    "competitive_positioning",
    "forecast_assumptions",
    "forecast_financials",
    "valuation",
    "investment_thesis",
    "catalysts",
    "risks",
    "bull_case",
    "base_case",
    "bear_case",
    "charts",
    "tables",
    "sources",
    "qa_results",
    "limitations",
)


def empty_research_object() -> dict[str, Any]:
    """Return a complete empty object rather than incompatible partial schemas."""
    return {key: {} if key not in {"filings_used", "investment_thesis", "catalysts", "risks", "charts", "tables", "sources", "limitations"} else [] for key in RESEARCH_OBJECT_KEYS}


def _sector_profile(company: dict[str, Any]) -> dict[str, Any]:
    config = load_config("sectors").get("sectors", {})
    sic = str(company.get("sic") or "")
    description = str(company.get("sic_description") or "").lower()
    category = "general_operating_company"
    if sic.startswith(("60", "61", "62")) or "bank" in description:
        category = "bank"
    elif sic == "6798" or "real estate investment trust" in description or "reit" in description:
        category = "reit"
    elif sic.startswith("3674") or "semiconductor" in description:
        category = "semiconductor"
    elif sic.startswith(("737", "738")) or "software" in description:
        category = "software_saas"
    selected = deepcopy(config.get(category, {}))
    selected["category"] = category
    return selected


def _section_by_name(filing_sections: list[dict[str, Any]], fragment: str) -> dict[str, Any] | None:
    fragment = fragment.lower()
    return next(
        (section for section in filing_sections if fragment in str(section.get("section_name", "")).lower()),
        None,
    )


def _cited_limitation(text: str, source_id: str | None) -> str:
    return f"{text} [{source_id}]" if source_id else text


def build_research_object(
    *,
    company: dict[str, Any],
    filings: list[dict[str, Any]],
    annual_metrics: pd.DataFrame,
    quarterly_metrics: pd.DataFrame,
    normalized_facts: list[dict[str, Any]],
    summary: dict[str, str],
    summary_source: str,
    filing_sections: list[dict[str, Any]],
    forecast_assumptions: dict[str, Any],
    forecast_financials: dict[str, list[dict[str, Any]]],
    valuation: dict[str, Any],
    chart_metadata: list[dict[str, Any]] | None = None,
    limitations: list[str] | None = None,
) -> dict[str, Any]:
    """Assemble verified inputs into the one canonical report contract."""
    research = empty_research_object()
    sources = build_source_records(filings)
    latest_10k = next((filing for filing in filings if filing.get("base_form") == "10-K"), None)
    preferred_accession = latest_10k.get("accession_number") if latest_10k else None
    cited_summary = cite_summary(summary, sources, preferred_accession)
    source_id = source_id_for_accession(sources, preferred_accession)
    sector_profile = _sector_profile(company)
    business = _section_by_name(filing_sections, "business")
    risks = _section_by_name(filing_sections, "risk")
    mda = _section_by_name(filing_sections, "discussion and analysis") or _section_by_name(
        filing_sections, "md&a"
    )
    generated_at = utc_now_iso()
    annual_records = dataframe_records(annual_metrics, "fiscal_year")
    quarterly_records = dataframe_records(quarterly_metrics, "fiscal_quarter")
    latest_annual = annual_records[-1] if annual_records else {}

    research["report_metadata"] = {
        "report_type": "institutional-style research report",
        "report_version": "2.0",
        "generated_at": generated_at,
        "report_date": generated_at[:10],
        "data_cutoff": max((str(filing.get("filing_date") or "") for filing in filings), default=""),
        "currency": "USD",
        "quality_label": "Research Preview",
        "affiliation": "Independent software-generated analysis; no institutional affiliation or endorsement.",
    }
    research["company_profile"] = {
        **clean_for_json(company),
        "exchange": company.get("exchange") or "Data unavailable",
        "sector": company.get("sector") or sector_profile.get("category", "Data unavailable"),
        "industry": company.get("sic_description") or "Data unavailable",
        "business_model": _cited_limitation(
            "Filing section extracted; review the cited Item 1 source for the complete business description."
            if business
            else "Business-model text was not extracted.",
            source_id if business else None,
        ),
        "sector_support": sector_profile,
    }
    research["filings_used"] = clean_for_json(filings)
    research["historical_annual_financials"] = {
        "period_type": "Actual",
        "estimate_label": "A",
        "records": annual_records,
    }
    research["historical_quarterly_financials"] = {
        "period_type": "Actual",
        "estimate_label": "A",
        "records": quarterly_records,
    }
    research["segment_analysis"] = {
        "status": "Not disclosed" if not filing_sections else "Filing text available for review",
        "metrics": [],
        "limitation": "Automated segment XBRL dimension extraction is not yet implemented.",
    }
    research["operating_kpis"] = {
        "latest_actual": latest_annual,
        "sector_category": sector_profile.get("category"),
        "configured_kpis": sector_profile.get("kpis", []),
    }
    research["management_commentary"] = {
        "analytical_summary": cited_summary,
        "generation_source": summary_source,
        "filing_sections": [
            section
            for section in filing_sections
            if "discussion" in str(section.get("section_name", "")).lower()
            or "material update" in str(section.get("section_name", "")).lower()
        ],
        "guidance": "Not disclosed" if not mda else "Review cited filing excerpt; no numeric guidance is inferred.",
    }
    research["risk_factors"] = {
        "filing_sections": [
            section
            for section in filing_sections
            if "risk" in str(section.get("section_name", "")).lower()
        ],
        "status": "Available" if risks else "Insufficient public data",
    }
    research["industry_analysis"] = {
        "status": "Insufficient public data",
        "limitation": "No licensed external industry dataset is configured.",
    }
    research["competitive_positioning"] = {
        "status": "Insufficient public data",
        "limitation": "Competitive claims require cited filing or licensed third-party evidence.",
    }
    research["forecast_assumptions"] = clean_for_json(forecast_assumptions)
    research["forecast_financials"] = clean_for_json(forecast_financials)
    research["valuation"] = clean_for_json(valuation)
    thesis_sections = ("Executive Summary", "Financial Performance", "Cash Flow Quality")
    research["investment_thesis"] = [
        {"point": cited_summary[section], "type": "AI interpretation" if "OpenAI" in summary_source else "System-calculated interpretation"}
        for section in thesis_sections
        if cited_summary.get(section)
    ][:3]
    research["catalysts"] = [
        {
            "description": _cited_limitation(
                "No filing-backed catalyst was automatically identified from the selected filings.",
                source_id,
            ),
            "status": "Insufficient public data",
        }
    ]
    watch_points = cited_summary.get("Watch Points", "")
    research["risks"] = [
        {"description": watch_points or "Risk analysis unavailable.", "source_type": "System-calculated interpretation"}
    ]
    research["bull_case"] = clean_for_json(
        {
            "forecast": forecast_financials.get("bull", []),
            "valuation": valuation.get("scenarios", {}).get("bull", {}),
        }
    )
    research["base_case"] = clean_for_json(
        {
            "forecast": forecast_financials.get("base", []),
            "valuation": valuation.get("scenarios", {}).get("base", {}),
        }
    )
    research["bear_case"] = clean_for_json(
        {
            "forecast": forecast_financials.get("bear", []),
            "valuation": valuation.get("scenarios", {}).get("bear", {}),
        }
    )
    research["charts"] = chart_metadata or []
    research["tables"] = [
        {"id": "annual_financials", "source_ids": [source_id] if source_id else []},
        {"id": "quarterly_financials", "source_ids": [source["source_id"] for source in sources if source.get("filing_form") == "10-Q"]},
        {"id": "forecast_assumptions", "source_ids": []},
        {"id": "forecast_financials", "source_ids": []},
        {"id": "valuation_bridge", "source_ids": []},
        {"id": "sources", "source_ids": [source["source_id"] for source in sources]},
    ]
    research["sources"] = sources
    research["qa_results"] = {}
    research["limitations"] = list(dict.fromkeys(
        [
            *(limitations or []),
            "Forecasts are mechanical scenarios, not consensus estimates or investment recommendations.",
            "Valuation uses visible assumptions and does not include live market data unless the user supplies it.",
            "Banks, insurers, and REITs retain limited-support warnings until specialized extraction is fully tested.",
        ]
    ))
    research["calculation_definitions"] = FORMULA_DEFINITIONS
    research["normalized_fact_provenance"] = clean_for_json(normalized_facts)
    validate_research_object(research)
    return research


def validate_research_object(research: dict[str, Any]) -> None:
    """Fail early when a renderer would receive an incompatible report object."""
    missing = [key for key in RESEARCH_OBJECT_KEYS if key not in research]
    if missing:
        raise ValueError(f"Structured research object is missing keys: {', '.join(missing)}")
