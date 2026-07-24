# FinBro Research Worklog

## Universal Metric Coverage V1 — Phases 2–3

- Centralized standard metric aliases, unit/period/applicability metadata, and validation rules in Metric Definition Registry V2.
- Migrated live Company Facts extraction to the registry and added deterministic unit filtering.
- Added a versioned derivation catalog plus guarded tax, capital-intensity, R&D-intensity, share-growth, average-balance ROA, and average-balance ROE calculations.
- Validation to date: 34/34 tests passed after registry migration; TypeScript passes after derivation expansion.
- Next milestone: adaptive Full/Standard/Limited report presentation.

## Universal Metric Coverage V1 — Phase 1

- Added a versioned benchmark registry for 16 new issuers plus the five accepted regressions.
- Added applicability-aware Tier 1/Tier 2 expectations, extraction-audit records, deterministic missing-reason codes, weighted scores, and Full/Standard/Limited report modes.
- Published coverage metadata through the research API without treating candidates as coverage or changing Canonical Metric values.
- Validation: production build and 31/31 tests passed; failures: none.
- Rollback: `6e4f048`. The unrelated `.DS_Store` remains excluded.
- Next milestone: central Universal Metric Definition Registry V2 and verified standard concept aliases.

## Universal Metric Coverage V1 — Phase 0 baseline

- `saveToken` routing: Sol owns architecture, definitions, derivation/validation policy and regression approval; Terra owns repository/coverage/extraction investigation and numerical reconciliation; Luna owns adaptive UI, diagnostics presentation, documentation, fixtures, and routine tests.
- Rollback point: local commit `27d463b`. No task files were dirty at start; the pre-existing `.DS_Store` modification remains unrelated and excluded.
- Baseline flow: `financial-metrics.ts` maps a flat concept list into Canonical Metrics, then `ensureCoreDerivedMetrics` calculates supported ratios and balances. Filing custom-XBRL/HTML parsing exists in the Shell-specific Metric Locator but is not yet a universal enrichment stage.
- Baseline quality gate: 27/27 tests, ESLint, TypeScript, vinext build, Vercel build, and `git diff --check` passed.
- Baseline coverage measurement: absent. There is no central applicability model, Tier 1/Tier 2 audit, benchmark registry, weighted score, or adaptive report mode.
- Rejected approaches: no LLM/embedding metric selection, no automatic custom-tag publication, no segment-as-consolidated substitution, and no broad snapshot rewrites.
- Next milestone: Phase 1 coverage diagnostics and versioned benchmarks.

## Deterministic SEC SIC routing — validated locally, not released

- `saveToken` routing: Terra handled repository/test-path inspection and regression inventory; Sol set resolution priority, SIC/fallback architecture, and final decision rules; Luna handled the form simplification, read-only classification panel, routine code edits, documentation, and formatting.
- UI: removed Market, Sector, and Subindustry selectors. The request now sends company/ticker, locale, and existing report options only. Versioned persistence retains those fields, and retry still preserves the assignment.
- Resolution: added bundled AAPL identity and `apple` / `apple inc` aliases. Exact tickers are deduplicated by normalized ticker plus zero-padded CIK; title punctuation or exchange differences do not create ambiguity. BRK.B/BRK-B and GOOG/GOOGL behavior remains covered.
- Classification: SEC Submissions SIC is authoritative. Added a centralized 12-pack registry and deterministic exact-SIC → SIC-family → sector-general → general-corporate fallback. Deprecated client sector/subindustry fields are accepted but ignored.
- Metrics: preserved all existing validated formulas and annual-fact deduplication. Added standard filing-backed diluted EPS and shares-outstanding definitions to the universal Canonical Metric core. Pack-specific metrics remain evidence-gated.
- API/report: added the structured classification object to diagnostics and report metadata; the UI exposes it in an expandable read-only panel. Missing specialization uses a General Pack rather than an SEC-outage error.
- Validation: 27/27 full tests passed; ESLint passed without warnings; `tsc --noEmit`, vinext production build, Vercel `next build --webpack`, and `git diff --check` passed. Existing SHEL/NVDA/JPM/LLY/CAT numerical and bilingual acceptance gates remained green.
- Live AAPL check: HTTP 200 from SEC Submissions and Company Facts; `AAPL → Apple Inc. → CIK 0000320193 → SIC 3571 Electronic Computers → Technology Hardware General`; five standardized annual periods generated without fallback.
- Limitations: SIC can be broad or outdated; no embedding/text classifier is used; unmapped issuers use General Corporate; specialized KPI coverage remains incremental.
- Next recommended step: review the local commit, then push/deploy only under a separate explicit release request.

