# Incremental Upgrade Implementation Matrix

This matrix separates the audited MVP baseline from the implemented upgrade. `Preserved` means the prior public interface or behavior remains available; `Extended` means the same module now carries additional capability; `New` means no baseline equivalent existed; `Limited` means the workflow is deliberately conservative rather than claiming complete support.

## Baseline audit

| Area | Audited baseline | Upgrade decision | Current result |
|---|---|---|---|
| Repository state | Python/Streamlit source, cached SEC data, and generated HTML/CSV; no Git metadata | Preserve user files; do not infer history | No destructive repository operations; Git history remains unavailable |
| Orchestration | `app.build_report(ticker)` drove SEC, XBRL, metrics, charts, summary, HTML | Preserve signature and old result keys | Extended staged pipeline with optional keyword arguments |
| SEC access | Ticker mapping, submissions, Company Facts, exact recent 10-K | Extend existing `SECClient` | One client handles form discovery, filing content, exhibits, cache metadata, retries, and structured errors |
| XBRL | Annual 10-K, USD, flat tag fallbacks, fiscal-year grouping | Refactor same mapper | Period-aware annual/quarter/YTD/instant/duration normalization with provenance |
| Metrics | Ten deterministic calculations | Preserve names; fix debt/equity semantics; extend registry | Formula definitions, explicit input/unit/null/zero/period behavior, and additional metrics |
| Charts | Five Plotly figures with fixed dictionary keys | Preserve all keys | Adds source/as-of/units, actual/forecast styles, FCF, quarterly, and scenario charts |
| Narrative | Optional OpenAI summary with rule-based fallback | Preserve fallback | Verified context, filing excerpts, citations, and numerical guard |
| Report | Self-contained HTML with KPI cards and charts | Reuse one report module | Ten-section HTML plus paginated PDF from one research object |
| Streamlit | Ticker form, dashboard, HTML download | Extend | Filing scope, text option, assumption inputs, statuses, tabs, QA, JSON/PDF downloads |
| Sample | Default AAPL HTML/dashboard/annual CSV | Preserve default and filenames | CLI ticker/scope/text/PDF flags plus quarterly CSV, research JSON, QA JSON, PDF |
| Tests/docs/config | None | New | Fixture-based tests, five YAML configs, research skill, and methodology docs |
| Environment | Moved `.venv` with stale entry-point shebangs | Do not patch opaque environment files | Document clean recreation; direct `python -m ...` remains diagnostic path |

## Data acquisition and filing coverage

| Requirement | Status | Implementation / boundary |
|---|---|---|
| Ticker-to-CIK, submissions, Company Facts | Preserved | Existing `SECClient` methods and cache format remain usable |
| 10-K and 10-Q discovery | Extended | Original and amendment forms normalized to a base form with filing/report dates and URLs |
| 8-K, S-1, and 424B4 discovery | Extended | Full-scope discovery with per-form limits and optional date filters |
| Filing URL construction | Extended | Generalized archive URL builders retain the original 10-K behavior |
| Exhibit discovery | New | Filing index inspection identifies candidate exhibits where available |
| SEC request hygiene | Extended | Configurable User-Agent, sequential pacing, retry/backoff, timeout, Retry-After support, and structured request errors |
| Cache governance | Extended | Legacy payload files plus sidecar retrieval/source/header metadata and stale-cache fallback |
| Filing-text extraction | New | Optional conservative HTML cleanup and section heuristics with confidence and source metadata |
| Paywalls/restricted portals | Out of scope | No bypass, authentication circumvention, or restricted-report acquisition |

## Financial normalization and metrics

| Requirement | Status | Implementation / boundary |
|---|---|---|
| Existing annual metric columns | Preserved | Compatibility adapter still returns a fiscal-year-indexed DataFrame |
| Annual comparative periods | Fixed | Selection keys off reported period end/context rather than only filing fiscal year |
| Discrete quarters and YTD | Extended | Selects compatible standalone quarters; deterministically derives quarters from compatible YTD facts when needed |
| Instant vs duration | New | Balance-sheet and flow concepts use separate period semantics |
| Duplicate/amendment resolution | Extended | Tag priority, form, context, filed date, accession, unit, and confidence are retained |
| Unit/currency metadata | New | Normalized records preserve unit and currency; unsupported values remain unavailable |
| Metric provenance | New | Metric, tag, taxonomy, value, unit, period, form, accession, confidence, ambiguity, and source URL retained |
| Debt correctness | Fixed | Aggregate debt is not added again to current debt; components are combined only when no valid aggregate exists |
| Equity reconciliation | Fixed | Total equity including noncontrolling interest is preferred for balance-sheet reconciliation |
| Formula registry | New | Each calculated metric documents required inputs, formula, unit, null behavior, zero behavior, and period behavior |
| Extended metrics | Extended | Growth, FCF margin/conversion, capex/R&D/S&M/SBC intensity, net cash, dilution, ROA/ROE/ROIC, coverage, leverage, quick ratio, EV and supported multiples |
| Missing values | Preserved/strengthened | No LLM backfill; explicit unavailable/partial outcomes replace silent invention |

