# Institutional Equity Research Refactor and Shell Sample TODO

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
