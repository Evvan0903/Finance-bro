"""Deterministic financial calculations over normalized SEC facts."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


FORMULA_DEFINITIONS: dict[str, dict[str, Any]] = {
    "total_debt": {
        "required_inputs": ["total_debt_reported or long_term_debt plus current debt"],
        "formula": "reported total debt; otherwise non-current debt + current maturities + short-term borrowings",
        "unit": "USD",
        "null_behavior": "null when no debt component is available",
        "zero_behavior": "zero is retained when explicitly reported",
        "period_behavior": "point-in-time",
    },
    "net_debt": {
        "required_inputs": ["total_debt", "cash"],
        "formula": "total_debt - cash",
        "unit": "USD",
        "null_behavior": "null if either input is missing",
        "zero_behavior": "zero is valid",
        "period_behavior": "point-in-time",
    },
    "free_cash_flow": {
        "required_inputs": ["operating_cash_flow", "capex"],
        "formula": "operating_cash_flow - abs(capex)",
        "unit": "USD",
        "null_behavior": "null if either input is missing",
        "zero_behavior": "zero is valid",
        "period_behavior": "same duration as input period",
    },
    "revenue_growth": {
        "required_inputs": ["revenue current period", "revenue prior comparable period"],
        "formula": "revenue / prior_revenue - 1",
        "unit": "ratio",
        "null_behavior": "first period or missing input is null",
        "zero_behavior": "null when prior revenue is zero",
        "period_behavior": "year-over-year for annual frames; sequential for quarterly frames",
    },
    "gross_margin": {"required_inputs": ["gross_profit", "revenue"], "formula": "gross_profit / revenue", "unit": "ratio", "null_behavior": "null if an input is missing", "zero_behavior": "null when revenue is zero", "period_behavior": "same duration"},
    "operating_margin": {"required_inputs": ["operating_income", "revenue"], "formula": "operating_income / revenue", "unit": "ratio", "null_behavior": "null if an input is missing", "zero_behavior": "null when revenue is zero", "period_behavior": "same duration"},
    "net_margin": {"required_inputs": ["net_income", "revenue"], "formula": "net_income / revenue", "unit": "ratio", "null_behavior": "null if an input is missing", "zero_behavior": "null when revenue is zero", "period_behavior": "same duration"},
    "current_ratio": {"required_inputs": ["current_assets", "current_liabilities"], "formula": "current_assets / current_liabilities", "unit": "x", "null_behavior": "null if an input is missing", "zero_behavior": "null when current liabilities are zero", "period_behavior": "point-in-time"},
    "debt_to_assets": {"required_inputs": ["total_debt", "assets"], "formula": "total_debt / assets", "unit": "ratio", "null_behavior": "null if an input is missing", "zero_behavior": "null when assets are zero", "period_behavior": "point-in-time"},
    "ocf_margin": {"required_inputs": ["operating_cash_flow", "revenue"], "formula": "operating_cash_flow / revenue", "unit": "ratio", "null_behavior": "null if an input is missing", "zero_behavior": "null when revenue is zero", "period_behavior": "same duration"},
    "free_cash_flow_margin": {"required_inputs": ["free_cash_flow", "revenue"], "formula": "free_cash_flow / revenue", "unit": "ratio", "null_behavior": "null if an input is missing", "zero_behavior": "null when revenue is zero", "period_behavior": "same duration"},
    "free_cash_flow_conversion": {"required_inputs": ["free_cash_flow", "net_income"], "formula": "free_cash_flow / net_income", "unit": "x", "null_behavior": "null if an input is missing", "zero_behavior": "null when net income is zero", "period_behavior": "same duration"},
    "capex_intensity": {"required_inputs": ["capex", "revenue"], "formula": "abs(capex) / revenue", "unit": "ratio", "null_behavior": "null if an input is missing", "zero_behavior": "null when revenue is zero", "period_behavior": "same duration"},
    "research_and_development_intensity": {"required_inputs": ["research_and_development", "revenue"], "formula": "research_and_development / revenue", "unit": "ratio", "null_behavior": "null if an input is missing", "zero_behavior": "null when revenue is zero", "period_behavior": "same duration"},
    "sales_and_marketing_intensity": {"required_inputs": ["sales_and_marketing", "revenue"], "formula": "sales_and_marketing / revenue", "unit": "ratio", "null_behavior": "null if an input is missing", "zero_behavior": "null when revenue is zero", "period_behavior": "same duration"},
    "stock_based_compensation_intensity": {"required_inputs": ["stock_based_compensation", "revenue"], "formula": "stock_based_compensation / revenue", "unit": "ratio", "null_behavior": "null if an input is missing", "zero_behavior": "null when revenue is zero", "period_behavior": "same duration"},
    "dilution": {"required_inputs": ["diluted_shares current and prior periods"], "formula": "diluted_shares / prior_diluted_shares - 1", "unit": "ratio", "null_behavior": "first period or missing input is null", "zero_behavior": "null when prior shares are zero", "period_behavior": "period-over-period"},
    "return_on_assets": {"required_inputs": ["net_income", "average assets"], "formula": "net_income / average(beginning assets, ending assets)", "unit": "ratio", "null_behavior": "null without comparable balance data", "zero_behavior": "null when average assets are zero", "period_behavior": "annual or comparable duration"},
    "return_on_equity": {"required_inputs": ["net_income", "average equity"], "formula": "net_income / average(beginning equity, ending equity)", "unit": "ratio", "null_behavior": "null without comparable balance data", "zero_behavior": "null when average equity is zero", "period_behavior": "annual or comparable duration"},
    "return_on_invested_capital": {"required_inputs": ["operating_income", "effective tax rate", "debt", "equity", "cash"], "formula": "NOPAT / average(debt + equity - cash)", "unit": "ratio", "null_behavior": "null if required inputs are missing", "zero_behavior": "null when invested capital is zero", "period_behavior": "annual or comparable duration"},
    "interest_coverage": {"required_inputs": ["operating_income", "interest_expense"], "formula": "operating_income / abs(interest_expense)", "unit": "x", "null_behavior": "null if an input is missing", "zero_behavior": "null when interest expense is zero", "period_behavior": "same duration"},
    "debt_to_ebitda": {"required_inputs": ["total_debt", "operating_income", "depreciation_and_amortization"], "formula": "total_debt / (operating_income + depreciation_and_amortization)", "unit": "x", "null_behavior": "null if an input is missing", "zero_behavior": "null when EBITDA is zero", "period_behavior": "point-in-time debt divided by same-period EBITDA"},
    "quick_ratio": {"required_inputs": ["current_assets", "inventory", "current_liabilities"], "formula": "(current_assets - inventory) / current_liabilities; cash + receivables fallback", "unit": "x", "null_behavior": "null if a usable numerator is unavailable", "zero_behavior": "null when current liabilities are zero", "period_behavior": "point-in-time"},
    "enterprise_value": {"required_inputs": ["market_cap", "net_debt"], "formula": "market_cap + net_debt", "unit": "USD", "null_behavior": "null without user/licensed market inputs", "zero_behavior": "zero is valid", "period_behavior": "as-of market-input date"},
    "ev_revenue": {"required_inputs": ["enterprise_value", "revenue"], "formula": "enterprise_value / revenue", "unit": "x", "null_behavior": "null if an input is missing", "zero_behavior": "null when revenue is zero", "period_behavior": "latest period only unless historical market data is supplied"},
    "ev_ebitda": {"required_inputs": ["enterprise_value", "ebitda"], "formula": "enterprise_value / EBITDA", "unit": "x", "null_behavior": "null if an input is missing", "zero_behavior": "null when EBITDA is zero", "period_behavior": "latest period only unless historical market data is supplied"},
    "price_earnings": {"required_inputs": ["market_cap", "net_income"], "formula": "market_cap / net_income", "unit": "x", "null_behavior": "null if an input is missing", "zero_behavior": "null when net income is zero", "period_behavior": "latest period only unless historical market data is supplied"},
    "price_free_cash_flow": {"required_inputs": ["market_cap", "free_cash_flow"], "formula": "market_cap / free_cash_flow", "unit": "x", "null_behavior": "null if an input is missing", "zero_behavior": "null when free cash flow is zero", "period_behavior": "latest period only unless historical market data is supplied"},
}


BASE_INPUT_COLUMNS = {
    "long_term_debt",
    "total_debt_reported",
    "short_term_debt",
    "current_debt_maturities",
    "short_term_borrowings",
    "cash",
    "operating_cash_flow",
    "capex",
    "revenue",
    "gross_profit",
    "operating_income",
    "pretax_income",
    "tax_expense",
    "net_income",
    "current_assets",
    "current_liabilities",
    "assets",
    "equity",
    "inventory",
    "receivables",
    "research_and_development",
    "sales_and_marketing",
    "stock_based_compensation",
    "diluted_shares",
    "interest_expense",
    "depreciation_and_amortization",
}


def _safe_divide(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    return numerator / denominator.replace(0, np.nan)


def _partial_sum(*series: pd.Series) -> pd.Series:
    """Sum components while leaving rows with every input missing as NaN."""
    frame = pd.concat(series, axis=1)
    return frame.sum(axis=1, min_count=1)


def _current_debt(metrics: pd.DataFrame) -> pd.Series:
    """Prefer an aggregate current-debt fact; otherwise sum known components."""
    components = _partial_sum(metrics["current_debt_maturities"], metrics["short_term_borrowings"])
    return metrics["short_term_debt"].combine_first(components)


def calculate_metrics(
    financials: pd.DataFrame,
    market_inputs: dict[str, Any] | None = None,
    *,
    periodicity: str | None = None,
) -> pd.DataFrame:
    """Add compatible and extended metrics without asking an LLM to calculate values."""
    attrs = dict(financials.attrs)
    metrics = financials.copy()
    for column in BASE_INPUT_COLUMNS:
        if column not in metrics:
            metrics[column] = np.nan

    current_debt = _current_debt(metrics)
    component_total = _partial_sum(metrics["long_term_debt"], current_debt)
    metrics["total_debt"] = metrics["total_debt_reported"].combine_first(component_total)
    metrics["net_debt"] = metrics["total_debt"] - metrics["cash"]
    metrics["net_cash"] = metrics["cash"] - metrics["total_debt"]
    metrics["free_cash_flow"] = metrics["operating_cash_flow"] - metrics["capex"].abs()

    is_quarterly = periodicity == "quarterly" or (
        periodicity is None and any("Q" in str(value) for value in metrics.index)
    )
    growth = metrics["revenue"].pct_change(fill_method=None)
    metrics["revenue_growth"] = growth
    metrics["sequential_revenue_growth"] = growth if is_quarterly else np.nan
    metrics["gross_margin"] = _safe_divide(metrics["gross_profit"], metrics["revenue"])
    metrics["operating_margin"] = _safe_divide(metrics["operating_income"], metrics["revenue"])
    metrics["net_margin"] = _safe_divide(metrics["net_income"], metrics["revenue"])
    metrics["current_ratio"] = _safe_divide(metrics["current_assets"], metrics["current_liabilities"])
    metrics["debt_to_assets"] = _safe_divide(metrics["total_debt"], metrics["assets"])
    metrics["ocf_margin"] = _safe_divide(metrics["operating_cash_flow"], metrics["revenue"])
    metrics["free_cash_flow_margin"] = _safe_divide(metrics["free_cash_flow"], metrics["revenue"])
    metrics["free_cash_flow_conversion"] = _safe_divide(metrics["free_cash_flow"], metrics["net_income"])
    metrics["capex_intensity"] = _safe_divide(metrics["capex"].abs(), metrics["revenue"])
    metrics["research_and_development_intensity"] = _safe_divide(
        metrics["research_and_development"], metrics["revenue"]
    )
    metrics["sales_and_marketing_intensity"] = _safe_divide(
        metrics["sales_and_marketing"], metrics["revenue"]
    )
    metrics["stock_based_compensation_intensity"] = _safe_divide(
        metrics["stock_based_compensation"], metrics["revenue"]
    )
    metrics["dilution"] = metrics["diluted_shares"].pct_change(fill_method=None)

    average_assets = (metrics["assets"] + metrics["assets"].shift(1)) / 2
    average_equity = (metrics["equity"] + metrics["equity"].shift(1)) / 2
    metrics["return_on_assets"] = _safe_divide(metrics["net_income"], average_assets)
    metrics["return_on_equity"] = _safe_divide(metrics["net_income"], average_equity)
    effective_tax_rate = _safe_divide(metrics["tax_expense"], metrics["pretax_income"])
    metrics["effective_tax_rate"] = effective_tax_rate
    metrics["nopat"] = metrics["operating_income"] * (1 - effective_tax_rate)
    invested_capital = metrics["total_debt"] + metrics["equity"] - metrics["cash"]
    average_invested_capital = (invested_capital + invested_capital.shift(1)) / 2
    metrics["return_on_invested_capital"] = _safe_divide(
        metrics["nopat"], average_invested_capital
    )
    metrics["ebitda"] = metrics["operating_income"] + metrics["depreciation_and_amortization"]
    metrics["interest_coverage"] = _safe_divide(
        metrics["operating_income"], metrics["interest_expense"].abs()
    )
    metrics["debt_to_ebitda"] = _safe_divide(metrics["total_debt"], metrics["ebitda"])
    quick_numerator = (metrics["current_assets"] - metrics["inventory"]).where(
        metrics["current_assets"].notna() & metrics["inventory"].notna()
    )
    quick_fallback = _partial_sum(metrics["cash"], metrics["receivables"])
    metrics["quick_ratio"] = _safe_divide(
        quick_numerator.combine_first(quick_fallback), metrics["current_liabilities"]
    )

    for column in (
        "share_price",
        "market_cap",
        "enterprise_value",
        "ev_revenue",
        "ev_ebitda",
        "price_earnings",
        "price_free_cash_flow",
    ):
        metrics[column] = np.nan

    if market_inputs and not metrics.empty:
        latest_index = metrics.index[-1]
        share_price = market_inputs.get("share_price")
        input_shares = market_inputs.get("diluted_shares")
        market_cap = market_inputs.get("market_cap")
        if input_shares is not None:
            metrics.loc[latest_index, "diluted_shares"] = float(input_shares)
        shares = metrics.loc[latest_index, "diluted_shares"]
        if market_cap is None and share_price is not None and pd.notna(shares):
            market_cap = float(share_price) * float(shares)
        if share_price is not None:
            metrics.loc[latest_index, "share_price"] = float(share_price)
        if market_cap is not None:
            metrics.loc[latest_index, "market_cap"] = float(market_cap)
            net_debt = metrics.loc[latest_index, "net_debt"]
            if pd.notna(net_debt):
                metrics.loc[latest_index, "enterprise_value"] = float(market_cap) + float(net_debt)
            ev = metrics.loc[latest_index, "enterprise_value"]
            for output, denominator in (
                ("ev_revenue", "revenue"),
                ("ev_ebitda", "ebitda"),
                ("price_earnings", "net_income"),
                ("price_free_cash_flow", "free_cash_flow"),
            ):
                numerator = ev if output.startswith("ev_") else float(market_cap)
                denominator_value = metrics.loc[latest_index, denominator]
                if pd.notna(numerator) and pd.notna(denominator_value) and float(denominator_value) != 0:
                    metrics.loc[latest_index, output] = float(numerator) / float(denominator_value)

    metrics = metrics.replace([np.inf, -np.inf], np.nan)
    metrics.attrs.update(attrs)
    metrics.attrs["formula_definitions"] = FORMULA_DEFINITIONS
    metrics.attrs["periodicity"] = "quarterly" if is_quarterly else "annual"
    return metrics


def latest_kpis(metrics: pd.DataFrame) -> dict[str, float]:
    """Return the latest period's KPI values with the compatible fiscal-year field."""
    if metrics.empty:
        return {}
    row = metrics.iloc[-1]
    period = metrics.index[-1]
    result: dict[str, Any] = {"fiscal_period": str(period), **row.to_dict()}
    try:
        result["fiscal_year"] = int(period)
    except (TypeError, ValueError):
        result["fiscal_year"] = int(str(period).split("-")[0])
    return result
