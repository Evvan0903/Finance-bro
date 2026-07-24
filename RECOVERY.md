# Recovery Checkpoint

## Current objective — deterministic SEC SIC research-pack routing

### Original objective

Simplify FinBro so users enter only a ticker/company name, language, and existing report options. Resolve one SEC identity, use SEC Submissions SIC as the authoritative deterministic classifier, map multiple SIC codes to broad General Research Packs, preserve the Metric Registry/evidence/report architecture, validate AAPL and the five accepted issuers, and create a local commit without pushing or deploying.

### Completed

- Preserved the pre-refactor checkpoint at `8915d5f` and left the unrelated `.DS_Store` change untouched.
- Added deterministic AAPL/alias resolution, ticker+CIK deduplication, controlled legal-name matching, and distinct-CIK-only ambiguity.
- Added centralized SIC rules, a 12-pack registry, exact/family/sector/general fallback, and structured classification metadata.
- Connected SEC Submissions classification to the research API; deprecated client sector/subindustry fields no longer control the result.
- Removed Market/Sector/Subindustry selectors and added expandable read-only SIC/pack metadata.
- Reused all five validated packs unchanged, added conservative broad/general packs, and added filing-backed diluted EPS and shares-outstanding metrics to the universal core.
- Updated README, architecture documentation, tests, worklog, recovery notes, and TODO.
- Passed 27/27 tests, ESLint, TypeScript, vinext build, Vercel build, and live AAPL SEC integration. The existing SHEL/NVDA/JPM/LLY/CAT numerical acceptance gates remain green.

### Remaining

- Do not push to GitHub or deploy to Vercel.

### Current status

Implementation, validation, and the required local commit are complete. AAPL resolves to CIK `0000320193`, SIC `3571`, and Technology Hardware General; missing specialization no longer blocks report generation.

### Files modified

- `README.md`
- `WORKLOG.md`
- `RECOVERY.md`
- `TODO.md`
- `site/README.md`
- `site/docs/research-classification.md`
- `site/app/ResearchApp.tsx`
- `site/app/globals.css`
- `site/app/api/research/route.ts`
- `site/app/api/sector-outlook/route.ts`
- `site/app/lib/sec-client.ts`
- `site/app/lib/sector-types.ts`
- `site/app/lib/sector-packs.ts`
- `site/app/lib/financial-metrics.ts`
- `site/app/lib/research-types.ts`
- `site/app/lib/research-classification/*`
- `site/tests/rendered-html.test.mjs`

### Next recommended step

Review the local commit and release only through a separately authorized push/deployment task.

### Assumptions and pending decisions

- SEC SIC is intentionally authoritative even when it is broad or dated.
- No embedding, vector, ML, LLM, or business-description classification is included.
- Unmapped/missing SIC uses General Corporate; specialized KPI coverage expands only after evidence-backed validation.
- No push or deployment is authorized in this task.

## Current objective — non-default ticker reliability

### Completed

- Read `WORKLOG.md`, `RECOVERY.md`, `TODO.md`, README, `/api/research`, SEC helpers/resolver, snapshot fallback, sector/SIC matching, Metric Registry, peers, scenarios, valuation, audit, frontend request flow, and `saveToken`.
- Diagnosed the actual non-default failure with MCHP and PNC: SEC ticker resolution, Submissions, and Company Facts all returned HTTP 200; annual facts sharing a calendar year generated duplicate `FY<year>` canonical keys during metric normalization, then the outer route mislabeled the internal error as SEC unavailability.
- Added the centralized server-side SEC client, dynamic exchange-aware ticker map resolver, CIK padding, share-class normalization, explicit ambiguity, cache/retry/rate/timeout handling, health route, structured errors, structured diagnostics, persisted selections, and compact frontend details/retry actions.
- Preserved the default five issuer snapshot gates, report methodology, canonical definitions, formulas, valuation, sector logic, bilingual output, and PDF presentation. The annual selection change only chooses one valid fact per year before the existing canonical key is formed.
- Passed ESLint, `next build --webpack`, `git diff --check`, and all 26 automated tests. Created the latest local checkpoint (`fix: classify non-default ticker failures`). No deployment was requested or performed.

### Remaining

- Do not deploy or push unless explicitly requested.
- If released later, smoke-test MCHP, PNC, and an unsupported but valid issuer in production, verifying classified results rather than a generic SEC outage.

## Current objective — FinBro public shell rebrand

### Completed

