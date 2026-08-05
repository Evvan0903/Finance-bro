# SEC Financial Report Agent

## FinBro web application

The active bilingual web application is under [`site/`](site/). FinBro now requires only a ticker or company name, resolves one SEC identity, reads the issuer's SEC Submissions SIC code, and deterministically selects one of 12 broad General Research Packs. Users no longer choose Market, Sector, or Subindustry. See [`site/docs/research-classification.md`](site/docs/research-classification.md) for the SIC registry, fallback hierarchy, and separation between classification, pack selection, Metric Locator extraction, and Canonical Metrics.

Clara V1 adds bilingual public-source private-company diligence at `/workflows/private-company-diligence`. It resolves and confirms an entity before research, uses a modular official/public provider registry, keeps company-reported statements separate from verified facts, requires evidence for every claim, preserves conflicts, and turns missing information into explicit gaps and follow-up questions. See [`site/docs/clara-private-diligence.md`](site/docs/clara-private-diligence.md) for provider coverage, source tiers, security, exports, environment variables, and limitations.

SEC Financial Report Agent turns a U.S. public-company ticker into a source-backed institutional-style equity research preview. The upgraded application preserves the original modular SEC/XBRL/metrics/chart/HTML flow and extends it with quarterly analysis, filing discovery and text extraction, provenance, transparent scenarios, deterministic valuation, report QA, and HTML/PDF/CSV/JSON exports.

The output is independent software-generated analysis for educational use. It is not investment advice, a Buy/Hold/Sell rating, or affiliated with any financial institution.

## What the upgrade adds

- Discovers 10-K, 10-Q, 8-K, S-1, and 424B4 filings, including amendments and date filters.
- Retrieves SEC data with configurable User-Agent, caching metadata, retries, throttling, timeouts, structured errors, and stale-cache fallback.
- Normalizes annual, quarterly, year-to-date, duration, and instant XBRL facts with accession-, tag-, unit-, period-, confidence-, and source-level provenance.
- Separates aggregate debt from current/non-current components and prefers total equity including noncontrolling interests where available.
- Calculates deterministic profitability, cash-conversion, intensity, return, leverage, liquidity, dilution, enterprise-value, and valuation metrics with documented formula behavior.
- Optionally extracts filing sections such as Item 1, 1A, 7, 7A, and 8 plus selected 10-Q, S-1, and 8-K content.
- Builds a single structured research object used by Streamlit, narrative, tables, charts, HTML, PDF, and QA.
- Produces explicit bull/base/bear mechanical forecasts and a transparent DCF-style Valuation Assessment without an investment rating.
- Attaches stable source IDs to narrative, tables, charts, and filings, then checks citation coverage and invalid markers.
- Scores data completeness/integrity, citations, calculations, analytical completeness, forecast transparency, and visual consistency.
- Exports a self-contained interactive HTML report and a paginated print-safe PDF with headers, footers, page numbers, tables, and chart fallbacks.
- Includes an original institutional-research workflow skill, public-reference log, configuration files, methodology documentation, and fixture-based tests.

## Data and source policy

Primary data comes from official SEC EDGAR endpoints:

- Ticker mapping: `https://www.sec.gov/files/company_tickers.json`
- Submissions: `https://data.sec.gov/submissions/CIK##########.json`
- Company Facts: `https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json`
- Filing documents and index data: `https://www.sec.gov/Archives/edgar/data/...`

Set `SEC_USER_AGENT` to a descriptive application/contact value. Requests are sequential and cached under `data/cache/`; sidecar metadata records retrieval time, source URL, cache policy, and response headers when available. If a refresh fails and a readable cache exists, the client can return stale cached data instead of hiding the request failure.

Public institutional publications were reviewed only for generalized functional conventions. The project does not copy proprietary text, forecasts, charts, branding, logos, or layouts. See [the reference log](docs/institutional_research_reference_log.md) and [source/copyright policy](docs/source_and_copyright_policy.md).

## Run locally

