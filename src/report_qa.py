"""Cross-report integrity, citation, calculation, and policy quality assurance."""

from __future__ import annotations

import json
import re
from typing import Any

import numpy as np
import pandas as pd

from src.citations import validate_citation_markers
from src.config_loader import load_config


def _check(check_id: str, passed: bool, message: str, severity: str = "error") -> dict[str, Any]:
    return {
        "check_id": check_id,
        "passed": bool(passed),
        "severity": "info" if passed else severity,
        "message": message,
    }


def _close(left: Any, right: Any, tolerance: float) -> bool:
    try:
        left_f = float(left)
        right_f = float(right)
        scale = max(abs(left_f), abs(right_f), 1.0)
        return np.isfinite(left_f) and np.isfinite(right_f) and abs(left_f - right_f) <= scale * tolerance
    except (TypeError, ValueError):
        return False


def _text_corpus(research: dict[str, Any]) -> list[str]:
    summary = research.get("management_commentary", {}).get("analytical_summary", {})
    texts = [str(value) for value in summary.values() if value]
    texts.extend(
        str(item.get("point") or item.get("description") or "")
        for key in ("investment_thesis", "catalysts", "risks")
        for item in research.get(key, [])
        if isinstance(item, dict)
    )
    return [text for text in texts if text]


