# Clara Evidence Verification & Uncertainty Layer

This change governs new research with `VerificationResult.status`: `verified`, `unverified`, or `rejected`. It does not treat source attribution (CompanyReported, PubliclyReported, officialRecord) as verification. Existing SEC `decision: unresolved` is the compatibility spelling of shared `unverified`, not another approval mechanism.

## Deterministic rules

| Domain | Verified | Unverified | Rejected |
| --- | --- | --- | --- |
| Entity association | Confirmed company-owned original page, attributable original independent record, or deterministically verified SEC issuer | Plausible relationship lacking support | Wrong entity, contradictory company domain, invalid original provenance |
| SEC | Existing strong legal-name match **and** an existing meaningful identity corroborator, without unresolved conflicts | Plausible legal name with missing corroboration or unresolved address/affiliate conflict | Wrong legal entity, supported domain mismatch, wrong original filing issuer |
| Funding | Each original field independently supported and attributed; amounts require understood meaning; explicit valuation can retain unknown pre/post-money basis | Missing field support, unknown amount meaning, conflicting comparable amounts, provisional issuer association | Wrong financing subject, wrong evidence/URL/excerpt association |
| People | Explicit person + role + company; founder requires founder wording; former roles remain historical; current statements are bounded to source time | Unclear role, date context, or conflicting statements | Other company's executive, unrelated author/speaker, wrong company |
| Hiring | Successful count-consistent snapshot from a confirmed company career source or supported ATS board, with matching job ownership | Unconfirmed board or incomplete snapshot | Wrong company/job/ATS tenant |
| Recent events | Supported target event plus dated original source or explicit valid ISO event date | Unclear subject, event, or timing | Hard entity/provenance mismatch |
| Legal relationships | Reuses original company-owned legal-source analysis; explicit ownership relationship is a relationship fact, not a primary issuer selection | Ambiguous primary entities or relevant unbound legal name | Unsupported subsidiary/advisory/lending entity as primary identity, irrelevant entity mention |

SEC corroborators are unchanged: official domain, sufficiently complete business address, two supported full related-person names, supported first-party legal-entity statement, or dated consistent historical identity evidence. No state-only, brand-only, city-only, search-snippet, or one-common-person shortcut was added. Explicit domain contradictions are now rejected instead of remaining unresolved.

Source-reported verification means the relevant deterministic evidence rule passed. It is not independent auditing of an issuer's statements.

## Enforcement and display

`verification/rules.ts` evaluates domain support; `governance.ts` creates an audit ledger and a separate canonical projection. The engine passes only verified claims, fields, evidence, and supported hiring snapshots to report builders. Untested page summaries, raw people arrays, rejected claims, and provisional funding fields cannot bypass that projection. Confirmed brand/display identity stays unchanged.

Canonical funding never sums round amounts, cumulative funding, offering totals, and amounts sold. A partially supported event retains its verified fields; unsupported valuation/amount fields remain only in the ledger and warning section. Normal visualization adapters and the detailed funding component also filter explicit non-verified metadata. CSV/XLSX registers distinguish governance status from legacy attribution.

`ClaraUnverifiedInformation.tsx` uses the existing amber design tokens and shows only actual, plausible, source-backed unverified items. It groups funding, SEC, people, hiring, identity and recent findings, provides reasons/missing corroboration and expandable source excerpts/timestamps, and excludes rejected records. Email contact details are redacted in this presentation. Markdown retains a separately labeled unverified section; normal sections never receive those facts. Retrieval/publication dates are labeled separately from event time.

The real funding path opts into bounded provisional Form D retrieval. A matching legal-name candidate can retrieve at most the existing filing/candidate caps; its original XML still must match the candidate issuer. New original evidence can satisfy the **unchanged** identity rule. Otherwise parsed fields remain provisional. Direct callers retain the previous strict default unless they explicitly opt in. The existing SEC client, rate limiter, identifying User-Agent and Form D parser remain in use.

## Harness, state, and history

`researchStateStore.recordToolExecution` ignores supplied verification labels and recalculates outcomes from server-side original evidence. ResearchState stores findings with evidence references/excerpts (not another copy of full raw documents), separate from canonical facts. Planner context separates verified, unverified and rejected findings; the strict planner action schema provides no status-changing action.

Unverified findings create durable `verification:<finding id>` gaps. Generic successful retries and model-requested resolved codes cannot resolve them. A later deterministic verified/rejected decision resolves the gap and appends previous status, next status, reason codes, evidence IDs, timestamp and execution ID. Stable finding IDs avoid the ordering-dependent `claim-1` identity. Disproving an issuer also downgrades its older dependent filing findings even if no new document is fetched; issuer approval alone cannot promote an old field without field evaluation. Earlier executions remain unchanged. No private reasoning is stored.

Existing `state_json`, `metadata_json`, and report/request JSON hold this metadata; no database schema migration or destructive rewrite was introduced.

## Before / after

