# Recovery Checkpoint

## Original objective

Refactor `skills/institutional_equity_research/SKILL.md` into a concise execution guide, then explicitly use the revised skill to create and visually verify a current institutional-style Shell plc research sample in Markdown and PDF.

The subsequent objective was to turn that research approach into a one-input MVP and publish it to ChatGPT Sites with owner-only access.

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

## Remaining tasks

None. The ScopeLine site is deployed privately and the prior skill/report work remains complete.

## Current status

Complete. The skill/report deliverables remain complete, and the one-input ScopeLine MVP is now live as an owner-only ChatGPT Site. Production homepage and Shell report generation both returned HTTP 200 after deployment.

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

Open the private ScopeLine URL and test additional SEC-reporting issuers. Make changes only for a newly identified defect or new request; do not regenerate the completed skill, Shell sample, or site from scratch.

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

## Recovery procedure

1. Read `RECOVERY.md` and `TODO.md` completely.
2. Inspect the latest local commit and working tree.
3. Treat the repository as the source of truth.
4. Resume only the first unchecked task.
5. Preserve existing code and do not push checkpoint commits.
