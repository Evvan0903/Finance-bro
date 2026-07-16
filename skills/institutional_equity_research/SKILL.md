---
name: institutional-equity-research
description: Create source-backed institutional-style equity research, earnings-quality reviews, public-side diligence, forensic screens, credit-style risk analysis, and investment-committee memos for listed companies. Use when Codex must normalize filings, analyze historical and segment performance, build transparent forecasts or valuation scenarios, formulate a falsifiable thesis, or produce cited research tables, charts, Markdown, or PDF outputs.
---

# Institutional Equity Research

## Objective and execution sequence

Create original, decision-useful research whose evidence and calculations can be reproduced. Lead with the investment view, then show supporting and conflicting evidence, uncertainty, and what would change the conclusion.

1. Define the issuer, security, audience, research date, point-in-time data cutoff, requested periods, currency, forecast horizon, and deliverable.
2. Identify the issuer's jurisdiction, accounting basis, fiscal calendar, listing structure, and filing status. Use the forms appropriate to the issuer; for example, do not treat a foreign private issuer as a U.S. domestic 10-K/10-Q filer.
3. Inventory primary filings and amendments available by the cutoff. Record source dates, reporting periods, accessions or stable URLs, and retrieval dates.
4. Extract, normalize, and reconcile the statements, segments, KPIs, guidance, capital structure, and material filing text before drawing conclusions.
5. Analyze the business model, historical performance, earnings quality, industry position, thesis, catalysts, and risks.
6. Build forecasts, scenarios, and valuation only from visible inputs and deterministic formulas supported by the available evidence.
7. Draft conclusion-first prose and original analytical tables or charts. Explain why every major finding matters to an investor.
8. Run the final QA checklist and state sources, limitations, unresolved questions, and data freshness.

## Sources and point-in-time discipline

Classify every research input as `Reported fact`, `Management statement`, `Assumption`, `Derived calculation`, or `Interpretation`. Do not let an assumption or interpretation overwrite a reported fact.

Use this source hierarchy:

1. Issuer filings and filing-level XBRL tied to the relevant period and filing.
2. Issuer annual/interim reports, results releases, presentations, and other official investor-relations materials.
3. Government, regulator, exchange, and official industry data.
4. Permitted third-party datasets with transparent methodology.
5. Public third-party analysis used only as secondary context.

Prefer the rendered filing when XBRL tags, dimensions, or contexts conflict with the face statements or notes. Do not let a lower-ranked source silently override a higher-ranked source. Preserve both records when a conflict cannot be resolved and describe the effect on the analysis.

Lock the cutoff before analysis. Information published after that cutoff may be mentioned only as a separately dated subsequent event; do not use it to rewrite the point-in-time view. For each material source, retain title, issuer or publisher, document type or form, filing/publication date, reporting period, accession when applicable, stable URL, and retrieval date. Cite the original source rather than a search result or aggregator whenever possible.

## Financial normalization and calculation discipline

Create a normalized research table before computing trends. For every value, retain the issuer, statement or note, concept, period start/end, duration or instant context, unit, scale, currency, sign convention, dimensions, filing date, form, amendment status, and source.

- Compare like periods and keep annual, quarterly, and year-to-date observations distinct.
- Convert scales explicitly and identify the exchange-rate source and date for any currency conversion. Do not mix reporting and trading currencies without a labeled bridge.
- Normalize presentation signs without losing the reported sign. State whether capex, debt, and cash outflows appear as positive magnitudes or negative cash-flow values.
- Prefer the latest valid amendment or issuer recast for the same period, retain the superseded value, and explain material changes. Treat a restatement as a new version of history, not a current-period operating movement.
- Adjust per-share history for disclosed stock splits and identify material fiscal-calendar or reporting-perimeter changes.
- Use filing-level XBRL or filing text for custom concepts, dimensions, segments, and KPIs. Map custom tags only when their definitions are economically equivalent.
- Derive a discrete quarter only from compatible year-to-date values: `Discrete quarter = current YTD - prior-quarter YTD`. Label it `Derived calculation` and cite both inputs.
- Use deterministic arithmetic outside the language model. For each derived metric, show the formula, input periods, units, and rounding. Treat a zero or missing denominator as unavailable.

