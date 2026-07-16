"""Generate compatible Plotly charts with consistent sources, units, and period labels."""

from __future__ import annotations

from typing import Any

import pandas as pd
import plotly.graph_objects as go

from src.config_loader import load_config


COLORS = {
    "revenue": "#2563EB",
    "net_income": "#15803D",
    "gross_margin": "#7C3AED",
    "operating_margin": "#EA580C",
    "net_margin": "#15803D",
    "cash": "#0891B2",
    "total_debt": "#B91C1C",
    "operating_cash_flow": "#0284C7",
    "free_cash_flow": "#0F766E",
    "bull": "#15803D",
    "base": "#2563EB",
    "bear": "#B91C1C",
}


def _base_figure(
    title: str,
    y_title: str,
    *,
    source_label: str,
    as_of_date: str | None,
    percent_axis: bool = False,
) -> go.Figure:
    style = load_config("style")
    chart_style = style.get("charts", {})
    footer = f"Source: {source_label}"
    if as_of_date:
        footer += f" | As of {as_of_date}"
    figure = go.Figure()
    figure.update_layout(
        title={"text": title, "x": 0.01, "xanchor": "left"},
        template=chart_style.get("template", "plotly_white"),
        height=int(chart_style.get("height_px", 390)),
        margin=dict(l=48, r=24, t=70, b=72),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        xaxis_title="Fiscal Period",
        yaxis_title=y_title,
        hovermode="x unified",
        annotations=[
            dict(
                text=footer,
                x=0,
                y=-0.22,
                xref="paper",
                yref="paper",
                xanchor="left",
                showarrow=False,
                font=dict(size=10, color="#64748B"),
            )
        ],
    )
    figure.update_xaxes(showgrid=False)
    figure.update_yaxes(
        tickformat=".1%" if percent_axis else "~s",
        rangemode="normal" if percent_axis else "tozero",
        zeroline=True,
        zerolinecolor="#94A3B8",
    )
    return figure


def _add_line(
    figure: go.Figure,
    metrics: pd.DataFrame,
    column: str,
    label: str,
    *,
    dash: str = "solid",
) -> None:
    if column in metrics and metrics[column].notna().any():
        figure.add_trace(
            go.Scatter(
                x=metrics.index.astype(str),
                y=metrics[column],
                name=label,
                mode="lines+markers",
                connectgaps=False,
                line=dict(color=COLORS.get(column), width=2.5, dash=dash),
                marker=dict(size=7),
                customdata=[["Actual"]] * len(metrics),
                hovertemplate="%{x}<br>%{y:,.2f}<br>Actual<extra>%{fullData.name}</extra>",
            )
        )