## Non-default ticker pipeline investigation and fix — validated locally

- `saveToken` routing: Terra inspected the request path, ran the non-default ticker matrix, and traced SEC responses; Sol isolated the root cause and approved the error-boundary design; Luna implemented the centralized client, compact error panel, persistence, tests, and documentation cleanup.
- Confirmed root cause: MCHP and PNC completed ticker resolution, SEC Submissions, and Company Facts retrieval successfully (HTTP 200) but failed during Metric Registry construction. Multiple valid annual endpoints in one calendar year were all labeled `FY<year>`, causing a duplicate canonical key. The route then incorrectly converted that internal metric-normalization exception into a generic SEC-unavailable response.
- Changes: added `site/app/lib/sec-client.ts` as the only SEC transport for research and Shell locator traffic. It uses a declared User-Agent, server-side request boundary, controlled memory caches, sub-10 rps scheduling, bounded retries/backoff for retryable errors, timeout handling, SEC ticker/exchange association lookup, zero-padded CIKs, share-class normalization (`BRK.B` → `BRK-B`), ambiguity detection, and safe diagnostics. Added cached `GET /api/sec-health`.
- Error behavior: `/api/research` now returns structured stage-aware failures (code, safe message, technical diagnostic, retryability, trace ID, preserved selections, safe request diagnostics, and sector details) rather than masking all unexpected exceptions as an SEC outage. Missing/inadequate Company Facts and unsupported sector classification are distinct outcomes; Shell retains its verified filing fallback only where supported.
- UI: preserved company/market/sector/subindustry/options in versioned local storage, added compact retry/edit-ticker actions and expandable technical details, and retained the existing FinBro/Ethan visual shell and report/PDF styles.
- Metrics: annual fact selection now deterministically chooses one valid reported endpoint per calendar year before generating existing `FY<year>` canonical keys. This fixes the collision without changing formulas, registry definitions, existing snapshot values, valuation assumptions, or report methodology.
- Tests passed: ESLint, Vercel-compatible `next build --webpack`, `git diff --check`, and 26/26 rendered/API/canonical tests. New tests cover arbitrary AAPL resolution, BRK.B/BRK-B and GOOG/GOOGL normalization, ambiguity, CIK padding, ticker-map caching, SEC 429, and SEC timeout classification. Existing SHEL/NVDA/JPM/LLY/CAT bilingual consistency acceptance gates remain green.
- Known limitations: only the five existing sector packs can produce full institutional reports. A successfully retrieved issuer outside those SIC-backed packs now receives a sector-classification/coverage result rather than a false SEC outage; no new sector pack was added. The SEC ticker association cache remains process-local in serverless cold starts, as intended for this small focused fix.
- Next recommended step: deploy this validated local checkpoint only after the owner requests release; then test MCHP and PNC plus one unsupported but valid issuer against production and inspect the structured diagnostic panel.

## Vercel compatibility and production deployment — deployed

