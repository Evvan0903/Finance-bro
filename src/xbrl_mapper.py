"""Normalize annual and quarterly SEC Company Facts with metric-level provenance."""

from __future__ import annotations

from datetime import date
from typing import Any, Iterable

import numpy as np
import pandas as pd

from src.utils import utc_now_iso


METRIC_DEFINITIONS: dict[str, dict[str, Any]] = {
    "revenue": {
        "tags": ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"],
        "units": ["USD"],
        "period_type": "duration",
    },
    "cost_of_revenue": {
        "tags": ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold"],
        "units": ["USD"],
        "period_type": "duration",
    },
    "gross_profit": {"tags": ["GrossProfit"], "units": ["USD"], "period_type": "duration"},
    "operating_income": {
        "tags": ["OperatingIncomeLoss"],
        "units": ["USD"],
        "period_type": "duration",
    },
    "pretax_income": {
        "tags": ["IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest", "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments"],
        "units": ["USD"],
        "period_type": "duration",
    },
    "tax_expense": {
        "tags": ["IncomeTaxExpenseBenefit"],
        "units": ["USD"],
        "period_type": "duration",
    },
    "net_income": {"tags": ["NetIncomeLoss", "ProfitLoss"], "units": ["USD"], "period_type": "duration"},
    "interest_expense": {
        "tags": ["InterestExpenseNonOperating", "InterestAndDebtExpense", "InterestExpense"],
        "units": ["USD"],
        "period_type": "duration",
    },
    "depreciation_and_amortization": {
        "tags": ["DepreciationDepletionAndAmortization", "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment", "Depreciation"],
        "units": ["USD"],
        "period_type": "duration",
    },
    "research_and_development": {
        "tags": ["ResearchAndDevelopmentExpense"],
        "units": ["USD"],
        "period_type": "duration",
    },
    "sales_and_marketing": {
        "tags": ["SellingAndMarketingExpense", "MarketingExpense"],
        "units": ["USD"],
        "period_type": "duration",
    },
    "selling_general_admin": {
        "tags": ["SellingGeneralAndAdministrativeExpense"],
        "units": ["USD"],
        "period_type": "duration",
    },
    "stock_based_compensation": {
        "tags": ["ShareBasedCompensation"],
        "units": ["USD"],
        "period_type": "duration",
    },
    "cash": {
        "tags": ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
        "units": ["USD"],
        "period_type": "instant",
    },
    "short_term_investments": {
        "tags": ["ShortTermInvestments", "MarketableSecuritiesCurrent"],
        "units": ["USD"],
        "period_type": "instant",
    },
    "receivables": {
        "tags": ["AccountsReceivableNetCurrent", "ReceivablesNetCurrent"],
        "units": ["USD"],
        "period_type": "instant",
    },
    "inventory": {"tags": ["InventoryNet"], "units": ["USD"], "period_type": "instant"},
    "assets": {"tags": ["Assets"], "units": ["USD"], "period_type": "instant"},
    "liabilities": {"tags": ["Liabilities"], "units": ["USD"], "period_type": "instant"},
    "current_assets": {"tags": ["AssetsCurrent"], "units": ["USD"], "period_type": "instant"},
    "current_liabilities": {
        "tags": ["LiabilitiesCurrent"],
        "units": ["USD"],
        "period_type": "instant",
    },
    # Non-current debt is intentionally separate from aggregate debt to prevent double counting.
    "long_term_debt": {
        "tags": ["LongTermDebtNoncurrent", "LongTermDebtAndFinanceLeaseObligationsNoncurrent", "LongTermDebtAndCapitalLeaseObligationsNoncurrent"],
        "units": ["USD"],
        "period_type": "instant",
    },
    "total_debt_reported": {
        "tags": ["LongTermDebt", "LongTermDebtAndFinanceLeaseObligations", "LongTermDebtAndCapitalLeaseObligations", "LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities"],
        "units": ["USD"],
        "period_type": "instant",
    },
    "short_term_debt": {
        "tags": ["ShortTermDebtCurrent"],
        "units": ["USD"],
        "period_type": "instant",
    },
    "current_debt_maturities": {
        "tags": ["LongTermDebtCurrent", "LongTermDebtAndFinanceLeaseObligationsCurrent", "LongTermDebtAndCapitalLeaseObligationsCurrent"],
        "units": ["USD"],
        "period_type": "instant",
    },
    "short_term_borrowings": {
        "tags": ["ShortTermBorrowings", "ShortTermBankLoansAndNotesPayable"],
        "units": ["USD"],
        "period_type": "instant",
    },
    "equity": {
        "tags": ["StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest", "StockholdersEquity", "PartnersCapitalIncludingPortionAttributableToNoncontrollingInterest"],
        "units": ["USD"],
        "period_type": "instant",
    },
    "operating_cash_flow": {
        "tags": ["NetCashProvidedByUsedInOperatingActivities"],
        "units": ["USD"],
        "period_type": "duration",
    },
    "capex": {
        "tags": ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsForAdditionsToPropertyPlantAndEquipment"],
        "units": ["USD"],
        "period_type": "duration",
    },
    "diluted_shares": {
        "tags": ["WeightedAverageNumberOfDilutedSharesOutstanding"],
        "units": ["shares"],
        "period_type": "duration",
    },
    "shares_outstanding": {
        "tags": ["CommonStocksIncludingAdditionalPaidInCapitalMember", "CommonStockSharesOutstanding"],
        "units": ["shares"],
        "period_type": "instant",
    },
    "diluted_eps": {
        "tags": ["EarningsPerShareDiluted"],
        "units": ["USD/shares"],
        "period_type": "duration",
    },
    "deferred_revenue": {
        "tags": ["ContractWithCustomerLiabilityCurrent", "DeferredRevenueCurrent"],
        "units": ["USD"],
        "period_type": "instant",
    },
    "net_interest_income": {
        "tags": ["InterestIncomeExpenseNonoperatingNet", "InterestIncomeExpenseAfterProvisionForLoanLoss"],
        "units": ["USD"],
        "period_type": "duration",
    },
    "deposits": {"tags": ["Deposits"], "units": ["USD"], "period_type": "instant"},
    "loans": {
        "tags": ["FinancingReceivableExcludingAccruedInterestAfterAllowanceForCreditLoss", "LoansAndLeasesReceivableNetReportedAmount"],
        "units": ["USD"],
        "period_type": "instant",
    },
    "provision_for_credit_losses": {
        "tags": ["ProvisionForCreditLosses"],
        "units": ["USD"],
        "period_type": "duration",
    },
    "rental_revenue": {
        "tags": ["RentalRevenue"],
        "units": ["USD"],
        "period_type": "duration",
    },
}

