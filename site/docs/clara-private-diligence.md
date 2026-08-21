# Clara V1 public-source private company diligence

Clara is FinBro's bilingual Private Company Diligence Analyst. The V1 workflow at `/workflows/private-company-diligence` accepts either a company name, a company website, or both, plus optional identity hints. It resolves the target before producing a formal public-source diligence report. It does not provide complete legal, financial, tax, operational, cybersecurity, ownership, litigation, valuation, fraud, background-investigation, or investment conclusions.

## Two Clara modes

`/workflows/company-intelligence` is the available **Quick Company Intelligence** workflow. It reuses the same confirmation-first identity graph and evidence controls for a concise nine-section business brief: Company Snapshot; Business and Products; Ownership and Leadership; Hiring and Growth Signals; Locations and Contact Information; Customers and Partners; Recent Business Activity; Key Commercial Signals; and Sources and Information Gaps. Its research-purpose selector supports competitor, potential customer, vendor, partner, sales prospect, and general research. Purpose changes emphasis only; it never changes evidentiary standards.

Quick mode selects the website source first, then selective USAspending or Form D checks only when relevant. ATS links visible on a company page are identified as public hiring infrastructure, but a link is not presented as an open-role count without direct ATS evidence. Contacts are restricted to public business channels; personal emails, personal mobiles, and residential addresses are excluded. Customer and partner labels require company and/or counterparty support; logos alone are not confirmation. Commercial signals are restrained, evidence-linked, and not investment recommendations. Coverage means public-source availability, not diligence completion.

`/workflows/private-company-diligence` is retained as the deeper **Outside-In Due Diligence** implementation and remains In Development in the product presentation. It is not presented as the completed Quick workflow. Shared infrastructure includes entity resolution, providers, evidence and claim registries, conflict handling, exports, source ledger, and the disabled `runClaraModel` boundary. The model router has `small`, `medium`, and `strong` tiers for future isolated structured-output use; no paid model calls are enabled and model output can never bypass evidence validation.

## Execution model

1. Validate that at least a company name or website is present; location, founder, industry, objective, language, and report depth remain optional.
2. For website-first requests, normalize and safely reach the domain, then inspect at most 12 identity-focused pages to depth 2. Extract JSON-LD, title, metadata, Terms/Privacy legal names, addresses, people, email domains, social profiles, products, services, and affiliates where available.
3. Score unique strong signals. Exact reachable domain plus an observed website organization name, exact domain plus a Terms/Privacy entity, an official legal-name match plus another signal, or a score of at least 60 is confirmable.
4. A displayed Low-confidence candidate with an exact reachable domain may be explicitly user-confirmed. Its status becomes `userConfirmed`, confidence stays Low, and the report records the identity limitation while research continues. A Low candidate without a reachable domain requests more information.
5. Frontend and backend import the same confirmation-eligibility function. High-confidence eligible candidates pass the confirmation gate automatically but remain visible and editable before report generation.
6. Build an enriched identity graph containing website names, candidate legal names, Terms/Privacy entities, domains, email domains, people, addresses, social profiles, product categories, affiliates, identifiers, jurisdictions, and explicit relationship boundaries.
7. Build a provider plan from enriched names, geography, and industry. Provider failures are typed and non-fatal.
8. Register raw evidence, normalize supported fields, assign source tiers and verification eligibility, then exclude weak/lead-only evidence from final claims.
9. Build evidence-linked claims, reconcile matching values, preserve conflicts, separate risks from information gaps, and generate follow-up questions.
10. Generate a 20-section report with References and Evidence Register last.

The process-local store is intentionally ephemeral because no Vercel-safe database binding is configured. Research records may be lost on process restart and are not an authorization boundary. Durable encrypted storage, retention controls, and signed downloads are future work.

## Provider registry

| Provider | V1 behavior | Source tier |
|---|---|---:|
| Company website | Safe server-side crawler limited to 12 identity-relevant pages and depth 2 on the supplied/canonical domain, with robots, redirect, type, time, and size controls | 2 |
| SEC Form D | Retrieves D and D/A only after a verified CIK is present; preserves amount offered versus sold and related-person limitations | 1 |
| USAspending | Exact normalized recipient matching, award-type-group requests, weak-match rejection, and official award normalization | 1 |
| SAM.gov | Configuration and manual-verification framework; not required for report completion | 1 |
| State registries | Official search links for selected states and explicit manual-verification fallback | 1 |
| USPTO | Configuration and manual-verification framework for legal/former assignee names; founder-owned IP remains separate | 1 |
| Broad web discovery | Vendor-neutral configuration boundary; unavailable providers create no fake results | 4 |
| Market context | Planning boundary for future official industry context; proxies cannot become company revenue or TAM | 1 |

Optional server variables are `SAM_API_KEY`, `USPTO_API_KEY`, and `PRIVATE_DILIGENCE_WEB_PROVIDER`. `SEC_USER_AGENT` remains applicable to shared SEC access. USAspending and company-site research require no API credential. Never put credentials in URLs, evidence, exports, diagnostics, or browser-visible responses.

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

Company-site requests are server-side, accept HTTP/S only, reject credentials and unsupported ports, resolve DNS before each request, block loopback/private/link-local/reserved addresses, reject cross-domain redirects, enforce a maximum of 12 pages and depth 2, respect applicable robots rules, validate response type/size, enforce timeouts, and use manual redirects. The crawler does not bypass login, CAPTCHA, or download arbitrary attachments. Only public business-role information needed for entity resolution is retained in the ephemeral record. Sensitive personal details, raw secret-bearing URLs, request headers, stack traces, and API responses are not published.

## Current limitations and future work

- Website-only resolution depends on identity signals actually exposed by the site. If no name or identity signal is extractable, Clara requests a company name, location, or founder rather than fabricating a candidate.
- Name-only candidate discovery needs a configured broad-web provider or an official identifier; V1 asks for a website, location, or founder when identity remains unresolved.
- SEC Form D is available only after a verified CIK is discovered; absence of Form D is not evidence that financing did not occur.
- SAM, USPTO, many state registries, licensing, and comprehensive litigation research require credentials, reviewed adapters, or manual verification.
- Public websites do not establish audited revenue, valuation, beneficial ownership, customer concentration, security posture, or complete litigation history.
- Future phases may add durable storage, document-room diligence, reviewed litigation providers, additional state adapters, and industry-specific verification packs.

Run focused validation with `node --test tests/clara-private-diligence.test.mjs`. After `pnpm build`, run website-first validation with `node scripts/validate-clara-website-first.mjs` and the broader three-company report validation with `node scripts/validate-private-diligence.mjs` in a network-enabled environment.
