# Recovery Checkpoint

## Original objective

Refactor `skills/institutional_equity_research/SKILL.md` into a concise execution guide, then explicitly use the revised skill to create and visually verify a current institutional-style Shell plc research sample in Markdown and PDF.

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

## Remaining tasks

- Finish deterministic historical, segment, cash-flow, earnings-quality, scenario, and valuation calculations.
- Create original report tables and charts.
- Write `samples/shell_equity_research_sample.md`.
- Create `samples/shell_equity_research_sample.pdf` using the project's PDF-capable environment.
- Render and inspect every PDF page and correct any visual defects.
- Audit the sample against the revised skill and document any unclear, restrictive, or missing guidance.
- Run final repository checks and create the next local checkpoint commit without pushing.

## Current status

Part 1 is complete and validated. Part 2 research is in progress; no Shell sample artifact has yet been finalized at this checkpoint.

## Files modified

- `skills/institutional_equity_research/SKILL.md`
- `RECOVERY.md`
- `TODO.md`

## Next recommended step

Complete and verify the deterministic Shell calculation table, then use it as the single numerical source for the Markdown report, charts, and PDF.

## Assumptions and pending decisions

- Research cutoff is July 15, 2026; Q1 2026 is the latest reported quarter, while the July 7 Q2 update is management guidance rather than reported results.
- FY2025 and Q1 2026 issuer figures are primarily USD and may not sum because of rounding.
- Scenario values will be explicitly labeled analyst assumptions and will use transparent enterprise cash-flow proxy formulas rather than unsupported target-price precision.
- Market-value calculations require a dated LSE price and a disclosed GBP/USD conversion; they will be treated as permitted third-party market inputs, not issuer-reported facts.
- The PDF will use original styling and charts without Shell logos or proprietary report design elements.

## Recovery procedure

1. Read `RECOVERY.md` and `TODO.md` completely.
2. Inspect the latest local commit and working tree.
3. Treat the repository as the source of truth.
4. Resume only the first unchecked task.
5. Preserve existing code and do not push checkpoint commits.
