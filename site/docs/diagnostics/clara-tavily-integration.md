# Clara shared-search validation

Validation completed 2026-09-18 UTC. Machine-readable proof: [clara-tavily-live.json](clara-tavily-live.json).

## Reused boundary and files

- Added `app/lib/private-diligence/search/sharedSearch.ts`: server-side adapters, deterministic router, run-local health/cache, attempt diagnostics and accounting.
- Extended `providers/serpApiWebSearchProvider.ts`: compatibility facade and unchanged secure original-page extraction; actual discovery provenance attached separately.
- Extended `engine.ts`, `funding/research.ts`, `funding/budget.ts`, `tools/fundingSearchTool.ts`, `tools/webResearchTool.ts`, `tools/types.ts`: shared run session and actual-attempt funding reservations. Existing SEC CIK discovery uses the same facade; no new issuer discovery added.
- Extended `providers/providerTypes.ts`, `types.ts`: persisted search diagnostics; no database migration required.
- Updated `planning/quickResearchPlanner.ts` display label, retaining provider IDs.
- Added `tests/clara-shared-search.test.mjs`; updated the existing SerpApi test loader and isolated its configuration from ambient Tavily settings.
- Updated `.env.example`, `site/README.md`, `site/docs/clara-private-diligence.md`, and these diagnostic artifacts. No secret/environment values changed.

## Live setup and request counts

Normal `@next/env` loader confirmed `TAVILY_API_KEY` present. Actual Next runtime independently recorded presence only. Isolated child process used `CLARA_SEARCH_PRIMARY=tavily`; `.env.local` was not edited. Both remote database credentials and URLs were removed from that child process; a fresh local SQLite database was created by the existing diagnostic launcher. Local server has been stopped.

One bounded standalone Tavily query returned HTTP 200, two normalized original URLs, and 1 reported credit. One fresh **Abaka AI** run then completed candidates → explicit confirmation → run → report → independent database reload. This is a real Tavily run, not a simulated live SerpApi quota test. No live SerpApi request was made; failure/fallback behavior is covered by mocked tests.

| Scope | Real successful Tavily calls | Reported credits |
|---|---:|---:|
| Standalone connectivity | 1 | 1 |
| Abaka generic web research | 6 | 6 |
| Abaka funding (2 routine + 1 model-selected follow-up) | 3 | 3 |
| Total | 10 | 10 |

There was also one initial sandbox-restricted transport attempt with no provider response (`upstreamUnavailable`). Billing was not reported; the router labelled its cost as an estimate of 1 credit. It is not included in the 10 provider-confirmed credits and is not assumed free. Network-enabled validation subsequently succeeded.

## Evidence and persisted report

Research ID: `b54d82c2-1554-4a54-a577-7136bf4c893d`.
All five endpoint checks returned 200. Report API content exactly matched a separate database read; confirmed identity graph was unchanged. Re-running the completed request returned `alreadyComplete: true`; tool executions stayed **4 → 4**.

14 retrieved evidence records carry actual `searchProvider: tavily`; 24 report claims reference at least one of these records (including claims also corroborated by direct company pages). This counts provenance links, not independently verified truth.

Two concrete persisted paths:

1. Tavily → `https://www.abaka.ai/team` → original company page evidence `serpapi-…-3` → product/service claims including `data collection` → Quick Business and Products section. Original publisher attribution and Company Reported status are retained.
2. Tavily → `https://www.forbes.com/profile/jack-lin/` → original Forbes page evidence `serpapi-…-6` → `claim-28` (`funding.amount: 20000000`), `claim-29` (`funding.amountMeaning: cumulative`), `claim-30` (`eventStatus: unknown`) → persisted Funding research section. Currency and article publication date remain unspecified; this was not relabelled as a current round.

The legacy `serpapi-…` evidence prefix is retained for compatibility. Original page title/URL identifies the publisher; `searchDiscovery` and provider-attempt diagnostics identify Tavily. Search snippets were excluded before RawEvidence creation.

## Limits and unrelated findings

Only one company was run; the 10-company benchmark was not repeated. CIK discovery was not reached live because Abaka has no confirmed legal name; SEC remains `issuer_unresolved`, with zero SEC requests and zero Form D retrievals. Existing CIK search routing and strict site/path filtering are covered with mocked transport; this is not a claim of successful live issuer resolution.

Funding used search=3, fetch=6, SEC=0, model=3. The existing source-fetch cap was reached. Some source responses were blocked, irrelevant to the selected entity, or lacked usable text; search results were not substituted as facts. Legal identity gaps, article extraction quality, funding-round/qualifier issues from the prior benchmark, and the existing Playwright dynamic-import build warning remain separate from search availability.

No commit, push, deploy, production data change, paid-plan change, or secret modification was performed.

## Final checks

- `npm test`: **231/231 passed**, including 18 shared-search tests and existing Clara identity, SEC, hiring, funding, Quick/Deep and other-agent regressions.
- `npm run lint`: passed without warnings.
- `npx tsc --noEmit`: passed.
- `npm run vercel-build`: passed; existing hiring Playwright dynamic-import warning and Node's existing `url.parse` deprecation notice remain.
- `git diff --check`: passed.

The live run preceded final small safeguards for transport security-error classification, shorter-deadline in-flight waiters, and restored six-second funding search timeout. Those safeguards were tested with mocked transport in the final full suite; no extra paid live run was launched merely to repeat already-proven source/persistence behavior.