- Root cause: the GitHub repository contained only a local `site/` Gitlink without a `.gitmodules` mapping or remotely fetchable source repository, so Vercel could not retrieve the actual application.
- Changes: converted that Gitlink into the existing tracked `site/` source tree; preserved the prior nested Git metadata outside the source tree. Added `site/vercel.json` (`nextjs`, `npm ci`, `npm run vercel-build`), the `vercel-build` script (`next build --webpack`), and ignored local `site/tmp/` artifacts. Cloudflare-only database code is retained but marked/excluded so Vercel’s Next.js type check does not require the Cloudflare virtual runtime module.
- Validation: the Vercel build command’s underlying `next build --webpack` completed successfully, as did ESLint. The published production homepage returned HTTP 200 from Vercel and server-rendered FinBro and Ethan content.
- GitHub: exact source commit `437ba0e61e1467f21df1572ed5fe0fe7e9bc84d1` was pushed to `Evvan0903/Finance-bro` on `main`.
- Deployment: Vercel project `evan-sun/finbro`, deployment `dpl_98ovkSn6uBDyVHgVK5GTAP4ZXQzT`, is production-ready at <https://finbro-seven.vercel.app>.
- Environment: no variable is required for the application to start. Set `SEC_USER_AGENT` in Vercel to a descriptive contact string (for example, `FinBro research@example.com`) for reliable live SEC requests; without it the retained fallback header is used.

## FinBro public shell rebrand — deployed

- Objective: rebrand the public website and application shell as **FinBro**, with **Ethan** as the AI junior analyst, while retaining formal, source-backed institutional research output and all existing financial logic.
- `saveToken` routing: Sol set the information architecture, public-versus-report tone boundary, and final functional review. The Luna presentation lane handled visual tokens, responsive shell layout, public copy, metadata, social preview, favicon, and routine test updates. Terra was not used because no large-scale content inventory or research extraction was needed.
- Brand and tone: public navigation, page metadata, product labels, request flow, loading state, footer, social preview, and PDF footer now use FinBro. Ethan is presented only as an AI junior analyst / research workflow assistant. The report body remains formal and objective; humor is confined to the application shell.
- Design: created `docs/design/aeye_design_reference.md` with the verified Aeye-derived token system. The exact `#0055FF` primary blue and all requested blue, surface, border, and text tokens are now defined globally. The responsive shell uses a white technical-research canvas, compact assignment panel, Ethan status card, original FinBro social image, and a new FinBro favicon.
- Integrity: no sector pack, source-selection rule, Metric Object, valuation formula, or financial calculation was redesigned. A pre-existing JPM scenario-audit failure was repaired by attaching its already-calculated model-implied equity value to its canonical metric reference; values and formulas were unchanged.
- Validation passed: production build; ESLint; 24/24 rendered/API/canonical-consistency tests; `git diff --check`. JPM, Shell, NVDA, LLY, and CAT acceptance gates still pass. The local dev-server visual harness could not stay bound in this sandbox, so final visual confirmation will use the existing private production site after release.
- Deployment: exact validated source commit `d20812d54baf0ab454042399da0b4de25bd5c8fb` (`d20812d`) was pushed to the existing private Sites project, saved as version **11** (`appgprj_6a585b81f7708191b13b1c34903345a9~appgver_1cbebbaad32c8191ae0c9f09dc1873e8`), and published as `appgdep_6a5b0ede3df08191afb09ea2f388c0dd`. The production URL remains <https://scopeline-research.evvan.chatgpt.site>; access is still custom and owner-only. The Sites display title is now `FinBro | Your overworked entry-level analyst.`
- Production verification: authenticated HTTP response returned 200 and server-rendered FinBro/Ethan content. The private browser correctly showed the normal ChatGPT sign-in gate before authentication; the deployment screenshot provided the owner-visible first viewport and showed the FinBro mark, exact blue shell, Ethan card, task form, Chinese/English control, no clipping, and no large empty region.
- Remaining issue: the legacy production URL slug remains `scopeline-research`, intentionally preserved because changing it would be a separate public-routing decision. There are no functional or visual release blockers.

## Financials → Diversified Banks → JPM — validated