- Read the recovery notes, worklog, TODO list, sector-pack and report/PDF architecture, canonical Metric Registry/Locator, `saveToken` skill, and archived-design location.
- Created the archived Aeye design reference at `docs/design/aeye_design_reference.md` and applied its required token system, including the exact primary blue `#0055FF`.
- Rebranded public-facing website metadata, navigation, request shell, loading states, footer, social image, favicon, and PDF footer as FinBro; Ethan is the AI junior analyst in the application shell only.
- Kept generated equity-research reports formal and removed ScopeLine from visible product labels. Financial calculations, sector logic, sources, and valuation methods were not refactored.
- Restored one existing JPM scenario canonical-reference omission so the consistency gate can publish the previously calculated model-implied equity values without changing those values or formulas.
- Passed production build, ESLint, 24/24 automated tests, and `git diff --check`.
- Committed the exact source as nested Sites commit `d20812d54baf0ab454042399da0b4de25bd5c8fb`, saved private Sites version 11 (`appgprj_6a585b81f7708191b13b1c34903345a9~appgver_1cbebbaad32c8191ae0c9f09dc1873e8`), and deployed it successfully as `appgdep_6a5b0ede3df08191afb09ea2f388c0dd` at `https://scopeline-research.evvan.chatgpt.site`.
- Verified the live authenticated response (HTTP 200; FinBro and Ethan server-rendered) and reviewed the deployment screenshot for the first viewport. Custom owner-only access was preserved; the Sites display title is now `FinBro | Your overworked entry-level analyst.`
- Made the minimum Vercel compatibility changes: replaced the local-only `site/` Gitlink with tracked source code, added Vercel’s Next.js/Webpack build configuration, and isolated the retained Cloudflare-only type import from Vercel’s build check.
- Passed the Vercel-compatible production build and ESLint; pushed commit `437ba0e61e1467f21df1572ed5fe0fe7e9bc84d1` to `Evvan0903/Finance-bro` and deployed it successfully to <https://finbro-seven.vercel.app>.

### Remaining

- No implementation or deployment task remains for the FinBro rebrand.
- The legacy production URL slug remains `scopeline-research`; change it only if the user explicitly requests a new public URL or custom domain.
- Configure `SEC_USER_AGENT` in Vercel if reliable live SEC retrieval is required; no environment variable is needed for startup.

### Current status

The FinBro implementation is complete and deployed. Existing LLY-related work was preserved in the released nested Sites commit; no new sector expansion was initiated for this task.

### Next recommended step

Monitor the existing private FinBro site. Do not alter financial, research, or sector implementation unless a separately requested task requires it.

## Original objective

Refactor `skills/institutional_equity_research/SKILL.md` into a concise execution guide, then explicitly use the revised skill to create and visually verify a current institutional-style Shell plc research sample in Markdown and PDF.

The subsequent objective was to turn that research approach into a one-input MVP and publish it to ChatGPT Sites with owner-only access.

The latest completed objective was to upgrade that existing private Site to a complete Chinese/English experience without changing its URL or access policy.

The current implementation objective is complete: improve the existing ScopeLine presentation and sector-evidence flow without rebuilding it, using NVDA to validate dated current-industry outlook, company-specific exposure, consistent units, bilingual Web/PDF parity, and private Sites deployment. One owner-signed-in visual PDF export check remains.

## Completed tasks

- Added a reusable presentation-format layer across dashboard, KPI cards, metric locator output, historical tables, charts, and Markdown/PDF report content. Money now uses `US$` with full named units; tables declare `Unit: US$ billion` (or an explicit mixed-unit label), use one decimal for financial values, and use two decimals for per-unit and multiple figures.
- Anchored semiconductor retrieval to the explicit research date of July 17, 2026 so deployment time cannot conceal accepted evidence. The visible NVDA research window is January 1, 2025 through June 29, 2026, the most recent accepted source publication date.
- Added official SEMI June 29, 2026 HBM/memory-equipment evidence and corrected the official BIS export-control source. Source selection deterministically prefers regulatory sources, industry statistics, then industry outlook sources after relevance/date filtering.
- Replaced generic company-exposure mappings with four NVIDIA-specific evidence rows: FY2026 Data Center revenue/growth, supply-chain reliance, Blackwell/networking transition, and Q1 FY2026 H20 export-control impact. Unsupported company-level HBM volumes/pricing and generic sector assertions are omitted and recorded in Data Coverage.
- Validated production English and Chinese NVDA responses after deployment: reported values agree, citations are dated and clickable, the research window is current, and all four exposure rows have NVIDIA filing/IR evidence.
- Passed the production build, ESLint, and all 24 automated tests. Direct production API verification also passed for both locales.
- Committed the independent Sites source changes as `947cd24`, `8a7fd81`, and final cache-safe release `3898e54`; deployed the final commit as private Sites version 9 at `https://scopeline-research.evvan.chatgpt.site`.
- Updated `WORKLOG.md` and `TODO.md` with the result, remaining owner-signed-in visual-export check, sources, unit rules, and validation outcome.

