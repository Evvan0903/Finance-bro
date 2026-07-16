"""Render HTML and PDF exports from one structured research object."""

from __future__ import annotations

from datetime import datetime
from html import escape as html_escape
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape as xml_escape

from jinja2 import Environment, select_autoescape
from markupsafe import Markup
import pandas as pd
import plotly.graph_objects as go

from src.config_loader import load_config
from src.research_object import empty_research_object
from src.utils import (
    PDF_OUTPUTS_DIR,
    PROJECT_ROOT,
    clean_for_json,
    dataframe_records,
    format_currency,
    format_percent,
    format_ratio,
    utc_now_iso,
)


DISCLAIMER = (
    "This institutional-style research report is generated from public filings and visible "
    "assumptions for educational and analytical purposes. It is not investment advice, a "
    "recommendation, or affiliated with or endorsed by any financial institution."
)


class PDFExportError(RuntimeError):
    """Raised when the optional PDF rendering toolchain is unavailable."""


_ENV = Environment(
    autoescape=select_autoescape(default=True, default_for_string=True),
    trim_blocks=True,
    lstrip_blocks=True,
)


REPORT_TEMPLATE = _ENV.from_string(
    """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ company.name }} {{ 'Financial Dashboard' if dashboard_only else 'Institutional-Style Research Report' }}</title>
  <style>
    :root { --navy:#102a56; --blue:#2563eb; --teal:#0f766e; --ink:#172033;
      --muted:#64748b; --line:#dce3ed; --bg:#f5f7fb; --paper:#fff; --purple:#7c3aed; }
    * { box-sizing:border-box; }
    body { margin:0; color:var(--ink); background:var(--bg); font-family:Arial,Helvetica,sans-serif;
      font-size:14px; line-height:1.52; }
    main { max-width:1240px; margin:0 auto; padding:28px 24px 64px; }
    .cover { color:white; background:linear-gradient(135deg,#0b1f41,#173b72); border-radius:16px;
      padding:30px 32px; box-shadow:0 14px 36px #0f172a22; }
    .eyebrow { text-transform:uppercase; letter-spacing:.12em; font-size:11px; color:#bfdbfe; font-weight:700; }
    h1 { font-size:32px; margin:6px 0 4px; line-height:1.15; } h2 { color:var(--navy); margin:0 0 14px; }
    h3 { color:#1e3a8a; margin:18px 0 7px; } a { color:var(--blue); }
    .cover a { color:#dbeafe; } .subtitle { color:#dbeafe; }
    .meta { display:grid; grid-template-columns:repeat(auto-fit,minmax(155px,1fr)); gap:12px; margin-top:22px; }
    .meta-item { border-top:1px solid #ffffff35; padding-top:9px; }
    .meta-label,.label { color:var(--muted); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; }
    .meta-label { color:#bfdbfe; } .meta-value { font-weight:700; margin-top:3px; }
    .status { display:inline-block; margin-top:16px; padding:6px 10px; border-radius:999px;
      background:#ffffff18; border:1px solid #ffffff33; font-size:12px; }
    .panel { background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:22px;
      margin:18px 0; box-shadow:0 3px 12px #0f172a0a; }
    .section-number { color:var(--teal); font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
    .kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .kpi { background:#f8fafc; border:1px solid var(--line); border-radius:9px; padding:14px; }
    .value { font-size:22px; font-weight:800; color:var(--navy); margin-top:4px; }
    .grid-2 { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
    .thesis { border-left:4px solid var(--blue); background:#eff6ff; padding:12px 14px; margin:9px 0; }
    .warning { background:#fff7ed; border:1px solid #fed7aa; color:#9a3412; border-radius:8px; padding:12px; }
    .limitation { background:#f8fafc; border-left:3px solid #94a3b8; padding:10px 12px; margin:8px 0; color:#475569; }
    .chart { border:1px solid var(--line); border-radius:9px; padding:8px; margin:14px 0; break-inside:avoid; }
    .chart-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
    table { border-collapse:collapse; width:100%; font-size:12px; margin:10px 0 18px; }
    th { background:var(--navy); color:white; text-align:right; padding:8px; position:sticky; top:0; }
    th:first-child,td:first-child { text-align:left; } td { padding:7px 8px; text-align:right; border-bottom:1px solid var(--line); }
    tbody tr:nth-child(even) { background:#f8fafc; }
    .table-scroll { overflow-x:auto; } .tag { font-size:11px; border:1px solid var(--line); border-radius:999px; padding:3px 7px; }
    .source-list { padding-left:20px; } .source-list li { margin:8px 0; overflow-wrap:anywhere; }
    .disclosure { font-size:12px; color:#475569; border-top:1px solid var(--line); padding-top:16px; }
    .qa-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
    .qa-score { text-align:center; border:1px solid var(--line); border-radius:8px; padding:10px; }
    .qa-score strong { display:block; font-size:20px; color:var(--navy); }
    @media(max-width:900px){.kpis,.grid-2,.chart-grid,.qa-grid{grid-template-columns:1fr 1fr}}
    @media(max-width:600px){main{padding:14px}.kpis,.grid-2,.chart-grid,.qa-grid{grid-template-columns:1fr}h1{font-size:26px}}
    @media print { body{background:white;font-size:10pt} main{max-width:none;padding:0}.panel,.cover{box-shadow:none}
      .panel{break-inside:auto}.chart{break-inside:avoid}.page-break{break-before:page}a{color:inherit;text-decoration:none}
      @page{size:Letter;margin:.55in} }
  </style>
</head>
<body><main>
  <header class="cover">
    <div class="eyebrow">SEC Financial Report Agent</div>
    <h1>{{ company.name }} ({{ company.ticker }})</h1>
    <div class="subtitle">{{ 'Financial Dashboard' if dashboard_only else 'Institutional-Style Equity Research Report' }}</div>
    <div class="meta">
      {% for label, value in cover_items %}<div class="meta-item"><div class="meta-label">{{ label }}</div><div class="meta-value">{{ value }}</div></div>{% endfor %}
    </div>
    <div class="status">{{ metadata.quality_label }} · Version {{ metadata.report_version }}</div>
  </header>

  <section class="panel">
    <div class="section-number">Section 1</div><h2>Research Dashboard</h2>
    <div class="kpis">{% for label, value in kpi_items %}<div class="kpi"><div class="label">{{ label }}</div><div class="value">{{ value }}</div></div>{% endfor %}</div>
    <h3>Three-Point Research View</h3>
    {% for item in thesis %}<div class="thesis">{{ item.point }}</div>{% else %}<div class="limitation">Insufficient public data.</div>{% endfor %}
    <div class="grid-2"><div><h3>Main Catalysts</h3>{% for item in catalysts %}<p>{{ item.description }}</p>{% endfor %}</div>
    <div><h3>Main Risks</h3>{% for item in risks %}<p>{{ item.description }}</p>{% endfor %}</div></div>
    <div class="warning">{{ disclosure }}</div>
  </section>

  <section class="panel"><h2>Original Financial Charts</h2><div class="chart-grid">
    {% for chart in charts %}<div class="chart">{{ chart }}</div>{% endfor %}
  </div></section>

  {% if not dashboard_only %}
  <section class="panel page-break"><div class="section-number">Section 2</div><h2>Company Overview</h2>
    <div class="grid-2"><div><p><strong>Industry:</strong> {{ company.industry }}</p><p><strong>Sector profile:</strong> {{ company.sector }}</p>
    <p>{{ company.business_model }}</p></div><div><p><strong>Products and services:</strong> Not disclosed by the structured numerical pipeline.</p>
    <p><strong>Geographic exposure and customer concentration:</strong> Review cited filing text; no values are inferred.</p></div></div>
  </section>

  <section class="panel"><div class="section-number">Section 3</div><h2>Historical Financial Performance</h2>
    <h3>Annual Actuals</h3><div class="table-scroll"><table><thead><tr>{% for header in annual_table.headers %}<th>{{ header }}</th>{% endfor %}</tr></thead>
    <tbody>{% for row in annual_table.rows %}<tr>{% for cell in row %}<td>{{ cell }}</td>{% endfor %}</tr>{% endfor %}</tbody></table></div>
    <h3>Quarterly Actuals</h3>{% if quarterly_table.rows %}<div class="table-scroll"><table><thead><tr>{% for header in quarterly_table.headers %}<th>{{ header }}</th>{% endfor %}</tr></thead>
    <tbody>{% for row in quarterly_table.rows %}<tr>{% for cell in row %}<td>{{ cell }}</td>{% endfor %}</tr>{% endfor %}</tbody></table></div>{% else %}<div class="limitation">Quarterly XBRL facts were unavailable.</div>{% endif %}
    {% for title,text in summary.items() %}<h3>{{ title }}</h3><p>{{ text }}</p>{% endfor %}
  </section>

  <section class="panel"><div class="section-number">Section 4</div><h2>Segment and KPI Analysis</h2>
    <p>{{ segment.status }}</p><div class="limitation">{{ segment.limitation }}</div>
    <p><strong>Configured sector KPIs:</strong> {{ configured_kpis|join(', ') if configured_kpis else 'Data unavailable' }}</p>
  </section>

  <section class="panel"><div class="section-number">Section 5</div><h2>Management Commentary</h2>
    <p><strong>Generation path:</strong> {{ commentary.generation_source }}</p><p><strong>Guidance:</strong> {{ commentary.guidance }}</p>
    {% for section in commentary.filing_sections %}<p><span class="tag">{{ section.filing_type }}</span> {{ section.section_name }} —
      <a href="{{ section.source_url }}">filed {{ section.filing_date }}</a>; extraction confidence {{ section.extraction_confidence }}.</p>{% else %}<div class="limitation">No filing-text commentary was extracted.</div>{% endfor %}
  </section>

  <section class="panel"><div class="section-number">Section 6</div><h2>Industry and Competitive Position</h2>
    <div class="grid-2"><div><h3>Industry Analysis</h3><p>{{ industry.status }}</p><div class="limitation">{{ industry.limitation }}</div></div>
    <div><h3>Competitive Positioning</h3><p>{{ competition.status }}</p><div class="limitation">{{ competition.limitation }}</div></div></div>
  </section>

  <section class="panel page-break"><div class="section-number">Section 7</div><h2>Forecast and Scenarios</h2>
    <p>Forecast periods are labeled E and remain separate from SEC-reported actuals labeled A.</p>
    <h3>Visible Assumptions</h3><div class="table-scroll"><table><thead><tr><th>Scenario</th><th>Assumption</th><th>Value</th><th>Source</th></tr></thead>
    <tbody>{% for row in assumption_rows %}<tr><td>{{ row.scenario }}</td><td>{{ row.name }}</td><td>{{ row.value }}</td><td>{{ row.source }}</td></tr>{% endfor %}</tbody></table></div>
    <h3>Scenario Forecasts</h3><div class="table-scroll"><table><thead><tr><th>Scenario</th><th>Period</th><th>Revenue</th><th>Op. Margin</th><th>UFCF</th><th>A/E</th></tr></thead>
    <tbody>{% for row in forecast_rows %}<tr><td>{{ row.scenario }}</td><td>{{ row.period }}</td><td>{{ row.revenue }}</td><td>{{ row.margin }}</td><td>{{ row.ufcf }}</td><td>E</td></tr>{% endfor %}</tbody></table></div>
  </section>

  <section class="panel"><div class="section-number">Section 8</div><h2>Valuation Assessment</h2>
    <p>{{ valuation.research_view }}</p><h3>Model-Implied Value Range</h3><p class="value">{{ valuation_range }}</p>
    <div class="table-scroll"><table><thead><tr><th>Scenario</th><th>Enterprise Value</th><th>Equity Value</th><th>Implied Value / Share</th><th>Status</th></tr></thead>
    <tbody>{% for row in valuation_rows %}<tr><td>{{ row.scenario }}</td><td>{{ row.enterprise_value }}</td><td>{{ row.equity_value }}</td><td>{{ row.per_share }}</td><td>{{ row.status }}</td></tr>{% endfor %}</tbody></table></div>
    <div class="limitation">No Buy, Hold, or Sell rating is generated. Live market price, peer data, and consensus estimates are absent unless explicitly supplied by the user or a licensed source.</div>
  </section>

  <section class="panel"><div class="section-number">Section 9</div><h2>Catalysts and Risks</h2>
    <div class="grid-2"><div><h3>Catalysts</h3>{% for item in catalysts %}<p>{{ item.description }}</p>{% endfor %}</div>
    <div><h3>Operational, Financial, and Thesis-Breaking Risks</h3>{% for item in risks %}<p>{{ item.description }}</p>{% endfor %}</div></div>
  </section>

  <section class="panel page-break"><div class="section-number">Section 10</div><h2>Appendix, QA, and Sources</h2>
    <h3>QA Summary</h3><p><strong>{{ qa.quality_label }}</strong> — {{ qa.overall_score }}/100</p><div class="qa-grid">
    {% for name,score in qa.scores.items() %}<div class="qa-score"><strong>{{ score }}</strong>{{ name|replace('_',' ')|title }}</div>{% endfor %}</div>
    <h3>Limitations</h3>{% for item in limitations %}<div class="limitation">{{ item }}</div>{% endfor %}
    <h3>SEC Filings and Other Sources</h3><ol class="source-list">{% for source in sources %}<li><strong>[{{ source.source_id }}]</strong>
      {{ source.source_title }}{% if source.accession_number %}; accession {{ source.accession_number }}{% endif %}. <a href="{{ source.url }}">Source link</a>. Retrieved {{ source.retrieved_at }}.</li>{% endfor %}</ol>
    <h3>Calculation Definitions</h3><div class="table-scroll"><table><thead><tr><th>Metric</th><th>Formula</th><th>Unit</th><th>Missing / Zero Behavior</th></tr></thead>
    <tbody>{% for row in calculation_rows %}<tr><td>{{ row.metric }}</td><td>{{ row.formula }}</td><td>{{ row.unit }}</td><td>{{ row.behavior }}</td></tr>{% endfor %}</tbody></table></div>
    <p class="disclosure">{{ disclosure }} Generated {{ metadata.generated_at }}. Report version {{ metadata.report_version }}.</p>
  </section>
  {% endif %}
</main></body></html>"""
)