## Research, forecast, valuation, and citations

| Requirement | Status | Implementation / boundary |
|---|---|---|
| Canonical research object | New | One contract stores metadata, company, filings, historicals, provenance, analysis, forecasts, valuation, sources, QA, and limitations |
| Rule-based narrative | Preserved | Fully operational without OpenAI credentials |
| Optional OpenAI narrative | Extended | Uses verified numerical context and selected filing excerpts; exceptions fall back to rules |
| Numerical claim guard | New | Generated numbers must be present in verified context; unsupported outputs are limited or rejected |
| Bull/base/bear forecasts | New | Deterministic formulas, identical scenario mechanics, visible values/sources, separate actual and estimate fields |
| Assumption overrides | New | UI/API accepts explicit user inputs; defaults remain visibly system/historical labels |
| DCF valuation | New | Scenario cash flows, discount rate, terminal growth, terminal value, EV, net debt, equity value, shares, and implied per-share result |
| Market price / peers | Limited | Only included when the user or a licensed integration supplies them; not scraped or fabricated |
| Ratings and target prices | Out of scope | Output uses `Research View`, `Valuation Assessment`, and `Model-Implied Value Range` |
| Source ledger | New | Stable source IDs include title, type, form, filing/report dates, accession, URL, and retrieval time |
| Citation validation | New | Paragraph and object markers are checked for validity and configured minimum coverage |

## Reporting, QA, and delivery

| Requirement | Status | Implementation / boundary |
|---|---|---|
| Five baseline charts | Preserved | Existing chart keys and Streamlit consumers remain valid |
| Chart governance | Extended | Source, as-of, units, frequency, actual/estimate differentiation, zero baseline, and print metadata |
| Ten-section report | New | Dashboard; overview; historicals; segments/KPIs; management; industry/competition; forecast; valuation; catalysts/risks; appendix |
| HTML safety | Fixed | Normal content is autoescaped; only generated chart markup is explicitly trusted |
| HTML export | Preserved/extended | Self-contained interactive output from the shared view model |
| PDF export | New | ReportLab pagination, headers, footers, page numbers, tables, and static/native chart paths |
| Structured exports | New | Annual CSV, quarterly CSV, complete JSON, and QA summary JSON |
| Numerical QA | New | Balance sheet, period separation, units/currency, duplicates, formulas, and DCF bridges |
| Citation QA | New | Coverage denominator, invalid markers, chart sources, and claim limitations |
| Policy QA | New | Unsupported target/rating language and prohibited branding checks |
| Quality scoring | New | Weighted 100-point score and gated labels; appearance alone cannot earn `Institutional Quality` |
| Visual QA | New process | PDF structural tests plus rendered-page inspection; HTML remains browser-testable |

## Sector support

| Sector | Status | Behavior |
|---|---|---|
| General operating companies | Supported baseline | Core financial statements, generic operating metrics, scenarios, valuation, and report pipeline |
| Software / SaaS | Limited | KPI taxonomy exists, but custom disclosures appear only when explicitly mapped/extracted |
| Semiconductors | Limited | Configured KPI expectations and issuer tests; concentration/end-market disclosures remain filing dependent |
| Banks and insurers | Limited | Visible warning; generic leverage/FCF concepts are not presented as specialized bank analysis |
| REITs | Limited | FFO/NOI/occupancy/lease metrics require explicit disclosed mappings; no silent derivation |
| Segment-dimensional XBRL | Limited | Not implemented; report marks segment analysis unavailable or filing-text-only |

## Verification evidence

- Fixture suite covers AAPL (multi-form issuer), NVDA (semiconductor), and JPM (limited-support bank).
- The default AAPL path runs without `OPENAI_API_KEY` and creates all configured artifacts.
- HTML and PDF share the same research object, source ledger, assumptions, calculations, and QA result.
- PDF page rendering was inspected for clipping, overlap, chart placement, headers, footers, and page numbering.
- A real Streamlit socket cannot bind in the managed sandbox; Streamlit's in-process test harness is used for application integration QA.