- Objective: complete and validate only the JPM bank pack using `Sector → Subindustry → Validation Company`; no other subindustry was started.
- `saveToken` routing: Sol handled decomposition, architecture, financial judgment, integration, conflict resolution, and final review; Terra handled current-source research plus filing-metric extraction/normalization; Luna handled bilingual labels, formatting, reflow, and routine presentation QA. Sol re-reviewed live-path, valuation, consistency, and PDF exceptions.
- Accepted current research: eight official, dated sources published from 2026-03-19 through 2026-07-10 from the Federal Reserve, FDIC, and OCC. Coverage includes rates/yield curve, deposits and liquidity, loan standards/demand, credit quality, capital/regulation, stress tests, trading, and operational risk. Each outlook claim retains publisher, original publication date, title, and clickable URL.
- Company evidence: four JPM-specific 2Q26 exposure rows use the July 14, 2026 SEC-filed earnings supplement for rates/deposits, credit, capital/liquidity/shareholder returns, and investment-banking/trading operating leverage. Unsupported rows remain hidden.
- Metrics located: canonical FY2025 objects now cover net interest income, firmwide managed net yield, deposits, total-deposit cost, loans, loan growth, provision, net charge-offs, allowance and coverage, CET1, LCR, efficiency, issuer ROE, issuer ROTCE, tangible book value, TBVPS, dividends, buybacks, combined capital returns, consolidated investment-banking fees, and Markets revenue. Newly verified filing values include 1.80% deposit cost, USD 9.8bn net charge-offs, 20% ROTCE, USD 107.56 TBVPS, USD 9.615bn investment-banking fees, and USD 35.782bn Markets revenue.
- Cross-report architecture: the same canonical keys feed Dashboard, Historical Financials, Company Exposure, Industry KPIs, Investment Debates, Risks, Catalysts, Peer Comparison, scenarios, Web, and PDF. The live SEC path now loads the verified FY2025 issuer metrics when the filing identity and date match.
- Valuation: P/TBV remains primary at explicit 1.20x / 1.70x / 2.20x scenario assumptions. Deterministic cross-checks show implied per-share value, P/E, cash-dividend yield, and issuer ROTCE less a visible 10% cost-of-equity assumption. No EV/revenue, EV/EBITDA, industrial FCF, rating, or target price is used. The report explicitly does not claim current, historical, or peer trading ranges without a dated market price.
- UI/PDF: bank-specific bilingual labels and mixed-unit captions added; unusable peer rows/columns and empty modules are hidden; cards reflow automatically; null chart bars are suppressed; Company Exposure citations stay compact. Chinese financial abbreviations are localized. PDF pagination now continues long blocks near natural blank rows and removes trailing blank pages.
- Validation passed: ESLint; production build; 24/24 automated tests; deterministic double-run consistency; live JPM request with peer comparison; Chinese and English canonical-value parity; 42 valid Web report links with no invalid hrefs; no DOM clipping, empty report sections, or blank charts. Final application PDFs were exported and rendered page-by-page: Chinese 7 pages and English 8 pages, with no blank trailing pages, clipped tables, or missing charts.
- Deployment: exact site commit `921715e8f16422dd3fa24d7059304fa8c3f85fa0` was saved as private Sites version **10** (`appgprj_6a585b81f7708191b13b1c34903345a9~appgver_8fe6761d893c81918769a4619f2f00ee`) and successfully published as deployment `appgdep_6a5ae1dc0f948191a02ae683995a9e30` at <https://scopeline-research.evvan.chatgpt.site>. Owner-only access remains unchanged. Sites confirmed the production deployment; the in-app browser reached the expected private ChatGPT sign-in gate, so it did not repeat the authenticated report interaction against production.
- Tests failed: an interim live peer-comparison run exposed four legacy values without canonical keys, and an interim visual run exposed incorrect per-share compact formatting plus a blank English PDF tail page. All were fixed and the final validation passed.
- Known limitations: standardized SEC XBRL still does not expose every issuer-defined KPI, so matched JPM filing-table metrics remain guarded by exact filing identity/date. The P/TBV range is an analyst sensitivity, not a claimed observed historical or peer range. The application PDF is a rasterized, visually cited report; Web citations remain the interactive clickable source surface.
- Industry status: **Financials → Diversified Banks is supported** after JPM bilingual Web/PDF validation.
- Next recommended step: monitor the deployed JPM live path and source freshness; stop here and do not begin another subindustry in this iteration.

## Current Industry Outlook & NVDA presentation upgrade — deployed

