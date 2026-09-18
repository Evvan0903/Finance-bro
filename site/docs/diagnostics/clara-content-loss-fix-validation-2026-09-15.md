# Clara Quick content-loss fix validation

This document preserves the post-fix comparison. The original baseline artifacts remain unchanged.

## Live Abaka AI result

- Environment: local Next.js server, isolated SQLite database, real configured providers
- Mode: Quick Company Intelligence
- Research ID: `f5624de2-a8cd-45c1-9b6a-e534e058e03c`
- Completed route: candidates → explicit confirmation → plan → run
- Provider outcome: company website success, SerpApi success, Greenhouse success, USAspending upstream unavailable, SEC Form D not selected
- Evidence: 23 normalized records
- Claims: 30 across description, legal name, founder, product, service, executive, and executive-role types

| Area | Before | After |
|---|---|---|
| Services | Empty structured services; source description only | Company-reported data collection, data cleaning, and data annotation appear as evidence-linked service claims and in Business and Products |
| Leadership | Team page fetched, but Tom Tang was absent | Tom Tang — CEO, Yunfei Zhao — Chief Operating Officer, and Zihan Wang — VP of Research appear as company-reported executive-role claims |
| Customer/partner coverage | Topic-tagged pages appeared covered without attributable facts | `covered=false`, zero claims, zero evidence; report explicitly states that no attributable fact was established |
| Recent-activity coverage | Topic-tagged pages appeared covered without an event claim | `covered=false`, zero claims, zero evidence; no unsupported event timeline is generated |
| Hiring | Nine point-in-time roles displayed | Unchanged: nine point-in-time roles displayed without headcount or growth inference |

## End-to-end traces

Service claim:

- Value: `data collection`
- Status: `CompanyReported`
- Original source: `https://www.abaka.ai/services/data_collection`
- Locator: `meta description`
- Supporting excerpt: `Abaka AI offers data collection, data cleaning, data annotation, and high-quality datasets...`
- Evidence ID: `website-f5624de2-a8cd-45c1-9b6a-e534e058e03c-4`
- Destination: Business and Products section and source register

Executive-role claim:

- Value: `Tom Tang — CEO`
- Status: `CompanyReported`
- Original source: `https://www.abaka.ai/team`
- Locator: `Tom Tang`
- Supporting excerpt: `Tom Tang CEO`
- Evidence ID: `website-f5624de2-a8cd-45c1-9b6a-e534e058e03c-8`
- Destination: Ownership and Leadership section and source register

Neither source supplied a publication date, so no date was invented. Both candidates retain retrieval timestamps in normalized evidence.

## Generalization check

A second live Quick run used Cohere (`https://cohere.com/`), research ID `f4e3ac1e-0b4d-48e3-87d9-3bac16c1a2f8`. It did not produce spurious product, service, or executive-role claims from unrelated source text. However, the existing entity-resolution path selected a malformed canonical name derived from navigation content (`Solutions Solutions Resources...`). That is a separate pre-existing entity-resolution defect and was not changed in this focused fix. The Cohere run must not be treated as a successful end-to-end company report.

## Stable regression coverage

`tests/clara-content-pipeline.test.mjs` covers:

- visible service and person-role facts through extraction, normalization, claims, and report;
- bounded excerpt, locator, retrieval time, source URL, and evidence ID preservation;
- JSON-LD compatibility and duplicate suppression;
- navigation/footer keyword rejection;
- ambiguous person-role rejection;
- qualified historical roles;
- fact-based relationship and activity coverage;
- unchanged point-in-time hiring semantics.

`tests/clara-serpapi-provider.test.mjs` also verifies that an independent page mentioning another company cannot contribute that other company's product to the selected company.

## Validation status

- `npm test`: passed, 180/180 tests; includes a successful vinext production build
- `npm run lint`: passed
- `npx tsc --noEmit`: passed
- `npm run vercel-build`: passed; existing Playwright dynamic-import warning remains
- `git diff --check`: passed

## Follow-up: company confirmation and Cohere identity fix

The separate entity-resolution defect above was resolved in the subsequent confirmation-flow work. The confirmed cause was not the page title alone: broad legal-entity extraction and unqualified selection of the first JSON-LD/website organization name allowed navigation-shaped text to enter `displayName`, `legalName`, and aliases. Names are now selected only when their structure and relationship to the searched name, domain, or supported title provide identity context. Page titles may support a match but are not stored as DBA names.

Live validation used a local Next.js server, a fresh isolated LibSQL database, and the configured real public providers:

- Cohere with website, research ID `21badb6e-5196-410a-b6ff-42874515de74`: explicitly confirmed `Cohere` / `cohere.com`; stored legal name `Cohere Inc`; report title remained `Cohere`; run completed.
- Abaka AI with website, research ID `ceb07bd4-00a2-4cb5-b521-531e2538bd7e`: explicitly confirmed `Abaka AI` / `abaka.ai`; report retained the same identity and preserved service and leadership facts; run completed.
- Cohere name-only, research ID `dd07d9cb-1f67-4719-80a8-81ecfaaaba13`: returned two distinct candidates (`Cohere` and `Cohere Technologies`), required selection, confirmed `Cohere`, and produced a report titled `Cohere`.
- Repeating confirmation returned the existing locked target; repeating the completed run returned the existing report with `alreadyComplete=true`, without another provider execution.

Each new confirmed graph retains the selected candidate ID, confirmed display name and website, supporting identity evidence IDs, and confirmation timestamp. Existing historical records are not rewritten.
