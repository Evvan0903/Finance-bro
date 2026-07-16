"""Reproducible DCF and user-supplied multiple valuation calculations."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


class ValuationError(ValueError):
    """Raised when valuation assumptions are internally inconsistent."""


def _finite(value: Any) -> float | None:
    try:
        number = float(value)
        return number if np.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def build_valuation_assumptions(
    metrics: pd.DataFrame,
    user_inputs: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build visible valuation assumptions without inventing market data."""
    latest = metrics.iloc[-1] if not metrics.empty else pd.Series(dtype=float)
    supplied = user_inputs or {}
    assumptions = {
        "discount_rate": {
            "value": float(supplied.get("discount_rate", 0.09)),
            "source": "User assumption" if "discount_rate" in supplied else "System-calculated",
            "unit": "ratio",
        },
        "terminal_growth_rate": {
            "value": float(supplied.get("terminal_growth_rate", 0.025)),
            "source": "User assumption" if "terminal_growth_rate" in supplied else "System-calculated",
            "unit": "ratio",
        },
        "net_debt": {
            "value": _finite(supplied.get("net_debt", latest.get("net_debt"))),
            "source": "User assumption" if "net_debt" in supplied else "System-calculated",
            "unit": "USD",
        },
        "diluted_shares": {
            "value": _finite(supplied.get("diluted_shares", latest.get("diluted_shares"))),
            "source": "User assumption" if "diluted_shares" in supplied else "SEC-reported fact",
            "unit": "shares",
        },
        "current_share_price": {
            "value": _finite(supplied.get("share_price")),
            "source": "User assumption" if supplied.get("share_price") is not None else "Data unavailable",
            "unit": "USD/share",
        },
        "peer_multiples": {
            "value": supplied.get("peer_multiples") or {},
            "source": "User assumption" if supplied.get("peer_multiples") else "Data unavailable",
            "unit": "x",
        },
    }
    if assumptions["discount_rate"]["value"] <= assumptions["terminal_growth_rate"]["value"]:
        raise ValuationError("Discount rate must exceed the terminal growth rate.")
    return assumptions


def calculate_dcf(
    forecast_rows: list[dict[str, Any]],
    *,
    discount_rate: float,
    terminal_growth_rate: float,
    net_debt: float | None,
    diluted_shares: float | None,
) -> dict[str, Any]:
    """Calculate a two-stage simplified DCF with a fully visible bridge."""
    if discount_rate <= terminal_growth_rate:
        raise ValuationError("Discount rate must exceed terminal growth rate.")
    if not forecast_rows:
        return {
            "status": "Unable to calculate from available filings",
            "limitations": ["Forecast free cash flow is unavailable."],
        }
    pv_forecast = 0.0
    schedule: list[dict[str, Any]] = []
    for period, row in enumerate(forecast_rows, start=1):
        cash_flow = _finite(row.get("unlevered_free_cash_flow"))
        if cash_flow is None:
            return {
                "status": "Unable to calculate from available filings",
                "limitations": ["A forecast period is missing unlevered free cash flow."],
            }
        discount_factor = 1 / ((1 + discount_rate) ** period)
        present_value = cash_flow * discount_factor
        pv_forecast += present_value
        schedule.append(
            {
                "fiscal_year": row.get("fiscal_year"),
                "unlevered_free_cash_flow": cash_flow,
                "discount_factor": discount_factor,
                "present_value": present_value,
            }
        )
    terminal_cash_flow = float(schedule[-1]["unlevered_free_cash_flow"]) * (
        1 + terminal_growth_rate
    )
    terminal_value = terminal_cash_flow / (discount_rate - terminal_growth_rate)
    terminal_discount_factor = 1 / ((1 + discount_rate) ** len(schedule))
    present_value_terminal = terminal_value * terminal_discount_factor
    enterprise_value = pv_forecast + present_value_terminal
    equity_value = enterprise_value - net_debt if net_debt is not None else None
    implied_value_per_share = (
        equity_value / diluted_shares
        if equity_value is not None and diluted_shares is not None and diluted_shares != 0
        else None
    )
    return {
        "status": "Calculated",
        "methodology": "Simplified unlevered free cash flow DCF",
        "discount_rate": discount_rate,
        "terminal_growth_rate": terminal_growth_rate,
        "forecast_schedule": schedule,
        "present_value_forecast_cash_flows": pv_forecast,
        "terminal_cash_flow": terminal_cash_flow,
        "terminal_value": terminal_value,
        "terminal_discount_factor": terminal_discount_factor,
        "present_value_terminal_value": present_value_terminal,
        "enterprise_value": enterprise_value,
        "net_debt": net_debt,
        "equity_value": equity_value,
        "diluted_shares": diluted_shares,
        "implied_value_per_share": implied_value_per_share,
        "source_type": "SYSTEM_CALCULATION",
        "limitations": []
        if implied_value_per_share is not None
        else ["Per-share value requires diluted shares and net debt."],
    }


