---
name: institutional-equity-research
description: Build original, source-backed institutional-style equity research reports from public filings and licensed inputs. Use when analyzing a public company, normalizing financial history, writing an evidence-led investment thesis, creating transparent forecasts or valuation scenarios, designing cited charts and tables, or running numerical, citation, and copyright QA on an equity research deliverable.
---

# Institutional Equity Research

## 1. Purpose

Create an original, reproducible institutional-style research report. Lead with the decision-relevant view, then show the verified evidence, assumptions, calculations, uncertainties, and sources that support it. Treat the SEC record as the primary factual foundation for U.S. issuers.

Use this execution sequence:

1. Define issuer eligibility, requested filing scope, data cutoff, forecast horizon, permitted inputs, and intended audience.
2. Inventory filings through the cutoff date and record originals, amendments, report periods, and accessions.
3. Snapshot permitted sources with retrieval metadata and populate the source ledger.
4. Extract and normalize reported facts and filing text; keep raw provenance.
5. Reconcile statements, periods, units, restatements, and any derived quarters before analysis.
6. Obtain user approval for material user-entered or AI-suggested assumptions before valuation.
7. Draft from the verified research object, then validate claims and citations.
8. Run numerical, citation, freshness, visual, missing-data, licensing, and copyright QA before export.

## 2. Legal and copyright boundaries

- Study public research only to infer functional conventions.
- Do not copy wording, forecasts, ratings, target prices, charts, layouts, logos, color systems, named frameworks, or analyst voice.
- Treat public access as distinct from a reuse license.
- Do not bypass paywalls, authentication, download controls, or client portals.
- Do not imply affiliation, endorsement, or equivalence to a financial institution.
- Use `institutional-style research report`; do not name an institution as the style source.

## 3. Source hierarchy

Classify every input as `Observed evidence`, `User assumption`, `Derived calculation`, or `Interpretation`. Only observed evidence participates in this reliability hierarchy:

1. SEC XBRL facts tied to an accession and reporting period.
2. SEC filing text and exhibits.
3. Company investor-relations materials.
4. Government and regulator data.
5. Properly licensed third-party data.
6. Public third-party analysis with clear usage boundaries.
Do not let a lower-ranked source silently override a higher-ranked source. User assumptions never overwrite observed evidence; store them separately. Derived calculations must name their formula and cited inputs. Interpretations must link to supporting evidence and remain clearly labeled.

Use XBRL as an extraction layer, not an automatic override of the rendered filing. When tags, face statements, amendments, later recasts, or filing text conflict, stop automatic selection, preserve both records, and send the item to review. Record source rights or permitted-use status for investor-relations materials, third-party exhibits, and external research.

## 4. Standard report architecture

Use this order unless the assignment requires a narrower deliverable:

1. Research Dashboard
2. Company Overview
3. Historical Financial Performance
4. Segment and KPI Analysis
5. Management Commentary
6. Industry and Competitive Position
7. Forecast and Scenarios
8. Valuation
9. Catalysts and Risks
10. Appendix, QA, Sources, and Disclosures

Show company, ticker, exchange, industry, publication date, data cutoff, currency, fiscal basis, version, and freshness status on the first page.

## 5. Company-overview analysis

- Explain how the company earns revenue and incurs major costs.
- Identify products, services, segments, geographies, customers, end markets, and capital intensity only when disclosed.
- Separate filing facts from interpretation.
- State `Not disclosed` when the source does not support a requested dimension.

## 6. Historical financial analysis

- Use three to five annual periods and available discrete quarters.
- Analyze revenue, profitability, cash conversion, working capital, balance-sheet quality, leverage, liquidity, capital allocation, dilution, and unusual items.
- Reconcile reported and derived figures.
- Compare like periods and units; never mix annual, quarterly, and year-to-date values.
- Explain earnings quality through the relationship among earnings, operating cash flow, free cash flow, and working capital.
- Select facts deterministically using accession, form, report period, start/end context, duration or instant type, fiscal frame, unit, dimensions, amendment status, and filing date.
- Prefer the latest valid amendment or issuer recast for the same disclosed period, but retain the superseded record and explain the change.
- Normalize stock splits and fiscal-calendar changes explicitly. Do not treat custom tags as equivalent to standard tags without a documented semantic mapping.
- Company Facts covers entity-wide standard-taxonomy facts only. Use filing-level XBRL or filing text for custom concepts, dimensions, segments, and KPIs; otherwise mark them unavailable.
- Derive a discrete quarter from compatible year-to-date facts only with a deterministic subtraction rule and label it `Derived quarter`. Do not infer a missing quarter from narrative or trends.

