# Clara V1 public-source private company diligence

Clara is FinBro's bilingual Private Company Diligence Analyst. The V1 workflow at `/workflows/private-company-diligence` accepts a company name plus optional identity hints, requires target confirmation, and produces a formal public-source diligence report. It does not provide complete legal, financial, tax, operational, cybersecurity, ownership, litigation, valuation, fraud, background-investigation, or investment conclusions.

## Execution model

1. Validate the company name and optional website, location, founder, industry, objective, language, and report depth.
2. Discover candidates and score only independently observed identity signals. Similar names alone cannot establish identity.
3. Require user confirmation unless an official identifier and high-confidence signals support automatic confirmation.
4. Build an identity graph containing observed names, domains, people, addresses, identifiers, jurisdictions, and explicit relationship boundaries.
5. Build a provider plan from the graph, geography, and industry. Provider failures are typed and non-fatal.
6. register raw evidence, normalize supported fields, assign source tiers and verification eligibility, then exclude weak/lead-only evidence from final claims.
7. Build evidence-linked claims, reconcile matching values, preserve conflicts, separate risks from information gaps, and generate follow-up questions.
8. Generate a 20-section report with References and Evidence Register last.

The process-local store is intentionally ephemeral because no Vercel-safe database binding is configured. Research records may be lost on process restart and are not an authorization boundary. Durable encrypted storage, retention controls, and signed downloads are future work.

## Provider registry

| Provider | V1 behavior | Source tier |
|---|---|---:|
| Company website | Safe server-side crawler limited to the confirmed domain, robots rules, approved content types, bounded redirects, time, and size | 2 |
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
- Official, independent, company, inferred, conflicting, outdated, and unverified statuses remain distinct. Conflicts are recorded; no source is silently discarded merely because values differ.

Missing public information produces an information gap, not a misconduct inference. Risks require evidence or a clearly labeled identity/conflict limitation. Follow-up questions name the evidence a human diligence team should request.

## Report and exports

The report covers executive summary, entity identification, legal profile, business model, management, financing, operating footprint, commercial evidence, government activity, IP, licensing, litigation limits, market context, competitive positioning, risks, conflicts, gaps, questions, methodology, and references. Unsupported empty analytical sections are omitted.

Exports include Markdown, PDF, evidence CSV/XLSX, claim CSV/XLSX, and risk CSV. Spreadsheet values are formula-injection protected. Public links and text are redacted for credential query fields and local filesystem paths. The PDF uses the shared formal renderer and Clara-specific footer; loading text and provider diagnostics stay outside formal exports.

## Security and privacy

Company-site requests accept HTTP/S only, reject credentials and unsupported ports, resolve DNS before each request, block loopback/private/link-local/reserved addresses, reject cross-domain redirects, enforce response type/size/time limits, and use manual redirects. Only public business-role information needed for entity resolution is retained in the ephemeral record. Sensitive personal details, raw secret-bearing URLs, request headers, stack traces, and API responses are not published.

## Current limitations and future work

- Name-only candidate discovery needs a configured broad-web provider or an official identifier; V1 asks for a website, location, or founder when identity remains unresolved.
- SEC Form D is available only after a verified CIK is discovered; absence of Form D is not evidence that financing did not occur.
- SAM, USPTO, many state registries, licensing, and comprehensive litigation research require credentials, reviewed adapters, or manual verification.
- Public websites do not establish audited revenue, valuation, beneficial ownership, customer concentration, security posture, or complete litigation history.
- Future phases may add durable storage, document-room diligence, reviewed litigation providers, additional state adapters, and industry-specific verification packs.

Run focused validation with `node --test tests/clara-private-diligence.test.mjs`. After `pnpm build`, run the three real-source scenarios with `node scripts/validate-private-diligence.mjs` in a network-enabled environment.