def generate_charts(
    metrics: pd.DataFrame,
    quarterly_metrics: pd.DataFrame | None = None,
    forecast_financials: dict[str, list[dict[str, Any]]] | None = None,
    *,
    source_label: str = "SEC Company Facts; system calculations",
    as_of_date: str | None = None,
) -> dict[str, go.Figure]:
    """Create the five MVP charts plus distinct quarterly/forecast/FCF views when data exists."""
    if as_of_date is None and not metrics.empty:
        as_of_date = str(metrics.index[-1])
    revenue = _base_figure(
        "Revenue Trend", "USD", source_label=source_label, as_of_date=as_of_date
    )
    _add_line(revenue, metrics, "revenue", "Revenue (A)")

    net_income = _base_figure(
        "Net Income Trend", "USD", source_label=source_label, as_of_date=as_of_date
    )
    _add_line(net_income, metrics, "net_income", "Net Income (A)")

    margins = _base_figure(
        "Margin Trend",
        "Margin",
        source_label=source_label,
        as_of_date=as_of_date,
        percent_axis=True,
    )
    for column, label in (
        ("gross_margin", "Gross Margin (A)"),
        ("operating_margin", "Operating Margin (A)"),
        ("net_margin", "Net Margin (A)"),
    ):
        _add_line(margins, metrics, column, label)

    cash_debt = _base_figure(
        "Cash vs Debt Trend", "USD", source_label=source_label, as_of_date=as_of_date
    )
    _add_line(cash_debt, metrics, "cash", "Cash (A)")
    _add_line(cash_debt, metrics, "total_debt", "Total Debt (A)")

    cash_flow = _base_figure(
        "Operating Cash Flow vs Net Income",
        "USD",
        source_label=source_label,
        as_of_date=as_of_date,
    )
    _add_line(cash_flow, metrics, "operating_cash_flow", "Operating Cash Flow (A)")
    _add_line(cash_flow, metrics, "net_income", "Net Income (A)")

    charts: dict[str, go.Figure] = {
        "revenue": revenue,
        "net_income": net_income,
        "margins": margins,
        "cash_debt": cash_debt,
        "cash_flow": cash_flow,
    }

    if "free_cash_flow" in metrics and metrics["free_cash_flow"].notna().any():
        free_cash_flow = _base_figure(
            "Free Cash Flow", "USD", source_label=source_label, as_of_date=as_of_date
        )
        _add_line(free_cash_flow, metrics, "free_cash_flow", "Free Cash Flow (A)")
        charts["free_cash_flow"] = free_cash_flow

    quarterly = quarterly_metrics if quarterly_metrics is not None else pd.DataFrame()
    if not quarterly.empty and "revenue" in quarterly and quarterly["revenue"].notna().any():
        quarterly_revenue = _base_figure(
            "Quarterly Revenue and Sequential Growth",
            "USD",
            source_label=source_label,
            as_of_date=str(quarterly.index[-1]),
        )
        _add_line(quarterly_revenue, quarterly, "revenue", "Quarterly Revenue (A)")
        if "sequential_revenue_growth" in quarterly and quarterly["sequential_revenue_growth"].notna().any():
            quarterly_revenue.add_trace(
                go.Bar(
                    x=quarterly.index.astype(str),
                    y=quarterly["sequential_revenue_growth"],
                    name="Sequential Growth (A)",
                    opacity=0.25,
                    yaxis="y2",
                    marker_color="#7C3AED",
                )
            )
            quarterly_revenue.update_layout(
                yaxis2=dict(
                    title="Sequential Growth",
                    overlaying="y",
                    side="right",
                    tickformat=".1%",
                    showgrid=False,
                    zeroline=True,
                )
            )
        charts["quarterly_revenue"] = quarterly_revenue

    forecasts = forecast_financials or {}
    if any(forecasts.get(scenario) for scenario in ("bull", "base", "bear")):
        forecast_chart = _base_figure(
            "Revenue Scenarios - Actual vs Forecast",
            "USD",
            source_label=f"{source_label}; visible scenario assumptions",
            as_of_date=as_of_date,
        )
        _add_line(forecast_chart, metrics, "revenue", "Historical Revenue (A)")
        for scenario in ("bull", "base", "bear"):
            rows = forecasts.get(scenario, [])
            if not rows:
                continue
            forecast_chart.add_trace(
                go.Scatter(
                    x=[f"{row['fiscal_year']}E" for row in rows],
                    y=[row.get("revenue") for row in rows],
                    name=f"{scenario.title()} Revenue (E)",
                    mode="lines+markers",
                    connectgaps=False,
                    line=dict(color=COLORS[scenario], width=2.5, dash="dash"),
                    marker=dict(size=7, symbol="diamond-open"),
                    hovertemplate="%{x}<br>%{y:,.2f}<br>Forecast<extra>%{fullData.name}</extra>",
                )
            )
        charts["forecast_revenue"] = forecast_chart
    return charts


def build_chart_metadata(
    charts: dict[str, go.Figure],
    *,
    source_ids: list[str],
    as_of_date: str | None,
) -> list[dict[str, Any]]:
    """Create serializable chart records for the shared research object."""
    return [
        {
            "chart_id": chart_id,
            "title": str(figure.layout.title.text or chart_id),
            "source_ids": source_ids,
            "as_of_date": as_of_date,
            "units": str(figure.layout.yaxis.title.text or ""),
            "actual_forecast_labels": True,
            "figure_type": "plotly",
        }
        for chart_id, figure in charts.items()
    ]
