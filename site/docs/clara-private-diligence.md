# Clara V1 public-source private company diligence

Clara is FinBro's bilingual Private Company Diligence Analyst. The V1 workflow at `/workflows/private-company-diligence` accepts either a company name, a company website, or both, plus optional identity hints. It resolves the target before producing a formal public-source diligence report. It does not provide complete legal, financial, tax, operational, cybersecurity, ownership, litigation, valuation, fraud, background-investigation, or investment conclusions.

## Two Clara modes

`/workflows/company-intelligence` is the available **Quick Company Intelligence** workflow. It reuses the same confirmation-first identity graph and evidence controls for a concise nine-section business brief: Company Snapshot; Business and Products; Ownership and Leadership; Hiring and Growth Signals; Locations and Contact Information; Customers and Partners; Recent Business Activity; Key Commercial Signals; and Sources and Information Gaps. Its research-purpose selector supports competitor, potential customer, vendor, partner, sales prospect, and general research. Purpose changes emphasis only; it never changes evidentiary standards.

Quick mode selects the website source first, then uses bounded SerpApi discovery only after a target has been confirmed. Every SerpApi lead is fetched from its original URL; snippets are not retained as evidence. Selective USAspending or Form D checks run only when relevant. ATS links visible on a company page are identified as public hiring infrastructure, but a link is not presented as an open-role count without direct ATS evidence. Contacts are restricted to public business channels; personal emails, personal mobiles, and residential addresses are excluded. Customer and partner labels require company and/or counterparty support; logos alone are not confirmation. Commercial signals are restrained, evidence-linked, and not investment recommendations. Coverage means public-source availability, not diligence completion.

After confirmation, Clara also runs bounded **Hiring Intelligence**. It discovers careers links on the confirmed domain, checks Greenhouse, Lever, Ashby, and company-hosted sources, normalizes public open roles, and stores an observed snapshot. A role is evidence that a public opening was observed at retrieval time; it is not proof of headcount growth, a filled role, or hiring outcomes. Retrieval failure, unsupported sources, parsing failure, and zero observed roles remain distinct states.

`/workflows/private-company-diligence` is retained as the deeper **Outside-In Due Diligence** implementation and remains In Development in the product presentation. It is not presented as the completed Quick workflow. Shared infrastructure includes entity resolution, providers, evidence and claim registries, conflict handling, exports, and a source ledger. When `DEEPSEEK_API_KEY` is configured, the model router may use DeepSeek V4 Pro only for structured ranking of already-grounded discovery candidates; it cannot introduce facts, companies, or URLs and its output cannot bypass evidence validation. All other model-router tasks remain disabled.

## Execution model

1. Validate that at least a company name or website is present; location, founder, industry, objective, language, and report depth remain optional.
2. For website-first requests, normalize and safely reach the domain, then inspect at most 12 identity-focused pages to depth 2. For company-name-only requests, try a bounded set of deterministic public website candidates and accept only an organization-name match without a mismatch signal.
3. If public identity information cannot be reached for a name-only request, create a server-bound provisional discovery lead from that request. It remains Low confidence, identity-unverified, and unusable as evidence; it exists only so the user can select the intended research target and let Clara continue discovery.
4. Score unique strong signals. Exact reachable domain plus an observed website organization name, exact domain plus a Terms/Privacy entity, an official legal-name match plus another signal, or a score of at least 60 can support automatic selection.
5. Keep target selection separate from legal-entity verification. Explicit selection requires a structurally valid candidate that belongs to the current research request, has server-side provenance, and is neither rejected nor likely unrelated. Missing website, legal name, location, people, or a high score does not by itself block explicit selection.
6. Frontend and backend use deterministic selection helpers. Exactly one candidate initializes `selectedCandidateId` to that server-issued ID; multiple candidates initialize it to null until the user chooses one. The independent Confirm action is disabled without a selection and sends only the research ID, selected candidate ID, and `explicitUserConfirmation: true`. Every candidate also carries its issuing research-request ID for backend ownership validation.
7. Explicit selection preserves Low/Medium/High confidence and records `userSelected`; automatic selection records `autoSelected`. Identity verification independently remains `unverified`, `partiallyVerified`, `verified`, or `conflicting`.
8. In Quick mode, valid selection starts research immediately. If no eligible public evidence is available, Clara produces a Limited brief with explicit gaps and zero unsupported claims. Deep mode retains the evidence requirement.
9. Build an enriched identity graph containing website names, candidate legal names, Terms/Privacy entities, domains, email domains, people, addresses, social profiles, product categories, affiliates, identifiers, jurisdictions, and explicit relationship boundaries.
10. Build a provider plan from enriched names, geography, and industry. Provider failures are typed and non-fatal.
11. Register raw evidence, normalize supported fields, assign source tiers and verification eligibility, then exclude weak/lead-only evidence from final claims.
12. Build evidence-linked claims, reconcile matching values, preserve conflicts, separate risks from information gaps, and generate follow-up questions.
13. Generate a 20-section report with References and Evidence Register last.