# Backward-compatible public mapping used by the original project.
METRIC_TAGS = {name: definition["tags"] for name, definition in METRIC_DEFINITIONS.items()}


def _parse_date(value: Any) -> date | None:
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _duration_days(fact: dict[str, Any]) -> int | None:
    start = _parse_date(fact.get("start"))
    end = _parse_date(fact.get("end"))
    return (end - start).days + 1 if start and end and end >= start else None


def _period_kind(fact: dict[str, Any], period_type: str) -> str | None:
    form = str(fact.get("form") or "").upper()
    base_form = form[:-2] if form.endswith("/A") else form
    fp = str(fact.get("fp") or "").upper()
    days = _duration_days(fact)
    if base_form == "10-K" and fp == "FY":
        if period_type == "instant" or (days is not None and 300 <= days <= 440):
            return "annual"
    if base_form == "10-Q" and fp in {"Q1", "Q2", "Q3"}:
        if period_type == "instant":
            return "quarter"
        if days is not None and 60 <= days <= 120:
            return "quarter"
        if days is not None and 121 <= days <= 300:
            return "year_to_date"
    return None


def _source_url(cik: Any, accession: str) -> str:
    if not cik or not accession:
        return ""
    cik_compact = str(int(str(cik)))
    accession_compact = accession.replace("-", "")
    return (
        f"https://www.sec.gov/Archives/edgar/data/{cik_compact}/{accession_compact}/"
        f"{accession}-index.html"
    )


def _collect_metric_candidates(
    company_facts: dict[str, Any],
    metric: str,
    definition: dict[str, Any],
    retrieved_at: str,
) -> list[dict[str, Any]]:
    us_gaap = company_facts.get("facts", {}).get("us-gaap", {})
    candidates: list[dict[str, Any]] = []
    for priority, tag in enumerate(definition["tags"]):
        concept = us_gaap.get(tag, {})
        units = concept.get("units", {})
        for unit in definition["units"]:
            for fact in units.get(unit, []):
                kind = _period_kind(fact, definition["period_type"])
                if not kind or fact.get("val") is None or not fact.get("end"):
                    continue
                try:
                    value = float(fact["val"])
                except (TypeError, ValueError):
                    continue
                end_date = _parse_date(fact.get("end"))
                # A 10-K can repeat several comparative periods with the filing's current
                # fiscal-year focus on every fact. Annual facts therefore use the period-end
                # year; quarter facts retain the SEC fiscal-year focus (for example, Apple's
                # fiscal Q1 2025 ends in calendar 2024).
                fiscal_year = end_date.year if kind == "annual" and end_date else fact.get("fy")
                if fiscal_year is None:
                    fiscal_year = end_date.year if end_date else None
                if fiscal_year is None:
                    continue
                accession = str(fact.get("accn") or "")
                form = str(fact.get("form") or "")
                candidates.append(
                    {
                        "metric": metric,
                        "value": value,
                        "unit": unit,
                        "currency": "USD" if unit.startswith("USD") else None,
                        "period_start": fact.get("start"),
                        "period_end": fact.get("end"),
                        "fiscal_year": int(fiscal_year),
                        "fiscal_period": str(fact.get("fp") or "FY"),
                        "form": form,
                        "filing_date": str(fact.get("filed") or ""),
                        "accession_number": accession,
                        "source_url": _source_url(company_facts.get("cik"), accession),
                        "source_type": "SEC_XBRL",
                        "taxonomy_namespace": "us-gaap",
                        "taxonomy_tag": tag,
                        "concept_label": concept.get("label") or tag,
                        "retrieved_at": retrieved_at,
                        "period_kind": kind,
                        "period_type": definition["period_type"],
                        "duration_days": _duration_days(fact),
                        "frame": fact.get("frame"),
                        "is_amendment": form.upper().endswith("/A"),
                        "tag_priority": priority,
                    }
                )
    return candidates


