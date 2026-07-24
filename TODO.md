# Institutional Equity Research Refactor and Shell Sample TODO

## Non-default ticker reliability

- [x] Trace arbitrary-ticker requests through resolution, SEC retrieval, sector matching, metric normalization, and report initialization.
- [x] Confirm the MCHP/PNC canonical-period collision and prevent it without changing formulas or existing validated values.
- [x] Centralize SEC transport, dynamic ticker/CIK resolution, cache, rate limiting, retry, timeout, and structured errors.
- [x] Preserve research selections and show compact retryable Ethan error details.
- [x] Add resolver/error regression coverage and pass lint, production build, and 26/26 tests.
- [ ] Deploy only when the owner requests a release; then smoke-test MCHP, PNC, and one unsupported sector on production.

## FinBro Vercel deployment

- [x] Identify the local-only nested Gitlink as the Vercel source-retrieval blocker.
- [x] Replace the Gitlink with the existing application source in the GitHub repository.
- [x] Add the minimal Vercel Next.js/Webpack build configuration.
- [x] Keep Cloudflare-only adapter code out of Vercel type checking without changing app behavior.
- [x] Pass the Vercel-compatible production build and ESLint.
- [x] Commit and push the source to the existing GitHub repository.
- [x] Deploy to Vercel production and verify the FinBro homepage response.

## FinBro public shell rebrand

- [x] Read recovery/project architecture, sector packs, canonical metrics/locator, PDF path, `saveToken`, and the Aeye-design-reference location.
- [x] Route the work under `saveToken` and preserve the formal report/public-shell tone boundary.
- [x] Create the Aeye design reference and apply the exact required global color tokens.
- [x] Rebrand visible product metadata, navigation, request flow, labels, footer, social card, favicon, and PDF footer as FinBro.
- [x] Present Ethan only as an AI junior analyst / research workflow assistant.
- [x] Preserve financial calculations, sources, canonical metrics, valuation, and sector logic.
- [x] Repair the pre-existing JPM scenario canonical-reference omission without changing its value or formula.
- [x] Pass production build, ESLint, 24/24 automated tests, and whitespace validation.
- [x] Create a local nested-Sites checkpoint commit for the exact validated source.
- [x] Push, save, deploy, and verify the updated private Sites version.
- [x] Record the release identifiers and production verification in recovery notes and `WORKLOG.md`.

## Completed

- [x] Recover and verify the previous completed checkpoint.
- [x] Read the applicable skill-creator and PDF instructions.
- [x] Count the original skill.
- [x] Refactor `skills/institutional_equity_research/SKILL.md` in place.
- [x] Preserve the requested methodology, data-discipline, citation, and QA controls.
- [x] Reduce the skill from 3,157 to 1,864 words (41.0%).
- [x] Validate the revised skill and its resource references.
- [x] Read and explicitly apply the revised skill to the Shell sample.
- [x] Establish the July 15, 2026 cutoff and issuer-appropriate source hierarchy.
- [x] Collect FY2021-FY2025, Q1 2026, segment, liquidity, capital-allocation, and current-guidance evidence.

## Unfinished

- [x] Reconcile and verify all derived Shell calculations.
- [x] Create original chart assets.
- [x] Write `samples/shell_equity_research_sample.md`.
- [x] Generate `samples/shell_equity_research_sample.pdf`.
- [x] Render and visually inspect every PDF page.
- [x] Audit the sample against the revised skill and note guidance gaps.
- [x] Run final validations and update recovery notes.
- [x] Create a local checkpoint commit; do not push.

## ScopeLine private ChatGPT Site

- [x] Create the independent Sites project under `site/`.
- [x] Implement one-input company/ticker research generation.
- [x] Normalize SEC annual facts and support 10-K/10-Q/20-F/6-K filing routes.
- [x] Build the Chinese institutional research interface and evidence labels.
- [x] Add original social-preview and favicon assets.
- [x] Add report download and print-to-PDF controls.
- [x] Pass lint, production build, and rendered/API tests.
- [x] Verify Shell locally against current SEC data.
- [x] Commit and push the exact Sites source state.
- [x] Deploy version 1 with owner-only access.
- [x] Verify the private production homepage and Shell API response.

## ScopeLine bilingual version 2

- [x] Add an accessible `中文 / EN` switch without changing the established design.
- [x] Translate all static UI, loading, error, report, action, and export labels.
- [x] Persist the selected language and update the document language.
- [x] Add `zh` / `en` locale handling to the research API.
- [x] Localize all generated report narratives, sources, limitations, and errors.
- [x] Add bilingual metadata and regression tests.
- [x] Pass lint, production build, and all five tests.
- [x] Verify Shell in Chinese and English locally.
- [x] Commit and push the exact bilingual Sites source state.
- [x] Deploy version 2 to the existing owner-only Site.
- [x] Verify the production homepage and both localized Shell APIs.