Clara research requests, candidate ownership, and selected targets are persisted through Turso/LibSQL when `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are configured. Local development can use a file-backed SQLite database. Persistence is not an authorization boundary; authenticated access controls, retention controls, and signed downloads remain future work.

Hiring runs and normalized job snapshots are persisted separately from the report record, allowing a future workflow to compare observed runs without treating a failed retrieval as zero jobs. The optional JS-rendered careers fallback uses server-side `playwright-core`, remains constrained to the confirmed hostname, and requires a deployment-provided Chromium executable through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; it does not bypass access controls or anti-bot protections.

## Standardized Clara tools

Clara exposes a TypeScript-native tool layer under `app/lib/private-diligence/tools` for future agent orchestration. It is a thin adapter over current deterministic workflows, not an agent or a second research system. The initial registry contains `company_identity`, `web_research`, and `hiring_intelligence`; each definition publishes a name, description, and bounded input schema.

Every tool returns the same envelope: `success`, `partial`, or `failed`; typed data; grounded observations; existing `RawEvidence` records; deterministic research gaps; sanitized errors; and retrieval metadata. A successful search with no evidence remains `success` with a gap, while provider, parsing, browser, or persistence failures remain explicit. Identity discovery never confirms a candidate for the user. Web research accepts only the existing website and SerpApi providers and retains secure fetching and original-page requirements. Hiring derives its target URL from the confirmed identity graph, preserves job IDs, URLs, timestamps, cautious inference rules, and durable snapshot behavior.

## Persistent ResearchState and execution history

The optional Step 3 infrastructure gives each research objective its own durable `ResearchState`, even when two sessions concern the same company. A state references the selected entity, current factual observations, open and resolved research gaps, existing evidence IDs and provenance, and its ordered tool-execution IDs. It does not store model reasoning or create another evidence registry.

`executeClaraTool` is a decision-free wrapper: it loads the state, resolves an allowlisted tool from the Step 2 registry, runs it with the existing Clara context, sanitizes the audit input, appends a `ToolExecutionRecord`, and deterministically updates the state. Each execution retains its per-tool attempt number, status, timestamps, observations, gaps, evidence references, and sanitized errors. Failed executions cannot add observations or evidence or erase earlier usable work. A successful retry can resolve a prior gap from the same tool while the original failed execution remains queryable.

Research states and executions use the existing Turso/LibSQL stack in `clara_research_states` and `clara_tool_executions`. Full evidence bodies remain in Clara's existing evidence flow; the state tables store traceable references instead. This infrastructure runs alongside the current Quick and Deep orchestration. It does not choose tools, retry automatically, score coverage, or mark research complete without an explicit later decision.

## Deterministic coverage evaluation

Step 4 adds a read-only coverage evaluator under `app/lib/private-diligence/coverage`. It evaluates the persisted `ResearchState` and its complete `ToolExecutionRecord` history without invoking an LLM, choosing tools, retrying work, generating prose, or changing research state. Callers can use the pure `evaluateCoverage` function with loaded records or `evaluateResearchCoverage` to load one state through the existing state store.

The evaluator supports two explicit profiles. `general_company_research` requires confirmed company identity plus usable original-page web evidence. `hiring_research` adds a valid Hiring Intelligence result; a successful, fully evaluated zero-job result is valid coverage and is not treated as a retrieval failure. Objective-to-profile selection is a narrow deterministic keyword rule, and callers may pass a profile explicitly when the workflow already knows its intent.

Each required topic is classified as `covered`, `partial`, or `missing`. The result exposes machine-readable blockers and warnings, relevant evidence references, outstanding gaps, retry history, and aggregate counts. A latest successful retry can satisfy a topic while preserving a warning about earlier failure. Active high-severity gaps block readiness, resolved gaps do not, and duplicate gaps are collapsed deterministically. Evidence volume, a successful status without usable web evidence, or merely running each tool once never establishes completion.

`readyForCompletion` means only that the selected coverage profile's minimum deterministic evidence conditions are met. It does not mark the state completed or replace a human or later orchestration decision. The current Step 3 reference shape does not provide reliable field-level mapping for a separate structured business-profile topic, so Step 4 intentionally evaluates identity, web presence, and hiring only rather than inferring business-profile coverage from document counts or prose.

## Coverage-aware Planner and bounded agent step

Clara's first agent service is intentionally single-step. `runClaraAgentStep` loads one `ResearchState` and its execution history, evaluates deterministic coverage, builds a compact Planner context, requests one strict structured decision, validates that decision, and may execute exactly one registered tool through `executeClaraTool`. It then reloads the durable state and execution history, re-evaluates coverage, and returns. It does not loop, recursively plan, mark research completed, or generate a report.

The Planner is a separate `plan_next_research_action` task on the existing medium-tier DeepSeek integration. It receives the objective, lightweight confirmed-company reference, recent grounded observations, active gaps, CoverageAssessment, summarized attempts, the existing registry's tool definitions, and the persisted authoritative company input when available. It does not receive raw HTML, browser payloads, full documents, secrets, environment variables, or private reasoning fields. Its response must match one of two strict JSON shapes: one `execute_tool` action with a registered tool, validated input, reason code, and target topic; or one `stop` action with a bounded reason code.

Planner output is never executed directly. The deterministic validator checks registry membership, the registered input contract, target-topic relevance, persisted company ownership, confirmation status, authoritative identity input, current gaps, duplicate successful work, and a maximum of two consecutive failed automatic attempts. Downstream web or hiring research cannot run without the same confirmed entity in the persisted Clara request. Grounded candidate discovery remains insufficient for confirmation; when candidates await selection, the valid outcome is `requires_user_confirmation` and no downstream tool runs. A Planner claim of `coverage_sufficient` is valid only when the evaluator already reports `readyToComplete`.

Planner timeout, malformed JSON, schema failure, unknown tools, unsafe input, invalid stop claims, and retry-limit violations execute no tool. The state is unchanged for Planner failures. Approved tool attempts retain the existing `ToolExecutionRecord`, evidence-reference, gap-lifecycle, sanitization, and Turso/LibSQL persistence behavior. No public agent API or chat UI is exposed in this step; callers use the internal service until authentication and request-level authorization are designed.

## Provider registry

| Provider | V1 behavior | Source tier |
|---|---|---:|
| Company website | Safe server-side crawler limited to 12 identity-relevant pages and depth 2 on the supplied/canonical domain, with robots, redirect, type, time, and size controls | 2 |
| SerpApi original-source web research | At most six deduplicated post-confirmation queries; leads are deduplicated and fetched as original pages before evidence normalization | 3 |
| SEC Form D | Retrieves D and D/A only after a verified CIK is present; preserves amount offered versus sold and related-person limitations | 1 |
| USAspending | Exact normalized recipient matching, award-type-group requests, weak-match rejection, and official award normalization | 1 |
| SAM.gov | Configuration and manual-verification framework; not required for report completion | 1 |
| State registries | Official search links for selected states and explicit manual-verification fallback | 1 |
| USPTO | Configuration and manual-verification framework for legal/former assignee names; founder-owned IP remains separate | 1 |
| Broad web discovery | Vendor-neutral configuration boundary; unavailable providers create no fake results | 4 |
| Market context | Planning boundary for future official industry context; proxies cannot become company revenue or TAM | 1 |
| Hiring Intelligence | Confirmed-domain careers discovery; Greenhouse, Lever, Ashby, and bounded company-careers adapters normalize public job snapshots and preserve job/source provenance | 2 |

Required Vercel variables for Clara persistence are `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Either `SERPAPI_API_KEY` or `TAVILY_API_KEY` enables bounded web discovery; `DEEPSEEK_API_KEY` is optional and only enables grounded candidate ranking. `SEC_USER_AGENT` remains applicable to shared SEC access. USAspending and company-site research require no API credential. Never put credentials in URLs, evidence, exports, diagnostics, or browser-visible responses.

