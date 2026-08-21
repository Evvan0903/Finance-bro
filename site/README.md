# FinBro

FinBro is a bilingual Chinese/English equity-research application. Give Ethan a ticker or company name; the server resolves one SEC reporting identity, reads the issuer's SIC code from SEC Submissions, selects a broad research methodology, and generates an evidence-backed report.

Users no longer select Market, Sector, or Subindustry. Language and the existing optional report modules remain available.

## Deterministic workflow

```text
Ticker / company name
→ SEC identity and CIK
→ SEC Submissions
→ SIC registry
→ General Research Pack
→ Metric Locator
→ Canonical Metrics
→ bilingual Web / PDF report
```

The API returns read-only classification metadata: SIC code and description, detected sector, selected pack, fallback level, and reason. Deprecated client `sector` and `subindustry` fields may still be accepted, but they cannot override SEC SIC classification.

The initial registry contains 12 broad methodologies:

- Technology Hardware General
- Semiconductor General
- Software & SaaS General
- Internet & Platform General
- Commercial Banking General
- Diversified Financials General
- Biopharma General
- Oil & Gas General
- Industrial Machinery General
- Consumer Products General
- Sector General
- General Corporate

The existing validated semiconductor, bank, biopharma, integrated-oil-and-gas, and industrial-machinery packs and their formulas remain unchanged. Technology Hardware General supports AAPL without forcing Apple into the semiconductor methodology. Unmapped or missing SIC values fall back to General Corporate rather than failing.

Every report uses the universal filing-based analytical core where evidence is available, including revenue, growth, profitability, diluted EPS, shares outstanding, cash flow, capex, strict free cash flow, cash, debt, repurchases, and deterministically supportable return measures. Pack-specific metrics appear only when verified.

See [research-classification.md](docs/research-classification.md) for the architecture, fallback hierarchy, and the separation among classification, pack selection, and metric extraction. Embeddings, machine-learning classification, vector databases, and LLM classification are intentionally not used in this deterministic MVP.

## Data and evidence

Issuer identity, SIC, filing dates, and financial facts come from official SEC Submissions and Company Facts. The Metric Locator and Canonical Metric Registry preserve source links, definitions, periods, units, currencies, formulas, and reproducibility checks. Missing values are not fabricated.

The application supports domestic and foreign-private-issuer filing paths, bilingual Web and PDF output, compact missing-data presentation, screened dated industry evidence, and structured stage-aware errors.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
npm run lint
npx tsc --noEmit
npm run vercel-build
npm test
```

Set `SEC_USER_AGENT` to a descriptive application/contact value for reliable production SEC requests.

Ethan's optional Industry and Market Analysis is enabled by default. It derives a reviewed company-industry profile from the resolved SEC identity and SIC, then requests only compatible official series. `FRED_API_KEY` and `BEA_API_KEY` improve provider coverage when configured; Census and BLS can run without keys for supported requests. Missing or failed market providers never block the company report, and no OpenAI API key, embedding service, D1 database, or R2 bucket is required.

Provider credentials use these exact server-only names: `FRED_API_KEY`, `BEA_API_KEY`, `CENSUS_API_KEY`, and `DATA_GOV_API_KEY`. The validator loads the same normalized configuration used by the production providers and automatically reads the project env files with shell variables taking precedence. No manual `source .env.local` step is needed.

From `site`:

```bash
node scripts/validate-market-providers.mjs
```

From the repository root:

```bash
node site/scripts/validate-market-providers.mjs
```

The output is sanitized and never contains credential values or request URLs. Local `.env.local` files are ignored by Git and apply only to local execution.

Every evidence-supported report visual is registered as a structured dataset and can be downloaded independently. Supported formats are CSV and XLSX for all data assets, plus SVG and PNG when a visual surface exists. The server protects spreadsheets from formula injection, sanitizes SVG, redacts credentials and local paths, and generates files from normalized datasets. Visual assets currently use a process-local expiring store, so links are not durable across server restarts or instances.

The reviewed specialized market profile in this release is NVIDIA / SIC 3674. Other issuers use conservative general mappings or an explicit mapping-review state. Official economic indicators remain labeled as context or proxies unless their source supports a commercial-market definition. See [ethan-industry-visual-assets.md](docs/ethan-industry-visual-assets.md).

## Vercel

Set Vercel's Root Directory to `site`. The project uses `npm ci` and `npm run vercel-build` (`next build --webpack`). Configure required provider variables separately in Vercel Project Settings for each intended environment; local `.env.local` values are not uploaded. Use only the exact server-side names `FRED_API_KEY`, `BEA_API_KEY`, `CENSUS_API_KEY`, and `DATA_GOV_API_KEY`, plus a descriptive `SEC_USER_AGENT`. Never use `NEXT_PUBLIC_` for credentials. Changing a Vercel variable requires a new deployment before the runtime sees it.

FRED and BEA require their credentials. Census can use its public anonymous quota, but `CENSUS_API_KEY` increases authenticated quota when valid. DATA GOV is required for the selected Congress.gov or GovInfo adapter. Missing or rejected optional market-provider credentials do not block Ethan's filing-based company report.

FinBro provides research information, not investment advice, a rating, or a target price.

## Clara workflows

Clara offers **Quick Company Intelligence** at `/workflows/company-intelligence`. It accepts a company name and/or public website, asks the user to confirm the target, then produces a concise public-source business brief for competitor, customer, vendor, partner, prospect, or general research. It prioritizes identity, business profile, leadership, public hiring links, locations, business contact channels, relationships, recent activity, commercial signals, sources, and information gaps. Public website facts remain Company Reported until independently corroborated; personal contact information is excluded. CSV/XLSX evidence and claim downloads plus Markdown/PDF report exports reuse Clara's controlled export path.

**Outside-In Due Diligence** remains an in-development, deeper workflow at `/workflows/private-company-diligence`. The two modes share entity resolution, provider, evidence, claim, export, and security infrastructure but keep their report scopes separate. Clara's model-router boundary is prepared but disabled; no paid LLM API is activated.
