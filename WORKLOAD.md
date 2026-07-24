# Universal Metric Coverage V1 — Workload Summary

## Objective

Verify that Universal Metric Coverage V1 implements its documented deterministic extraction,
applicability, audit, coverage, and adaptive-report controls. Confirm the existing benchmark
artifact and representative canonical financial values, then correct only a proven defect.

## Verification Performed

- Inspected the V2 metric definitions, canonical registry, derived-metric engine, audit, scoring,
  Inline XBRL, custom mapping, HTML table, research route, and bilingual Data Coverage surfaces.
- Confirmed applicable-only coverage denominators; candidate/rejected facts are not covered.
- Confirmed derived metrics require canonical inputs and retain formulas and input provenance.
- Confirmed dimensions cannot publish as consolidated facts; custom mappings are validated-only;
  HTML table extraction is candidate-only.
- Confirmed Full / Standard / Limited thresholds and conditional hiding of unsupported sections.
- Recalculated the artifact's initial 13 non-financial Tier 1 average: 80.45%.
- Reviewed the artifact's 21 benchmark rows, modes, direct/derived counts, and unresolved metrics.
- Live SEC route review returned HTTP 200 for 12 representatives and checked canonical periods,
  units, currencies, direct/derived reconciliation, strict FCF, and bank-specific treatment.
- Regression snapshots exercised NVDA, JPM, SHEL, LLY, and CAT through the established suite.

## Changes Made

- Allowed a later, validated amendment (for example, 10-K/A) to supersede an earlier Company
  Facts value only when period and unit match and the reported value differs.
- Recorded the supersession reason in the extraction audit and technical audit display.
- Invalidated direct and transitive derived dependents after a canonical source replacement so the
  route can recompute them from corrected inputs.
- Added regression coverage for amendment eligibility and derived-dependency invalidation.
- Updated recovery, TODO, and worklog records for this verification handoff.

## Key Files Changed

- `site/app/lib/canonical-metrics.ts` — safe replacement and dependent-derived invalidation.
- `site/app/lib/filing-enrichment/inline-xbrl.ts` — narrow later-amendment supersession rule.
- `site/app/lib/metric-coverage/extraction-audit.ts` — explicit supersession audit reason.
- `site/app/lib/metric-coverage/types.ts` — audit selection-reason field.
- `site/app/ResearchApp.tsx` — displays the selected audit reason in technical details.
- `site/tests/filing-enrichment.test.mjs` — amendment source-precedence regression coverage.
- `site/tests/rendered-html.test.mjs` — derived invalidation regression coverage.
- `WORKLOG.md`, `RECOVERY.md`, `TODO.md` — concise verified-state handoff.

## Benchmark Results

| Ticker | Pack | Tier 1 | Tier 2 | Report Mode | Main Gap |
| --- | --- | ---: | ---: | --- | --- |
| AAPL | technology-hardware-general | 95.83% | 86.36% | Full | shares outstanding |
| MSFT | software-saas-general | 95.83% | 76.19% | Full | shares outstanding |
| AMZN | sector-general | 83.33% | 72.73% | Full | liabilities / shares |
| GOOGL | internet-platform-general | 87.50% | 80.95% | Full | gross-profit inputs |
| ORCL | software-saas-general | 58.33% | 71.43% | Standard | debt, liabilities, shares, gross-profit inputs |
| KO | consumer-products-general | 79.17% | 72.73% | Standard | debt detail / liabilities / shares |
| AXP | diversified-financials-general | 100.00% | 0.00% | Full | Tier 2 not applicable |
| NVDA | semiconductors | 87.50% | 86.36% | Full | cost of revenue / shares |
| JPM | banks | 100.00% | 0.00% | Full | Tier 2 not applicable |

- The verified average is 80.45% across AAPL, DELL, HPQ, MSFT, ORCL, ADBE, GOOGL, META,
  AMZN, KO, PEP, NKE, and WMT.
- Below 65%: ORCL (58.33%) and SHEL (54.17%).
- The artifact's zero known materially incorrect published metrics remains artifact-supported;
  this session's representative live review did not identify a contradiction.

## Test Results

| Command | Result | Details |
| --- | --- | --- |
| `pnpm test` | Pass | Vinext build plus 40/40 tests; no skips or failures. |
| `pnpm run lint` | Pass | ESLint completed without warnings. |
| `pnpm exec tsc --noEmit` | Pass | TypeScript completed without errors. |
| `pnpm run vercel-build` | Pass | Next.js Webpack production build completed. |
| Targeted Node tests | Pass | 32/32; filing, canonical, bilingual, report, and sector gates. |
| `git diff --check` | Pass | No whitespace errors before commit. |
| `npm` / `npx` equivalents | Not available | The bundled runtime exposes `pnpm`, not `npm` or `npx`; equivalent commands above were run. |

## Remaining Limitations

- ORCL lacks conservatively validated consolidated debt, liability, share, and gross-profit inputs.
- SHEL remains limited under FPI / IFRS custom-tag handling despite separately validated sector KPIs.
- Custom concepts remain unpublished until an explicit deterministic validation rule exists.
- Dimensional extraction is intentionally incremental; segment facts cannot stand in for totals.
- HTML table candidates remain diagnostic-only in V1.
- Live results still depend on SEC availability, filing shape, and source freshness.

## Git Status

- Branch: `main`.
- Verification began at `24c6d7ce9fd7d6eaf45ec4d21aae3d6038c8e12f`; the local handoff commit is created after final checks.
- `.DS_Store` was already modified and remains deliberately uncommitted.
- Local history was four commits ahead of `origin/main` at verification start.
- No push or deployment occurred in this session.

## Recommended Next Step

Prioritize V2 issuer-specific, deterministic mappings for low-coverage consolidated debt,
liability, share-count, and gross-profit concepts, beginning with ORCL and preserving the same
period, unit, dimension, reconciliation, provenance, and regression gates.
