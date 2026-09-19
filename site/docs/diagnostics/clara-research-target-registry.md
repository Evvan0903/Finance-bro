# Clara Research Target Registry and bounded strategy

The registry describes capabilities; it is not a list of required sections or automatic provider calls. No provider, budget increase, schema migration or application multi-agent architecture was introduced here.

## Confirmed execution path

The real Quick route is `api/private-diligence/run/route.ts → runPrivateDiligence → web_research → legal discovery → parallel hiring / funding / researchAdaptively → deterministic governance → report`. `runClaraAgentStep` is separately implemented and is not called by this route. Previously Quick replaced the general search provider's six topics with just leadership and recent activity, and the adaptive branch admitted only overview/products/people/recent. A failed or empty follow-up stopped the entire adaptive branch.

## Strategy and budget

Stage A reuses the same two baseline searches but searches leadership/products and announcements/customers/partners together, alongside the existing bounded company website crawl. Original page statements can now become customer, partnership, pricing and security SourceFacts; new topics do not imply new providers. Explicit names, relationship language, original excerpts and dates remain required. Logos, navigation, search snippets, hypothetical pricing and unrelated entities cannot establish these records. Security support, compliance and certification remain the exact source assertion; no automatic certification claim is created.

Stage B considers original-page/link signals, value, cost and prior attempts. Optional branches cannot schedule without a relevant signal. At most two adaptive follow-ups remain permitted; a successful target stops, two empty attempts stop that target, unavailable/unresolved branches stop individually, and other promising branches may continue. Exact server-permitted queries, confirmed identity, existing tool schema validation, run-local URL reuse and shared hard budgets are unchanged: 50 seconds; 9 search, 44 page, 8 model, 8 official, 10 tool attempts. No provider is called simply because it appears in the catalogue.

`TargetResearchProgress` records discovery/deepening phase, attempts, empty attempts, source/evidence IDs and stop reason. `source_unavailable`, `entity_unresolved` and `searched_not_found` remain different. These are research progress observations, not verification grants. Only deterministic governance can approve canonical claims. Parallel funding, hiring, legal and official-record outcomes merge through `mergeTargetProgress`; deferred IDs cannot be merged as executed targets.

## Classification decisions

Value and cost are relative 1–5 planning hints (0 cost means local reuse), not numerical company scores. Shared targets use `coveredBy` and reuse the original branch instead of duplicating work. The metadata names only tools actually present in ClaraToolRegistry; USAspending is an existing directly scheduled provider, not an invented agent tool.

