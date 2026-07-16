# Report Methodology

## Canonical research object

The report is built once as a structured research object and then reused by Streamlit, HTML, PDF, JSON, charts, and QA. This prevents separate renderers from silently changing calculations or narrative inputs. The schema requires company and filing metadata, annual and quarterly actuals, operating and sector KPIs, commentary, risks, forecasts, valuation, scenarios, charts, tables, sources, QA results, and limitations.

## Ten-section report structure

The HTML and PDF follow the configured order:

1. Research Dashboard
2. Company Overview
3. Historical Financial Performance
4. Segment and KPI Analysis
5. Management Commentary
6. Industry and Competitive Position
7. Forecast and Scenarios
8. Valuation
9. Catalysts and Risks
10. Appendix and Sources

Unavailable sections remain visible with an explicit limitation rather than being populated with generic claims. In particular, segment, industry, competitive-positioning, and catalyst content is conservative until supported evidence is available.

## Actuals, narrative, and citations

Annual and quarterly SEC-derived records are labeled actual (`A`). Forecast periods are labeled estimate (`E`) and remain separate from reported facts. Core narrative has six stable headings: executive summary, financial performance, profitability and margin, balance sheet and liquidity, cash-flow quality, and watch points.

Without `OPENAI_API_KEY`, narrative is generated from deterministic metrics. When OpenAI is enabled, the model receives only verified company data, calculated metrics, bounded filing excerpts, and approved missing-data labels. The prompt prohibits invented financial or market data, recommendations, copied filing text, and unsupported quotations. A numerical guard rejects the enhanced response when a dollar amount cannot be traced to the numeric input set; any API, parsing, or validation failure falls back to the deterministic narrative.

Sources are assembled only from records with actual URLs or labeled user inputs. SEC sources receive stable report-local markers such as `[S1]`. Deterministic summary paragraphs are cited to the preferred 10-K when available, and QA validates marker existence and text-level coverage. A source marker identifies the underlying filing; it is not a substitute for reviewing the linked source.

## Forecast methodology

Forecasts are mechanical scenarios, not consensus estimates. Default assumptions are based on recent historical data:

- median of up to three recent observations for revenue growth and selected intensities;
- latest operating margin and effective tax rate where available;
- latest net-working-capital intensity; and
- recent diluted-share change.

Base uses those historical defaults. Bull adds 3 percentage points to revenue growth and 2 percentage points to operating margin; bear subtracts the same amounts. Management guidance and user overrides can replace supported assumptions and retain an explicit source label. Forecast horizon is bounded to one through ten years and defaults to three.

For each period, the engine calculates revenue, operating income, NOPAT, depreciation, capex, net working capital, its change, unlevered free cash flow, and diluted shares. All assumptions are displayed with values, units, descriptions, and sources.

## Valuation methodology

The valuation section is an assessment, not a rating or target price. It calculates a simplified unlevered free-cash-flow DCF for bull, base, and bear scenarios. The default discount rate is 9% and terminal growth rate is 2.5% unless the user supplies values; the discount rate must exceed terminal growth.

The DCF explicitly records forecast cash flows, discount factors, present values, terminal value, enterprise value, net-debt bridge, equity value, diluted shares, and implied value per share. A 3x3 discount-rate/terminal-growth sensitivity grid surrounds the base inputs. Per-share output remains unavailable if net debt or diluted shares are missing. Historical trading multiples appear only when the caller supplies usable market inputs; peer multiples are not invented.

The report uses the neutral label `Model-Implied Value Range` and states that no Buy, Hold, or Sell rating is generated. Live share price, consensus estimates, and peer data are absent unless explicitly supplied by a user or a future licensed connector.

## Charts and tables

Every chart uses original project styling, an as-of date, units, and a source footer. The five baseline chart keys are retained, with optional free-cash-flow, quarterly-revenue, and forecast-revenue views. Historical series use actual labels; scenario series use dashed estimate styling. Missing points are not connected, and absolute-value axes include zero.

Tables expose annual actuals, quarterly actuals, assumptions, forecast financials, valuation bridges, sources, and calculation definitions. Formula definitions state null and zero behavior to make derived values reproducible.

## HTML and PDF parity

HTML and PDF consume the same canonical research object and calculated chart collection. HTML uses one autoescaped ten-section template; the dashboard view is a shortened rendering of that template. PDF uses ReportLab for pagination, repeating table headers, page headers/footers, disclosures, and page numbers. It attempts Plotly/Kaleido image export for charts and falls back to native ReportLab line charts if browser-based image generation is unavailable.

Parity means shared inputs and conclusions, not pixel-identical layout: interactive Plotly HTML and paginated print output necessarily render charts and tables differently.

## Quality labels and disclosures

QA results are attached to the research object before rendering, so the visible report metadata and appendix show the same score and label. Labels are `Incomplete`, `Draft`, `Research Preview`, `QA Review Required`, or `Institutional Quality` according to the executable thresholds described in `docs/qa_methodology.md`.

Every report states that it is independent software-generated analysis for educational and analytical purposes, is not investment advice, and is not affiliated with or endorsed by a financial institution.

## Current limitations

- Segment dimension extraction and reconciliation are not implemented.
- Industry and competitive analysis require cited external evidence that is not connected by default.
- Catalyst identification is intentionally conservative and normally remains unavailable.
- Filing-section extraction is heuristic and opt-in.
- Bank, insurer, and REIT analysis needs specialized accounting models before generic ratios should be relied on.
- Mechanical forecasts and DCF outputs are highly assumption-sensitive and should not be presented as consensus, advice, or a market price target.

