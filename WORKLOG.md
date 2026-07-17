# ScopeLine Metric Locator Worklog

## Canonical Metric Upgrade — Phase 7.4

- Objective: validate Industrials / Industrial Machinery with CAT and complete sequential sector unlocking.
- Research: ingested four current official sources from the U.S. Census Bureau, Federal Reserve, BLS, and Caterpillar covering orders/backlog, manufacturing utilization, producer-price inputs, and Q1 2026 volume/price/cost execution.
- Changes: added the industrial-machinery KPI ontology, source priorities, backlog and price-cost research methods, sector drivers, peers, EV/FCF scenarios, and dedicated bilingual report/UI paths.
- Filing extraction: captured CAT FY2025 firm backlog (USD 51.2bn), backlog expected within one year (USD 19.3bn), price-realization profit impact (USD -0.817bn), manufacturing-cost profit impact (USD -2.148bn), and Power & Energy segment margin (19.9%) with exact 10-K provenance.
- Derived metrics: working capital = USD 52.485bn current assets − USD 36.558bn current liabilities = USD 15.927bn; strict FCF = USD 11.739bn operating cash flow − USD 2.821bn cash capex = USD 8.918bn; FCF conversion = 100.41%; price-cost impact = USD -2.965bn; near-term backlog share = 37.70%.
- Acceptance: 7/10 KPI cards have verified canonical values. Comparable FY2025 new orders, uniform organic growth, and CAT company-level utilization remain ontology concepts but are hidden because no comparable issuer numeric value was verified; industry utilization is context only.
- Valuation: Bear/Base/Bull use explicit through-cycle FCF and 10x/14x/18x EV/FCF assumptions. Backlog is not treated as recognized revenue and near-term backlog share is not presented as a completion rate.
- Consistency and reproducibility: 235 canonical metrics and 890 surface references passed with zero issues; two identical runs matched all objects, definitions, formulas, sources, statuses, scenarios, valuation values, citations, and outputs.
- UI validation: saved-source Chinese and English CAT reports showed USD 51.2bn backlog, USD -2.965bn price-cost impact, 19.9% segment margin, USD 15.927bn working capital, and 100.4% FCF conversion without a false coverage warning or UI error.
- Runtime note: a separate live-SEC browser request reproduced the existing temporary SEC public-data outage; the verified saved-source acceptance path passed. Runtime-source resilience remains a Phase 8 reliability item.
- Files: industrial sector types/methods/evidence/pack, financial normalization, research/outlook APIs, bilingual UI, CAT fixture, and tests.
- Tests: targeted ESLint passed; production build passed; 20/20 automated tests passed; bilingual browser acceptance passed; 0 failed.
- Industry status: Industrial Machinery validated/unlocked. Semiconductors, Banks, Biopharma, and Industrial Machinery have all passed their sequential acceptance gates.
- Next: complete Phase 8 automated invariants and five-company regression coverage.

## Canonical Metric Upgrade — Phase 7.3

- Objective: validate Healthcare / Biopharma with LLY before beginning Industrials.
- Research: ingested four dated public sources from IQVIA, FDA, and CMS covering R&D productivity, novel approvals, clinical-trial participation, and the 2028 Medicare negotiation cycle.
- Changes: added the biopharma KPI ontology, source priorities, research methods, drivers, peers, bilingual UI/report paths, and transparent commercial-revenue EV/revenue scenarios.
- Filing extraction: captured LLY FY2025 Mounjaro revenue (USD 22.965bn), Zepbound revenue (USD 13.542bn), combined revenue concentration (56%), and issuer-estimated U.S. compound-patent expiry (2036) with exact 10-K section/table/row provenance. The verified filing evidence is reused only when the live latest annual filing matches FY2025 and its February 12, 2026 filing date.
- Acceptance: 5/10 KPI cards have verified numeric objects: largest-product revenue, product concentration, R&D expense (USD 13.337bn), derived gross margin (83.04%), and patent-expiry year. Pipeline stage, clinical milestones, regulatory dates, cash runway, and risk-adjusted pipeline value remain explicit ontology concepts but are hidden as numeric cards because public inputs do not support deterministic values.
- Valuation: Bear/Base/Bull use explicit commercial-revenue and 4x/7x/10x EV/revenue assumptions. No pipeline count, clinical stage, probability, or unsupported rNPV is converted into a fabricated value.
- Consistency and reproducibility: 166 canonical metrics and 594 surface references passed with zero issues; two identical runs matched all canonical objects, definitions, formulas, sources, statuses, scenarios, valuation values, citations, and outputs.
- UI validation: live Chinese and English LLY reports showed USD 22.965bn, 56%, and 2036 from the verified filing objects, did not show an incorrect coverage warning, and produced no browser errors.
- Known limitations: candidate-level stages and milestones remain dated text evidence, not canonical numeric metrics; profitable LLY is not assigned a false cash-runway ratio; cash capex is unavailable from the selected standardized definition, so strict FCF remains uncalculated.
- Files: biopharma sector types/methods/evidence/pack, research API/UI, canonical display/financial normalization, LLY fixture/generator, and tests.
- Tests: targeted ESLint passed; production build passed; 19/19 automated tests passed; bilingual live browser acceptance passed; 0 failed.
- Industry status: Biopharma validated/unlocked; Industrials remains coming soon.
- Next: implement and validate Industrials with CAT.

