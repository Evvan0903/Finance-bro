# Ethan industry analysis and visual assets

## Scope

Ethan's existing ticker-only Public Company Research workflow can add an evidence-backed Industry and Market Analysis to the same report. The option is enabled by default and can be disabled for the prior company-only behavior. Mason and the standalone government-data workflow are unchanged.

## Resolution and provider planning

The server resolves one SEC identity and treats SEC Submissions SIC as the classification anchor. A `CompanyIndustryProfile` records the company, SIC, sector, reviewed industry candidates, NAICS and BEA codes, preferred FRED series, official-provider plan, confidence, proxy boundaries, and exclusions.

The hierarchy is:

1. reviewed ticker/SIC mapping;
2. compatible sector or general mapping;
3. `mapping-review` with no specialized claim.

The reviewed specialized profile is NVIDIA / SIC 3674. It maps compatible semiconductor-manufacturing context across NAICS 334413/334, BEA 3344, selected FRED series, Census CBP, and BLS. NVIDIA remains a fabless platform company, so U.S. manufacturing classifications are explicitly proxies rather than NVIDIA's market size or market share.

Available official-provider adapters include FRED, BEA, Census, BLS, SEC, World Bank, Congress.gov, and GovInfo. Ethan selects only profile-compatible providers. The exact server-only credential names are `FRED_API_KEY`, `BEA_API_KEY`, `CENSUS_API_KEY`, and `DATA_GOV_API_KEY`; credentials are never returned to the client, written into references, or stored in visual files. The standalone validator automatically loads local project env files and uses the same normalization and provider-specific credential mapping as production. EIA and additional reviewed specialized mappings are future work.

## Normalized analysis objects

`MarketDefinition` makes scope visible: classification code, official label, analytical role, direct-versus-proxy status, included scope, known exclusions, source, and confidence.

`IndustryMetric` preserves provider, series/table identifier, value, unit, geography, observation period, source URL, retrieval date, transformation, and proxy warning. Deterministic calculations handle growth, CAGR, normalized series, compatible ratios, and company-minus-industry comparisons. Incompatible periods, units, geographies, or definitions are not combined.

The integrated report adds:

- market definition and data scope;
- industry scale, demand, production, investment, and employment indicators when supported;
- company-versus-industry positioning;
- minimal industry data coverage without provider diagnostics.

The company report remains usable when every market provider fails. Ethan shows one neutral section-level message while existing filing-based financials, citations, scenarios, and company visuals remain present. Provider failures remain server-side and are not serialized into the public report.

## Visual asset architecture

Each evidence-supported chart or table becomes a normalized `VisualAssetDataset` with stable report-scoped identity, typed columns, rows, section metadata, period/unit metadata, and optional proxy limitations. A registry exposes report-scoped list, detail, and download routes. The UI reuses the same descriptors for inline compact menus and the filtered Visual Downloads section.

Company assets cover the dashboard, company-sector exposure, historical chart and table, sector KPI data, capital allocation, supported product/pipeline tables, peer comparison, risk matrix, valuation scenarios, and dated valuation. Market assets cover the market definition, compatible official time series, Census footprint data when returned, and company-versus-industry proxy comparison. Unsupported or empty datasets are not rendered.

CSV and XLSX contain full normalized rows. XLSX keeps numeric cells numeric, freezes headers, applies filters, sizes columns, and includes a metadata sheet. SVG is standalone and sanitized. PNG is a portable 1600×900 rendering generated from the structured dataset. Filenames are deterministic and safe.

## Security and persistence

- asset/report/format identifiers are allowlisted;
- arbitrary user URLs are not accepted;
- SVG scripts, foreign objects, event handlers, external references, style blocks, and executable URLs are removed or rejected;
- CSV and XLSX text beginning with formula-control characters is escaped;
- secret query fields, sensitive metadata keys, credentials, and local filesystem paths are redacted;
- response MIME types and attachment filenames are explicit;
- export failure does not invalidate the report.

Visual datasets and generated descriptors currently live in a bounded process-local TTL store. They expire and may not be available on another server instance. Durable object storage and signed download authorization are deployment follow-ups; the current identifiers are not an authentication boundary.

## Known limitations

- Only the NVDA mapping has specialized review in this release.
- Public economic classifications do not equal a commercial total-addressable market unless the cited definition says so.
- Company-versus-industry comparisons are directional proxies and do not establish causation.
- Gross industry output and NVIDIA Data Center comparisons are omitted when compatible verified inputs are absent.
- Portable PNG text uses an ASCII bitmap fallback; CSV, XLSX, SVG, Web, and PDF preserve the full bilingual labels.