## 7. Segment analysis

- Use reported segment measures and retain their taxonomy or filing source.
- Reconcile segment totals to consolidated amounts within a stated tolerance.
- Do not force cross-company comparability when segment definitions differ.
- Mark segment data unavailable when dimension extraction is incomplete.

## 8. Industry analysis

- Describe industry structure, demand drivers, cyclicality, regulation, capacity, pricing, and substitution using cited evidence.
- Separate company disclosures from licensed external industry data.
- State the limitation when no external industry dataset is configured.

## 9. Competitive-positioning analysis

- Link each claimed advantage or pressure to observable evidence.
- Analyze switching costs, scale, cost position, network effects, intellectual property, distribution, customer concentration, and capital requirements only where relevant.
- Avoid unsupported market-share or moat claims.

## 10. Management-guidance analysis

- Preserve the exact reporting period, metric definition, range, date, and source.
- Distinguish guidance from historical results, consensus, user assumptions, and AI suggestions.
- Compare language over time only with cited filing excerpts.
- Do not fabricate or paraphrase a quotation as though it were verbatim.

## 11. Forecast methodology

- Build forecasts from visible revenue, margin, tax, reinvestment, working-capital, and share-count assumptions.
- Label each assumption `Company guidance`, `Historical trend`, `User assumption`, `AI-suggested assumption`, or `System-calculated`.
- Keep actuals and forecasts in separate fields and label periods `A` and `E`.
- Never allow an AI-suggested value to replace company or user input silently.
- Keep every calculation deterministic. An AI may propose a numeric assumption only as a visibly labeled draft, and that value requires explicit user approval before it enters a valuation.
- Record forecast horizon, approval status, source date, and rationale for every material assumption.
- Use `Unable to calculate from available filings` when required inputs are absent.

## 12. Valuation methodology

- Use methods appropriate to the business and available data.
- Show the complete DCF bridge: revenue, margin, tax, depreciation and amortization, capex, working-capital change, unlevered free cash flow, discount rate, terminal growth, terminal value, enterprise value, net debt, equity value, shares, and per-share value.
- Reconcile valuation methods rather than averaging them mechanically.
- Require a dated diluted share count and net-debt position. Require sourced or user-entered market price only for price-relative analysis, and peer multiples only when using relative valuation.
- Show the discount-rate method, terminal-value method, and sensitivity table. Require discount rate to exceed terminal growth and disclose the share-count date.
- State peer-selection criteria and reject hidden or unlicensed peer data.
- Use `Valuation Assessment` and `Model-Implied Value Range`; do not generate a rating by default.

## 13. Investment-thesis methodology

- Limit the front-page thesis to three to five falsifiable points.
- Connect each point through driver, operating effect, financial-statement effect, and valuation implication.
- Explain what may be under- or over-discounted without claiming access to proprietary market expectations.
- Attach a source marker to every material factual premise.

## 14. Catalyst methodology

- Use dated or observable events.
- State the expected transmission from event to operating result or valuation.
- Separate near-term and medium-term catalysts.
- Do not list generic positives as catalysts.

## 15. Risk methodology

- Classify company, industry, macro, regulatory, accounting, liquidity, and valuation risks.
- Rank material risks by likelihood and impact when evidence permits.
- Include leading indicators and thesis-breaking conditions.
- Pair each risk with the assumption or thesis point it threatens.

## 16. Bull/base/bear methodology

- Change a small set of explicit, causal assumptions across scenarios.
- Keep formulas identical across scenarios.
- Make the base case the central visible assumption set, not a hidden default.
- Show scenario dependencies and probability only when the user supplies or approves probabilities.

## 17. Chart-design rules

- Give every chart one analytical job.
- Use an interpretive title, units, period frequency, source, and as-of date.
- Distinguish actuals and estimates with line style, marker, and label, not color alone.
- Use lines for trends, bars for comparisons, waterfalls for bridges, and matrices for likelihood/impact.
- Use a zero baseline for absolute bars and avoid misleading truncated axes.
- Omit or label missing observations; do not connect across unsupported gaps.
- Provide a text or table equivalent for decision-relevant visuals.