## Evidence and claims

- Tier 1 official records can become `finalEvidence` when the entity match is Medium or High.
- Tier 2 company sources and Tier 3 independent sources become `supportingEvidence` when the match is Medium or High.
- Tier 4 or Low-confidence evidence is `leadOnly` or `excluded` and cannot support a final claim.
- Every claim must contain at least one eligible evidence ID.
- Website statements retain `companyReported: true` and display as Company Reported unless an independent or official source supports the same value.
- Website-derived candidate fields retain page URL, title, page type, retrieved date, extracted-field list, and `Company Reported` evidence status. Entity confirmation does not upgrade those facts to Verified.
- Official, independent, company, inferred, conflicting, outdated, and unverified statuses remain distinct. Conflicts are recorded; no source is silently discarded merely because values differ.

Missing public information produces an information gap, not a misconduct inference. Risks require evidence or a clearly labeled identity/conflict limitation. Follow-up questions name the evidence a human diligence team should request.

## Report and exports

The report covers executive summary, entity identification, legal profile, business model, management, financing, operating footprint, commercial evidence, government activity, IP, licensing, litigation limits, market context, competitive positioning, risks, conflicts, gaps, questions, methodology, and references. Unsupported empty analytical sections are omitted.

Exports include Markdown, PDF, evidence CSV/XLSX, claim CSV/XLSX, and risk CSV. Spreadsheet values are formula-injection protected. Public links and text are redacted for credential query fields and local filesystem paths. The PDF uses the shared formal renderer and Clara-specific footer; loading text and provider diagnostics stay outside formal exports.