DISPLAY_COLUMNS = [
    ("fiscal_period", "Fiscal Period", "period"),
    ("fiscal_year", "Fiscal Year", "period"),
    ("fiscal_quarter", "Fiscal Quarter", "period"),
    ("revenue", "Revenue", "currency"),
    ("revenue_growth", "Growth", "percent"),
    ("gross_margin", "Gross Margin", "percent"),
    ("operating_margin", "Op. Margin", "percent"),
    ("net_income", "Net Income", "currency"),
    ("free_cash_flow", "Free Cash Flow", "currency"),
    ("cash", "Cash", "currency"),
    ("total_debt", "Total Debt", "currency"),
]


def _format_cell(value: Any, kind: str) -> str:
    if kind == "currency":
        return format_currency(value)
    if kind == "percent":
        return format_percent(value)
    if kind == "ratio":
        return format_ratio(value)
    return "—" if value is None or (isinstance(value, float) and pd.isna(value)) else str(value)


def _table_view(records: list[dict[str, Any]], period_key: str) -> dict[str, Any]:
    columns = [(period_key, "Fiscal Period", "period")] + [
        item for item in DISPLAY_COLUMNS if item[0] not in {"fiscal_period", "fiscal_year", "fiscal_quarter"}
    ]
    return {
        "headers": [header for _, header, _ in columns],
        "rows": [
            [_format_cell(record.get(key), kind) for key, _, kind in columns]
            for record in records
        ],
    }


