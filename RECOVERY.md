# Recovery Checkpoint

## Original objective

Refactor `skills/institutional_equity_research/SKILL.md` into a concise execution guide, then explicitly use the revised skill to create and visually verify a current institutional-style Shell plc research sample in Markdown and PDF.

The subsequent objective was to turn that research approach into a one-input MVP and publish it to ChatGPT Sites with owner-only access.

The latest completed objective was to upgrade that existing private Site to a complete Chinese/English experience without changing its URL or access policy.

The current objective is to incrementally upgrade the same private ScopeLine Site into a sector-aware research platform, initially supporting Energy / Integrated Oil & Gas and Technology / Semiconductors, while preserving the brand, SEC pipeline, citations, bilingual experience, PDF export, URL, and owner-only access.

## Completed tasks

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

## Remaining tasks

- None for the requested version 3 upgrade.

## Current status

Complete. Sites version 4 is live at `https://scopeline-research.evvan.chatgpt.site` from source commit `6d6b671`. Lint, production build, all nine tests, local SHEL/NVDA browser validation, outlook-only refresh, eight-page PDF rendering QA, and authenticated production homepage/SHEL/NVDA/outlook checks all passed. The Site remains owner-only.

## Files modified

- `skills/institutional_equity_research/SKILL.md`
- `samples/shell_equity_research_sample.md`
- `samples/shell_equity_research_sample.pdf`
- `samples/assets/shell_cash_generation.png`
- `samples/assets/shell_segment_earnings.png`
- `RECOVERY.md`
- `TODO.md`
- `site/` (independent Sites repository; implementation, tests, assets, hosting metadata, and local checkpoint commit)

## Next recommended step

Open the private production Site while signed into the owner ChatGPT account and use the SHEL / NVDA examples or enter another company in the currently supported universe.

## Assumptions and pending decisions

- Research cutoff is July 15, 2026; Q1 2026 is the latest reported quarter, while the July 7 Q2 update is management guidance rather than reported results.
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

## Recovery procedure

1. Read `RECOVERY.md` and `TODO.md` completely.
2. Inspect the latest local commit and working tree.
3. Treat the repository as the source of truth.
4. Resume only the first unchecked task.
5. Preserve existing code and do not push checkpoint commits.