## Security and privacy

Company-site requests are server-side, accept HTTP/S only, reject credentials and unsupported ports, resolve DNS before each request, block loopback/private/link-local/reserved addresses, reject cross-domain redirects, enforce a maximum of 12 pages and depth 2, respect applicable robots rules, validate response type/size, enforce timeouts, and use manual redirects. The crawler does not bypass login, CAPTCHA, or download arbitrary attachments. Only public business-role information needed for entity resolution is retained in the configured database record. Sensitive personal details, raw secret-bearing URLs, request headers, stack traces, and API responses are not published.

## Current limitations and future work

- Website-only resolution depends on identity signals actually exposed by the site. If no name or identity signal is extractable, Clara requests a company name, location, or founder rather than fabricating a candidate.
- Name-only discovery is bounded and conservative. A provisional user-selected target can start Quick research, but it remains explicitly unverified until public sources establish identity; absence of evidence produces a Limited brief rather than an inferred company profile.
- SEC Form D is available only after a verified CIK is discovered; absence of Form D is not evidence that financing did not occur.
- SAM, USPTO, many state registries, licensing, and comprehensive litigation research require credentials, reviewed adapters, or manual verification.
- Public websites do not establish audited revenue, valuation, beneficial ownership, customer concentration, security posture, or complete litigation history.
- A careers page can be incomplete, geo-filtered, JavaScript-rendered, rate-limited, or blocked by its provider. Clara preserves that limitation rather than reporting zero roles. The current snapshot model enables later comparison but does not itself calculate historical hiring growth.
- Future phases may add authenticated access controls, retention policies, document-room diligence, reviewed litigation providers, additional state adapters, and industry-specific verification packs.

Run focused validation with `node --test tests/clara-private-diligence.test.mjs`. After `npm run build`, run website-first validation with `node scripts/validate-clara-website-first.mjs` and the broader three-company report validation with `node scripts/validate-private-diligence.mjs` in a network-enabled environment.


### Clara shared search (SerpApi / Tavily)

`search/sharedSearch.ts` is the server-side routing boundary below the existing
`serpApiWebSearch` compatibility provider. Generic Quick web research, funding
announcements, permitted follow-up queries, and existing SEC CIK lead discovery
use it. Company candidate discovery remains direct website/Wikidata; direct SEC,
USAspending and ATS calls are unchanged. No new legal-entity discovery is added.

Configuration is loaded by Next's normal environment loader. `TAVILY_API_KEY`
(case-sensitive) alone enables search. Default order is SerpApi then Tavily;
`CLARA_SEARCH_PRIMARY=serpapi|tavily` optionally reverses it. No client credentials.
Tavily uses only `/search`, explicit basic/general, auto parameters disabled,
at most five results, no answer/raw content/images, and usage requested.
Provider headers never pass to the secure original-page fetcher.

Routing is deterministic: each provider at most once per query. Missing config,
authentication, confirmed quota, rate limit, upstream outage, and provider timeout
allow fallback while budget/deadline remain. Invalid requests, malformed success
responses, cancellation and security filtering do not. Genuine empty results
(including SerpApi Success + error indicating empty) do not trigger fallback.
Tavily 432 and 433 retain separate plan/PAYG limit reasons; 429 is rate limiting.
Errors contain fixed codes, not provider error text or credentials.