def dcf_sensitivity(
    forecast_rows: list[dict[str, Any]],
    *,
    discount_rates: list[float],
    terminal_growth_rates: list[float],
    net_debt: float | None,
    diluted_shares: float | None,
) -> list[dict[str, Any]]:
    """Return a transparent discount-rate/terminal-growth sensitivity grid."""
    table: list[dict[str, Any]] = []
    for discount_rate in discount_rates:
        row: dict[str, Any] = {"discount_rate": discount_rate, "values": {}}
        for growth in terminal_growth_rates:
            if discount_rate <= growth:
                row["values"][str(growth)] = None
                continue
            result = calculate_dcf(
                forecast_rows,
                discount_rate=discount_rate,
                terminal_growth_rate=growth,
                net_debt=net_debt,
                diluted_shares=diluted_shares,
            )
            row["values"][str(growth)] = result.get("implied_value_per_share")
        table.append(row)
    return table


def calculate_historical_multiples(metrics: pd.DataFrame) -> list[dict[str, Any]]:
    """Expose multiples only for periods with supplied/licensed market values."""
    if metrics.empty:
        return []
    columns = [
        "enterprise_value",
        "ev_revenue",
        "ev_ebitda",
        "price_earnings",
        "price_free_cash_flow",
    ]
    output: list[dict[str, Any]] = []
    for period, row in metrics.iterrows():
        if not any(pd.notna(row.get(column)) for column in columns):
            continue
        output.append(
            {
                "fiscal_period": str(period),
                **{column: _finite(row.get(column)) for column in columns},
                "source_type": "USER_INPUT_AND_SYSTEM_CALCULATION",
            }
        )
    return output


def calculate_valuation(
    forecast_financials: dict[str, list[dict[str, Any]]],
    assumptions: dict[str, Any],
    metrics: pd.DataFrame,
) -> dict[str, Any]:
    """Calculate bull/base/bear DCFs and optional user-input multiple views."""
    discount_rate = float(assumptions["discount_rate"]["value"])
    terminal_growth = float(assumptions["terminal_growth_rate"]["value"])
    net_debt = _finite(assumptions["net_debt"]["value"])
    diluted_shares = _finite(assumptions["diluted_shares"]["value"])
    scenarios: dict[str, Any] = {}
    for scenario in ("bull", "base", "bear"):
        scenarios[scenario] = calculate_dcf(
            forecast_financials.get(scenario, []),
            discount_rate=discount_rate,
            terminal_growth_rate=terminal_growth,
            net_debt=net_debt,
            diluted_shares=diluted_shares,
        )
    discount_rates = [max(0.001, discount_rate - 0.01), discount_rate, discount_rate + 0.01]
    terminal_rates = [
        max(-0.05, terminal_growth - 0.005),
        terminal_growth,
        terminal_growth + 0.005,
    ]
    sensitivity = dcf_sensitivity(
        forecast_financials.get("base", []),
        discount_rates=discount_rates,
        terminal_growth_rates=terminal_rates,
        net_debt=net_debt,
        diluted_shares=diluted_shares,
    )
    values = [
        scenario_result.get("implied_value_per_share")
        for scenario_result in scenarios.values()
        if scenario_result.get("implied_value_per_share") is not None
    ]
    return {
        "title": "Valuation Assessment",
        "assessment_label": "Model-Implied Value Range",
        "assumptions": assumptions,
        "scenarios": scenarios,
        "model_implied_value_range": {
            "low": min(values) if values else None,
            "high": max(values) if values else None,
            "unit": "USD/share",
        },
        "sensitivity": sensitivity,
        "historical_multiples": calculate_historical_multiples(metrics),
        "peer_multiple_inputs": assumptions["peer_multiples"],
        "research_view": "No Buy, Hold, or Sell rating is generated.",
    }