- Recovered and verified the prior completed skill-upgrade checkpoint (`b9b928d`).
- Read the complete `skill-creator` and PDF skill instructions.
- Counted the original `SKILL.md` at 3,157 words.
- Rewrote `SKILL.md` in place to 1,864 words, a 41.0% reduction.
- Consolidated repeated policy, provenance, asset, publication-control, and QA material while retaining the requested analytical workflow and controls.
- Included the requested single copyright red line and single missing-data rule exactly once each.
- Validated the revised skill with the skill-creator quick validator and the repository resource validator.
- Read the revised skill completely and began applying it to Shell plc with a research cutoff of July 15, 2026.
- Collected issuer-appropriate evidence from Shell's FY2025 Form 20-F, FY2025 annual report, Q1 2026 IAS 34 results, July 2026 Q2 update, investor materials, and official transaction releases.
- Confirmed that Shell is a foreign private issuer using Form 20-F and Form 6-K rather than domestic Form 10-K and Form 10-Q.
- Reconciled FY2021-FY2025 historical statements, recast FY2023-FY2025 segment data, Q1 2026 actuals, and July 2026 management guidance.
- Created the complete compact report at `samples/shell_equity_research_sample.md` with all 13 requested sections and a revised-skill conformance appendix.
- Created two original, source-noted chart assets under `samples/assets/`.
- Generated `samples/shell_equity_research_sample.pdf` as a nine-page landscape report using the project's PDF-capable environment.
- Rendered and visually inspected every final PDF page after correcting the initial list formatting and segment-chart pagination.
- Verified all required sections, key formulas, citations, PDF links, source labels, and actual-versus-guidance treatment with deterministic checks.
- Re-ran skill validation, resource validation, whitespace checks, and the project test suite; all 33 tests passed.
- Created an independent Sites source repository under `site/` for the ScopeLine institutional research MVP.
- Implemented a Chinese-first one-input workflow that accepts a company name or ticker and generates a source-linked research report from SEC ticker mapping, Submissions, and Company Facts.
- Added issuer-appropriate support for 10-K/10-Q and foreign-private-issuer 20-F/6-K forms.
- Added three-to-five-year financial normalization, cash-flow and balance-sheet analysis, earnings-quality observations, investment thesis, catalysts, risks, thesis breakers, and transparent Bear/Base/Bull sensitivities.
- Added explicit evidence labels for reported facts, calculations, assumptions, management statements, and interpretations; unavailable data are not fabricated.
- Added Markdown download and browser print-to-PDF controls, original brand assets, responsive report styling, and private-site metadata.
- Passed lint, production build, and three deterministic rendered/API tests.
- Verified the local and deployed production APIs with Shell plc: five annual periods through FY2025, latest 20-F and 6-K links, a USD 26.052 billion cash-flow proxy, and all three scenarios.
- Committed the exact Sites source as `84ceada` in the independent `site/` repository and pushed it only to the ChatGPT Sites source repository required for deployment.
- Published version 1 privately at `https://scopeline-research.evvan.chatgpt.site`; access is owner-only with no allowed groups or additional users.
- Added an accessible `中文 / EN` switch to the existing ScopeLine header while preserving the institutional report design.
- Localized every client-visible state, including the request form, loading and error messages, report headings, evidence labels, tables, scenarios, source ledger, limitations, actions, footer, and Markdown export.
- Persisted the selected language in browser storage and synchronized the document language to `zh-CN` or `en`.
- Extended the research API to accept `locale: "zh" | "en"`, default to Chinese, return `report.locale`, and localize all generated dashboard, narrative, thesis, risk, catalyst, valuation, formula, source, limitation, and error text.
- Added bilingual metadata and regression coverage for Chinese SSR, both language controls, localized validation errors, the client/API locale contract, persistence, document language, and starter cleanup.
- Passed lint, the production build, and all five bilingual regression tests.
- Verified Shell locally and in production in both languages; both versions returned five annual periods, 20-F and 6-K filing links, and the full scenario set. The English JSON had no Chinese-character residue.
- Committed the bilingual Sites source as `a5e4f29`, published version 2 to the existing private URL, and reverified the production homepage plus Chinese and English report APIs with HTTP 200 responses.
- Confirmed the access policy remains owner-only with no groups or additional users.
- Added separate modular analyst packs for Energy / Integrated Oil & Gas and Technology / Semiconductors, including distinct KPIs, research questions, drivers, peers, valuation methods, risks, catalysts, and report guidance.
- Separated reusable sector methodology from dated current evidence and added 2025+ publication-date screening, metadata, original summaries, filter-first retrieval, deterministic local embeddings, and reusable caches.
- Integrated the market-sector-subindustry-options contract into the existing bilingual SEC pipeline without rebuilding the Site.
- Replaced the old cash-flow proxy with strict `FCF = operating cash flow - cash capital expenditure`; missing cash capex now produces the required unavailable message.
- Added a 12-section sector-aware report, company exposure table, sector KPIs, peer comparisons, investment debates, filing watchlist, categorized catalysts, thesis breakers, sector-specific scenarios, and transparent valuation formulas.
- Added outlook-only refresh that updates sector evidence without refetching company filing data.
- Simplified the hero and request interface, retained the ScopeLine brand, added disabled coming-soon sectors, and moved detailed explanations to the report methodology, sources, and limitations.
- Replaced browser print export with an application-owned PDF generator that paginates report blocks, keeps scenarios together, prevents table clipping, renders populated charts, and adds a controlled per-page footer.
- Found and fixed a Chromium canvas-taint issue during real PDF export by using a self-contained inline SVG data URL rather than an opaque Blob URL.
- Passed lint, a production build, and all nine sector-aware regression tests.
- Generated SHEL and NVDA locally from current SEC data and confirmed visibly different KPIs, drivers, peers, questions, risks, and valuation frameworks.
- Verified SHEL uses the transparent EV / operating cash flow fallback only when strict FCF is unavailable; operating cash flow is never labeled as FCF.
- Verified NVDA calculates strict FCF at USD 96.7 billion, gross margin at 71.1%, and uses 6x / 9x / 12x EV / Revenue scenarios.
- Verified outlook-only refresh changed the sector timestamp while leaving the company-data retrieval timestamp unchanged.
- Downloaded a real eight-page NVDA PDF, rendered every page, and confirmed populated charts, unclipped tables, readable sources, intact scenario cards, and the exact application footer without browser URLs.
- Committed the completed version 3 implementation locally as `8d22cab` (`checkpoint: sector-aware research experience`); it has not yet been pushed or deployed.
- Published the validated sector-aware source to the existing private ScopeLine Site.
- Diagnosed a production-only SEC HTTP 429 at the remote ticker-directory lookup, configured a compliant SEC User-Agent in Sites, and added a public-CIK local resolver for the two supported sector universes so supported reports do not spend a remote directory request.
- Kept all filing, Company Facts, financial, and peer data on the original official SEC pipeline; the local resolver only maps supported tickers and company names to public SEC CIK identifiers.
- Passed lint, production build, and all nine regression tests again after the SEC request-resilience change.
- Committed the final source as `6d6b671` (`fix: reduce SEC directory requests`), pushed that exact state, saved Sites version 4, and deployed it successfully.
- Verified the private production homepage, SHEL energy report, NVDA semiconductor report, and independent sector-outlook refresh endpoint with HTTP 200 responses.
- Verified production SHEL has five annual periods, ten energy KPIs, XOM/CVX/BP/TTE peers, strict unavailable FCF treatment, and EV / OCF valuation fallback.
- Verified production NVDA has five annual periods, nine semiconductor KPIs, AMD/AVGO/INTC/TSM peers, 71.1% latest gross margin, USD 96.7 billion strict FCF, and EV / Revenue valuation.
- Updated the Site display title to `ScopeLine 行业感知研究 · Sector-Aware Research`.
- Reconfirmed access remains owner-only with one owner, no additional users, and no allowed groups.
- Added reusable metric definitions with aliases, accepted units, period rules, preferred sources, derivations, required inputs, validation rules, and exact internal statuses.
- Added deterministic extraction for standard SEC Company Facts, filing-level custom inline XBRL, filing HTML tables, and filing text, plus ordered source-ledger handling for exhibits and existing presentations.
- Added company, period, duration, unit/currency, filing date, section/row, definition, dimensional-context, and numeric-range validation.
- Added selected-value provenance, formulas, confidence, and rejected-candidate reasons; Company Facts absence no longer implies issuer non-disclosure.
- Added the Shell-only `/api/metric-locator` validation endpoint with official SEC inputs and an explicitly labeled verified-snapshot fallback.
- Tested the locator against the full official Shell 2025 Form 20-F and Company Facts: all 11 requested metrics were extracted (100%); strict FCF is USD 21.948 billion and Shell's differently defined USD 26.052 billion FCF is retained as a rejected definition-mismatch candidate.
- Integrated the Shell locator audit into the existing research API and updated FY2025 cash capex, strict FCF, net debt, ratios, scenarios, dashboard, and energy KPI cards.
- Hid unusable KPI and balance cards, allowed CSS grids to reflow, and replaced repeated table gaps with a short em dash.
- Added a one-time `Limited data coverage` chip for critical FCF/valuation gaps and an expandable bilingual `Data Coverage` panel with sources, locations, methods, confidence, formulas, unresolved reasons, and rejected candidates.
- Added `WORKLOG.md`; passed ESLint, production build, 12/12 automated tests, a full-official-document Shell locator test, and an integrated Shell research-response test.
- Committed the exact Sites source as `34fb7c4`, pushed it to the existing Sites source repository, saved version 5, and completed an owner-only production deployment.
- Verified the production homepage, Shell metric-locator endpoint, and Shell research endpoint with authenticated HTTP 200 responses. Production returned 11/11 located metrics, strict FCF of USD 21.948 billion, no unresolved metrics, and no critical coverage warning.
- Reconfirmed owner-only access with no allowed groups or additional users.
- Completed Canonical Metric Phase 1: added the schema, registry, unique cache key, explicit-definition lookup, deterministic canonical formulas, source lineage, full-precision storage, and locator-to-registry publication.
- Published 12 Shell FY2025 canonical objects, including operating cash flow as the hidden input to strict FCF; duplicate keys, ambiguous definitions, invalid schema values, and mixed-period formula inputs are rejected.
- Passed the Phase 1 production build and all 13 automated tests.
- Completed Canonical Metric Phase 2: standardized annual SEC facts and all derived ratios into the Registry, replaced report-local FCF/margin/growth/scenario arithmetic with Registry calculations, and added definition-priority adapters.
- Routed dashboard, historicals, sector KPIs, driver exposure, earnings quality, thesis, debates, risks, catalysts, peers, scenarios, and valuation through canonical keys.
- Added canonical scenario assumptions and deterministic projected revenue, net income, operating cash flow, cash capex, FCF, valuation-metric, and enterprise-value objects with full input lineage.
- Added a report-level `metricUsage` ledger and merged peer canonical objects into the same versioned Registry snapshot.
- Passed targeted ESLint, the production build, and all 14 automated tests for Phase 2. A direct research smoke test could not cross the restricted local sandbox to SEC and returned the existing HTTP 502 public-data-unavailable response.
- Completed Canonical Metric Phase 3: added exact Registry/formula/source/cache/surface auditing and a machine-readable same-snapshot reproducibility comparator.
- Added explicit checks for duplicate keys, conflicting values, definition/formula changes, missing dependencies, rounded calculation inputs, annual/quarterly mixing, stale versions, source changes, raw surface mismatches, scenario/valuation replay, and Web/PDF key parity.
- Versioned the shared Web/PDF rendering model; PDF export now rejects a report DOM that is not the audited shared model.
- Integrated `consistencyAudit` into research API responses and passed targeted ESLint, the production build, and all 15 automated tests.
- Completed Canonical Metric Phase 4 using a compact saved Shell snapshot derived from official SEC Company Facts and Submissions plus the existing verified FY2025 filing excerpt.
- Passed all 14 required Shell metrics, exact FCF reconciliation, one explicit issuer net-debt definition, capital-allocation/debate/exposure consistency, 142/142-object double-run reproducibility, and zero auditor issues across 642 report-surface references.
- Found and fixed a definition-label inconsistency: Shell's issuer-reported net debt includes debt-hedging derivative and collateral adjustments and is no longer described or classified as a simple derived debt-less-cash value.
- Generated an eight-page application PDF, rendered and visually inspected every page, and confirmed Web/PDF agreement through the shared audited DOM model.
- Added `site/artifacts/metric_consistency_report.json` and saved the verified PDF at `site/output/pdf/shell-phase4-consistency.pdf`.
- Passed targeted ESLint, the production build, and all 16 automated tests.
- Completed Canonical Metric Phase 5: scenario cards now hide unusable FCF, valuation-input, and implied-EV rows while preserving critical missing-input details in the one-time `Limited data coverage` indicator and expandable `Data Coverage` audit.
- Added a server-side publication block: a failed canonical consistency audit returns HTTP 500 with the machine-readable audit and does not publish the report.
- Re-ran targeted ESLint, the production build, and all 16 automated tests successfully.
- Completed Canonical Metric Phase 6: added a reusable recent-sector-research ingestion pipeline with publication-window, retrieval-sequence, source-metadata, accessibility, deduplication, and concise-content validation.
- Stored source type, generalized analytical methods, and current evidence separately; runtime retrieval uses concise bilingual chunks and never loads full reports.
- Accepted 3 integrated-oil-and-gas and 4 semiconductor sources/methods from 2025-01-01 through 2026-07-17 with no rejected sources; every current claim retains publisher and original publication date.
- Reviewed the official source URLs and passed targeted ESLint, the production build, and all 16 automated tests.
- Completed Phase 7.1 Semiconductors / NVDA acceptance using a compact official SEC snapshot through 2026-07-17.
- Added canonical reported operating income and derived operating margin, completed the semiconductor ontology with operating margin and utilization, and made the source-fixture generator issuer-agnostic.
- NVDA produced five annual periods through FY2026, 174 canonical metrics, 662 audited surface references, and zero consistency issues. Two runs matched all 174 objects with no missing or changed outputs.
- Confirmed exact FY2026 strict FCF of USD 96.676bn = USD 102.718bn operating cash flow − USD 6.042bn cash capex; gross margin was 71.07% and operating margin 60.38%.
- Passed targeted ESLint, production build, and 17/17 automated tests; Semiconductors is validated, while Banks remains preview.
- Completed Phase 7.2 Financials / Banks acceptance using JPM's official SEC Company Facts/Submissions snapshot and exact FY2025 Form 10-K filing-table evidence.
- Added the bank ontology, recent official FDIC/OCC/Federal Reserve evidence, bank-specific drivers and peers, and P/TBV scenarios; industrial-company capex and FCF templates are explicitly excluded.
- Populated all 12 bank KPIs, including definition-preserving issuer-reported firmwide net yield (2.50%), standardized CET1 (14.6%), average LCR (111%), and reported ROE (17%).
- JPM produced five annual periods, 167 canonical metrics, 642 audited surface references, and zero consistency issues. Two runs reproduced every canonical object and output.
- Verified FY2025 tangible book value of USD 308.407bn, capital returns of USD 48.216bn, and Bear/Base/Bull model-implied equity values of USD 351.584bn / USD 540.021bn / USD 732.775bn.
- Passed targeted ESLint, production build, and 18/18 automated tests; Banks is validated, while Biopharma remains preview.
- Completed Phase 7.3 Healthcare / Biopharma acceptance using LLY's official SEC Company Facts/Submissions snapshot and exact FY2025 Form 10-K product, concentration, and patent evidence.
- Added the biopharma ontology, four recent IQVIA/FDA/CMS evidence sources, research methods, drivers, peers, bilingual report paths, and commercial-revenue EV/revenue scenarios.
- Populated five verified KPI cards: Mounjaro revenue USD 22.965bn, Mounjaro/Zepbound revenue concentration 56%, R&D expense USD 13.337bn, derived gross margin 83.04%, and issuer-estimated U.S. compound-patent expiry in 2036.
- Kept pipeline stage, clinical milestones, regulatory dates, cash runway, and risk-adjusted pipeline value as explicit ontology concepts without fabricating numeric values. No rNPV is calculated from candidate counts or incomplete inputs.
- LLY produced five annual periods, 166 canonical metrics, 594 audited surface references, and zero consistency issues. Two runs reproduced every canonical object and output.
- Fixed a live-report gap found in browser QA by reusing the verified FY2025 10-K evidence only when LLY's current annual filing identity matches; Chinese and English live reports now agree with the acceptance snapshot without a false coverage warning.
- Passed targeted ESLint, production build, 19/19 automated tests, and bilingual live browser acceptance; Biopharma is validated, while Industrials remains coming soon.
- Completed Phase 7.4 Industrials / Industrial Machinery with CAT using a compact official SEC snapshot plus exact FY2025 10-K backlog, price/cost, and segment-margin evidence.
- Added four recent official Census, Federal Reserve, BLS, and Caterpillar sources, industrial research methods, KPI ontology, drivers, peers, through-cycle EV/FCF scenarios, and bilingual UI/report paths.
- Verified CAT FY2025 revenue of USD 67.589bn, operating income of USD 11.151bn, strict FCF of USD 8.918bn, working capital of USD 15.927bn, firm backlog of USD 51.2bn, combined price-cost impact of USD -2.965bn, Power & Energy segment margin of 19.9%, FCF conversion of 100.41%, and near-term backlog share of 37.70%.
- Kept comparable new orders, uniform organic growth, and CAT company-level utilization unavailable rather than substituting revenue growth or industry utilization; near-term backlog is labeled as a delivery obligation, not a completion rate.
- CAT produced 227 canonical metrics and 858 audited surface references after the consolidated-gross-profit plausibility gate, with zero consistency issues. Two runs reproduced every object and output.
- Passed targeted ESLint, production build, 20/20 automated tests, and bilingual saved-source browser acceptance. A separate live-SEC request reproduced the existing temporary SEC public-data outage, so runtime-source resilience remains for Phase 8.
- Completed Phase 8 automated coverage for unit and currency conflicts, full-precision formulas, cache deletion/expiry/failure/clear behavior, five official-source snapshots, working-capital surface reconciliation, and unsupported-sector prevention.
- Prevented CAT's immaterial standardized `CostOfGoodsAndServicesSold` fact from generating a false consolidated gross profit or 99.9% gross margin; CAT operating margin remains the supported profitability measure.
- Added a disclosed, dated runtime fallback for only the five accepted companies after temporary SEC/network failures. A direct no-fixture CAT outage simulation returned HTTP 200, passed consistency, disclosed the July 17, 2026 snapshot, and retained strict FCF of USD 8.918bn.
- Passed targeted ESLint, production build, and 23/23 automated tests for Phase 8.
- Completed the local Phase 9 artifact and final audit: 921 canonical metrics and 3,562 report-surface references across SHEL, NVDA, JPM, LLY, and CAT; zero duplicate keys, conflicting values, formula mismatches, cross-section mismatches, or reproducibility mismatches.
- Passed the final production build, ESLint, and 24/24 automated tests.
- Created the exact local Sites source checkpoint `71f5fd4` (`checkpoint: final consistency artifact phase 9`).
- Pushed the exact validated source commit `71f5fd47380c04606e0a80045d53fe3a401837b4` to the existing Sites `main` branch, saved Sites version 6 (`appgprj_6a585b81f7708191b13b1c34903345a9~appgver_2308142c1fa88191b7bc7fb93c6d00f3`), and deployed it successfully through the verified owner-only path.
- Sites now reports version 6 as latest and live at `https://scopeline-research.evvan.chatgpt.site`; the authenticated production URL returned HTTP 200. No implementation files were changed during deployment.