Quick creates one run-local health/cache session shared by generic and funding
search. Confirmed auth/quota disables the provider for that run; rate limits cool
down for 30 seconds. No global or distributed breaker, durable cache, or new
cross-user sharing. A separately resumed process starts a new health session;
persisted attempt diagnostics remain available but are not a permanent disable.
Successful discovery is cached for 120 seconds; true empty results for 30 seconds,
maximum 32 entries per run. Query, domain/path filters, locale, time range, result
limit and provider behavior affect the key. In-flight equivalents share results;
failed results are never cached as empty. Original search times survive cache hits.
Cancellation-bearing calls own their transport and do not share in-flight work.

Generic web retains a six-outbound-attempt allowance across both providers.
Funding retains its shared four-search-attempt budget and existing 24-second /
remaining Quick deadline. Reservation is synchronous before each dispatch; a
failed primary consumes one unit. No extra allowance is created for fallback.
Funding source fetches, SEC and model calls retain their independent existing caps.
Provider timeout is capped by the remaining deadline, including fallback.

Persisted `PrivateProviderResult.searchDiagnostics` records logical operations,
cache-hit flags and attempted/skipped providers with sanitized reasons. Actual
outbound count is the sum of attempted flags; cache hits have no new attempts.
Provider-reported credits and explicitly estimated Tavily credits / SerpApi
request units are separate fields (failed attempts are not presumed free).
The run-local session also maintains aggregate counters. Legacy provider/evidence
IDs are retained; `structuredData.searchDiscovery` records actual underlying
provider, rank/score, request ID, search time and publication-date hint. Scores
are not factual confidence; date hints are not article dates. Source attribution,
publication date and facts still come exclusively from fetched original pages.
Search snippets/answers never become evidence; inaccessible pages produce a gap.

Contracts verified against [Tavily Search](https://docs.tavily.com/documentation/api-reference/endpoint/search),
[Tavily credits](https://docs.tavily.com/documentation/api-credits), and
[SerpApi status codes](https://serpapi.com/api-status-and-error-codes).

### Source-grounded legal entity discovery

Quick research now runs `entity-resolution/legalEntityDiscovery.ts` after original
company/web pages are retrieved and before the existing automatic SEC candidate
lookup. It reuses those pages, then follows Terms, Privacy, Legal/Imprint and
regulatory links on the confirmed company domain or explicitly linked subdomains.
Product/solution links and third-party domains are excluded. Conventional root
legal URLs are considered only when no retrieved legal source/link exists.
The secure fetcher still enforces DNS, redirects, content type and body limits;
robots exclusions are checked per origin. The extra step is capped at six legal
page attempts, twelve HTTP requests including robots/redirects, and ten seconds
within the existing Quick deadline. It never uses a search snippet as authority.

`researchRecord.legalEntityDiscovery` and the SEC provider result retain every
extracted candidate with its legal name, relationship, status, source URL/type,
exact supporting excerpt, original retrieval time, evidence ID and locator.
Actual fetched legal documents remain in RawEvidence with separate `legal-page-`
IDs. Deterministic extraction requires a corporate suffix; it does not append a
suffix to a brand or promote a directory/product name. Coverage is conservative
and primarily supports English corporate disclosures; inaccessible or client-only
legal content can leave discovery incomplete.

An explicit first-party operating/contracting statement can establish a legal
name as eligible for a brand-level SEC query. A copyright name or unbound mention
remains a candidate. Supported parent/subsidiary relations are preserved as
directed references, not collapsed. Specialised advisory/lending/fund/SPV names
without support for the selected brand's scope are rejected **for this query**;
that status does not deny the entity's legal existence. Multiple supported
operating entities, joint controllers and conflicting scope remain unresolved.
`accepted` means query eligibility, never independently verified incorporation
or a verified SEC issuer.

SEC receives a scoped copy of the identity graph whose legal-name lists contain
only accepted operating candidates; `legalNames[0]` from the locked legacy graph
is no longer the selection mechanism. All candidates and exclusions persist,
while the confirmed brand/display identity remains unchanged. Search CIKs still
must pass the unmodified SEC legal-name/corroboration/conflict verifier before
Form D access. The Form D parser, Agent planner and funding report are unchanged.
No new database tables, model calls or autonomous agent tools were added.

### Bounded adaptive Quick research (2026-09-18)

Quick now executes registered web/hiring/funding tools under one outbound budget, then permits at most two general gap-driven original-page searches. Exact source quotes flow through evidence and claims into the report; legal identity and SEC verification remain separate. See [implementation, live comparison, limits and reproducible evaluation](diagnostics/clara-deep-research/report.md).
