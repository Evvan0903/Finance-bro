# Clara mostly-empty report diagnosis

## Result

The reported symptom was **partially reproduced** in a live local browser run of the current Quick Company Intelligence workflow. Clara found and fetched substantial public material, but most useful company facts did not survive the extraction and report-assembly path. Hiring was the clearest successful exception.

Tested target: Abaka AI (`https://abaka.ai/`). The browser flow completed candidate discovery, explicit user selection, confirmation, planning, research, and report rendering. The run used an isolated local SQLite database and the application's normal provider configuration. Research ID: `80d6fba3-aefb-4826-8f78-ed7f5e11e0a3`.

## Active runtime path

The public workflow calls:

`/workflows/company-intelligence` → `/api/private-diligence/candidates` → `/confirm-entity` → `/plan` → `/run` → `runPrivateDiligence`

The Tool Registry, agent planner, ResearchState, and coverage-evaluator modules exist, but they are not part of this user-facing Quick execution path. No LLM planner or LLM report writer was invoked in this baseline. Candidate resolution used the supplied official website, so DeepSeek candidate ranking was not invoked. The report was assembled deterministically.

Configured provider keys were present for the providers used by this path. No secret value was printed. Remote Turso variables were not used because the diagnostic deliberately used isolated SQLite. The optional Playwright browser executable was unavailable, but this did not block the official static pages, SerpApi original-page fetches, or Greenhouse adapter used in the run.

## Compact runtime result

| Company | Sources discovered | Pages fetched | Evidence extracted | Facts shown in report | Main failure stage |
|---|---:|---:|---:|---|---|
| Abaka AI | 15 original web sources plus 9 ATS job records | 15 original HTML pages; ATS via Greenhouse adapter | 24 raw / 23 normalized / 16 claims | 16 claims, but only 3 claim types; 9-role hiring count shown | Visible-page extraction, then normalization/claim mapping |

Provider outcomes: company website `success` (8 evidence), SerpApi `success` (7 evidence), Greenhouse `success_with_jobs` (9 records), USAspending `upstreamUnavailable` (0), SEC Form D skipped because no verified CIK existed. The USAspending result is not interpreted as proof that Abaka has no government business.

## Confirmed root causes

1. **Visible product, service, and leadership text is not mapped into structured fields.** `extractCompanyPage` retains body text, but products and services are populated only from JSON-LD objects whose exact type is `Product` or `Service`; executives depend on JSON-LD `Person` records. Runtime evidence: the fetched official data-collection page contained 1,884 characters and explicit service language, yet returned `products=[]` and `services=[]`; the fetched team page contained “Tom Tang CEO,” yet returned `executives=[]`. See `app/lib/private-diligence/extraction/htmlExtractor.ts`, `extractCompanyPage`, lines 118–180. **Confidence: confirmed.**

2. **Normalization discards the raw page text, and the claim mapper accepts only a narrow set of business facts.** `normalizeEvidenceRegistry` copies scalar and string-array values from `structuredData` but not `rawText`. `buildClaimRegistry` emitted 16 claims consisting only of 10 descriptions, 5 legal names, and 1 founder; it has no service, customer, partner, recent-activity, or hiring claim mapping. See `app/lib/private-diligence/evidence/evidenceRegistry.ts`, lines 11–38, and `claimRegistry.ts`, lines 8–34. **Confidence: confirmed.**

3. **The report can count topic-tagged sources as coverage without producing topic facts.** `sourceParagraphs` writes source titles and `sourceSummary` text; customer/partner and recent-activity sections are assembled from search-topic membership rather than attributable relationship/event claims. In the observed UI those topics appeared covered with two evidence items each, but contained no customer, partner, or event fact. The overall report said `Strong public-source coverage` despite empty product, service, customer, and partner arrays. See `app/lib/private-diligence/reports/quickReportBuilder.ts`, lines 36–66 and 137–195. **Confidence: confirmed.**

## Concrete missing-fact path

The official page `https://www.abaka.ai/services/data_collection` was discovered and fetched successfully. Its raw text says Abaka offers data collection, data cleaning, and data annotation and includes “Global Data Collection at Scale.” `extractCompanyPage` retained the sentence in `bodyText` but produced empty product and service arrays. `normalizeEvidenceRegistry` then omitted `bodyText`; `buildClaimRegistry` had no service seed; the report's `businessModel.services` remained empty. The page appeared only as a generic reviewed-source description, not a structured service fact.

## Smallest recommended fix (not implemented)

Extend the existing HTML extraction boundary—not the architecture—to derive conservative, evidence-linked `services`, `products`, and `executives` from explicit headings and nearby visible text on official pages. Preserve the source excerpt or a bounded fact candidate through normalization. Then add corresponding service/executive claim seeds and make section coverage depend on attributable facts rather than search-topic tags alone.

The first regression test should pass a fixture containing a `/services/...` heading and an explicit “we provide …” sentence through `extractCompanyPage` → `normalizeEvidenceRegistry` → `buildClaimRegistry` → `buildQuickCompanyIntelligenceReport`, and assert that:

1. the service appears as a source-linked claim;
2. the Business and Products section contains it;
3. unrelated nearby navigation text is not extracted as a service; and
4. a topic is not marked covered solely because a search lead was tagged for that topic.

The current behavior is recorded separately in `diagnostics/clara-content-loss.test.mjs`; it is not part of the normal test suite and should be replaced when the defect is fixed.

## Secondary diagnostic limitations

- SerpApi per-URL fetch exceptions are swallowed in `fetchDetails`; successful evidence is retained, but failed URLs and rejection reasons are not preserved. Therefore exact discovered-lead count, per-page HTTP status, and failed original URLs are unknown for this run.
- The candidates route maps every exception to `INVALID_PRIVATE_COMPANY_INPUT`. A separate vinext-local attempt hit that generic response even though direct discovery and SQLite probes succeeded. This masks environment/database/network failures, but it was not the cause of the successful Next.js baseline's sparse report.
- No production claim is made. This run establishes a local application-code defect; it does not prove identical provider availability in the deployed environment.

## Reproduction

From `site/`, start the application against a disposable database:

```bash
CLARA_LOCAL_DATABASE_PATH=/private/tmp/finbro-clara-diagnostic.db npm run dev -- --port 3001
```

In a second terminal, run the opt-in live route diagnostic (this consumes real provider quota):

```bash
CLARA_DIAGNOSTIC_ALLOW_LIVE=1 \
CLARA_DIAGNOSTIC_BASE_URL=http://127.0.0.1:3001 \
CLARA_DIAGNOSTIC_COMPANY='Abaka AI' \
CLARA_DIAGNOSTIC_WEBSITE='https://abaka.ai/' \
node scripts/diagnose-clara-quick.mjs
```

Run the isolated defect reproduction without provider calls:

```bash
node --import tsx --test diagnostics/clara-content-loss.test.mjs
```

## Artifacts

- Sanitized trace: `docs/diagnostics/clara-abaka-quick-trace-2026-09-15.json`
- Independent reference comparison: `docs/diagnostics/clara-abaka-reference-comparison-2026-09-15.md`
- Live route diagnostic: `scripts/diagnose-clara-quick.mjs`
- Separate defect reproduction: `diagnostics/clara-content-loss.test.mjs`
