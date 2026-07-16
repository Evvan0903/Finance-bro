"""Transparent historical-trend and user-input forecast scenarios."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

import numpy as np
import pandas as pd


ASSUMPTION_SOURCES = {
    "Company guidance",
    "Historical trend",
    "User assumption",
    "AI-suggested assumption",
    "System-calculated",
}


def _finite(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
        return number if np.isfinite(number) else default
    except (TypeError, ValueError):
        return default


def _median(series: pd.Series, default: float = 0.0) -> float:
    clean = pd.to_numeric(series, errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
    return float(clean.tail(3).median()) if not clean.empty else default


def _assumption(value: float, source: str, unit: str, description: str) -> dict[str, Any]:
    if source not in ASSUMPTION_SOURCES:
        raise ValueError(f"Unsupported forecast assumption source: {source}")
    return {
        "value": float(value),
        "source": source,
        "unit": unit,
        "description": description,
    }


def _historical_defaults(metrics: pd.DataFrame) -> dict[str, float]:
    latest = metrics.iloc[-1] if not metrics.empty else pd.Series(dtype=float)
    revenue = metrics.get("revenue", pd.Series(index=metrics.index, dtype=float))
    capex = metrics.get("capex", pd.Series(index=metrics.index, dtype=float)).abs()
    depreciation = metrics.get(
        "depreciation_and_amortization", pd.Series(index=metrics.index, dtype=float)
    )
    current_assets = metrics.get("current_assets", pd.Series(index=metrics.index, dtype=float))
    current_liabilities = metrics.get(
        "current_liabilities", pd.Series(index=metrics.index, dtype=float)
    )
    return {
        "revenue_growth": _median(metrics.get("revenue_growth", pd.Series(dtype=float)), 0.0),
        "operating_margin": _finite(latest.get("operating_margin"), 0.0),
        "tax_rate": _finite(latest.get("effective_tax_rate"), 0.21),
        "capex_intensity": _median(capex / revenue.replace(0, np.nan), 0.0),
        "depreciation_intensity": _median(depreciation / revenue.replace(0, np.nan), 0.0),
        "net_working_capital_intensity": _finite(
            (latest.get("current_assets") - latest.get("current_liabilities"))
            / latest.get("revenue")
            if pd.notna(latest.get("current_assets"))
            and pd.notna(latest.get("current_liabilities"))
            and _finite(latest.get("revenue")) != 0
            else 0.0,
            0.0,
        ),
        "share_count_growth": _median(metrics.get("dilution", pd.Series(dtype=float)), 0.0),
    }


def build_forecast_assumptions(
    metrics: pd.DataFrame,
    *,
    forecast_years: int = 3,
    management_guidance: dict[str, dict[str, float]] | None = None,
    user_overrides: dict[str, dict[str, float]] | None = None,
) -> dict[str, Any]:
    """Build visible bull/base/bear assumptions without overwriting higher-priority inputs."""
    defaults = _historical_defaults(metrics)
    scenario_adjustments = {
        "base": {"revenue_growth": 0.0, "operating_margin": 0.0},
        "bull": {"revenue_growth": 0.03, "operating_margin": 0.02},
        "bear": {"revenue_growth": -0.03, "operating_margin": -0.02},
    }
    descriptions = {
        "revenue_growth": "Annual revenue growth assumption",
        "operating_margin": "Operating income as a percentage of revenue",
        "tax_rate": "Cash tax proxy applied to operating income",
        "capex_intensity": "Capital expenditures as a percentage of revenue",
        "depreciation_intensity": "Depreciation and amortization as a percentage of revenue",
        "net_working_capital_intensity": "Net working capital as a percentage of revenue",
        "share_count_growth": "Annual diluted share-count change",
    }
    assumptions: dict[str, Any] = {
        "forecast_years": max(1, min(int(forecast_years), 10)),
        "scenarios": {},
    }
    for scenario, adjustments in scenario_adjustments.items():
        assumptions["scenarios"][scenario] = {}
        for name, value in defaults.items():
            adjusted = value + adjustments.get(name, 0.0)
            assumptions["scenarios"][scenario][name] = _assumption(
                adjusted, "Historical trend", "ratio", descriptions[name]
            )

    for supplied, source in (
        (management_guidance or {}, "Company guidance"),
        (user_overrides or {}, "User assumption"),
    ):
        for scenario, values in supplied.items():
            if scenario not in assumptions["scenarios"] or not isinstance(values, dict):
                continue
            for name, value in values.items():
                if name not in assumptions["scenarios"][scenario] or value is None:
                    continue
                assumptions["scenarios"][scenario][name] = _assumption(
                    float(value), source, "ratio", descriptions[name]
                )
    return assumptions


def forecast_scenarios(
    historical_metrics: pd.DataFrame,
    assumptions: dict[str, Any],
) -> dict[str, list[dict[str, Any]]]:
    """Calculate forecast financials for each scenario from explicit assumptions."""
    if historical_metrics.empty or historical_metrics.get("revenue", pd.Series(dtype=float)).dropna().empty:
        return {scenario: [] for scenario in ("bull", "base", "bear")}
    latest = historical_metrics.iloc[-1]
    try:
        last_year = int(str(historical_metrics.index[-1]).split("-")[0])
    except (TypeError, ValueError):
        last_year = pd.Timestamp.today().year
    forecast_years = int(assumptions.get("forecast_years", 3))
    output: dict[str, list[dict[str, Any]]] = {}
    for scenario in ("bull", "base", "bear"):
        scenario_assumptions = assumptions.get("scenarios", {}).get(scenario, {})
        if not scenario_assumptions:
            output[scenario] = []
            continue
        values = {
            name: _finite(payload.get("value"))
            for name, payload in scenario_assumptions.items()
            if isinstance(payload, dict)
        }
        revenue = _finite(latest.get("revenue"))
        diluted_shares = _finite(latest.get("diluted_shares"), np.nan)
        prior_nwc = _finite(latest.get("revenue")) * values.get(
            "net_working_capital_intensity", 0.0
        )
        rows: list[dict[str, Any]] = []
        for offset in range(1, forecast_years + 1):
            fiscal_year = last_year + offset
            revenue *= 1 + values.get("revenue_growth", 0.0)
            operating_income = revenue * values.get("operating_margin", 0.0)
            tax_rate = values.get("tax_rate", 0.21)
            nopat = operating_income * (1 - tax_rate)
            depreciation = revenue * values.get("depreciation_intensity", 0.0)
            capex = revenue * values.get("capex_intensity", 0.0)
            nwc = revenue * values.get("net_working_capital_intensity", 0.0)
            change_in_nwc = nwc - prior_nwc
            unlevered_fcf = nopat + depreciation - capex - change_in_nwc
            if np.isfinite(diluted_shares):
                diluted_shares *= 1 + values.get("share_count_growth", 0.0)
            rows.append(
                {
                    "fiscal_year": fiscal_year,
                    "period_type": "Forecast",
                    "estimate_label": "E",
                    "scenario": scenario,
                    "revenue": revenue,
                    "revenue_growth": values.get("revenue_growth", 0.0),
                    "operating_margin": values.get("operating_margin", 0.0),
                    "operating_income": operating_income,
                    "tax_rate": tax_rate,
                    "nopat": nopat,
                    "depreciation_and_amortization": depreciation,
                    "capex": capex,
                    "net_working_capital": nwc,
                    "change_in_net_working_capital": change_in_nwc,
                    "unlevered_free_cash_flow": unlevered_fcf,
                    "diluted_shares": diluted_shares if np.isfinite(diluted_shares) else None,
                    "source_type": "SYSTEM_CALCULATION",
                }
            )
            prior_nwc = nwc
        output[scenario] = rows
    return output


def update_forecast_assumptions(
    assumptions: dict[str, Any], user_overrides: dict[str, dict[str, float]]
) -> dict[str, Any]:
    """Apply explicit user changes while retaining a visible audit label."""
    updated = deepcopy(assumptions)
    for scenario, values in user_overrides.items():
        for name, value in values.items():
            target = updated.get("scenarios", {}).get(scenario, {}).get(name)
            if target is not None and value is not None:
                target["value"] = float(value)
                target["source"] = "User assumption"
    return updated
