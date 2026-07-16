# Source and Copyright Policy

## Principles

The project produces original, source-backed analysis. It may learn general research conventions from publicly accessible materials, but it must not copy a publisher's prose, charts, forecasts, branding, or distinctive report layout, imply an affiliation, or bypass access controls.

## Source hierarchy and labeling

The configured order of preference is:

1. SEC XBRL
2. SEC filing
3. Company investor relations
4. Government data
5. Licensed third party
6. Public third party
7. User input
8. System calculation
9. AI interpretation

Higher-ranked verified sources should be preferred when two sources address the same fact. Every source record must include a report-local source ID, title, type, URL, and retrieval time. Filing sources also carry form, filing date, reporting period, and accession number. User inputs must remain labeled as user inputs; calculated values must preserve their input provenance; AI interpretation must be supported by cited evidence.

The default application currently ingests SEC sources and explicit user assumptions. Other source types define the policy for future connectors but are not evidence that such connectors are implemented.

## Permitted use

- Retrieve and normalize public SEC facts and filing metadata.
- Link to the original filing and identify it by accession number.
- Extract short or bounded filing sections for analysis, with provenance and review warnings.
- Paraphrase source-supported facts and commentary in original language.
- Calculate original ratios, forecasts, valuation schedules, charts, and tables from disclosed inputs.
- Use public institutional-research publications to identify generic conventions such as visible assumptions, source footers, scenario separation, risk disclosure, and report freshness.
- Use licensed or user-provided data only within its applicable license and label it accurately.

## Prohibited use

- Copy or closely paraphrase proprietary research prose.
- Reproduce third-party charts, tables, forecasts, ratings, target prices, or full reports.
- Store or redistribute a proprietary report merely because it is reachable online.
- Imitate a bank, broker, research provider, or publisher's brand identity or distinctive visual trade dress.
- State or imply that this software is approved, endorsed, or produced by a named institution.
- Circumvent a paywall, authentication control, robots restriction, or technical access control.
- Present unlicensed consensus data, peer data, or market data as public SEC information.
- Convert an AI-generated interpretation into a purported management quotation.

## Citation practice

Source records are de-duplicated by accession/URL or title/URL and receive local IDs (`S1`, `S2`, and so on). Material narrative should include a valid marker and the appendix should provide the direct source link, filing identifiers, and retrieval time. Citation validation detects unknown markers and calculates coverage across material report text.

For filing text, the report links to the primary SEC document and records the extracted section name, character range, matched heading, truncation state, and confidence. Users should quote the original filing, not the extracted copy, when exact wording matters.

## Public research reference log

`docs/institutional_research_reference_log.md` records public materials reviewed for broad methodology and presentation conventions. Those sources inform general design principles only. Their wording, publisher-specific graphics, valuation outputs, ratings, and report structures are not imported into issuer reports.

## Original presentation policy

Charts are generated from the project's own data frames and use the neutral `SEC Financial Report Agent` design configuration. The HTML and PDF layouts are project-authored. Quality labels describe the software's QA result and must not be phrased as equivalence to a licensed sell-side product.

## Missing and unsupported evidence

If a material claim lacks an allowed source, the implementation should remove it, limit it, or display an approved missing-data label. Market prices, peer multiples, consensus estimates, industry statistics, competitive claims, and management guidance must not be inferred from SEC numeric facts. In this release they remain unavailable unless supported by an explicit input or future licensed/public connector.

## Review responsibility

The source ledger and automated checks reduce traceability risk but do not replace human review. Before external use, verify material claims against the linked primary source, confirm the permission status of any non-SEC input, and remove any content that could imply copied proprietary research or institutional endorsement.

