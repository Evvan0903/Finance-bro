# Universal Metric Coverage V1

## Coverage tiers

Tier 1 contains the 24 core income-statement, cash-flow, balance-sheet, per-share, debt, and shareholder-return metrics used to decide report depth. Tier 2 contains supplemental working-capital, expense, tax, efficiency, and return metrics. Tier 3 is pack-specific and remains evidence-gated.

## Applicability

Each expectation declares its company type and pack exclusions. Banks and diversified financials do not receive industrial FCF/debt requirements. Inventory is excluded for banks and software/platform packs. `not-applicable` metrics are removed from denominators.

## Source precedence and architecture

```text
SEC Company Facts
→ Standard Concept Registry
→ Direct Canonical Metrics
→ Derived Metric Engine
→ Filing-Level Inline XBRL
→ Validated Custom Mappings
→ Dimensions and Segment Facts
→ Validated HTML Table Facts
→ Canonical Metric Registry
→ Coverage Audit
→ Adaptive Report
```

Company Facts remains first. Filing enrichment may fill an unresolved standard metric, but never replaces an already selected Company Facts metric. Derived values require canonical inputs. Custom mappings publish only when explicitly validated. Dimensional facts remain separate from consolidated facts. HTML table matches are diagnostic candidates until a deterministic rule validates context, unit, period, and definition.

## Standard concepts and validation

Metric Definition Registry V2 stores metric ID, display name, definition ID, statement, period type, accepted unit class, prioritized US GAAP/IFRS/DEI aliases, labels, applicability, and validation rules. Selection requires an annual filing form, a finite value, the correct instant/duration behavior, accepted units, and deterministic priority/amendment handling.

## Derived metrics

The versioned rules include gross profit and margin, operating margin, strict FCF, FCF margin, cash conversion, total/net debt, working capital/current ratio, effective tax rate, capex and R&D intensity, share-count growth, average assets/equity, and ROA/ROE over average balances. Every result stores its formula and canonical input keys. Sign and denominator guards suppress economically meaningless calculations.

## Filing-level extraction

The Inline XBRL parser preserves taxonomy, concept, context, start/end dates, units, scale, sign, decimals, and explicit dimensions. Only consolidated standard concepts passing deterministic rules can publish. Source fetch failure does not erase usable Company Facts.

## Custom concepts, dimensions, and HTML tables

The custom mapping registry separates `candidate`, `validated`, and `rejected`; only `validated` is publishable. Explicit dimensions are retained and a dimensional fact cannot substitute for a consolidated value. The V1 HTML table locator finds row-label candidates but intentionally does not publish them.

## Coverage scoring and adaptive reports

Tier 1 contributes 70%, Tier 2 20%, and pack-specific metrics 10%, normalized when a tier is not applicable. Candidate-only and rejected values never count. Tier 1 coverage selects Full (at least 80%), Standard (55% to below 80%), or Limited (below 55%). Empty optional sections are hidden. A compact bilingual Data Coverage panel shows coverage and unresolved core metrics; technical audits remain collapsed.

## Benchmarks

V1 benchmarks cover AAPL, DELL, HPQ, MSFT, ORCL, ADBE, GOOGL, META, AMZN, KO, PEP, NKE, WMT, AXP, BLK, SCHW, plus NVDA, JPM, SHEL, LLY, and CAT regressions. The live SEC run on 2026-07-24 returned HTTP 200 for all 21. The 13-company initial applicable non-financial set averaged 80.45% Tier 1 coverage, with zero known materially incorrect published metrics. ORCL was below 65% because its latest normalized Company Facts and conservative filing gates did not yield validated consolidated debt, liability, share, or gross-profit inputs. Full results are in `site/artifacts/universal_metric_coverage_v1.json`.

## Known limitations

- SEC Company Facts does not contain every filing fact.
- Issuers may use custom XBRL concepts.
- SEC filing structures and custom taxonomies vary by issuer.
- Dimensional disclosures vary across issuers.
- Filing HTML structures are inconsistent.
- Some metrics are genuinely not disclosed.
- SIC classification may be broad.
- General Pack analysis remains less specialized than validated industry packs.
- Candidate custom concepts are not automatically trusted.
- Custom mappings require validation before publication.
- Dimensional and table extraction coverage remains incremental.
- No embedding, vector database, or ML classifier is authoritative.
- No market prices or consensus estimates are included.
- Live SEC availability may affect filing-level enrichment.

## Why ML and embeddings are deferred

Semantic search may later help locate candidates, but it cannot select or publish financial values. V1 favors auditable taxonomy mappings, deterministic parsing, explicit validation, and canonical reconciliation.

## Deferred V2

- Validate issuer-specific custom mappings for benchmark gaps.
- Add additional dimensional taxonomy and continuation patterns.
- Promote selected HTML table candidates only after issuer/layout-specific deterministic validation.
- Expand compact public-filing fixtures for unstable live integrations.