def run_report_qa(
    research: dict[str, Any],
    *,
    annual_metrics: pd.DataFrame | None = None,
    quarterly_metrics: pd.DataFrame | None = None,
) -> dict[str, Any]:
    """Run all cross-report checks and return transparent component scores."""
    config = load_config("qa")
    schema = load_config("schema")
    thresholds = config.get("thresholds", {})
    balance_tolerance = float(thresholds.get("balance_sheet_relative_tolerance", 0.02))
    dcf_tolerance = float(thresholds.get("dcf_relative_tolerance", 0.001))
    annual = annual_metrics if annual_metrics is not None else pd.DataFrame()
    quarterly = quarterly_metrics if quarterly_metrics is not None else pd.DataFrame()
    checks: list[dict[str, Any]] = []

    missing_keys = [key for key in schema.get("required_object_keys", []) if key not in research]
    checks.append(_check("structured_object_schema", not missing_keys, f"Missing keys: {missing_keys}" if missing_keys else "All required structured-object keys are present.", "critical"))

    balance_rows = 0
    balance_failures: list[str] = []
    if not annual.empty:
        for period, row in annual.iterrows():
            if all(pd.notna(row.get(field)) for field in ("assets", "liabilities", "equity")):
                balance_rows += 1
                if not _close(row["assets"], row["liabilities"] + row["equity"], balance_tolerance):
                    balance_failures.append(str(period))
    checks.append(
        _check(
            "balance_sheet_reconciliation",
            not balance_failures,
            "No comparable balance-sheet rows were available."
            if balance_rows == 0
            else (
                "Assets reconcile to liabilities plus equity within tolerance."
                if not balance_failures
                else f"Balance sheet did not reconcile for: {', '.join(balance_failures)}"
            ),
            "error",
        )
    )

    segment_tolerance = float(
        thresholds.get("segment_reconciliation_relative_tolerance", 0.02)
    )
    segment_rows = [
        item
        for item in research.get("segment_analysis", {}).get("metrics", [])
        if isinstance(item, dict)
        and item.get("segment_total") is not None
        and item.get("consolidated_total") is not None
    ]
    segment_failures = [
        str(item.get("metric") or item.get("period") or "segment total")
        for item in segment_rows
        if not _close(
            item.get("segment_total"),
            item.get("consolidated_total"),
            segment_tolerance,
        )
    ]
    checks.append(
        _check(
            "segment_reconciliation",
            not segment_failures,
            "Segment totals were unavailable; segment reconciliation was not applicable."
            if not segment_rows
            else (
                "Available segment totals reconcile within tolerance."
                if not segment_failures
                else f"Segment totals did not reconcile for: {', '.join(segment_failures)}"
            ),
        )
    )

    annual_periods_valid = annual.empty or not any("Q" in str(index) for index in annual.index)
    quarterly_periods_valid = quarterly.empty or all("Q" in str(index) for index in quarterly.index)
    checks.append(_check("period_separation", annual_periods_valid and quarterly_periods_valid, "Annual and quarterly periods are visibly separated." if annual_periods_valid and quarterly_periods_valid else "Annual and quarterly periods appear mixed."))

    historical_actual = all(
        payload.get("period_type") == "Actual" and payload.get("estimate_label") == "A"
        for payload in (
            research.get("historical_annual_financials", {}),
            research.get("historical_quarterly_financials", {}),
        )
    )
    forecast_rows = [
        row
        for rows in research.get("forecast_financials", {}).values()
        for row in rows
        if isinstance(row, dict)
    ]
    forecast_estimates = all(
        row.get("period_type") == "Forecast" and row.get("estimate_label") == "E"
        for row in forecast_rows
    )
    checks.append(
        _check(
            "historical_forecast_separation",
            historical_actual and forecast_estimates,
            "Historical actuals (A) and forecast estimates (E) are explicitly separated."
            if historical_actual and forecast_estimates
            else "Historical and forecast labels are incomplete or mixed.",
        )
    )

    provenance = research.get("normalized_fact_provenance", [])
    units_consistent = all(record.get("unit") for record in provenance)
    currencies = {record.get("currency") for record in provenance if record.get("currency")}
    checks.append(_check("unit_consistency", units_consistent, "Every normalized fact has a unit." if units_consistent else "At least one normalized fact lacks a unit."))
    checks.append(_check("currency_consistency", len(currencies) <= 1, f"Currencies present: {sorted(currencies)}" if currencies else "No currency-denominated facts were available."))
    fact_keys = [
        (record.get("metric"), record.get("period_kind"), record.get("fiscal_year"), record.get("fiscal_period"))
        for record in provenance
    ]
    checks.append(_check("duplicate_fact_resolution", len(fact_keys) == len(set(fact_keys)), "Normalized metric-period facts are unique." if len(fact_keys) == len(set(fact_keys)) else "Duplicate normalized metric-period facts remain."))
    provenance_complete = all(
        record.get("value") is not None
        and record.get("unit")
        and (
            record.get("source_type") != "SEC_XBRL"
            or (
                record.get("accession_number")
                and record.get("source_url")
                and record.get("taxonomy_tag")
            )
        )
        for record in provenance
    )
    checks.append(
        _check(
            "fact_provenance",
            provenance_complete,
            "Normalized facts retain values, units, and required SEC provenance."
            if provenance_complete
            else "At least one normalized fact lacks required provenance.",
            "critical",
        )
    )

    calculation_failures: list[str] = []
    percentage_failures: list[str] = []
    ratio_formulas = {
        "gross_margin": ("gross_profit", "revenue"),
        "operating_margin": ("operating_income", "revenue"),
        "net_margin": ("net_income", "revenue"),
        "ocf_margin": ("operating_cash_flow", "revenue"),
        "free_cash_flow_margin": ("free_cash_flow", "revenue"),
        "capex_intensity": ("capex", "revenue"),
        "research_and_development_intensity": ("research_and_development", "revenue"),
        "sales_and_marketing_intensity": ("sales_and_marketing", "revenue"),
        "stock_based_compensation_intensity": ("stock_based_compensation", "revenue"),
        "effective_tax_rate": ("tax_expense", "pretax_income"),
    }
    if not annual.empty:
        for period, row in annual.iterrows():
            if pd.notna(row.get("total_debt")) and pd.notna(row.get("cash")) and pd.notna(row.get("net_debt")):
                if not _close(row["net_debt"], row["total_debt"] - row["cash"], 1e-9):
                    calculation_failures.append(f"net debt {period}")
            if pd.notna(row.get("operating_cash_flow")) and pd.notna(row.get("capex")) and pd.notna(row.get("free_cash_flow")):
                if not _close(row["free_cash_flow"], row["operating_cash_flow"] - abs(row["capex"]), 1e-9):
                    calculation_failures.append(f"free cash flow {period}")
            if pd.notna(row.get("market_cap")) and pd.notna(row.get("net_debt")) and pd.notna(row.get("enterprise_value")):
                if not _close(row["enterprise_value"], row["market_cap"] + row["net_debt"], 1e-9):
                    calculation_failures.append(f"enterprise value {period}")
            for metric, (numerator, denominator) in ratio_formulas.items():
                if all(pd.notna(row.get(field)) for field in (metric, numerator, denominator)):
                    denominator_value = float(row[denominator])
                    if denominator_value == 0:
                        percentage_failures.append(f"{metric} {period} has a zero denominator")
                        continue
                    expected = abs(float(row[numerator])) / denominator_value if metric == "capex_intensity" else float(row[numerator]) / denominator_value
                    if not _close(row[metric], expected, 1e-9):
                        percentage_failures.append(f"{metric} {period}")
    checks.append(_check("calculation_reconciliation", not calculation_failures, "Net debt, free cash flow, and enterprise value reconcile." if not calculation_failures else f"Calculation failures: {', '.join(calculation_failures)}", "critical"))
    checks.append(
        _check(
            "percentage_scaling",
            not percentage_failures,
            "Calculated percentages use decimal scaling and reconcile to their inputs."
            if not percentage_failures
            else f"Percentage scaling failures: {', '.join(percentage_failures)}",
        )
    )

    dcf_failures: list[str] = []
    for scenario, result in research.get("valuation", {}).get("scenarios", {}).items():
        if result.get("status") != "Calculated":
            continue
        expected_ev = float(result.get("present_value_forecast_cash_flows", 0)) + float(
            result.get("present_value_terminal_value", 0)
        )
        if not _close(result.get("enterprise_value"), expected_ev, dcf_tolerance):
            dcf_failures.append(scenario)
        equity = result.get("equity_value")
        net_debt = result.get("net_debt")
        if equity is not None and net_debt is not None and not _close(
            equity, float(result["enterprise_value"]) - float(net_debt), dcf_tolerance
        ):
            dcf_failures.append(f"{scenario} equity bridge")
    checks.append(_check("dcf_reconciliation", not dcf_failures, "DCF components reconcile." if not dcf_failures else f"DCF failures: {', '.join(dcf_failures)}", "critical"))

    unsupported_valuation: list[str] = []
    for scenario, result in research.get("valuation", {}).get("scenarios", {}).items():
        if result.get("status") != "Calculated":
            continue
        required = (
            "discount_rate",
            "terminal_growth_rate",
            "present_value_forecast_cash_flows",
            "present_value_terminal_value",
            "enterprise_value",
        )
        if any(result.get(field) is None for field in required):
            unsupported_valuation.append(f"{scenario} missing required DCF fields")
        elif float(result["discount_rate"]) <= float(result["terminal_growth_rate"]):
            unsupported_valuation.append(f"{scenario} discount rate does not exceed terminal growth")
        if result.get("implied_value_per_share") is not None and any(
            result.get(field) is None for field in ("equity_value", "diluted_shares", "net_debt")
        ):
            unsupported_valuation.append(f"{scenario} per-share bridge is incomplete")
    checks.append(
        _check(
            "unsupported_valuation",
            not unsupported_valuation,
            "Calculated valuation outputs have complete, internally valid support."
            if not unsupported_valuation
            else f"Unsupported valuation outputs: {', '.join(unsupported_valuation)}",
            "critical",
        )
    )

    chart_metadata = research.get("charts", [])
    chart_sources_ok = all(chart.get("source_ids") for chart in chart_metadata)
    checks.append(_check("chart_sources", chart_sources_ok, "Every chart has a source reference." if chart_sources_ok else "One or more charts lack source references."))

    citation_result = validate_citation_markers(_text_corpus(research), research.get("sources", []))
    minimum_coverage = float(thresholds.get("minimum_material_claim_citation_coverage", 0.85))
    citations_ok = citation_result["coverage"] >= minimum_coverage and not citation_result["invalid_citation_ids"]
    citation_result["minimum_required_coverage"] = minimum_coverage
    citation_result["passed"] = citations_ok
    checks.append(_check("citation_coverage", citations_ok, f"Material-text citation coverage is {citation_result['coverage']:.1%}; invalid markers: {citation_result['invalid_citation_ids']}."))
    checks.append(
        _check(
            "fabricated_citation",
            not citation_result["invalid_citation_ids"],
            "Every citation marker resolves to the source ledger."
            if not citation_result["invalid_citation_ids"]
            else f"Unknown citation markers: {citation_result['invalid_citation_ids']}",
            "critical",
        )
    )

    source_records_complete = all(
        all(source.get(field) for field in ("source_id", "source_title", "source_type", "url", "retrieved_at"))
        for source in research.get("sources", [])
    )
    checks.append(
        _check(
            "source_record_completeness",
            source_records_complete,
            "Every source record contains the required identity and retrieval fields."
            if source_records_complete
            else "At least one source record lacks a required identity or retrieval field.",
        )
    )

    limitations_ok = bool(research.get("limitations"))
    checks.append(_check("missing_data_disclosure", limitations_ok, "Missing data and limitations are disclosed." if limitations_ok else "Missing-data limitations are absent."))

    corpus = "\n".join(_text_corpus(research)) + "\n" + json.dumps(research.get("report_metadata", {}))
    prohibited = [phrase for phrase in config.get("prohibited_phrases", []) if phrase.lower() in corpus.lower()]
    target_price = bool(re.search(r"\btarget\s+price\b", corpus, flags=re.IGNORECASE))
    checks.append(_check("unsupported_target_price", not target_price, "No unsupported target price is present." if not target_price else "Unsupported target-price language is present.", "critical"))
    checks.append(_check("restricted_branding", not prohibited, "No prohibited institution-quality or rating claims are present." if not prohibited else f"Prohibited phrases: {prohibited}", "critical"))
    restricted_sources = [
        str(source.get("source_id") or source.get("source_title") or "unknown source")
        for source in research.get("sources", [])
        if "RESTRICTED" in str(source.get("source_type") or "").upper()
        or str(source.get("rights_status") or "").lower() in {"restricted", "prohibited"}
    ]
    checks.append(
        _check(
            "restricted_content",
            not restricted_sources,
            "No source is marked as restricted or prohibited for report use."
            if not restricted_sources
            else f"Restricted source records are present: {restricted_sources}",
            "critical",
        )
    )

    required_metrics = schema.get("required_metrics", [])
    latest = annual.iloc[-1] if not annual.empty else pd.Series(dtype=float)
    available_required = sum(pd.notna(latest.get(metric)) for metric in required_metrics)
    completeness_ratio = available_required / len(required_metrics) if required_metrics else 1.0
    data_completeness = round(15 * completeness_ratio)

    data_integrity_ids = {
        "balance_sheet_reconciliation",
        "segment_reconciliation",
        "period_separation",
        "historical_forecast_separation",
        "unit_consistency",
        "currency_consistency",
        "duplicate_fact_resolution",
        "fact_provenance",
        "percentage_scaling",
    }
    integrity_checks = [check for check in checks if check["check_id"] in data_integrity_ids]
    data_integrity = round(20 * sum(check["passed"] for check in integrity_checks) / len(integrity_checks))
    citation_score = round(15 * citation_result["coverage"])
    calculation_ids = {
        "calculation_reconciliation",
        "dcf_reconciliation",
        "unsupported_valuation",
    }
    calculation_checks = [check for check in checks if check["check_id"] in calculation_ids]
    calculation_integrity = round(20 * sum(check["passed"] for check in calculation_checks) / len(calculation_checks))
    analytical_flags = [
        bool(research.get("investment_thesis")),
        research.get("risk_factors", {}).get("status") == "Available",
        research.get("industry_analysis", {}).get("status")
        not in {None, "Insufficient public data"},
        research.get("competitive_positioning", {}).get("status")
        not in {None, "Insufficient public data"},
        any(
            item.get("status") not in {"Insufficient public data", "Not disclosed"}
            for item in research.get("catalysts", [])
            if isinstance(item, dict)
        ),
        bool(research.get("risks")),
    ]
    analytical_completeness = round(10 * sum(analytical_flags) / len(analytical_flags))
    assumption_payloads = [
        payload
        for scenario in research.get("forecast_assumptions", {}).get("scenarios", {}).values()
        for payload in scenario.values()
        if isinstance(payload, dict)
    ]
    forecast_transparency = round(
        10
        * (
            sum("value" in payload and "source" in payload for payload in assumption_payloads)
            / len(assumption_payloads)
            if assumption_payloads
            else 0
        )
    )
    visual_consistency = 10 if chart_sources_ok and bool(chart_metadata) else (5 if bool(chart_metadata) else 0)
    scores = {
        "data_completeness": data_completeness,
        "data_integrity": data_integrity,
        "citation_coverage": citation_score,
        "calculation_integrity": calculation_integrity,
        "analytical_completeness": analytical_completeness,
        "forecast_transparency": forecast_transparency,
        "visual_consistency": visual_consistency,
    }
    overall = sum(scores.values())
    critical_errors = [
        check for check in checks if not check["passed"] and check["severity"] == "critical"
    ]
    institutional = (
        overall >= int(thresholds.get("institutional_style_overall_score", 85))
        and data_integrity >= int(thresholds.get("institutional_style_data_integrity_score", 18))
        and citation_score >= int(thresholds.get("institutional_style_citation_score", 13))
        and analytical_completeness
        >= int(thresholds.get("institutional_style_analytical_score", 8))
        and not critical_errors
    )
    if institutional:
        label = "Institutional Quality"
    elif critical_errors:
        label = "QA Review Required"
    elif overall < 50:
        label = "Incomplete"
    elif overall < 70:
        label = "Draft"
    else:
        label = "Research Preview"
    return {
        "quality_label": label,
        "overall_score": overall,
        "maximum_score": 100,
        "scores": scores,
        "checks": checks,
        "critical_errors": critical_errors,
        "citation_validation": citation_result,
        "passed_for_export": not critical_errors,
    }


def apply_qa_results(research: dict[str, Any], qa_results: dict[str, Any]) -> dict[str, Any]:
    """Attach QA results and visible label to the shared object."""
    research["qa_results"] = qa_results
    research.setdefault("report_metadata", {})["quality_label"] = qa_results["quality_label"]
    return research