## 18. Table-design rules

- Put periods in columns or rows consistently across the report.
- Label actual and forecast periods directly.
- Use one currency and scale per table.
- Align decimals, use parentheses for negatives when appropriate, and display `—` for unavailable values.
- Place source and calculation notes immediately below the table.

## 19. Citation standards

- Give each source a stable identifier.
- Store title, type, form, filing date, reporting period, accession, URL, and retrieval timestamp.
- Cite material facts at paragraph level and charts/tables at object level.
- Cite system calculations to their source inputs and formula definition.
- Never fabricate a URL, accession, quotation, or citation marker.

## 20. Image-use standards

- Create original charts from public or properly licensed data.
- Do not copy institutional report charts, screenshots, illustrations, or logos.
- Use decorative imagery only when it communicates necessary context and licensing permits use.
- Add accessible text for every decision-relevant image.

## 21. Institutional writing standards

- Write concisely, neutrally, and with calibrated confidence.
- Lead each section with its conclusion, then evidence and counterevidence.
- Distinguish fact, management statement, calculation, assumption, inference, and opinion.
- Use conditional language for forecasts.
- Avoid marketing superlatives, false precision, and unexplained jargon.
- State what changed, why it matters, and what to monitor.

## 22. Numerical QA standards

- Reconcile assets to liabilities plus total equity within tolerance.
- Reconcile segments where available.
- Verify units, currency, scaling, sign conventions, and comparable periods.
- Recalculate debt, net debt, free cash flow, enterprise value, and every DCF bridge deterministically.
- Resolve duplicate and amended facts explicitly.
- Confirm narrative, table, and chart values agree.
- Treat division by zero as unavailable, never infinity.
- Use explicit tolerances from project configuration. A default face-statement tolerance may be the greater of 0.5% of assets and one reporting-unit rounding increment; disclose any project override.

## 23. Citation QA standards

- Verify every citation identifier exists in the source ledger.
- Require citation coverage for material factual paragraphs.
- Verify filing markers match the stated form, date, reporting period, and accession.
- Remove, weaken, or label any claim that cannot be supported.
- Do not count a generic source list as paragraph-level citation coverage.

## 24. Missing-data standards

Use only these explicit responses when appropriate:

- `Data unavailable`
- `Not disclosed`
- `Insufficient public data`
- `Unable to calculate from available filings`

Do not interpolate, infer, backfill, or ask an LLM to create a missing financial value. Preserve partial data only when the output is clearly labeled partial.

## 25. Prohibited behaviors

- Do not provide hidden or unsupported target prices, ratings, consensus values, peer data, or market prices.
- Do not calculate financial values with an LLM.
- Do not present stale research as current.
- Do not mix reported, adjusted, and forecast values without labels.
- Do not claim specialized bank, insurer, REIT, or other sector support until extraction, formulas, and tests pass.
- Do not label a report institutional quality based on appearance alone.

## 26. Institutional-style scoring rubric

Score 100 points:

- Data completeness: 15
- Data integrity: 20
- Citation coverage: 15
- Calculation integrity: 20
- Analytical completeness: 10
- Forecast transparency: 10
- Visual consistency: 10

Use `Institutional Quality` only when the overall score is at least 85, data integrity is at least 18/20, citation coverage is at least 13/15, and there are no critical errors, fabricated values, unsupported valuation outputs, or copyright-policy violations. Otherwise use `Draft`, `Incomplete`, `Research Preview`, or `QA Review Required`.

Before delivery, run numerical, citation, visual, missing-data, freshness, licensing, and copyright checks. Document the denominator used for citation coverage and the evidence behind every subscore. Render every PDF page and inspect for clipping, overlap, unreadable text, missing charts, broken links, and incorrect page metadata.

Hard-block client-facing delivery when a report contains a fabricated citation or value, an unsupported valuation output, an unreconciled core statement above tolerance without a visible limitation, a material copyright or licensing violation, or stale data presented as current. A technical preview may still be exported only when it is visibly labeled `QA Review Required` and lists the blocking errors. `Institutional Quality` is a project QA label, not a claim of institutional authorship, affiliation, endorsement, or regulatory compliance. Route regulated research distribution and analyst-certification questions to qualified compliance review.