- Name-only SEC candidate: previously no original Form D read; now bounded original retrieval, with provisional fields in amber unless original evidence independently satisfies existing identity rules.
- Verified round / unsupported valuation: previously both could share a source attribution; now only the supported round fields reach normal funding views, while the valuation stays provisional.
- Wrong-company SEC record: audit decision retained; neither ordinary report nor amber panel displays its financial facts.
- Historical executive: explicit former-role qualifier is retained and cannot populate current executive arrays.
- Later issuer contradiction: earlier field observations remain in execution history, but current ResearchState no longer lists them as verified facts.

## Fresh validation — 2026-09-18 UTC

See `clara-evidence-verification-live.json` for request IDs, precise URLs, per-stage checks and redacted outbound observations. All HTTP requests used an isolated temporary SQLite database via the existing local diagnostic launcher, never a production connection. No CIK/legal-name/financing fact was injected into the live requests.

| Case | Actual result |
| --- | --- |
| Mercury | Automatic CIK `0001719932`; submissions and three original XML filings returned HTTP 200. Name plus two supported full related-person names verified the issuer after original-document retrieval. Three SEC offerings reached normal report fields/timeline, separate from round funding. |
| Cohere | Discovery returned `0001874178` (Rivian Automotive) and `0001851745` (Cohere Health). Both submissions returned 200, but both candidates were rejected for identity conflicts. Zero original Form D requests for these candidates; zero SEC offering facts in the report. |
| Glean | Discovery returned `0001086222`, rejected by identity checks. No SEC offering entered the report. Actual leadership/legal-name uncertainty appeared in the amber UI. This is **not** a live provisional SEC success case. |
| Stable provisional SEC fixture | Real provider → original XML parser → governance → Quick builder → application store → new process → report GET. Name-only issuer stays unverified, XML amount appears in amber, normal funding events/timeline remain empty. No manual database-row edits. |

Final-code read-only re-evaluation of the saved original sources preserved all three canonical claim/field sets and decision counts, without modifying stored reports. All three live reports were byte-identical to the report GET response after persistence. Confirmed identities were unchanged; all canonical claims and funding fields carried verified decisions; normal timeline events were verified; execution history persisted. Every observed SEC request declared the existing explicit environment User-Agent; its actual value/contact was not recorded. No fabricated identity was used.

Browser checks used the actual Glean workflow: warning content, expand/collapse, original source link, English/Chinese switching, and 390px responsive layout. Document width remained 390px with no horizontal overflow.

## Legacy behavior and remaining limitations

- Historical reports without verification metadata retain their existing rendering. They are **not** silently upgraded or supplied with invented history; exports explicitly say `Legacy: not evaluated`. Fresh research is required for current governance.
- No live provisional SEC example was obtained in the bounded runs; that branch is covered by stable original-document fixtures and durable reload tests, not claimed as live success.
- Conservative attribution can leave duplicate/overlapping extracted statements with different outcomes when their own evidence differs. Missing support is never filled from model memory.
- Search candidate quality, access failures, extraction timeouts and finite request budgets remain limitations. Cohere/Glean demonstrate discovery/identity failures, not SEC connectivity failures.
- Temporal interpretation stays conservative: source dates never become event dates; explicit ISO event dates are recognized, while other date phrasing remains in the original excerpt rather than guessed.
- No new providers, RAG, vector store, financial inference, production configuration, commits, pushes or deployment were added.

## Changed file groups

- Shared verification: `site/app/lib/private-diligence/verification/{types,rules,governance,presentation}.ts`.
- SEC flow: `entity-resolution/secIssuerResolution.ts`, `providers/secFormDProvider.ts`, `providers/providerTypes.ts`, `funding/research.ts`.
- Canonical reports: `engine.ts`, `evidence/evidenceRegistry.ts`, `reports/{quickReportBuilder,reportBuilder,claraVisualization}.ts`, shared claim/funding/hiring/research types.
- Harness/history: `state/{researchStateStore,researchStateReducer,types}.ts`, `tools/types.ts`, `agent/{plannerContext,types}.ts`, `modelRouter.ts`.
- Presentation: `site/app/{ClaraUnverifiedInformation,ClaraFundingResearch,ClaraPrivateDiligenceWorkflow}.tsx`, `globals.css`, private-diligence export route.
- Regression: `clara-verification.test.mjs`, `clara-verification-persistence.test.mjs`, original-document fixtures; existing SEC tests updated only for explicit hard-rejection semantics and test-loader dependency wiring.

## Final validation commands

| Command | Result |
| --- | --- |
| `npm test` | PASS — 304 tests, zero failures (existing 281 plus 23 focused regressions) |
| `npm run lint` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run vercel-build` | PASS — optimized Next build and TypeScript completed |
| `git diff --check` | PASS |

The build retains the pre-existing dynamic-dependency warning in `hiring/playwrightFallback.ts` and the Node module-registration deprecation warning; neither failed the build. Local server/browser sessions were stopped after verification. Unrelated pre-existing worktree edits were preserved.