| Target | Decision | Why / reuse boundary |
|---|---|---|
| identity | EXISTING | Already locked by candidate confirmation; never replaced by a discovered name. |
| legal_entity | EXISTING | Existing company-owned legal discovery and SEC candidate gate; reuse its evidence. |
| business_description | EXISTING | Extract original attributable company statements from baseline pages. |
| products | EXISTING | Existing extraction; improve depth only when original product evidence is promising. |
| services | EXISTING | Shares product evidence, avoiding another provider or search. Shared with products. |
| business_model | ADD NOW | Retain explicit pricing or offering terms; no inference from industry or funding. Shared with pricing. |
| pricing | ADD NOW | High-density original pricing pages are inexpensive; no estimates or inferred currency. |
| founders | EXISTING | Reuse person-role attribution and current/historical safeguards. |
| executives | EXISTING | Same people branch; never infer current roles from dated historical mentions. Shared with founders. |
| board_or_key_people | ADD NOW | Source-backed director and appointment statements reuse people extraction. Shared with founders. |
| funding | EXISTING | Use existing bounded announcement and SEC intelligence; no parallel financing provider. |
| investors | EXISTING | Existing field-level financing validation; do not infer from logos. Shared with funding. |
| valuation | EXISTING | Existing financing fields preserve unspecified basis/currency. Shared with funding. |
| hiring | EXISTING | Known ATS adapters and confirmed company careers sources already exist. |
| key_open_roles | ADD NOW | Derive from observed job titles without another request or headcount inference. Shared with hiring. |
| hiring_function_mix | EXISTING | Reuse structured postings and explainable normalized categories. Shared with hiring. |
| hiring_geography | EXISTING | Snapshot of posting locations, not office or headcount estimates. Shared with hiring. |
| locations | EXISTING | Website address extraction exists; do not recast job locations as company offices. |
| customers | ADD NOW | Original case studies are accessible and useful; reject logos and menu lists. |
| customer_evidence | ADD NOW | Shares the customer branch; preserve company-reported attribution, no endorsement inference. Shared with customers. |
| partnerships | ADD NOW | Original announcements can add meaningful context with a bounded follow-up. |
| strategic_relationships | ADD NOW | Use the same partnership record; no additional generic relationship search. Shared with partnerships. |
| recent_developments | EXISTING | Existing source-date rules and verbatim extraction; no retrieval-date substitution. |
| product_launches | EXISTING | A recent-development subtype, not a second search branch. Shared with recent_developments. |
| m_and_a | EXISTING | Original announcements already supported as recent developments; no deal-size inference. Shared with recent_developments. |
| security_compliance | ADD NOW | Public company trust pages are low-cost; support, compliance and certification remain distinct claims. |
| certifications | ADD NOW | Shares security evidence; preserve the precise named standard and asserted scope. Shared with security_compliance. |
| government_activity | EXISTING | Existing USAspending provider is gated by government relevance; do not run for every company. |
| sec_filings | EXISTING | Existing strict issuer association, original parsing and provisional governance. Shared with funding. |
| developer_api_ecosystem | ADD NOW | Use explicit company documentation via product discovery; no repo popularity/usage inference. Shared with products. |
| major_integrations | ADD NOW | Explicit integration documentation shares product extraction; logos do not establish partnerships. Shared with products. |
| geographic_expansion | EXISTING | Use explicit dated recent developments; job counts cannot establish expansion. Shared with recent_developments. |
| executive_hiring | EXISTING | Recent/people evidence or observed job openings already covers this without inferring a vacancy. Shared with founders. |
| finance_leadership_hiring | ADD NOW | Deterministic title classification over existing postings; zero additional requests. Shared with hiring. |
| regulatory_signals | DEFER | Multiple jurisdictions and entity ambiguity need a dedicated resolver; generic search is unsafe. |
| ip_patents | DEFER | Assignee/parent resolution is expensive and usually low-density for this general Quick objective. |
| legal_events | DEFER | Court coverage and namesake risk require jurisdiction-specific matching and careful event semantics. |
| sam_gov | DEFER | USAspending already covers public awards; SAM registration is not an awarded contract. |
| state_registries | DEFER | Fragmented access and legal-name ambiguity; company-owned legal sources suffice for this iteration. |
| certification_databases | DEFER | Scope/entity matching and heterogeneous access exceed incremental value; preserve first-party claims. |
| public_pricing_changes | DEFER | A single current page cannot prove a change; would require dated comparable snapshots. |
| revenue_estimates | DO NOT ADD | No supported source means no estimate; speculative financial precision is outside scope. |
| logo_relationships | DO NOT ADD | A logo is not an attributable relationship statement. |
| hiring_growth | DO NOT ADD | One observed job snapshot cannot establish growth, health, existing staffing or IPO preparation. |

## Public-source decisions

| Source category | Decision | Accessibility, matching risk and maintenance |
|---|---|---|
| Company newsroom and product pages | ADD NOW / expand reuse | Frequent, owned-domain originals; broaden link selection rather than add a provider. Historical dates and actual subject still matter. |
| Customer and partner announcements | ADD NOW | Company-owned explicit relationship statements; moderate context risk, low request cost; no logo inference. |
| Public pricing pages | ADD NOW | Cheap current terms and high information density; preserve original units/currency; no estimated prices or change claims. |
| Developer documentation and integrations | ADD NOW / reuse products | Useful where linked from the company; preserve supported capability statements, not adoption/partnership inference. |
| Company security / trust pages | ADD NOW | Cheap scoped first-party assertions; exact original semantics, not independent certification. |
| Investor announcements | EXISTING | Existing funding search and per-field evidence validation; don't create duplicate investor provider. |
| ATS systems | EXISTING / improve reuse | Existing Greenhouse/Lever/Ashby/generic adapters; confirmed company relation and original postings required. |
| SEC original filings | EXISTING | Unchanged strict legal-name plus identity corroboration; provisional records remain governed separately. |
| USAspending | EXISTING / selective | Existing official awards provider; government relevance gate and conservative entity matching remain. |
| SAM.gov | DEFER | Registration/opportunity data is not an award; overlaps current government branch but adds matching complexity. |
| State registries | DEFER | Fragmented jurisdiction access, legal-name ambiguity and maintenance cost. |
| USPTO | DEFER | Assignee/parent matching is expensive and low-value for most general Quick runs. |
| Certification databases | DEFER | Heterogeneous access and scope matching need their own vetted resolver. |
| Courts / generic legal-event search | DEFER | Jurisdiction and namesake risks outweigh current generic-search value. |
| Logos, speculative revenue and hiring-implied growth | DO NOT ADD | These cannot establish the proposed company facts. |

## Focused tests

`tests/clara-research-targets.test.mjs` verifies unique metadata/registered tools, inactive target exclusion, signal-based follow-up, exact source-grounded statements, repeated-empty stopping, independent failure continuation, wrong-entity uncertainty, budget enforcement and parallel audit merging. Existing adaptive and tool regression tests are preserved.