## Canonical Metric Upgrade — Phase 7.2

- Objective: validate Financials / Banks with JPM before beginning Biopharma.
- Research: ingested three current official sources (FDIC Q1 2026 Quarterly Banking Profile, OCC Spring 2026 Semiannual Risk Perspective, and Federal Reserve 2025 stress-test results) with publication dates and source lineage.
- Changes: added the bank KPI ontology, source priorities, research methods, drivers, peers, P/TBV scenarios, and bank-specific report/UI paths; industrial revenue, capex, and FCF templates are explicitly excluded.
- Filing extraction: added a reusable issuer-reported filing-table metric input and captured JPM FY2025 firmwide managed-basis net yield (2.50%), standardized CET1 (14.6%), average LCR (111%), and issuer-reported ROE (17%) with exact 10-K table/row provenance.
- Acceptance: 12/12 core bank KPIs were populated. FY2025 net revenue was USD 182.447bn, NII USD 95.443bn, deposits USD 2.559tn, loan growth 10.88%, credit-loss provision USD 14.212bn, allowance coverage 1.76%, efficiency ratio 52.42%, tangible book value USD 308.407bn, and capital returns USD 48.216bn.
- Valuation: Bear/Base/Bull use explicit tangible-book growth and 1.2x/1.7x/2.2x P/TBV assumptions; model-implied equity values are USD 351.584bn / USD 540.021bn / USD 732.775bn. No FCF object is created for JPM.
- Consistency and reproducibility: 167 canonical metrics and 642 surface references passed with zero issues; two identical runs matched all objects and outputs.
- Known limitations: the 2.50% measure is JPM's managed-basis, FTE firmwide net yield on average interest-earning assets and is labeled as a NIM analogue, not silently treated as another NIM definition. Live issuers still require filing-table extraction or a verified snapshot for issuer-specific ratios absent from Company Facts.
- Files: bank sector types/methods/evidence/pack, research API/UI, canonical scenarios, financial normalization, consistency auditor, JPM fixture, fixture generator, and tests.
- Tests: targeted ESLint passed; production build passed; 18/18 automated tests passed; 0 failed.
- Industry status: Banks validated/unlocked; Biopharma remains preview.
- Next: implement and validate Healthcare / Biopharma with LLY, separating reported commercial metrics from pipeline assumptions.

## Canonical Metric Upgrade — Phase 7.1

- Objective: validate Semiconductors / NVDA before beginning Banks.
- Changes: saved a compact official SEC Company Facts/Submissions snapshot through 2026-07-17; made the fixture generator issuer-agnostic; added reported operating income and canonical operating-margin calculation; completed the semiconductor KPI ontology with operating margin and utilization.
- Acceptance: NVDA FY2022–FY2026 history; FY2026 revenue USD 215.938bn, gross margin 71.07%, operating margin 60.38%, inventory USD 21.403bn, cash capex USD 6.042bn, and strict FCF USD 96.676bn.
- Consistency: 174 canonical metrics and 662 surface references passed with zero issues. Dashboard, history, KPIs, debates, risks, scenarios, valuation, Web, and PDF references use the same keys.
- Reproducibility: two identical NVDA snapshot runs matched all 174 objects with zero missing or mismatched outputs.
- Known limitations: standardized SEC facts do not make issuer-specific utilization, product-cycle, customer-concentration, end-market/AI mix, or external market-share measures reliably comparable; unusable cards remain hidden and the ontology records the required concepts.
- Files: NVDA fixture/generator, financial metric normalization, semiconductor pack/types, research API/types, consistency auditor, and tests.
- Tests: targeted ESLint passed; production build passed; 17/17 automated tests passed; 0 failed.
- Industry status: Semiconductors validated/unlocked; Banks remains preview.
- Next: implement and validate Banks / JPM without industrial-company FCF or revenue templates.

## Canonical Metric Upgrade — Phase 6