def _ambiguity_flags(selected: dict[str, Any], peers: list[dict[str, Any]]) -> list[str]:
    flags: list[str] = []
    values = {round(float(peer["value"]), 8) for peer in peers}
    tags = {peer["taxonomy_tag"] for peer in peers}
    if len(values) > 1 and len(tags) > 1:
        baseline = abs(float(selected["value"])) or 1.0
        if any(abs(float(peer["value"]) - float(selected["value"])) / baseline > 0.005 for peer in peers):
            flags.append("conflicting_fallback_tag_values")
    if selected["tag_priority"] > 0:
        flags.append("fallback_tag_used")
    if selected["is_amendment"]:
        flags.append("amended_filing_selected")
    return flags


def _select_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not candidates:
        return []
    frame = pd.DataFrame(candidates)
    selected_records: list[dict[str, Any]] = []
    grouping = ["metric", "period_kind", "fiscal_year", "fiscal_period"]
    for _, group in frame.groupby(grouping, dropna=False, sort=False):
        # Comparative facts can be re-filed under a later fy/fp. The period closest to the
        # current fiscal focus is the latest end date represented within that group.
        latest_end = group["period_end"].max()
        peers = group[group["period_end"] == latest_end].to_dict(orient="records")
        best_priority = min(int(peer["tag_priority"]) for peer in peers)
        priority_peers = [peer for peer in peers if int(peer["tag_priority"]) == best_priority]
        selected = sorted(
            priority_peers,
            key=lambda item: (item.get("filing_date") or "", item.get("accession_number") or ""),
        )[-1]
        flags = _ambiguity_flags(selected, peers)
        selected["ambiguity_flags"] = flags
        selected["confidence"] = "low" if "conflicting_fallback_tag_values" in flags else (
            "medium" if flags else "high"
        )
        selected_records.append(selected)
    return selected_records