- Objective: improve the existing sector-aware application without rebuilding it: current, cited sector outlook; company-specific exposure; one presentation layer for financial units; bilingual Web/PDF parity; and NVDA validation.
- Changes: added a typed presentation formatter used by the dashboard, KPI cards, historical tables, and report export; values now use `US$` plus named full units, while financial tables use `Unit: US$ billion` (or the explicit mixed-unit label), one decimal for financial table values, and two for per-unit and multiple values.
- Sector evidence: deterministic retrieval now uses the research date rather than deployment-clock time, applies the source hierarchy as a tie-breaker, records `Research window: 2025-01-01 to 2026-06-29`, and includes compact clickable publisher/date/source citations. Added current official SEMI HBM/memory-capacity evidence and corrected the BIS export-control source.
- NVDA company exposure: replaced generic sector-to-company claims with four verified NVIDIA-specific rows: FY2026 Data Center revenue and growth; third-party manufacturing/assembly/package/test dependency; Blackwell and networking transition evidence; and the Q1 FY2026 H20 export-control charge. Unsupported HBM volumes/pricing and generic sector rows are omitted and retained only in Data Coverage.
- Shell metrics: 11/11 previously requested Shell locator metrics remain found — production, realized prices, LNG volumes, refining margin, segment earnings, cash capex, strict FCF, net debt, dividends, buybacks, and major projects. Unresolved: none.
- Files changed: `site/app/lib/presentation-format.ts`, canonical-metric and locator formatters, sector evidence/retrieval/types/learning pipeline, research API/types, `ResearchApp.tsx`, styles, and rendered-report tests.
- Validation: production build passed; ESLint passed; 24/24 automated tests passed. Authenticated production API checks returned current English and Chinese NVDA reports with matching financial values, the accepted research window, dated citations, and four verified exposure rows. Failed tests: none. The package-manager wrapper could not run in the non-interactive restricted environment, so the underlying build/test commands were run directly and passed.
- Deployment: private Sites version **9** is live at <https://scopeline-research.evvan.chatgpt.site>, sourced from `3898e54f6dc9eec07ccace8491b928a8eec92b60` (`3898e54`). Deployment ID: `appgdep_6a5ad4a6fb58819185cfdf9236553f42`. Owner-only access remains unchanged.
- Known limitations: owner-only authentication prevented a fresh in-browser visual/PDF screenshot in this session. PDF export continues to use the same audited shared report DOM and its regression checks passed. Claims are limited to accepted public evidence; missing company-specific facts remain hidden rather than inferred.
- Next recommended step: have the owner sign in and export one live NVDA PDF for final human visual QA; do not expand to additional sectors until that check is satisfactory.

## Deployment — validated Phase 9 release

- Commit SHA: `71f5fd47380c04606e0a80045d53fe3a401837b4` (`71f5fd4`)
- Sites project: `appgprj_6a585b81f7708191b13b1c34903345a9`
- Saved version: Sites version **6** (`appgprj_6a585b81f7708191b13b1c34903345a9~appgver_2308142c1fa88191b7bc7fb93c6d00f3`)
- Deployment: succeeded as publish deployment `appgdep_6a5a8e7b4d5881918d17ab62bf8d7aef`; owner-only access preserved.
- Production URL: <https://scopeline-research.evvan.chatgpt.site>
- Verification: Sites reports latest version 6 and the saved version source matches the commit above; the authenticated production URL returned HTTP 200 with 10,435 bytes.
- Remaining issues: no deployment or implementation blockers. The in-app browser DOM snapshot was empty in this session, so live verification used the Sites deployment record and an authenticated production HTTP check.

## Canonical Metric Upgrade — Phase 9

- Objective: finalize the worklog, machine-readable consistency artifact, recovery state, and private production release.
- Artifact: updated `site/artifacts/metric_consistency_report.json` for all five accepted companies and sectors. It records 921 canonical metrics, 3,562 surface references, zero duplicate keys, zero conflicting values, zero formula mismatches, zero cross-section mismatches, and zero reproducibility mismatches.
- Final validation: all five fixture reports returned HTTP 200, passed consistency with zero issues, and reproduced exactly across two runs. The final production build, ESLint, and 24/24 automated tests passed.
- Source checkpoint: exact validated Sites source is committed locally at `71f5fd4` (`checkpoint: final consistency artifact phase 9`); Phase 8 is `ee60e83`, and Phase 7.4 is `4c7e91e`.
- Deployment status: completed. The exact source was pushed to the existing Sites `main` branch, saved as version 6, deployed through the owner-only production path, and verified live at the production URL above.
- Remaining action: none for this deployment-only release. The existing application validation remains recorded below; no implementation or refactor was made during deployment.