def _legacy_research_object(
    company: dict[str, Any], metrics: pd.DataFrame, summary: dict[str, str]
) -> dict[str, Any]:
    research = empty_research_object()
    generated_at = utc_now_iso()
    research["report_metadata"] = {
        "report_version": "2.0",
        "generated_at": generated_at,
        "report_date": generated_at[:10],
        "quality_label": "Research Preview",
        "data_cutoff": company.get("filing_date", "Data unavailable"),
    }
    research["company_profile"] = {
        **company,
        "industry": company.get("sic_description", "Data unavailable"),
        "sector": "Data unavailable",
        "exchange": "Data unavailable",
        "business_model": "Insufficient public data",
    }
    research["historical_annual_financials"] = {
        "records": dataframe_records(metrics, "fiscal_year"),
        "period_type": "Actual",
    }
    research["historical_quarterly_financials"] = {"records": [], "period_type": "Actual"}
    research["management_commentary"] = {
        "analytical_summary": summary,
        "generation_source": "Legacy-compatible report input",
        "guidance": "Not disclosed",
        "filing_sections": [],
    }
    research["investment_thesis"] = [
        {"point": text} for text in list(summary.values())[:3]
    ]
    research["catalysts"] = [{"description": "Insufficient public data"}]
    research["risks"] = [{"description": summary.get("Watch Points", "Insufficient public data")}]
    research["segment_analysis"] = {"status": "Not disclosed", "limitation": "Segment analysis unavailable."}
    research["industry_analysis"] = {"status": "Insufficient public data", "limitation": "No external industry data configured."}
    research["competitive_positioning"] = {"status": "Insufficient public data", "limitation": "No cited competitive evidence configured."}
    research["operating_kpis"] = {"configured_kpis": []}
    research["forecast_assumptions"] = {"scenarios": {}}
    research["forecast_financials"] = {}
    research["valuation"] = {"scenarios": {}, "research_view": "Valuation not calculated.", "model_implied_value_range": {"low": None, "high": None}}
    research["sources"] = [
        {
            "source_id": "S1",
            "source_title": f"SEC {company.get('form', 'filing')}",
            "accession_number": company.get("accession_number"),
            "url": company.get("filing_url", ""),
            "retrieved_at": generated_at,
        }
    ] if company.get("filing_url") else []
    research["limitations"] = ["This compatibility report does not include the full research object."]
    research["qa_results"] = {"quality_label": "Research Preview", "overall_score": 0, "scores": {}}
    research["calculation_definitions"] = {}
    return research


