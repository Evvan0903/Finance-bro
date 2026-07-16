# Architecture

## Purpose and design stance

The project is an incremental upgrade of the original SEC Financial Report Agent. It keeps the existing ticker-first Streamlit workflow and compatible public interfaces while adding quarterly data, provenance, filing-text analysis, deterministic forecasts and valuation, QA, and PDF export. The architecture is intentionally filing-first: SEC data and explicit user inputs drive calculations; an LLM is optional and is never the calculation engine.

## End-to-end flow

1. `app.build_report()` identifies the issuer, retrieves SEC submissions and Company Facts, and selects the requested filing scope.
2. `src.sec_client.SECClient` handles EDGAR access, throttling, retries, cache files, cache metadata, and stale-cache fallback.
3. `src.xbrl_mapper` converts Company Facts into annual and quarterly frames plus a fact-level provenance ledger.
4. `src.metrics_calculator` derives ratios and cash-flow, leverage, return, and optional market-value metrics deterministically.
5. Optional `src.filing_text_extractor` extracts bounded sections from selected filing HTML.
6. `src.forecast_engine` builds visible bull/base/bear assumptions and mechanical forecast schedules.
7. `src.valuation_engine` calculates scenario DCFs, a sensitivity grid, and optional user-input market multiple views.
8. `src.llm_summary` produces either a deterministic summary or an optional guarded OpenAI narrative.
9. `src.research_object` assembles one canonical, source-aware report object.
10. `src.report_qa` validates that object and attaches a score, checks, and a visible quality label.
11. `src.report_generator` renders HTML and PDF from that same object; Streamlit displays the same underlying results.

## Main components

| Area | Module | Implemented responsibility |
|---|---|---|
| Orchestration and UI | `app.py` | Staged report build, status reporting, Streamlit tabs, downloads, sector warning |
| Reproducible CLI | `generate_sample_report.py` | Ticker-selectable HTML, dashboard, CSV, JSON, QA JSON, and optional PDF artifacts |
| SEC access | `src/sec_client.py` | Ticker/CIK lookup, submissions, Company Facts, filing discovery, filing HTML, exhibit discovery, caching and retry policy |
| Normalization | `src/xbrl_mapper.py` | XBRL tag fallback, annual/quarter/YTD classification, discrete-quarter derivation, provenance and confidence |
| Calculations | `src/metrics_calculator.py` | Formula registry and deterministic financial metrics |
| Text analysis | `src/filing_text_extractor.py` | Optional, bounded filing-section extraction with filing provenance |
| Narrative | `src/llm_summary.py` | Rule-based summary plus optional verified-input OpenAI enhancement |
| Forecast and valuation | `src/forecast_engine.py`, `src/valuation_engine.py` | Visible assumptions, scenarios, DCF, sensitivity, optional user-supplied market inputs |
| Report contract | `src/research_object.py` | Single canonical structured object and sector profile selection |
| Citations and QA | `src/citations.py`, `src/report_qa.py` | Source ledger, citation markers, reconciliation and policy checks, scoring and labels |
| Presentation | `src/chart_generator.py`, `src/report_generator.py` | Original charts, ten-section HTML, dashboard view, paginated PDF |
| Configuration | `config/*.yaml` | Schema, style, source policy, sector KPIs, and QA thresholds |

## Incremental compatibility

The upgrade retains baseline interfaces where practical:

- `SECClient.latest_10k()` and the original SEC retrieval methods remain available.
- `METRIC_TAGS`, `extract_metric_series()`, and `extract_financial_metrics()` remain public while using the provenance-aware normalizer.
- `calculate_metrics()` and `latest_kpis()` remain the calculation entry points.
- The five original chart keys—`revenue`, `net_income`, `margins`, `cash_debt`, and `cash_flow`—remain present.
- `generate_html_report()` and `generate_dashboard_html()` accept the original arguments and can construct a compatibility research object when a canonical object is not supplied.
- `build_report(ticker)` remains valid; new behavior is exposed through keyword arguments.
- The sample generator still defaults to AAPL.

## State and outputs

- `data/cache/` stores SEC JSON or filing HTML and adjacent metadata sidecars.
- `outputs/` stores generated HTML, dashboard HTML, annual and quarterly CSVs, structured JSON, and QA JSON.
- `outputs/pdf/` stores PDF reports.
- `tmp/pdfs/` is used for temporary chart images during PDF generation.

The canonical research object is the contract between analysis, QA, and rendering. HTML and PDF do not independently recompute the financial analysis.

## Failure and fallback behavior

- Fresh cache is preferred. If a network or payload error occurs, the client can return an expired cache entry.
- If SEC data are unavailable and no cache exists, a structured SEC exception is raised.
- Filing-text extraction is optional and records limitations rather than preventing a numeric report.
- If `OPENAI_API_KEY` is absent, invalid, or produces numerically unsupported dollar claims, the report uses the deterministic summary.
- PDF chart export first tries Plotly image export and falls back to native ReportLab charts when browser-based rendering is unavailable.
- Missing calculations remain null or carry an explicit unavailable label; the pipeline does not fill them with invented values.

## Implemented limits

- Automated segment XBRL dimension extraction is not implemented.
- External industry, peer, consensus, and live market datasets are not connected by the default application path.
- General operating-company analysis is supported. Software/SaaS and semiconductor KPI sets are limited; bank and REIT support is explicitly limited. Insurers are warned through the UI but do not yet have a dedicated KPI configuration.
- Filing text uses regex-bounded section extraction and is not a full semantic filing parser.
- Stale-cache metadata is inspectable through `cache_metadata()`, but the current report object does not surface a stale-data flag.
- QA computes an export-readiness signal; the current orchestrator does not hard-block artifact creation when that signal fails.

