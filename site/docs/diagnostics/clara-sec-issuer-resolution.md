# Clara SEC issuer resolution

## Scope and previous behavior

The Quick API locks the user-selected candidate, builds the existing EntityIdentityGraph,
then runs funding research. Previously `verifySecIssuer()` returned a boolean: a normalized
exact legal name plus either the SEC website domain or business street/postal address had
to match. Missing website/address blocked otherwise plausible candidates without retaining
an issuer-specific decision audit.

The existing graph contains legal names separately from display names/aliases, domains,
addresses, founders/executives/directors, related entities and identity evidence IDs.
Website evidence also contains original text, typed pages and structured identity fields.
Wikipedia/Wikidata discovery currently contributes website/name discovery leads and source
IDs, not reliable structured street addresses or officer records. No new identity system or
LLM verification authority was introduced.

## Deterministic rule

`resolveSecIssuer` requires exact normalized supported legal-name agreement AND an eligible
corroborating signal, with no identity contradiction. Corporate suffixes are preserved.
Decisions are `verified`, `unresolved`, or `rejected`, with matched/conflicting reason codes,
CIK, issuer name, timestamps and evidence references containing URL, locator and excerpt.

Eligible corroboration:

- Exact official-domain agreement; original-document email/domain must be issuer-scoped,
  not an agent or unrelated person's contact information.
- Complete street-number/street/postal agreement with existing graph evidence. Explicitly
  labeled first-party legal/contact/about-page addresses are also collected from already
  retrieved text when structured website extraction missed them. City alone is insufficient.
- Two distinct full related-person names matching supported founders/executives/directors;
  one person, or repetition of one person, is insufficient.
- An explicit first-party legal entity statement on the confirmed domain, with operational
  or privacy-policy wording. A bare name, third-party mention, customer or affiliate context
  cannot qualify.
- Multiple dated, distinct original filings agreeing with supported addresses. Dates remain
  attached; conflicting newer or older records prevent silent acceptance.

All domain/address/affiliate conflicts override positive corroboration. A clear different
legal name is rejected; ambiguous associations remain unresolved. Source addresses are not
silently classified as current offices; an unexplained mailing/business discrepancy is
conservatively unresolved.

Original filing signals are used only from already-retrieved evidence or after initial
verification. An unresolved candidate never triggers an original-document request. Verified
candidates use the existing D/D-A selection/parser. Retrieved documents are rechecked before
any funding evidence is published. Retrieval, parsing and post-fetch identity conflicts have
separate downstream stage/error fields.

Associations live in `PrivateProviderResult.secIssuerAssociations` and
`FundingResearch.issuerAssociations`, persisted by the existing request/report JSON store.
They do not overwrite the confirmed Identity Graph. No database schema migration is needed.
Leading-zero CIK variants are normalized before deduplication and the existing two-candidate,
three-recent-filing and request-budget limits remain in place.

## Final live validation (2026-09-17 Pacific / 2026-09-18 UTC)

Actual HTTP paths: candidates → confirm-entity → run → report. A newly created isolated
SQLite database was used. No CIK, legal name, funding fact or matching outcome was injected.
The configured identifying User-Agent was observed on SEC calls without recording its value.

- Cohere request `b8d8e9ee-190f-466d-b3e5-9d57cc3e52c0`: automatic discovery found
  CIK 0001798355; SEC submissions returned 200. Legal name and official privacy statement
  matched. However, the official privacy page explicitly gives 171 John Street, Suite 200,
  Toronto, ON Canada M5T 1X3, while SEC lists 530 E. McDowell Road #107412, Phoenix AZ 85004.
  This yields `business_address_conflict`, `identity_conflict`, and `unresolved`. There was
  one SEC request, zero original filing requests and zero SEC funding events in the final
  persisted report. An explanation of the entity/address relationship or a better-supported
  issuer candidate is still required; the implementation does not infer either.
- Abaka AI request `793c6d23-9a8f-47a9-a808-df2aba03d593`: no supported legal name or candidate
  CIK, zero SEC calls, empty association list and `issuer_unresolved`. No fabricated CIK.
- Both reports completed, retained one announcement event, survived a fresh database
  connection, and matched the report GET response exactly. Confirmed graphs were byte-for-byte
  equal to the confirmation responses; field evidence links and association audits persisted.

An exploratory intermediate implementation accepted the Cohere name/privacy statement and
fetched three original D/D-A documents (all HTTP 200), then parsed field evidence into its
isolated report. Reviewing those results exposed the previously uncollected Toronto/Phoenix
address discrepancy. That intermediate report is NOT accepted as a validated target/issuer
association. The final implementation adds the sourced address conflict check and excludes
those filings. A separate first exploratory request failed in candidate search before any SEC
call. Final results above are from fresh requests after these corrections.

Therefore the final live result is safe unresolved identity, not a successful live Form D
association. The verified-issuer → parser → field evidence → Quick report path is covered by
fixtures. The old-address/new-address conflict rule is deliberately conservative; relocation,
multiple offices and parent/subsidiary relationships require explicit evidence, not inference.
The current text address recognizer is limited to explicit English labels and US/Canadian
postal formats. Existing structured graph addresses continue to be supported. This work does
not add historical crawling, Wikipedia identity enrichment or new announcement extraction.

## Files and validation

- `app/lib/private-diligence/entity-resolution/secIssuerResolution.ts`: decision/evidence rules.
- `app/lib/private-diligence/providers/secFormDProvider.ts`: bounded integration, audit and CIK deduplication.
- `app/lib/private-diligence/providers/providerTypes.ts`: preserve audit even on downstream failure.
- `app/lib/private-diligence/types.ts`, `funding/types.ts`: optional association audit fields.
- `app/lib/private-diligence/funding/research.ts`: pass existing evidence, retain association audit,
  distinguish failed candidate discovery from SEC retrieval.
- `tests/clara-sec-issuer-resolution.test.mjs`: 16 focused decision/integration regressions.
- `tests/clara-private-diligence.test.mjs`: update its module loader for the new dependency.
- This document and `clara-sec-issuer-resolution-live.json`: final live validation record.

Validation: `npm test` 213/213; `npm run lint`; `npx tsc --noEmit`;
`npm run vercel-build`; `git diff --check`. All passed. The existing dynamic-dependency
warning from the hiring Playwright fallback remains in the production build.
No commit, push, deployment or production configuration/data changes.