def _render_context(
    research: dict[str, Any], charts: dict[str, go.Figure]
) -> dict[str, Any]:
    company = research.get("company_profile", {})
    metadata = research.get("report_metadata", {})
    annual_records = research.get("historical_annual_financials", {}).get("records", [])
    quarterly_records = research.get("historical_quarterly_financials", {}).get("records", [])
    latest = annual_records[-1] if annual_records else {}
    chart_html = [
        Markup(figure.to_html(full_html=False, include_plotlyjs=True if index == 0 else False))
        for index, figure in enumerate(charts.values())
    ]
    kpi_items = [
        ("Revenue", format_currency(latest.get("revenue"))),
        ("Net Income", format_currency(latest.get("net_income"))),
        ("Net Margin", format_percent(latest.get("net_margin"))),
        ("Free Cash Flow", format_currency(latest.get("free_cash_flow"))),
        ("Cash", format_currency(latest.get("cash"))),
        ("Total Debt", format_currency(latest.get("total_debt"))),
        ("Current Ratio", format_ratio(latest.get("current_ratio"))),
        ("ROIC", format_percent(latest.get("return_on_invested_capital"))),
    ]
    cover_items = [
        ("Ticker", company.get("ticker", "Data unavailable")),
        ("Exchange", company.get("exchange", "Data unavailable")),
        ("Industry", company.get("industry", "Data unavailable")),
        ("Report Date", metadata.get("report_date", "Data unavailable")),
        ("Data Cutoff", metadata.get("data_cutoff", "Data unavailable")),
        ("Filing Coverage", ", ".join(sorted({str(filing.get("form")) for filing in research.get("filings_used", [])})) or "Data unavailable"),
    ]
    assumption_rows = []
    for scenario, assumptions in research.get("forecast_assumptions", {}).get("scenarios", {}).items():
        for name, payload in assumptions.items():
            assumption_rows.append(
                {
                    "scenario": scenario.title(),
                    "name": name.replace("_", " ").title(),
                    "value": format_percent(payload.get("value")),
                    "source": payload.get("source"),
                }
            )
    forecast_rows = []
    for scenario, rows in research.get("forecast_financials", {}).items():
        for row in rows:
            forecast_rows.append(
                {
                    "scenario": scenario.title(),
                    "period": f"{row.get('fiscal_year')}E",
                    "revenue": format_currency(row.get("revenue")),
                    "margin": format_percent(row.get("operating_margin")),
                    "ufcf": format_currency(row.get("unlevered_free_cash_flow")),
                }
            )
    valuation_rows = []
    for scenario, result in research.get("valuation", {}).get("scenarios", {}).items():
        valuation_rows.append(
            {
                "scenario": scenario.title(),
                "enterprise_value": format_currency(result.get("enterprise_value")),
                "equity_value": format_currency(result.get("equity_value")),
                "per_share": format_currency(result.get("implied_value_per_share"), decimals=2),
                "status": result.get("status", "Data unavailable"),
            }
        )
    value_range = research.get("valuation", {}).get("model_implied_value_range", {})
    valuation_range = (
        f"{format_currency(value_range.get('low'), decimals=2)} - "
        f"{format_currency(value_range.get('high'), decimals=2)} per share"
        if value_range.get("low") is not None and value_range.get("high") is not None
        else "Unable to calculate from available filings"
    )
    calculation_rows = [
        {
            "metric": metric.replace("_", " ").title(),
            "formula": definition.get("formula"),
            "unit": definition.get("unit"),
            "behavior": f"{definition.get('null_behavior')}; {definition.get('zero_behavior')}",
        }
        for metric, definition in research.get("calculation_definitions", {}).items()
    ]
    return {
        "company": company,
        "metadata": metadata,
        "cover_items": cover_items,
        "kpi_items": kpi_items,
        "thesis": research.get("investment_thesis", []),
        "catalysts": research.get("catalysts", []),
        "risks": research.get("risks", []),
        "charts": chart_html,
        "summary": research.get("management_commentary", {}).get("analytical_summary", {}),
        "annual_table": _table_view(annual_records, "fiscal_year"),
        "quarterly_table": _table_view(quarterly_records, "fiscal_quarter"),
        "segment": research.get("segment_analysis", {}),
        "configured_kpis": research.get("operating_kpis", {}).get("configured_kpis", []),
        "commentary": research.get("management_commentary", {}),
        "industry": research.get("industry_analysis", {}),
        "competition": research.get("competitive_positioning", {}),
        "assumption_rows": assumption_rows,
        "forecast_rows": forecast_rows,
        "valuation": research.get("valuation", {}),
        "valuation_rows": valuation_rows,
        "valuation_range": valuation_range,
        "qa": research.get("qa_results", {"quality_label": "Research Preview", "overall_score": 0, "scores": {}}),
        "limitations": research.get("limitations", []),
        "sources": research.get("sources", []),
        "calculation_rows": calculation_rows,
        "disclosure": DISCLAIMER,
    }