> Do not fabricate missing financial values. Use `Data unavailable`, `Not disclosed`, `Insufficient public data`, or `Unable to calculate from available filings`.

## Report architecture

Adapt depth to the assignment while keeping a traceable decision path:

1. Research dashboard: issuer, security, exchange, research date, data cutoff, currency, fiscal basis, latest reported period, valuation reference date, and three to five headline findings.
2. Company and business model: revenue drivers, cost structure, segments, geographies, customers, capital intensity, and economic sensitivities that are actually disclosed.
3. Historical financial performance: three to five annual periods plus useful recent interim periods.
4. Segment and KPI analysis: reported measures, reconciliations, definition changes, and mix implications.
5. Cash flow, capex, balance sheet, liquidity, and shareholder returns.
6. Earnings quality: cash conversion, working capital, non-operating items, impairments, provisions, acquisitions/disposals, adjusted measures, and share dilution.
7. Industry and competitive context based on cited evidence.
8. Three to five falsifiable thesis points, catalysts, key risks, and thesis-breaking conditions.
9. Forecasts, bull/base/bear scenarios, and valuation assessment when supported.
10. Sources, formulas, limitations, and unresolved questions.

## Historical, segment, and earnings-quality analysis

Analyze revenue, operating profit, margins, tax, net income, operating cash flow, cash capital expenditure, free cash flow, working capital, debt, net debt, pensions or other material obligations, liquidity, dividends, repurchases, and diluted shares where available. Define non-GAAP or issuer-adjusted measures and reconcile them to reported measures when the issuer supplies a bridge.

Use formulas consistently, for example:

- `Growth = current / prior - 1`
- `Margin = profit measure / revenue`
- `Cash conversion = operating cash flow / net income` when both measures are comparable and the denominator is positive
- `Free cash flow proxy = operating cash flow - cash capital expenditure`
- `Net debt = interest-bearing debt - cash and cash equivalents`, adjusted only for clearly identified items

Explain material movements through price, volume, mix, margins, working capital, portfolio changes, financing, tax, or other disclosed drivers. Separate recurring operating performance from commodity or foreign-exchange effects, one-offs, accounting estimates, and management-defined adjustments. A numerical correlation is not a causal explanation.

Use the issuer's reported segment definitions. Reconcile segment totals to consolidated results or explain corporate items, eliminations, and definition differences. Compare segment trends only across periods with consistent definitions; show recasts where available. For KPIs, retain the exact definition, scope, period basis, and any definition change. Do not force cross-company comparability when definitions differ.

Assess earnings quality by linking reported earnings to cash generation and balance-sheet movements. Investigate large gaps among net income, operating cash flow, and the free-cash-flow proxy; working-capital releases; recurring exclusions from adjusted earnings; capitalization or provision changes; impairments and reversals; acquisition/disposal gains; tax volatility; and dilution. Present alternative explanations and distinguish a monitoring signal from a conclusion about intent.

## Forecasts and scenarios

Build forecasts from causal operating drivers rather than extrapolating a headline growth rate. Show revenue or volume, pricing, margins, tax, depreciation, capex, working capital, financing, and share-count assumptions as applicable. Label each period `A` for actual or `E` for estimate and each assumption as `Company guidance`, `Historical trend`, `User assumption`, or `Analyst assumption`. Keep assumptions visible beside the resulting calculations and obtain user confirmation before using material user-entered or AI-suggested inputs in a requested valuation.

Use identical formulas in bull, base, and bear cases. Change only a small number of explicit variables that explain the outcome, state the causal path, and avoid assigning probabilities unless the user supplies or approves them. Prefer ranges when operating uncertainty does not support point precision. Show sensitivity to the few assumptions that dominate value.

## Valuation

