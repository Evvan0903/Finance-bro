# Clara V1 developer diagnostic report

Validation date: 2026-08-05

This report records sanitized validation outcomes only. It contains no API keys, raw response bodies, request headers, local paths, or hardcoded production findings.

## Candidate-selection state validation — 2026-08-21

The reported Abaka confirmation failure did not reproduce in the pre-fix local build: clicking the candidate card's embedded Confirm action reached the backend and generated a report. Inspection nevertheless confirmed that the UI had no independent selected-candidate state. Displaying a candidate and confirming it were conflated, one result was not visibly selected, and confirmation captured a candidate object rather than deriving its payload solely from a selected ID.

Confirmed categories: **A** and **C**. Category **D** was a structural risk but not observed as a stale request. Categories **F**, **G**, **H**, and **I** were not reproduced.

After the minimal fix, the sanitized Abaka browser trace was:

| Field | Value |
|---|---|
| `researchRequestId` | `97750122-74e9-4093-b4e3-2aa86a40f81a` |
| `candidates.length` | `1` |
| `candidateId` | `bd809464-9781-4544-ae3d-65048be1d037` |
| `candidate.researchRequestId` | `97750122-74e9-4093-b4e3-2aa86a40f81a` |
| `selectedCandidateId` | `bd809464-9781-4544-ae3d-65048be1d037` |
| Explicit confirmation | `true` |
| Ownership comparison | `true` |
| Confirmation / research / report | Pass / Pass / Pass |

One candidate was visibly Selected before confirmation, and the separate Confirm target company button was enabled. The request candidate ID equaled the selected candidate ID. The backend loaded the same request and candidate IDs and retained the ownership gate.

The deterministic multiple-candidate regression uses three candidates, starts with no selection, selects the second ID, and builds the confirmation payload only from that ID. No-selection, stale-object, cross-request, and malformed-candidate cases are covered. A natural multi-candidate public response was not available from the current conservative discovery path, so no production discovery data was fabricated for browser testing.

Validation: 27 focused tests and 120 full-suite tests passed, together with ESLint, TypeScript, Vinext build, Vercel-compatible build, and `git diff --check`. No manual deployment was performed.

## Company discovery and target-selection validation — 2026-08-20

The blocking path was the reuse of legal-identity verification rules as target-selection rules. A name-only request could produce a candidate, but missing website/legal name/location/people or a Low score prevented the candidate route, UI, confirmation API, and engine from agreeing that the user could select it.

Target selection now requires a structurally valid, server-owned candidate with request-bound provenance that is not rejected or likely unrelated. It does not assert that the legal identity is verified. Automatic selection still uses strong evidence thresholds; explicit user selection preserves the original confidence and records verification separately.

| Scenario | Result | Key outcome |
|---|---|---|
| Name only, public lookup unavailable | Pass | Server-bound Low-confidence discovery lead remained unverified, was explicitly selectable, and produced a Limited Quick brief with no fabricated claims |
| Name plus official website | Pass | Medium 65-point candidate remained incomplete but selectable; confirmation started research and produced a Strong Quick brief |
| Low/Medium/High eligibility parity | Pass | Shared frontend and backend rules agreed for every confidence level |
| Candidate from another request / tampered ID | Pass | Rejected before Identity Graph construction |
| Rejected or likely unrelated candidate | Pass | Not selectable |
| Valid selected target with no eligible evidence | Pass | Quick mode returned explicit information gaps rather than a false failure or unsupported claim |

Sanitized confirmation diagnostics record controlled status/confidence fields, score, selection eligibility, frontend/backend parity, target-selection outcome, and whether the research session was created. They exclude provider bodies, raw URLs, secrets, stack traces, and personal data.

Manual browser validation covered name-only and name-plus-website paths. Both advanced from candidate selection directly into Quick research; no stale additional-identifiers message appeared. Live website-first validation also passed company-name-only discovery and report generation. No manual deployment was performed.

Automated validation: 21 focused tests passed, 114 full-suite tests passed, and ESLint, TypeScript, Vinext build, Vercel-compatible build, and `git diff --check` passed.

## Website-first resolution validation

| Scenario | Result | Key outcome |
|---|---|---|
| Website-only Abaka AI | Pass | Abaka AI derived from the live site; Medium, 65/100; confirmation and report generation completed |
| Website-only second private company | Pass | Live Anthropic site produced an enriched High-confidence candidate |
| Company-name-only | Pass | Requested additional identity information without fabricating a candidate |
| Mismatched name and website | Pass | Preserved the supplied name and surfaced the website-organization mismatch |
| Unreachable website | Pass | Returned a concise identity-information request without technical details |
| Low-information website | Pass | Preserved unresolved identity fields instead of inferring unavailable facts |

All website-derived evidence remained Company Reported. The frontend and backend used the same confirmation helper, and a valid explicit confirmation proceeded without the former generic confirmation error.

## Real-source scenarios

| Profile | Company | Identity | Coverage | Evidence | Claims | Gaps | Questions | Result |
|---|---|---|---|---:|---:|---:|---:|---|
| Venture-backed technology | Anthropic PBC | Medium | Moderate public-source coverage | 8 | 12 | 6 | 6 | Pass |
| Government contractor / construction services | Turner Construction Company | Medium | Strong public-source coverage | 31 | 132 | 6 | 6 | Pass |
| Small company with limited public information | Pine Park Health | Medium | Limited public-source coverage | 4 | 4 | 6 | 6 | Pass |

All three runs used the real company websites and the live official USAspending endpoint. The reports kept company website claims labeled Company Reported, excluded weak matches, linked every claim to evidence, placed References last, used sanitized clickable HTTPS references, and avoided exact revenue, valuation, ownership, litigation, or investment conclusions.

Provider outcomes varied by entity. Company website retrieval succeeded in all three cases. USAspending returned one exact Anthropic record, 25 exact Turner records, and no exact Pine Park record; nine weak Turner recipient matches were rejected. SAM and USPTO were not configured. State registry, market context, and broad-web discovery used explicit manual/unavailable statuses. No unavailable provider blocked the company-site report.

## Automated validation

- Clara-focused tests: 14 passed, 0 failed
- Full automated suite: 107 passed, 0 failed
- TypeScript: passed
- ESLint: passed
- Vinext production build: passed
- Next.js/Vercel-compatible production build: passed
- `git diff --check`: passed
- Shared Ethan XLSX regression: passed after correcting byte-range response handling
- Browser QA: English and Chinese at 390px and 1440px, no horizontal overflow
- Live report QA: Pine Park Health generated with 10 evidence-supported sections and four final clickable references
- Export QA: Markdown, CSV, and XLSX returned valid attachment MIME types and non-empty files; PDF completed with the Clara footer and no browser errors

No manual Vercel deployment was performed.
