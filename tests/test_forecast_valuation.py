from __future__ import annotations

import pandas as pd
import pytest

from src.forecast_engine import build_forecast_assumptions, forecast_scenarios
from src.metrics_calculator import calculate_metrics
from src.valuation_engine import (
    ValuationError,
    build_valuation_assumptions,
    calculate_dcf,
    calculate_valuation,
)


@pytest.fixture
def metrics():
    frame = pd.DataFrame(
        {
            "revenue": [100.0, 110.0, 121.0],
            "operating_income": [20.0, 23.0, 26.0],
            "pretax_income": [18.0, 21.0, 24.0],
            "tax_expense": [3.6, 4.2, 4.8],
            "net_income": [14.4, 16.8, 19.2],
            "operating_cash_flow": [20.0, 24.0, 28.0],
            "capex": [5.0, 5.5, 6.0],
            "current_assets": [40.0, 44.0, 48.0],
            "current_liabilities": [20.0, 22.0, 24.0],
            "cash": [10.0, 12.0, 14.0],
            "assets": [150.0, 165.0, 180.0],
            "equity": [80.0, 90.0, 100.0],
            "total_debt_reported": [30.0, 32.0, 34.0],
            "diluted_shares": [10.0, 10.0, 10.0],
            "depreciation_and_amortization": [4.0, 4.4, 4.8],
        },
        index=pd.Index([2022, 2023, 2024], name="fiscal_year"),
    )
    return calculate_metrics(frame)


def test_forecast_assumptions_are_visible_and_overridable(metrics):
    assumptions = build_forecast_assumptions(
        metrics, user_overrides={"base": {"revenue_growth": 0.08}}
    )
    payload = assumptions["scenarios"]["base"]["revenue_growth"]
    assert payload["value"] == 0.08
    assert payload["source"] == "User assumption"


def test_forecast_formula_reconciles(metrics):
    assumptions = build_forecast_assumptions(metrics, forecast_years=3)
    forecasts = forecast_scenarios(metrics, assumptions)
    assert len(forecasts["base"]) == 3
    row = forecasts["base"][0]
    expected = row["nopat"] + row["depreciation_and_amortization"] - row["capex"] - row["change_in_net_working_capital"]
    assert row["unlevered_free_cash_flow"] == pytest.approx(expected)
    assert row["estimate_label"] == "E"


def test_dcf_reconciles(metrics):
    forecasts = forecast_scenarios(metrics, build_forecast_assumptions(metrics))
    result = calculate_dcf(
        forecasts["base"],
        discount_rate=0.09,
        terminal_growth_rate=0.025,
        net_debt=20,
        diluted_shares=10,
    )
    assert result["enterprise_value"] == pytest.approx(
        result["present_value_forecast_cash_flows"] + result["present_value_terminal_value"]
    )
    assert result["equity_value"] == pytest.approx(result["enterprise_value"] - 20)
    assert result["implied_value_per_share"] == pytest.approx(result["equity_value"] / 10)


def test_full_valuation_produces_scenarios_and_sensitivity(metrics):
    forecasts = forecast_scenarios(metrics, build_forecast_assumptions(metrics))
    assumptions = build_valuation_assumptions(metrics)
    result = calculate_valuation(forecasts, assumptions, metrics)
    assert set(result["scenarios"]) == {"bull", "base", "bear"}
    assert len(result["sensitivity"]) == 3
    assert "Buy" in result["research_view"] and "No" in result["research_view"]


def test_invalid_terminal_growth_is_rejected(metrics):
    with pytest.raises(ValuationError):
        build_valuation_assumptions(
            metrics, {"discount_rate": 0.02, "terminal_growth_rate": 0.03}
        )