## Remaining tasks

- Perform one owner-signed-in visual export of a live NVDA report to PDF and inspect it for clipping, chart/table legibility, English/Chinese unit labels, and citations. No implementation change is authorized unless that visual check reveals a concrete defect.

## Current status

The prior canonical-metric Phase 9 work remains complete. The subsequent current-industry/NVDA upgrade is deployed from independent Sites commit `3898e54`; 24/24 tests pass. Private production version 9 is live at the existing owner-only URL and authenticated English/Chinese API checks passed. Only human visual PDF QA remains.

## Files modified

- `skills/institutional_equity_research/SKILL.md`
- `samples/shell_equity_research_sample.md`
- `samples/shell_equity_research_sample.pdf`
- `samples/assets/shell_cash_generation.png`
- `samples/assets/shell_segment_earnings.png`
- `RECOVERY.md`
- `TODO.md`
- `site/` (independent Sites repository; implementation, tests, assets, hosting metadata, and local checkpoint commit)
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
- `WORKLOG.md`
- `site/app/lib/canonical-metrics.ts`
- `site/app/lib/financial-metrics.ts`
- `site/app/lib/canonical-scenarios.ts`
- `site/app/lib/metric-consistency-auditor.ts`
- `site/app/lib/report-rendering-model.ts`
- `site/app/lib/sector-learning-pipeline.ts`
- `site/app/lib/sector-evidence.ts`
- `site/app/lib/sector-retrieval.ts`
- `site/app/lib/sector-types.ts`
- `site/app/lib/presentation-format.ts`
- `site/tests/fixtures/shel-source-snapshot.json`
- `site/tests/fixtures/nvda-source-snapshot.json`
- `site/tests/fixtures/jpm-source-snapshot.json`
- `site/tests/fixtures/lly-source-snapshot.json`
- `site/tests/fixtures/cat-source-snapshot.json`
- `site/scripts/create-company-fixture.mjs`
- `site/artifacts/metric_consistency_report.json`
- `site/output/pdf/shell-phase4-consistency.pdf`