Python 3.11+ is recommended.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cp .env.example .env
streamlit run app.py
```

`OPENAI_API_KEY` is optional. Without it, the report uses the deterministic rule-based narrative path. The SEC User-Agent should still be configured:

```dotenv
SEC_USER_AGENT="SEC Financial Report Agent your-email@example.com"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4.1-mini"
```

If this folder was moved and an existing `.venv/bin/streamlit` reports a stale interpreter path, recreate the virtual environment. As a temporary diagnostic, `./.venv/bin/python -m streamlit run app.py` bypasses a stale entry-point shebang.

## Streamlit workflow

The app exposes:

1. Ticker and filing scope: annual, annual plus quarterly, or full SEC scope.
2. Optional filing-text extraction.
3. Optional user-labeled forecast and valuation inputs.
4. Step-level retrieval, normalization, calculation, forecast, valuation, citation, QA, and export statuses.
5. Dashboard, financials, filing insights, forecast/valuation, and QA/export tabs.
6. HTML, structured JSON, QA JSON, and optional PDF downloads.

## Generate reproducible samples

The default remains AAPL:

```bash
python generate_sample_report.py
```

Other examples:

```bash
python generate_sample_report.py --ticker NVDA
python generate_sample_report.py --ticker JPM --filing-scope annual
python generate_sample_report.py --ticker AAPL --filing-scope full --include-filing-text
python generate_sample_report.py --ticker MSFT --no-pdf
```

For ticker `AAPL`, the command writes:

- `outputs/AAPL_dashboard.html`
- `outputs/AAPL_SEC_financial_report.html`
- `outputs/AAPL_annual_metrics.csv`
- `outputs/AAPL_quarterly_metrics.csv`
- `outputs/AAPL_structured_report.json`
- `outputs/AAPL_qa_summary.json`
- `outputs/pdf/AAPL_SEC_financial_report.pdf` when PDF dependencies are available

## Tests and validation

```bash
python -m pytest -q
python -m compileall -q app.py generate_sample_report.py src tests
python generate_sample_report.py --ticker AAPL
```

The tests use compact local AAPL, NVDA, and JPM submissions fixtures. They cover filing discovery, cache/error behavior, annual and quarterly XBRL resolution, debt semantics, formulas, forecast/valuation math, filing-text extraction, chart metadata, research-object rendering, PDF structure, source/citation checks, QA scoring, and sector configuration.

## Architecture

```text
app.py / generate_sample_report.py
        |
        v
SECClient -> XBRL mapper -> metrics calculator
        |                         |
        +-> filing text           +-> forecast -> valuation
                                   |
                                   v
                         structured research object
                         /      |       |       \
                    narrative  charts  QA   HTML/PDF/JSON/CSV
```

Existing compatibility interfaces remain available, including `build_report(ticker)`, `SECClient.latest_10k`, `extract_financial_metrics`, `calculate_metrics`, the five baseline chart keys, `generate_html_report`, and the default AAPL sample filenames.

See:

- [Architecture](docs/architecture.md)
- [Data methodology](docs/data_methodology.md)
- [Report methodology](docs/report_methodology.md)
- [QA methodology](docs/qa_methodology.md)
- [Implementation matrix](docs/implementation_matrix.md)
- [Reusable research skill](skills/institutional_equity_research/SKILL.md)

## Configuration

- `config/institutional_report_schema.yaml`: research-object keys, ten sections, required metrics/charts/tables, missing-data language.
- `config/report_style.yaml`: original brand tokens, chart/table rules, units, labels, and PDF settings.
- `config/report_qa_rules.yaml`: tolerances, weights, critical checks, thresholds, and allowed quality labels.
- `config/source_policy.yaml`: source hierarchy, source fields, claim/citation rules, assumption labels, and copyright boundaries.
- `config/sector_kpis.yaml`: supported general-company KPIs and limited software, semiconductor, bank, and REIT profiles.

## Important limitations

- Company Facts does not supply complete custom-tag, segment-dimensional, or filing-text context. Automated segment XBRL dimension extraction is not implemented.
- Filing-text extraction is heuristic and optional; every excerpt retains its source URL and confidence for review.
- Industry, market-share, consensus, live-price, and peer-multiple data require public or properly licensed sources. The app does not invent them.
- Forecasts are mechanical scenarios from visible assumptions, not consensus estimates. Valuation is model-implied and not a target price or recommendation.
- Generic operating-company analysis is the supported path. Software/SaaS and semiconductor KPIs are limited; banks, insurers, and REITs retain visible limitations until specialized mapping and reconciliation are fully tested.
- PDF export prefers static Plotly rendering through Kaleido. If a browser renderer is unavailable, the ReportLab path produces original print-safe chart fallbacks from the same data.
- SEC schemas and issuer reporting vary. Missing or ambiguous fields remain unavailable and visible rather than being inferred.
- The current workspace does not contain Git metadata, so commit history and tracked-file diffs cannot be audited here.

## Dependency rationale

- `PyYAML`: validated external report/source/style/QA/sector configuration.
- `beautifulsoup4`: conservative filing HTML text cleanup and section extraction.
- `reportlab`: deterministic PDF layout, pagination, headers, footers, tables, and native chart fallback.
- `kaleido`: optional Plotly-to-image conversion for PDF charts.
- `pypdf`: structural PDF assertions in tests.
- `pytest`: fixture-based unit and integration validation.

All other packages extend the original application stack and remain constrained by compatible major versions in `requirements.txt`.