Choose methods that fit the business and the available data. A DCF should show revenue, margins, tax, depreciation and amortization, capex, working-capital change, free cash flow, discount rate, terminal method, enterprise value, net debt, equity value, dated diluted shares, and per-share value. State the discount-rate method and require terminal growth to remain below the discount rate.

For multiples, define the numerator and denominator, use comparable periods, explain peer selection, date market inputs, and distinguish reported from adjusted metrics. For asset-heavy, cyclical, financial, or resource companies, consider asset value, mid-cycle cash flow, dividend capacity, leverage, or sum-of-the-parts methods when better supported. Reconcile different methods by explaining what each captures; do not average incompatible outputs mechanically. Call the conclusion `Valuation assessment` or `Model-implied value range`, and state when current market inputs are absent.

## Thesis, catalysts, and risks

Limit the thesis to three to five testable points. Connect each point through `driver -> operating effect -> financial-statement effect -> valuation implication`, cite its factual premises, present counterevidence, and identify a monitoring indicator.

Use catalysts that are dated or observable, and explain how each may transmit into operations, cash flow, risk, or valuation. Separate near-term events from medium-term developments. Pair each material company, industry, macro, regulatory, accounting, liquidity, or valuation risk with the thesis assumption it threatens, a leading indicator, and a thesis-breaking condition. Calibrate confidence to the evidence.

## Citations, writing, tables, and charts

Cite material factual paragraphs and management statements at paragraph level. Cite tables and charts at object level, including the source, period, currency, units, and as-of date. Cite calculations through their formula and source inputs. Never invent a URL, accession, quotation, citation marker, market price, or peer value.

Write neutrally and concisely. Lead each section with the conclusion, then evidence, counterevidence, investor relevance, and what to monitor. Keep reported facts, calculations, assumptions, and interpretations visibly distinct. Use conditional language for forecasts and avoid unsupported precision.

Create each table or chart for one analytical question. Keep currency and scale consistent, label actuals and estimates directly, show missing observations without bridging gaps, use zero-based axes for absolute bars, and provide a readable table or text equivalent for decision-relevant visuals. Put calculation and source notes directly below the object.

> Do not copy or closely reproduce proprietary research text, charts, forecasts, ratings, target prices, logos, or distinctive report designs. Use public or permitted data to create original analysis and visuals.

## Task-specific resource routing

Keep this guide as the default execution layer. Load supplementary resources only when they change the work:

- Use `patterns/report_archetypes.yaml` and `patterns/section_blueprints.yaml` for a broad report whose format is not already specified.
- Use `patterns/sector_patterns.yaml` for relevant issuer economics; fall back to the general method when no sector pattern fits.
- Use `patterns/analytical_patterns.yaml` for complex causal or committee reasoning; use `patterns/forensic_patterns.yaml` or `patterns/diligence_patterns.yaml` only for those requested scopes.
- Use `patterns/disclosure_patterns.yaml` when forecasts, valuation, forensic work, public-side diligence, or credit-style analysis requires a specialized limitation.
- Use `patterns/chart_patterns.yaml`, `patterns/table_patterns.yaml`, `patterns/writing_patterns.yaml`, and `patterns/layout_patterns.yaml` when producing designed tables, charts, or longer reports. For PDF or other visual export, also load `design/layout_tokens.yaml` and `design/visual_grammar.yaml`.
- Consult `research_corpus.yaml` and `patterns/pattern_provenance.yaml` only when adding or validating reusable patterns. Use `benchmarks/benchmark_cases.yaml` only for acceptance testing, and `assets/asset_manifest.yaml` only when introducing a non-data asset.
- Run `python scripts/validate_resources.py` after changing bundled resources, not for ordinary issuer analysis.

## Final QA checklist

- Financial reconciliation
- Period, unit, sign, and currency consistency
- Formula accuracy
- Citation coverage
- Actual-versus-estimate labeling
- Visible assumptions
- Agreement among narrative, tables, and charts
- Basic visual readability