def generate_research_html_report(
    research: dict[str, Any],
    charts: dict[str, go.Figure],
    *,
    dashboard_only: bool = False,
) -> str:
    """Render the canonical object into one self-contained, autoescaped HTML report."""
    return REPORT_TEMPLATE.render(
        **_render_context(research, charts), dashboard_only=dashboard_only
    )


def generate_html_report(
    company: dict[str, Any],
    metrics: pd.DataFrame,
    charts: dict[str, go.Figure],
    summary: dict[str, str],
    research_object: dict[str, Any] | None = None,
) -> str:
    """Backward-compatible HTML entry point backed by the shared renderer."""
    research = research_object or _legacy_research_object(company, metrics, summary)
    return generate_research_html_report(research, charts)


def generate_dashboard_html(
    company: dict[str, Any],
    metrics: pd.DataFrame,
    charts: dict[str, go.Figure],
    summary: dict[str, str],
    research_object: dict[str, Any] | None = None,
) -> str:
    """Preserve the dashboard-first sample using the same report view model and CSS system."""
    research = research_object or _legacy_research_object(company, metrics, summary)
    return generate_research_html_report(research, charts, dashboard_only=True)


def _pdf_table(data: list[list[Any]], widths: list[float] | None = None):
    from reportlab.lib import colors
    from reportlab.platypus import Table, TableStyle

    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#102A56")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#DCE3ED")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def _reportlab_chart_drawing(figure: go.Figure):
    """Create a print-safe ReportLab chart when browser-based Plotly export is unavailable."""
    from reportlab.graphics.charts.legends import Legend
    from reportlab.graphics.charts.lineplots import LinePlot
    from reportlab.graphics.shapes import Drawing, String
    from reportlab.lib import colors

    drawing = Drawing(510, 260)
    title = str(figure.layout.title.text or "Financial Chart")
    drawing.add(String(12, 240, title, fontName="Helvetica-Bold", fontSize=11, fillColor=colors.HexColor("#102A56")))
    plot = LinePlot()
    plot.x = 48
    plot.y = 45
    plot.width = 430
    plot.height = 165
    categories: list[str] = []
    series: list[list[tuple[float, float]]] = []
    series_names: list[str] = []
    series_colors: list[Any] = []
    dash_patterns: list[list[int] | None] = []
    all_values: list[float] = []
    trace_payloads: list[tuple[Any, list[str], list[Any]]] = []
    for trace in figure.data:
        if getattr(trace, "yaxis", None) == "y2":
            continue
        raw_x = getattr(trace, "x", None)
        raw_y = getattr(trace, "y", None)
        x_values = [str(value) for value in ([] if raw_x is None else list(raw_x))]
        y_values = [] if raw_y is None else list(raw_y)
        for category in x_values:
            if category not in categories:
                categories.append(category)
        trace_payloads.append((trace, x_values, y_values))
    category_positions = {category: index for index, category in enumerate(categories)}
    for trace, x_values, y_values in trace_payloads:
        points: list[tuple[float, float]] = []
        for index, value in enumerate(y_values):
            try:
                number = float(value)
            except (TypeError, ValueError):
                continue
            if pd.isna(number):
                continue
            category = x_values[index] if index < len(x_values) else str(index)
            if category not in category_positions:
                category_positions[category] = len(categories)
                categories.append(category)
            points.append((float(category_positions[category]), number))
            all_values.append(number)
        if not points:
            continue
        series.append(points)
        series_names.append(str(getattr(trace, "name", "Series")))
        color_value = getattr(getattr(trace, "line", None), "color", None) or "#2563EB"
        try:
            series_colors.append(colors.HexColor(str(color_value)))
        except ValueError:
            series_colors.append(colors.HexColor("#2563EB"))
        dash = str(getattr(getattr(trace, "line", None), "dash", "solid") or "solid")
        dash_patterns.append([5, 3] if dash != "solid" else None)
    if not series:
        drawing.add(String(12, 125, "Chart data unavailable", fontName="Helvetica", fontSize=9))
        return drawing
    plot.data = series
    plot.joinedLines = 1
    plot.xValueAxis.valueMin = 0
    plot.xValueAxis.valueMax = max(1, len(categories) - 1)
    plot.xValueAxis.valueSteps = list(range(len(categories)))
    plot.xValueAxis.labelTextFormat = lambda value: categories[int(value)] if 0 <= int(value) < len(categories) else ""
    plot.xValueAxis.labels.fontSize = 6.5
    plot.xValueAxis.labels.angle = 30
    plot.xValueAxis.labels.dy = -5
    minimum = min(all_values)
    maximum = max(all_values)
    plot.yValueAxis.valueMin = min(0.0, minimum) if minimum >= 0 else minimum * 1.08
    plot.yValueAxis.valueMax = maximum * 1.08 if maximum != 0 else 1.0
    plot.yValueAxis.labels.fontSize = 7
    plot.yValueAxis.labelTextFormat = lambda value: f"{value / 1_000_000_000:.1f}B" if abs(value) >= 1_000_000_000 else (f"{value:.1%}" if abs(maximum) <= 2 else f"{value:,.0f}")
    for index, color in enumerate(series_colors):
        plot.lines[index].strokeColor = color
        plot.lines[index].strokeWidth = 1.8
        if dash_patterns[index]:
            plot.lines[index].strokeDashArray = dash_patterns[index]
    drawing.add(plot)
    legend = Legend()
    legend.x = 48
    legend.y = 226
    legend.fontName = "Helvetica"
    legend.fontSize = 6.5
    legend.dx = 7
    legend.dy = 7
    legend.deltax = 100
    legend.columnMaximum = 1
    legend.colorNamePairs = list(zip(series_colors, series_names))
    drawing.add(legend)
    source = "Source: SEC Company Facts; system calculations"
    annotations = list(figure.layout.annotations or [])
    if annotations and getattr(annotations[0], "text", None):
        source = str(annotations[0].text)
    drawing.add(String(12, 12, source[:150], fontName="Helvetica", fontSize=6.5, fillColor=colors.HexColor("#64748B")))
    return drawing