## ScopeLine sector-aware version 3

- [x] Recover and verify the version 2 checkpoint before changing code.
- [x] Audit the current SEC, bilingual UI, and browser PDF implementation.
- [x] Select accessible, dated 2025-2026 official evidence for energy and semiconductors.
- [x] Add modular energy and semiconductor analyst packs.
- [x] Separate the sector methodology store from the current evidence store.
- [x] Add filter-first chunk retrieval, deterministic embeddings, and caches.
- [x] Upgrade the SEC report API to the market-sector-subindustry flow.
- [x] Remove the investing-cash-flow fallback and enforce strict FCF.
- [x] Add the 12-section sector-aware bilingual report and outlook-only refresh.
- [x] Simplify the hero and add the sector-aware request controls.
- [x] Improve PDF export, print layout, tables, charts, sources, and footer.
- [x] Add regression tests for source screening, FCF, SHEL, and NVDA.
- [x] Verify visibly different SHEL and NVDA research outputs.
- [x] Run lint, build, automated tests, browser QA, and PDF rendering QA.
- [x] Update recovery notes and create a local checkpoint commit.
- [x] Publish the sector-aware release to the existing private ScopeLine Site and verify production.

## ScopeLine Metric Locator iteration

- [x] Recover and inspect the latest version 3 checkpoint.
- [x] Define reusable metric metadata, source order, statuses, and audit records.
- [x] Implement deterministic standard XBRL, custom XBRL, HTML-table, text, derivation, and validation logic.
- [x] Add a Shell-only validation endpoint with official-source and verified-snapshot modes.
- [x] Test all 11 Shell metrics against the full official 2025 filing and Company Facts (11/11 found).
- [x] Integrate the passing Shell locator results into the existing research response.
- [x] Hide unusable cards, reflow grids, and replace repeated missing strings with compact display.
- [x] Add the `Limited data coverage` indicator and expandable `Data Coverage` audit.
- [x] Add and pass regression tests for source order, strict FCF, custom XBRL, and missing-data UI.
- [x] Create the final local checkpoint and deploy Sites version 5 with owner-only access.

## ScopeLine Canonical Metric upgrade

- [x] Phase 1: implement Canonical Metric Object, Metric Registry, canonical-key uniqueness, explicit definitions, full-precision formulas, and source lineage.
- [x] Phase 2: connect dashboard, historicals, KPIs, exposures, debates, risks, catalysts, peers, scenarios, and valuation to Registry selectors.
- [x] Phase 3: add consistency and reproducibility auditor plus machine-readable comparison.
- [x] Phase 4: pass Shell consistency, double-run, and Web/PDF acceptance.
- [x] Phase 5: revalidate missing-data presentation and invalid-formula visibility.
- [x] Phase 6: implement the 2025-current sector research learning pipeline.
- [x] Phase 7: sequentially validate Semiconductors/NVDA, Banks/JPM, Biopharma/LLY, and Industrials/CAT.
  - [x] Phase 7.1: Semiconductors / NVDA.
  - [x] Phase 7.2: Banks / JPM.
  - [x] Phase 7.3: Biopharma / LLY.
  - [x] Phase 7.4: Industrials / CAT.
- [x] Phase 8: add five-company snapshots and complete automated regression coverage.
- [x] Phase 9: finalize worklog, consistency artifact, recovery checkpoint, private deployment, and production verification.
  - [x] Generate the final five-company consistency artifact.
  - [x] Run the production build, ESLint, and 24/24 automated tests.
  - [x] Create the exact local Sites source checkpoint at `71f5fd4`.
  - [x] Push `71f5fd4` to the existing Sites source repository.
  - [x] Save and deploy the new owner-only Sites version (version 6).
  - [x] Verify the production URL and confirm Sites latest version 6 points to the requested commit.

## ScopeLine Current Industry Outlook & NVDA presentation upgrade

- [x] Preserve the existing architecture, canonical metrics, bilingual UI, and private Sites configuration.
- [x] Add current dated semiconductor evidence and a visible research window.
- [x] Use compact clickable citations and omit raw source URLs from report copy.
- [x] Centralize money, percentage, per-unit, and table unit presentation.
- [x] Replace generic company-exposure rows with validated NVIDIA filing/IR evidence.
- [x] Validate English and Chinese NVDA reports, build, lint, and all automated tests.
- [x] Deploy the validated private Sites version and record the result in `WORKLOG.md`.
- [ ] Perform owner-signed-in visual export QA of one live NVDA PDF.
