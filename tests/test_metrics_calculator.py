from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from src.metrics_calculator import FORMULA_DEFINITIONS, calculate_metrics


@pytest.fixture
def financials():
    return pd.DataFrame(
        {
            "revenue": [100.0, 120.0],
            "gross_profit": [40.0, 54.0],
            "operating_income": [20.0, 30.0],
            "pretax_income": [18.0, 27.0],
            "tax_expense": [3.6, 5.4],
            "net_income": [14.4, 21.6],
            "operating_cash_flow": [22.0, 32.0],
            "capex": [5.0, 7.0],
            "cash": [20.0, 24.0],
            "assets": [200.0, 230.0],
            "liabilities": [110.0, 125.0],
            "equity": [90.0, 105.0],
            "current_assets": [60.0, 72.0],
            "current_liabilities": [30.0, 36.0],
            "inventory": [10.0, 12.0],
            "receivables": [15.0, 18.0],
            "long_term_debt": [45.0, 50.0],
            "total_debt_reported": [50.0, 56.0],
            "current_debt_maturities": [5.0, 6.0],
            "short_term_borrowings": [2.0, 3.0],
            "diluted_shares": [10.0, 10.2],
            "depreciation_and_amortization": [4.0, 5.0],
            "interest_expense": [2.0, 2.5],
            "research_and_development": [8.0, 10.0],
            "sales_and_marketing": [6.0, 7.0],
            "stock_based_compensation": [3.0, 4.0],
        },
        index=pd.Index([2023, 2024], name="fiscal_year"),
    )


def test_existing_and_new_formulas(financials):
    result = calculate_metrics(financials)
    latest = result.loc[2024]
    assert latest["total_debt"] == 56.0
    assert latest["net_debt"] == 32.0
    assert latest["free_cash_flow"] == 25.0
    assert latest["revenue_growth"] == pytest.approx(0.2)
    assert latest["gross_margin"] == pytest.approx(0.45)
    assert latest["operating_margin"] == pytest.approx(0.25)
    assert latest["current_ratio"] == pytest.approx(2.0)
    assert latest["free_cash_flow_margin"] == pytest.approx(25 / 120)
    assert latest["capex_intensity"] == pytest.approx(7 / 120)
    assert latest["interest_coverage"] == pytest.approx(12)
    assert latest["debt_to_ebitda"] == pytest.approx(56 / 35)
    assert latest["quick_ratio"] == pytest.approx((72 - 12) / 36)
    assert latest["dilution"] == pytest.approx(0.02)


def test_reported_total_debt_prevents_double_counting(financials):
    result = calculate_metrics(financials)
    assert result.loc[2024, "total_debt"] == 56
    assert result.loc[2024, "total_debt"] != 50 + 6 + 3


def test_component_debt_fallback(financials):
    financials["total_debt_reported"] = np.nan
    financials["short_term_debt"] = np.nan
    result = calculate_metrics(financials)
    assert result.loc[2024, "total_debt"] == 50 + 6 + 3


def test_market_input_multiples(financials):
    result = calculate_metrics(financials, {"share_price": 20.0, "diluted_shares": 10.0})
    latest = result.iloc[-1]
    assert latest["market_cap"] == 200
    assert latest["enterprise_value"] == 232
    assert latest["ev_revenue"] == pytest.approx(232 / 120)
    assert latest["price_earnings"] == pytest.approx(200 / 21.6)


def test_division_by_zero_is_null(financials):
    financials.loc[2024, "revenue"] = 0
    result = calculate_metrics(financials)
    assert pd.isna(result.loc[2024, "gross_margin"])
    assert pd.isna(result.loc[2024, "ocf_margin"])


def test_every_formula_defines_required_behavior():
    required = {"required_inputs", "formula", "unit", "null_behavior", "zero_behavior", "period_behavior"}
    assert FORMULA_DEFINITIONS
    assert all(required.issubset(definition) for definition in FORMULA_DEFINITIONS.values())