- Objective: make recent sector-research learning reusable, dated, concise, and separate from company filings and canonical metrics.
- Changes: added a typed ingestion pipeline that validates public accessibility, relevance, original publication date, retrieval sequence, HTTPS URL, deduplication, required metadata, and concise bilingual method/evidence content.
- Stored fields: title, publisher, original publication date, retrieval date, sector, subindustry, geography, topic, URL, source type, generalized analytical methods, current evidence, and investor implication.
- Runtime discipline: only original concise patterns and evidence enter retrieval; no full report text is stored or loaded. Deterministic vector retrieval still runs only after sector/subindustry/geography/date filtering.
- Coverage: 3 integrated-oil-and-gas sources/methods and 4 semiconductor sources/methods accepted; 0 rejected. Every outlook claim carries publisher, publication date, title, and URL.
- Files: `site/app/lib/sector-learning-pipeline.ts`, sector evidence/types/retrieval, and tests.
- Tests: official source URLs reviewed; targeted ESLint passed; production build passed; 16/16 automated tests passed; 0 failed.
- Next: validate and unlock industries sequentially, beginning with Semiconductors / NVDA.

## Canonical Metric Upgrade — Phase 5

- Objective: confirm that compact missing-data presentation never conceals an invalid calculation or inconsistent report.
- Changes: scenario cards now omit unusable FCF, valuation-input, and implied-EV rows instead of repeating empty values; remaining rows reflow naturally. The existing one-time `Limited data coverage` label and expandable `Data Coverage` audit remain the detailed disclosure path.
- Publication control: `/api/research` now hard-blocks a report when the canonical consistency audit fails and returns the machine-readable audit instead of publishing potentially inconsistent values.
- Visibility: unresolved critical inputs remain recorded in `dataCoverage`; formulas and rejected candidates remain visible in the audit panel even when their empty metric cards are hidden.
- Files: `site/app/ResearchApp.tsx`, `site/app/api/research/route.ts`, and `site/tests/rendered-html.test.mjs`.
- Tests: targeted ESLint passed; production build passed; 16/16 automated tests passed; 0 failed.
- Next: build the dated, reusable sector research learning pipeline.

## Canonical Metric Upgrade — Phase 4

- Objective: pass the Shell 14-metric, cross-section, double-run, and Web/PDF acceptance gate before sector expansion.
- Snapshot: saved a compact official SEC Company Facts/Submissions fixture dated through 2026-07-17; the existing verified Form 20-F excerpt supplies filing-level custom XBRL and KPI text without storing the full filing.
- Results: 14/14 required metrics found; 142 canonical objects and 642 surface references audited with zero issues; two runs matched 142/142 objects with zero missing, definition, formula, source, status, scenario, valuation, citation, or output changes.
- FCF: USD 42.863bn OCF − USD 20.915bn cash capex = USD 21.948bn. Dashboard, FY2025 history, KPI, and valuation starting point use the same canonical key.
- Capital allocation: one issuer-reported net-debt definition; FCF, dividends, buybacks, and net debt agree across KPIs, company exposure, debates, risks, and valuation references.
- Inconsistency found/resolved: dashboard and KPI copy described issuer-reported Shell net debt as simple normalized debt less cash. Both now disclose derivative/collateral adjustments and classify the metric as reported.
- Web/PDF: both use `shared-research-report-dom-v1`; generated an eight-page PDF, rendered every page, and found no clipping, overlap, empty charts, broken tables, or footer errors.
- Files: Shell source fixture/generator, scenario starting-point lineage, canonical display formatting, research API/UI, tests, `site/artifacts/metric_consistency_report.json`, and `site/output/pdf/shell-phase4-consistency.pdf`.
- Tests: targeted ESLint passed; production build passed; 16/16 automated tests passed; 0 failed.
- Next: revalidate missing-data behavior and invalid-formula visibility.

## Canonical Metric Upgrade — Phase 3

- Objective: automate cross-surface consistency and same-snapshot reproducibility checks.
- Changes: added a Metric Consistency Auditor covering Registry schema/duplicates/conflicts, cache identity, period/unit/currency controls, source lineage, exact formula replay, rounded-input detection, module references, historical tables, chart inputs, narratives, peer data, scenarios, valuation, and shared Web/PDF data-model keys.
- Reproducibility: added a machine-readable comparator for matched, mismatched, missing, definition-changed, formula-changed, source-changed, status-changed, scenario-changed, valuation-changed, and citation-changed outputs; retrieval timestamps are the only excluded fields.
- Integration: `/api/research` now returns `consistencyAudit` beside the report. Web and PDF use one versioned rendering-model constant, and PDF export rejects an unaudited DOM model.
- Files: `site/app/lib/metric-consistency-auditor.ts`, `site/app/lib/report-rendering-model.ts`, research API/types, Web report, PDF exporter, tests.
- Tests: targeted ESLint passed; production build passed; 15/15 automated tests passed; 0 failed. A deliberate historical-value mutation was detected, while two identical snapshots with different retrieval timestamps reproduced successfully.
- Next: run the full Shell acceptance and double-run comparison from saved source snapshots, then compare Web/PDF values.