def generate_pdf_report(
    research: dict[str, Any],
    output_path: Path | str | None = None,
    charts: dict[str, go.Figure] | None = None,
) -> Path:
    """Render a paginated PDF from the same canonical research object used by HTML."""
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER
        from reportlab.lib.pagesizes import LETTER
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.platypus import (
            Image,
            PageBreak,
            Paragraph,
            SimpleDocTemplate,
            Spacer,
        )
    except ImportError as exc:
        raise PDFExportError(
            "PDF export requires reportlab. Install the optional PDF dependencies from requirements.txt."
        ) from exc

    ticker = str(research.get("company_profile", {}).get("ticker") or "REPORT")
    path = Path(output_path) if output_path else PDF_OUTPUTS_DIR / f"{ticker}_SEC_financial_report.pdf"
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_dir = PROJECT_ROOT / "tmp" / "pdfs"
    temp_dir.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="ReportTitle", parent=styles["Title"], textColor=colors.HexColor("#102A56"), fontSize=22, leading=26, spaceAfter=12))
    styles.add(ParagraphStyle(name="Section", parent=styles["Heading1"], textColor=colors.HexColor("#102A56"), fontSize=15, leading=18, spaceBefore=10, spaceAfter=8))
    styles.add(ParagraphStyle(name="Subsection", parent=styles["Heading2"], textColor=colors.HexColor("#1E3A8A"), fontSize=11, leading=14, spaceBefore=8, spaceAfter=5))
    styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], fontSize=7.5, leading=10, textColor=colors.HexColor("#475569")))
    styles.add(ParagraphStyle(name="CenterSmall", parent=styles["Small"], alignment=TA_CENTER))

    def paragraph(text: Any, style: str = "BodyText"):
        return Paragraph(xml_escape(str(text or "Data unavailable")), styles[style])

    company = research.get("company_profile", {})
    metadata = research.get("report_metadata", {})
    story: list[Any] = [
        paragraph(f"{company.get('name', 'Company')} ({ticker})", "ReportTitle"),
        paragraph("Institutional-Style Equity Research Report", "Subsection"),
        paragraph(
            f"Report date: {metadata.get('report_date')} | Data cutoff: {metadata.get('data_cutoff')} | "
            f"Version: {metadata.get('report_version')} | Status: {metadata.get('quality_label')}",
            "Small",
        ),
        Spacer(1, 0.14 * inch),
        paragraph(DISCLAIMER, "Small"),
        Spacer(1, 0.18 * inch),
        paragraph("1. Research Dashboard", "Section"),
    ]
    latest = (research.get("historical_annual_financials", {}).get("records") or [{}])[-1]
    story.append(
        _pdf_table(
            [
                ["Metric", "Value", "Metric", "Value"],
                ["Revenue", format_currency(latest.get("revenue")), "Net Income", format_currency(latest.get("net_income"))],
                ["Net Margin", format_percent(latest.get("net_margin")), "Free Cash Flow", format_currency(latest.get("free_cash_flow"))],
                ["Cash", format_currency(latest.get("cash")), "Total Debt", format_currency(latest.get("total_debt"))],
            ],
            [1.25 * inch, 1.5 * inch, 1.25 * inch, 1.5 * inch],
        )
    )
    story.append(paragraph("Research View", "Subsection"))
    for item in research.get("investment_thesis", []):
        story.append(paragraph(f"• {item.get('point')}", "Small"))

    chart_paths: list[Path] = []
    if charts:
        story.append(paragraph("Original Financial Charts", "Section"))
        for index, (chart_id, figure) in enumerate(charts.items()):
            chart_path = temp_dir / f"{ticker}_{index}_{chart_id}.png"
            try:
                chart_path.write_bytes(figure.to_image(format="png", width=980, height=500, scale=1.3))
                chart_paths.append(chart_path)
                chart_flowable = Image(str(chart_path), width=7.1 * inch, height=3.62 * inch)
            except Exception:
                chart_flowable = _reportlab_chart_drawing(figure)
            story.extend([chart_flowable, Spacer(1, 0.08 * inch)])

    story.extend([PageBreak(), paragraph("2. Company Overview", "Section"), paragraph(company.get("business_model"), "BodyText")])
    story.append(paragraph("3. Historical Financial Performance", "Section"))
    annual = research.get("historical_annual_financials", {}).get("records", [])
    annual_table = _table_view(annual, "fiscal_year")
    if annual_table["rows"]:
        story.append(_pdf_table([annual_table["headers"], *annual_table["rows"]]))
    quarterly = research.get("historical_quarterly_financials", {}).get("records", [])
    if quarterly:
        story.append(paragraph("Quarterly Actuals", "Subsection"))
        quarterly_table = _table_view(quarterly, "fiscal_quarter")
        story.append(_pdf_table([quarterly_table["headers"], *quarterly_table["rows"]]))
    for title, text in research.get("management_commentary", {}).get("analytical_summary", {}).items():
        story.extend([paragraph(title, "Subsection"), paragraph(text, "BodyText")])

    story.extend([
        paragraph("4. Segment and KPI Analysis", "Section"),
        paragraph(research.get("segment_analysis", {}).get("limitation"), "BodyText"),
        paragraph("5. Management Commentary", "Section"),
        paragraph(research.get("management_commentary", {}).get("guidance"), "BodyText"),
        paragraph("6. Industry and Competitive Position", "Section"),
        paragraph(research.get("industry_analysis", {}).get("limitation"), "BodyText"),
        paragraph(research.get("competitive_positioning", {}).get("limitation"), "BodyText"),
        PageBreak(),
        paragraph("7. Forecast and Scenarios", "Section"),
    ])
    forecast_rows = [["Scenario", "Period", "Revenue", "Op. Margin", "UFCF", "A/E"]]
    for scenario, rows in research.get("forecast_financials", {}).items():
        for row in rows:
            forecast_rows.append([scenario.title(), f"{row.get('fiscal_year')}E", format_currency(row.get("revenue")), format_percent(row.get("operating_margin")), format_currency(row.get("unlevered_free_cash_flow")), "E"])
    if len(forecast_rows) > 1:
        story.append(_pdf_table(forecast_rows))
    story.append(paragraph("8. Valuation Assessment", "Section"))
    valuation_rows = [["Scenario", "Enterprise Value", "Equity Value", "Implied / Share", "Status"]]
    for scenario, result in research.get("valuation", {}).get("scenarios", {}).items():
        valuation_rows.append([scenario.title(), format_currency(result.get("enterprise_value")), format_currency(result.get("equity_value")), format_currency(result.get("implied_value_per_share"), decimals=2), result.get("status")])
    if len(valuation_rows) > 1:
        story.append(_pdf_table(valuation_rows))
    story.extend([paragraph("9. Catalysts and Risks", "Section")])
    for item in research.get("catalysts", []):
        story.append(paragraph(f"Catalyst: {item.get('description')}", "BodyText"))
    for item in research.get("risks", []):
        story.append(paragraph(f"Risk: {item.get('description')}", "BodyText"))
    story.extend([PageBreak(), paragraph("10. Appendix and Sources", "Section")])
    qa = research.get("qa_results", {})
    story.append(paragraph(f"QA status: {qa.get('quality_label')} ({qa.get('overall_score')}/100)", "BodyText"))
    story.append(paragraph("Limitations", "Subsection"))
    for limitation in research.get("limitations", []):
        story.append(paragraph(f"• {limitation}", "Small"))
    story.append(paragraph("Sources", "Subsection"))
    for source in research.get("sources", []):
        story.append(paragraph(f"[{source.get('source_id')}] {source.get('source_title')} — {source.get('url')}", "Small"))
    story.append(Spacer(1, 0.15 * inch))
    story.append(paragraph(DISCLAIMER, "Small"))

    def page_header_footer(canvas, doc):
        canvas.saveState()
        # Paint an explicit page background so native vector chart pages render
        # consistently in PDF viewers that otherwise treat untouched regions as
        # transparent or black.
        canvas.setFillColor(colors.white)
        canvas.rect(0, 0, LETTER[0], LETTER[1], stroke=0, fill=1)
        canvas.setStrokeColor(colors.HexColor("#DCE3ED"))
        canvas.line(42, LETTER[1] - 34, LETTER[0] - 42, LETTER[1] - 34)
        canvas.setFillColor(colors.HexColor("#64748B"))
        canvas.setFont("Helvetica", 7)
        canvas.drawString(42, LETTER[1] - 26, f"SEC Financial Report Agent | {ticker}")
        canvas.drawRightString(LETTER[0] - 42, 24, f"Page {doc.page}")
        canvas.drawString(42, 24, "Educational analysis - not investment advice")
        canvas.restoreState()

    document = SimpleDocTemplate(
        str(path),
        pagesize=LETTER,
        rightMargin=42,
        leftMargin=42,
        topMargin=46,
        bottomMargin=38,
        title=f"{company.get('name')} Institutional-Style Research Report",
        author="SEC Financial Report Agent",
        subject="Source-backed public-filing analysis",
    )
    try:
        document.build(story, onFirstPage=page_header_footer, onLaterPages=page_header_footer)
    finally:
        for chart_path in chart_paths:
            try:
                chart_path.unlink()
            except OSError:
                pass
    return path
