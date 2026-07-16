# Data Methodology

## Source scope and hierarchy

The default report path uses public SEC EDGAR sources:

- the SEC ticker mapping for ticker-to-CIK resolution;
- company submissions for filing discovery and issuer metadata;
- Company Facts for structured US-GAAP facts; and
- primary filing HTML for optional section extraction.

The configured source hierarchy is: SEC XBRL, SEC filing, company investor relations, government data, licensed third party, public third party, user input, system calculation, and AI interpretation. In the current application path, SEC sources, user-entered assumptions, system calculations, and optional AI interpretation are implemented. Company IR, government, licensed, and general public third-party data are policy-ready but not automatically ingested.

## SEC access, caching, and freshness

`SECClient` sends an identifying `SEC_USER_AGENT`, applies at least a 0.11-second request interval, uses a 30-second default timeout, and retries GET requests for 429 and common 5xx responses with backoff and `Retry-After` support.

JSON and HTML responses are cached locally for 24 hours by default. Each written cache entry has a metadata sidecar containing the key, source URL, retrieval timestamp, TTL, and content type. A fresh cache entry is returned without a network call. When a network request or payload validation fails, an expired cache entry may be returned as a continuity fallback. `cache_metadata()` exposes age and freshness, but this release does not propagate a stale-cache flag into the generated report; users who require confirmed freshness should inspect cache metadata or clear the relevant cache before a run.

## Filing discovery

Discovery supports `10-K`, `10-Q`, `8-K`, `S-1`, and `424B4`, including amendment identification and optional date filters. Each discovered record includes the form, amendment flag, filing and report dates, accession number, primary document, EDGAR URLs, XBRL flags, and source type.

Application scopes are:

- `annual`: 10-K only;
- `annual_and_quarterly`: 10-K and 10-Q; and
- `full`: 10-K, 10-Q, 8-K, S-1, and 424B4.

The orchestrator bounds each run to at most two 10-Ks, eight 10-Qs, four 8-Ks, two S-1s, and two 424B4s. Optional text extraction uses one recent filing per form and at most four filings. The latest 10-K lookup excludes amendments by default; broader discovery includes amendments unless explicitly disabled.

## XBRL normalization

Each supported metric has an ordered list of US-GAAP tags, allowed units, and an instant or duration period type. The normalizer:

1. collects candidate facts from the ordered tag list;
2. classifies 10-K FY duration facts as annual when their duration is 300–440 days;
3. classifies 10-Q Q1–Q3 duration facts as discrete quarters at 60–120 days or year-to-date at 121–300 days;
4. accepts instant facts for the corresponding annual or quarterly filing context;
5. groups candidates by metric, period kind, fiscal year, and fiscal period;
6. prefers the latest represented period end, then the highest-priority taxonomy tag, then the latest filing/accession; and
7. keeps the configured number of recent annual years and quarters.

Annual facts use the fact period-end year so comparative periods repeated in a later 10-K do not collapse into the filing's current fiscal-year focus. Quarterly facts retain the SEC fiscal-year/fiscal-period identity, which accommodates issuers whose fiscal quarter ends in a different calendar year.

When a direct Q2 or Q3 duration fact is absent, the system may derive a discrete quarter by subtracting the prior comparable year-to-date or Q1 fact from the current year-to-date fact. Such records are labeled `SYSTEM_CALCULATION`, assigned medium confidence, and include a `derived_from_year_to_date` flag and their source accessions. A direct discrete fact takes precedence.

## Fact provenance and ambiguity

The normalized ledger preserves, where available:

- metric, value, unit, and currency;
- period start/end, fiscal year/period, duration, and period kind;
- filing form/date, accession number, source URL, and retrieval time;
- taxonomy namespace/tag and concept label;
- amendment and frame metadata; and
- confidence plus ambiguity flags.

Fallback tags, selected amendments, conflicting values across fallback tags, and YTD-derived quarters are explicitly flagged. Confidence is high when no flag applies, medium for ordinary fallback/amendment/derived cases, and low when conflicting fallback-tag values exceed the implemented tolerance.

## Deterministic calculations

All financial formulas are computed in Python. `FORMULA_DEFINITIONS` records each metric's required inputs, formula, unit, null behavior, zero behavior, and period behavior. Division by a zero denominator produces null rather than infinity.

Important policies include:

- total debt prefers a reported aggregate fact; otherwise it adds non-current debt to an aggregate current-debt fact or available current components, avoiding double counting;
- free cash flow equals operating cash flow less absolute capital expenditure;
- annual revenue growth is year-over-year, while the quarterly frame exposes sequential growth;
- returns use comparable average balance-sheet values when available; and
- enterprise value and trading multiples remain unavailable unless market capitalization, share price, shares, or peer inputs are explicitly supplied.

Missing SEC facts remain null. Display layers use `Data unavailable`, `Not disclosed`, `Insufficient public data`, or `Unable to calculate from available filings` according to context.

## Filing-text methodology

Filing-text extraction is opt-in. HTML is converted to visible text after script, style, SVG, and related non-content elements are removed. Regex boundaries target configured 10-K, 10-Q, S-1/424B4, and 8-K sections. The extractor chooses the richest bounded match to reduce table-of-contents false positives, caps a section at 80,000 characters, and records the filing, accession, URL, character range, matched heading, truncation state, and a length-based confidence label. The optional LLM context further limits each excerpt to 12,000 characters.

This approach is useful for focused review but can miss nonstandard headings, select an imperfect boundary, or return a low-confidence 8-K body fallback. Extracted text must therefore be reviewed against the linked filing before being treated as a quotation or complete disclosure.

## Sector coverage

- General operating companies: supported for the common financial statement and cash-flow metrics.
- Software/SaaS: limited KPI configuration; ARR, RPO, subscription revenue, and sales efficiency are not guaranteed because specialized mappings are incomplete.
- Semiconductors: limited KPI configuration; customer, end-market, and geographic mix are not automatically extracted.
- Banks: limited; generic leverage ratios may be misleading, and CET1, NIM, charge-offs, and allowance analysis are not fully mapped or reconciled.
- REITs: limited; FFO, NOI, occupancy, and lease metrics appear only when explicitly disclosed and mapped.
- Insurers: flagged as requiring specialization in the UI, but no dedicated insurer KPI profile is implemented.

Segment XBRL dimensions, geographic/product reconciliations, peer data, consensus estimates, and live prices are future work rather than inferred outputs.