## Next recommended step

Sign in as the Site owner, generate an NVDA report in each language, export one PDF, and inspect it. Keep version 9 and the current architecture unchanged unless that targeted visual check reveals a reproducible defect.

## Assumptions and pending decisions

- Current semiconductor evidence is filtered from January 1, 2025 through the explicit research date of July 17, 2026. The latest accepted publication is June 29, 2026, so that date is shown as the visible end of the research window.
- FY2025 and Q1 2026 issuer figures are primarily USD and may not sum because of rounding.
- Scenario values are explicitly labeled analyst assumptions and use transparent enterprise cash-flow proxy formulas rather than unsupported target-price precision.
- Market-value calculations require a dated LSE price and a disclosed GBP/USD conversion; they will be treated as permitted third-party market inputs, not issuer-reported facts.
- The PDF uses original styling and charts without Shell logos or proprietary report design elements.
- The report's conformance appendix records four guidance gaps: assumption-confirmation semantics, energy-sector modeling minimums, issuer-APM bridge format, and synchronization of market value, ADS/share count, pending issuance, and net debt dates.
- The website intentionally does not use live market prices and therefore does not publish ratings or target prices.
- The website requires standardized SEC XBRL; non-SEC issuers and issuers with insufficient Company Facts may return an unavailable-data message.
- ScopeLine is currently private and visible only to the owner. Making it public requires a separate explicit access change.
- `site/` is its own Git repository used by ChatGPT Sites; the parent repository must not recreate or flatten it.
- Chinese remains the server-rendered default; the browser remembers a user's selected language under `scopeline-locale` and restores it after hydration.
- Switching language after report generation refetches the same issuer in the selected language so the narrative and exported Markdown do not mix languages.
- Version 3 keeps sector evidence as curated metadata and original summaries rather than storing or reproducing full third-party reports.
- Sector retrieval uses local deterministic text embeddings after sector, subindustry, geography, and date filters; it does not require an external embedding API.
- The application-owned PDF path controls pagination and footer metadata; print styles remain a fallback.
- When strict FCF is unavailable for an energy issuer, the scenario framework may use explicitly labeled operating cash flow as an EV / OCF valuation input, but never relabels it as FCF.
- Runtime retrieval timestamps use UTC, while the research date uses the current US/Pacific calendar date.
- Production Sites uses a compliant `SEC_USER_AGENT` runtime variable stored as a secret; it is not committed to source.
- Direct SEC ticker-directory calls can still be rate-limited from shared cloud egress. Supported energy, semiconductor, and peer tickers use the bundled public CIK resolver before falling back to the live directory.
- Shell validation uses FY2025 consistently across all 11 metrics. The realized-price result is explicitly scoped to Europe / Shell subsidiaries / crude oil and NGL, not presented as a group-wide blended realization.
- The latest Shell 2025 Form 20-F was filed March 12, 2026. The validation endpoint falls back to a compact verified excerpt only when official requests fail and discloses that source mode.
- CAT acceptance uses FY2025 issuer metrics only when the latest 10-K identity matches the December 31, 2025 period and February 13, 2026 filing date.
- Comparable CAT FY2025 new orders, uniform organic growth, and company-level utilization are not available as verified numeric metrics; industry utilization remains contextual evidence only.
- Verified runtime fallback is restricted to SHEL, NVDA, JPM, LLY, and CAT, occurs only after a temporary SEC/network error, and is disclosed with its retrieval date; arbitrary issuers do not receive a generic snapshot.
- The current local Sites HEAD is `3898e54`, the deployed source of truth. Do not amend prior checkpoints; create a separate fix commit only for a newly discovered, reproducible defect.
- Sites access was rechecked before deployment: `custom` access, one owner (`evansunemail@gmail.com`), no allowed groups, and no additional users.

## Recovery procedure

1. Read `RECOVERY.md` and `TODO.md` completely.
2. Inspect the latest local commit and working tree.
3. Treat the repository as the source of truth.
4. Resume only the first unchecked task.
5. Preserve existing code and do not push checkpoint commits.