## Canonical Metric Upgrade — Phase 8

- Objective: complete deterministic coverage for schema, uniqueness, dependencies, units, currency, periods, lineage, candidate/definition conflicts, precision, consistency, cache invalidation, reproducibility, Web/PDF agreement, sector requirements, and unsupported fallbacks.
- Changes: added explicit mixed-unit and mixed-currency rejection tests, full-precision ratio verification, cache hit/delete/expiry/failure/clear tests, five-snapshot presence checks, and industrial working-capital surface auditing.
- Candidate validation: CAT's standardized `CostOfGoodsAndServicesSold` fact was not a consolidated cost-of-sales measure. A plausibility gate now prevents this immaterial fact from creating a false 99.9% derived gross margin; CAT gross profit and gross margin remain unavailable while operating margin remains verified.
- Runtime resilience: live SEC requests remain first priority. Only SHEL, NVDA, JPM, LLY, and CAT may fall back after a temporary SEC/network error to their dated, verified official-source snapshots; the fallback is disclosed in Data Coverage. Arbitrary issuers never receive a Shell or generic snapshot.
- Regression fixtures: SHEL, NVDA, JPM, LLY, and CAT all have saved Company Facts/Submissions snapshots, and every supported sector has a double-run acceptance test.
- Tests: targeted ESLint passed; production build passed; 23/23 automated tests passed at the Phase 8 checkpoint; direct no-fixture CAT outage simulation returned HTTP 200, passed the consistency audit, disclosed the snapshot date, and preserved FY2025 strict FCF of USD 8.918bn; 0 failed.
- Files: research API, financial normalization, consistency auditor, and regression tests.
- Next: generate the final machine-readable consistency artifact and completion report.

## Canonical Metric Upgrade — Phase 7.4

- Objective: validate Industrials / Industrial Machinery with CAT and complete sequential sector unlocking.
- Research: ingested four current official sources from the U.S. Census Bureau, Federal Reserve, BLS, and Caterpillar covering orders/backlog, manufacturing utilization, producer-price inputs, and Q1 2026 volume/price/cost execution.
- Changes: added the industrial-machinery KPI ontology, source priorities, backlog and price-cost research methods, sector drivers, peers, EV/FCF scenarios, and dedicated bilingual report/UI paths.
- Filing extraction: captured CAT FY2025 firm backlog (USD 51.2bn), backlog expected within one year (USD 19.3bn), price-realization profit impact (USD -0.817bn), manufacturing-cost profit impact (USD -2.148bn), and Power & Energy segment margin (19.9%) with exact 10-K provenance.
- Derived metrics: working capital = USD 52.485bn current assets − USD 36.558bn current liabilities = USD 15.927bn; strict FCF = USD 11.739bn operating cash flow − USD 2.821bn cash capex = USD 8.918bn; FCF conversion = 100.41%; price-cost impact = USD -2.965bn; near-term backlog share = 37.70%.
- Acceptance: 7/10 KPI cards have verified canonical values. Comparable FY2025 new orders, uniform organic growth, and CAT company-level utilization remain ontology concepts but are hidden because no comparable issuer numeric value was verified; industry utilization is context only.
- Valuation: Bear/Base/Bull use explicit through-cycle FCF and 10x/14x/18x EV/FCF assumptions. Backlog is not treated as recognized revenue and near-term backlog share is not presented as a completion rate.
- Consistency and reproducibility: after the Phase 8 consolidated-gross-profit plausibility gate, 227 canonical metrics and 858 surface references passed with zero issues; two identical runs matched all objects, definitions, formulas, sources, statuses, scenarios, valuation values, citations, and outputs.
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

Monitor production extraction behavior before adding any new sector or issuer pack. Sites version 6 is live at `https://scopeline-research.evvan.chatgpt.site` and remains owner-only.
