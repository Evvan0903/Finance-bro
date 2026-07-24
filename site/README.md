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

Set `SEC_USER_AGENT` to a descriptive application/contact value for reliable production SEC requests. No OpenAI API key, embedding service, D1 database, or R2 bucket is required.

## Vercel

Set Vercel's Root Directory to `site`. The project uses `npm ci` and `npm run vercel-build` (`next build --webpack`). This change set is validated locally only; it is not pushed or deployed.

FinBro provides research information, not investment advice, a rating, or a target price.