def _derive_quarters(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Derive Q2/Q3 discrete duration facts from YTD facts only when direct quarters are absent."""
    direct_keys = {
        (record["metric"], record["fiscal_year"], record["fiscal_period"])
        for record in records
        if record["period_kind"] == "quarter"
    }
    ytd = {
        (record["metric"], record["fiscal_year"], record["fiscal_period"]): record
        for record in records
        if record["period_kind"] == "year_to_date"
    }
    quarters = [record for record in records if record["period_kind"] in {"annual", "quarter"}]
    previous_period = {"Q2": "Q1", "Q3": "Q2"}
    for (metric, fiscal_year, fiscal_period), current in ytd.items():
        key = (metric, fiscal_year, fiscal_period)
        if key in direct_keys or fiscal_period not in previous_period:
            continue
        prior_key = (metric, fiscal_year, previous_period[fiscal_period])
        prior = ytd.get(prior_key)
        if prior is None and previous_period[fiscal_period] == "Q1":
            prior = next(
                (
                    record
                    for record in records
                    if record["period_kind"] == "quarter"
                    and (record["metric"], record["fiscal_year"], record["fiscal_period"]) == prior_key
                ),
                None,
            )
        if prior is None or current["unit"] != prior["unit"]:
            continue
        derived = dict(current)
        derived.update(
            {
                "value": float(current["value"]) - float(prior["value"]),
                "period_start": prior["period_end"],
                "period_kind": "quarter",
                "source_type": "SYSTEM_CALCULATION",
                "taxonomy_tag": "DerivedFromYearToDateFacts",
                "concept_label": f"Derived discrete {fiscal_period}",
                "confidence": "medium",
                "ambiguity_flags": ["derived_from_year_to_date"],
                "derived_from": [
                    current["accession_number"],
                    prior["accession_number"],
                ],
            }
        )
        quarters.append(derived)
    return quarters


def normalize_company_facts(
    company_facts: dict[str, Any],
    *,
    metrics: Iterable[str] | None = None,
    annual_years: int | None = 5,
    quarterly_periods: int | None = 12,
) -> list[dict[str, Any]]:
    """Return normalized SEC facts with provenance, confidence, and ambiguity flags."""
    retrieved_at = utc_now_iso()
    requested = list(metrics or METRIC_DEFINITIONS)
    candidates: list[dict[str, Any]] = []
    for metric in requested:
        definition = METRIC_DEFINITIONS.get(metric)
        if definition:
            candidates.extend(_collect_metric_candidates(company_facts, metric, definition, retrieved_at))
    selected = _derive_quarters(_select_candidates(candidates))

    annual_year_set = sorted(
        {record["fiscal_year"] for record in selected if record["period_kind"] == "annual"}
    )
    if annual_years is not None:
        annual_year_set = annual_year_set[-annual_years:] if annual_years > 0 else []
    quarter_keys = sorted(
        {
            (record["period_end"], record["fiscal_year"], record["fiscal_period"])
            for record in selected
            if record["period_kind"] == "quarter"
        }
    )
    if quarterly_periods is not None:
        quarter_keys = quarter_keys[-quarterly_periods:] if quarterly_periods > 0 else []
    allowed_quarters = {(fy, fp) for _, fy, fp in quarter_keys}
    return sorted(
        [
            record
            for record in selected
            if (
                record["period_kind"] == "annual"
                and record["fiscal_year"] in annual_year_set
            )
            or (
                record["period_kind"] == "quarter"
                and (record["fiscal_year"], record["fiscal_period"]) in allowed_quarters
            )
        ],
        key=lambda record: (
            record["period_end"],
            record["metric"],
            record["fiscal_period"],
        ),
    )


def _records_to_frame(records: list[dict[str, Any]], period_kind: str) -> pd.DataFrame:
    relevant = [record for record in records if record["period_kind"] == period_kind]
    if not relevant:
        empty = pd.DataFrame(columns=list(METRIC_DEFINITIONS))
        empty.attrs["provenance"] = []
        return empty
    if period_kind == "annual":
        for record in relevant:
            record["period_key"] = int(record["fiscal_year"])
        index_name = "fiscal_year"
    else:
        for record in relevant:
            record["period_key"] = f"{int(record['fiscal_year'])}-{record['fiscal_period']}"
        index_name = "fiscal_quarter"
    values = pd.DataFrame(relevant).pivot_table(
        index="period_key", columns="metric", values="value", aggfunc="last"
    )
    values.index.name = index_name
    values = values.reindex(sorted(values.index))
    for metric in METRIC_DEFINITIONS:
        if metric not in values:
            values[metric] = np.nan
    values.attrs["provenance"] = [dict(record, period_key=None) for record in relevant]
    return values.replace([np.inf, -np.inf], np.nan)


def extract_metric_series(company_facts: dict[str, Any], tags: list[str]) -> pd.Series:
    """Backward-compatible annual metric extraction for an arbitrary fallback tag list."""
    definition = {"tags": tags, "units": ["USD"], "period_type": "duration"}
    candidates = _collect_metric_candidates(company_facts, "metric", definition, utc_now_iso())
    records = [record for record in _select_candidates(candidates) if record["period_kind"] == "annual"]
    if not records:
        return pd.Series(dtype="float64")
    return pd.Series(
        {record["fiscal_year"]: record["value"] for record in records}, dtype="float64"
    ).sort_index()


def extract_financial_metrics(company_facts: dict[str, Any], years: int = 5) -> pd.DataFrame:
    """Preserve the MVP API while using the provenance-aware annual normalizer."""
    records = normalize_company_facts(company_facts, annual_years=years, quarterly_periods=0)
    return _records_to_frame(records, "annual")


def extract_quarterly_financial_metrics(
    company_facts: dict[str, Any], quarters: int = 12
) -> pd.DataFrame:
    """Extract discrete 10-Q fiscal-quarter metrics with YTD derivation where required."""
    records = normalize_company_facts(company_facts, annual_years=0, quarterly_periods=quarters)
    return _records_to_frame(records, "quarter")


def extract_financial_metrics_with_provenance(
    company_facts: dict[str, Any], *, years: int = 5, quarters: int = 12
) -> tuple[pd.DataFrame, pd.DataFrame, list[dict[str, Any]]]:
    """Return annual and quarterly frames plus the shared normalized fact ledger."""
    records = normalize_company_facts(
        company_facts, annual_years=years, quarterly_periods=quarters
    )
    return (
        _records_to_frame(records, "annual"),
        _records_to_frame(records, "quarter"),
        records,
    )
