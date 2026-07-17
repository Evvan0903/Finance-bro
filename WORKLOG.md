# ScopeLine Metric Locator Worklog

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