## Canonical Metric Upgrade — Phase 2

- Objective: make the canonical Registry the only quantitative source used by report modules.
- Changes: normalized annual SEC facts into the Registry; added definition-priority selectors and historical adapters; routed dashboard, historicals, sector KPIs, driver exposure, earnings quality, thesis, debates, risks, catalysts, peers, scenarios, and valuation through canonical keys.
- Scenario controls: assumptions are explicit canonical objects; projected revenue, net income, operating cash flow, capex, FCF, valuation metric, and model-implied enterprise value are deterministic Registry calculations with input lineage.
- Traceability: the report now publishes a canonical snapshot plus a `metricUsage` ledger by module. Peer metrics share the report data version and are merged into the same snapshot.
- Files: `site/app/lib/financial-metrics.ts`, `site/app/lib/canonical-scenarios.ts`, canonical Registry, research API/types, metric definitions/locator, tests.
- Tests: production build passed; targeted ESLint passed; 14/14 automated tests passed; 0 failed.
- Network note: a direct Shell research smoke test from the restricted local sandbox reached the existing bilingual SEC-unavailable response (HTTP 502). No Registry exception occurred before the blocked external fetch; fixture-based reproducibility testing remains scheduled for Phases 3–4 and 8.
- Next: implement the automated consistency and reproducibility auditor before running the full Shell acceptance gate.

## Canonical Metric Upgrade — Phase 1

- Objective: establish one canonical Metric Object and Metric Registry before changing report modules.
- Changes: added schema validation, canonical-key construction, definition-aware lookup, history/sector selectors, deterministic formula dependency resolution, full-precision storage, source lineage, and locator-to-registry publication.
- Files: `site/app/lib/canonical-metrics.ts`, metric-locator types/engine/API, tests.
- Tests: production build passed; 13/13 tests passed; 0 failed.
- Metrics unified: 12 Shell FY2025 objects, including strict FCF and its canonical operating-cash-flow/cash-capex inputs.
- Inconsistencies found/resolved: issuer and normalized definitions can collide under a loose query; Registry now raises `DEFINITION_CONFLICT` until a definition is explicit.
- Unresolved: report modules still use legacy period adapters and calculations; addressed in Phase 2.
- Industries: Integrated Oil & Gas remains supported; Semiconductors remains existing support pending canonical acceptance; Banks, Biopharma, and Industrials remain preview/coming soon.
- Next: connect every report module to the Registry and remove duplicate calculations.

## Changes made

- Added a reusable, ordered Metric Locator Engine for standard SEC XBRL, filing custom XBRL, filing HTML tables, filing text, exhibits/releases, and existing presentations.
- Added deterministic extraction, unit normalization, derivation, validation, confidence, source provenance, and rejected-candidate auditing.
- Integrated Shell FY2025 locator results into the existing report without adding sectors.
- Hid unusable KPI and balance cards, reflowed remaining cards, replaced repeated missing strings with `—`, and added compact `Limited data coverage` plus expandable `Data Coverage`.

## Files changed

- `site/app/lib/metric-locator-types.ts`
- `site/app/lib/metric-definitions.ts`
- `site/app/lib/metric-locator.ts`
- `site/app/lib/shell-metric-validation.ts`
- `site/app/api/metric-locator/route.ts`
- `site/app/api/research/route.ts`
- `site/app/lib/research-types.ts`
- `site/app/lib/sector-packs.ts`
- `site/app/ResearchApp.tsx`
- `site/app/globals.css`
- `site/tests/rendered-html.test.mjs`
- `RECOVERY.md`, `TODO.md`, `WORKLOG.md`

## Shell validation

- Found: Production; realized prices; LNG volumes; refining margins; segment earnings; cash capital expenditure; strict free cash flow; net debt; dividends; share buybacks; major projects.
- Unresolved: none.
- Success rate: 11/11 (100%).
- Strict FCF: USD 42.863bn operating cash flow − USD 20.915bn cash capex = USD 21.948bn. Shell's USD 26.052bn differently defined FCF is retained as a rejected definition-mismatch candidate.

## Tests

- Passed: ESLint; targeted TypeScript checks; production build; 12/12 automated tests; full Shell 2025 Form 20-F + Company Facts locator test; integrated Shell research response test.
- Failed: none.

## Known limitations

- The engine is reusable, but each new issuer/metric still needs aliases, definitions, units, and validation rules.
- The selected realized-price value is explicitly scoped to Europe / Shell subsidiaries / crude oil and NGL; it is not a group-wide blended realization.
- If SEC filing HTML is temporarily unreachable, Shell validation uses an explicitly labeled verified FY2025 snapshot.

## Next recommended step

Monitor production extraction behavior before adding any new sector or issuer pack. Sites version 5 is live at `https://scopeline-research.evvan.chatgpt.site` and remains owner-only.
