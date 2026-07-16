# QA Methodology

## Purpose

QA evaluates the canonical research object after calculations and citations are assembled and before the final render is returned. The same QA result is written into report metadata, the HTML/PDF appendix, and the QA JSON artifact.

## Executable checks

`run_report_qa()` currently performs:

- required structured-object key validation;
- balance-sheet reconciliation (`assets = liabilities + equity`) within 2% when comparable facts exist;
- segment reconciliation within 2% when comparable segment totals exist;
- annual/quarterly period separation;
- explicit historical actual (`A`) versus forecast estimate (`E`) separation;
- fact-unit presence and single-currency consistency;
- duplicate normalized metric-period detection;
- required value/unit/accession/URL/tag provenance for SEC XBRL facts;
- reconciliation of net debt, free cash flow, and user-input enterprise value;
- percentage and intensity scaling back to numerator/denominator inputs;
- DCF reconciliation of forecast present values, terminal value, enterprise value, and the equity bridge within 0.1%;
- support checks for calculated valuation fields and `discount rate > terminal growth`;
- chart source-reference presence;
- material-text citation coverage and invalid source-marker detection;
- required source-ledger identity and retrieval fields;
- missing-data and limitation disclosure;
- unsupported `target price` language detection; and
- prohibited branding, endorsement, rating, and quality-equivalence phrase detection; and
- source records explicitly marked restricted or prohibited.

The check messages explicitly state when no comparable balance-sheet rows or currency facts were available. A skipped comparison is therefore visible rather than represented as a positive reconciliation of nonexistent data.

## Scoring

The maximum score is 100:

| Component | Weight | Method |
|---|---:|---|
| Data completeness | 15 | Availability of required latest-period metrics |
| Data integrity | 20 | Pass rate across statement/segment reconciliation, period and actual/estimate separation, unit/currency, provenance, duplicate, and percentage-scaling checks |
| Citation coverage | 15 | Material text with valid source markers |
| Calculation integrity | 20 | Calculation and DCF reconciliation pass rate |
| Analytical completeness | 10 | Presence of thesis, filing-backed risk, industry/competition evidence, catalysts, and risks |
| Forecast transparency | 10 | Assumptions include both value and source |
| Visual consistency | 10 | Charts exist and all chart metadata contains source references |

Material citation coverage must be at least 85% to pass its check. The score itself uses the actual coverage percentage.

## Labels and gate signal

`Institutional Quality` requires all of the following:

- overall score of at least 85;
- data-integrity score of at least 18/20;
- citation score of at least 13/15;
- analytical-completeness score of at least 8/10; and
- no critical errors.

Otherwise:

- any critical error produces `QA Review Required`;
- a score below 50 produces `Incomplete`;
- a score from 50 through 69 produces `Draft`; and
- a score of 70 or more produces `Research Preview` unless the stricter institutional thresholds are met.

The QA result includes `passed_for_export`, which is true only when there are no critical errors. In the current release this is a signal for the caller and UI; `build_report()` still creates HTML and may create PDF even when the signal is false. External publishing workflows should enforce the signal explicitly.

## Critical conditions

Executable critical failures include an invalid structured-object schema; missing required SEC fact provenance; calculation or DCF reconciliation failure; unsupported calculated valuation; an unknown citation marker; unsupported target-price language; restricted branding/rating language; and a source explicitly marked restricted or prohibited. Fabricated-data detection remains bounded to provenance, deterministic reconciliation, and supported-output checks rather than claiming semantic proof of every external input.

Citation coverage below the configured 85% threshold has error severity and prevents `Institutional Quality`; an unknown or fabricated marker is critical and sets `passed_for_export` to false.

## Test coverage

The automated test suite covers:

- ticker/CIK mapping, SEC URL construction, filing filters, amendments, and cache metadata;
- AAPL, NVDA, and JPM submissions fixtures for operating-company, semiconductor, and bank paths;
- annual comparative selection, direct quarterly facts, YTD quarter derivation, and provenance fields;
- debt aggregation, formula correctness, zero denominators, market-input multiples, and formula metadata;
- forecast overrides, unlevered FCF reconciliation, DCF bridges, sensitivity, and invalid terminal assumptions;
- filing-section extraction and script removal;
- chart keys/source footers, ten-section HTML, citation markers, QA scoring, and structural PDF generation; and
- configuration loading and specialized-sector warnings.

Tests use synthetic Company Facts and small submissions fixtures. They do not constitute broad issuer-by-issuer accounting validation.

## Manual acceptance checks

For a release candidate:

1. Run the full pytest suite.
2. Generate a sample without `OPENAI_API_KEY` to verify the deterministic fallback.
3. Inspect the QA JSON for failed and critical checks.
4. Confirm HTML section order, source links, actual/estimate labels, and missing-data disclosures.
5. Render the PDF and inspect every page for clipping, overlap, table overflow, chart ordering, headers, footers, and page numbers.
6. When filing text is enabled, compare extracted sections with the linked SEC documents.
7. For banks, insurers, or REITs, verify that the limited-support warning is present and avoid relying on generic ratios without specialist review.

## Known QA limitations

- The report does not currently hard-block export on `passed_for_export`.
- Citation coverage below threshold is not a hard export block, although unknown markers are critical.
- No automated stale-cache warning is attached to the report object.
- Segment reconciliation is configured but not executable because segment dimension extraction is not implemented.
- There is no automated cross-check against audited statements outside SEC Company Facts.
- Visual QA is structural in tests; full page-by-page appearance still requires rendering and human inspection.
- Sector fixtures validate routing and selected calculations, not complete bank, insurer, REIT, SaaS, or semiconductor accounting coverage.
