import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function moduleUrl(path, replacements = {}) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(from, to);
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}

const copyUrl = await moduleUrl("../app/lib/private-diligence/copy.ts");
const reportUrl = await moduleUrl("../app/lib/private-diligence/reports/quickReportBuilder.ts", {
  '"../copy"': JSON.stringify(copyUrl),
});
const htmlUrl = await moduleUrl("../app/lib/private-diligence/extraction/htmlExtractor.ts");
const matcherUrl = await moduleUrl("../app/lib/private-diligence/entity-resolution/entityMatcher.ts");
const securityUrl = await moduleUrl("../app/lib/private-diligence/security.ts");
const providerUrl = await moduleUrl("../app/lib/private-diligence/providers/serpApiWebSearchProvider.ts", {
  '"../extraction/htmlExtractor"': JSON.stringify(htmlUrl),
  '"../entity-resolution/entityMatcher"': JSON.stringify(matcherUrl),
  '"../security"': JSON.stringify(securityUrl),
});
const providerTypesUrl = await moduleUrl("../app/lib/private-diligence/providers/providerTypes.ts");
const plannerUrl = await moduleUrl("../app/lib/private-diligence/planning/quickResearchPlanner.ts");

const { buildQuickCompanyIntelligenceReport } = await import(reportUrl);
const {
  buildSerpApiQueries,
  createSerpApiWebSearchProvider,
  deduplicateSerpApiLeads,
  deduplicateSerpApiQueries,
  normalizeSerpApiOrganicResults,
} = await import(providerUrl);
const { executePrivateProvider } = await import(providerTypesUrl);
const { buildQuickCompanyIntelligencePlan } = await import(plannerUrl);

function context(overrides = {}) {
  return {
    researchId: "research-serpapi",
    input: {
      companyName: "Abaka AI", website: "https://abaka.ai/", city: null, state: null,
      country: null, founderOrExecutive: null, industry: null, researchObjective: "General diligence",
      locale: "en", reportDepth: "Standard", workflowMode: "quick", quickResearchPurpose: "General Research",
    },
    identityGraph: {
      entityId: "entity-abaka", canonicalName: "Abaka AI", legalNames: [], dbaNames: [], formerNames: [],
      domains: ["abaka.ai"], emailDomains: ["abaka.ai"], addresses: [], phoneNumbers: [], founders: [],
      executives: [], directors: [], registrationNumbers: [], registrationJurisdictions: [], cikCandidates: [],
      ueiCandidates: [], cageCodes: [], samEntityIds: [], usaSpendingRecipientIds: [], patentAssigneeNames: [],
      trademarkOwnerNames: [], parentCompanies: [], subsidiaries: [], affiliatedEntities: [], socialProfiles: [],
      termsPageLegalNames: [], privacyPageLegalNames: [], productCategories: [], industryLabels: [],
      identityConfidence: "Medium", resolutionStatus: "userConfirmed", targetSelectionStatus: "userSelected",
      identityVerificationStatus: "partiallyVerified", identityLimitations: [],
    },
    now: () => new Date("2026-08-28T00:00:00.000Z"),
    ...overrides,
  };
}

test("normalizes bounded organic results and rejects malformed responses", () => {
  const results = normalizeSerpApiOrganicResults({ organic_results: [
    { position: 1, title: "Abaka AI overview", link: "https://news.example/abaka?utm_source=test", snippet: "lead only" },
    { position: 2, title: "Unsupported PDF", link: "https://news.example/abaka.pdf", snippet: "ignored" },
    { position: 3, title: "Missing URL" },
  ] }, "overviewProducts", 4);
  assert.equal(results.length, 1);
  assert.equal(results[0].url, "https://news.example/abaka");
  assert.equal(results[0].topics[0], "overviewProducts");
  assert.throws(() => normalizeSerpApiOrganicResults({ organic_results: {} }, "overviewProducts"), /malformedResponse/);
});

test("reports a missing key without attempting a request", async () => {
  let calls = 0;
  const provider = createSerpApiWebSearchProvider({ apiKey: null, fetchImpl: async () => { calls += 1; return new Response(); } });
  assert.equal(provider.isConfigured(), false);
  assert.equal(provider.validateConfiguration(), "invalidConfiguration");
  const result = await executePrivateProvider(provider, context());
  assert.equal(result.status, "invalidConfiguration");
  assert.equal(calls, 0);
});

test("contains API failures and malformed responses without throwing", async () => {
  const failed = createSerpApiWebSearchProvider({ apiKey: "test-only", fetchImpl: async () => new Response("upstream", { status: 500 }) });
  assert.equal((await executePrivateProvider(failed, context())).status, "upstreamUnavailable");

  const malformed = createSerpApiWebSearchProvider({
    apiKey: "test-only",
    fetchImpl: async () => new Response(JSON.stringify({ organic_results: "not-an-array" }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  assert.equal((await executePrivateProvider(malformed, context())).status, "parseFailed");
});

test("deduplicates queries and result URLs while merging topic coverage", () => {
  const queries = deduplicateSerpApiQueries([
    { topic: "overviewProducts", query: '"Abaka AI" company overview' },
    { topic: "leadership", query: '  "Abaka   AI"   company overview  ' },
    { topic: "hiring", query: '"Abaka AI" jobs careers' },
  ]);
  assert.equal(queries.length, 2);
  assert.equal(buildSerpApiQueries(context()).length, 6);

  const leads = deduplicateSerpApiLeads([
    { url: "https://news.example/abaka?utm_campaign=a", title: "One", snippet: "first", topics: ["overviewProducts"], position: 2 },
    { url: "https://news.example/abaka", title: "Two", snippet: "second", topics: ["leadership"], position: 1 },
  ]);
  assert.equal(leads.length, 1);
  assert.deepEqual(leads[0].topics.sort(), ["leadership", "overviewProducts"]);
  assert.equal(leads[0].position, 1);
});

test("selects SerpApi research only after the target is confirmed", () => {
  const confirmed = buildQuickCompanyIntelligencePlan(context().input, context().identityGraph)
    .find((item) => item.providerId === "serpApiWebSearch");
  const unresolvedGraph = { ...context().identityGraph, targetSelectionStatus: "unselected" };
  const unresolved = buildQuickCompanyIntelligencePlan(context().input, unresolvedGraph)
    .find((item) => item.providerId === "serpApiWebSearch");
  assert.equal(confirmed.selected, true);
  assert.equal(unresolved.selected, false);
});

test("drops SerpApi snippets before original-page evidence normalization", async () => {
  const snippet = "UNVERIFIED_SNIPPET_MUST_NOT_ENTER_EVIDENCE";
  const provider = createSerpApiWebSearchProvider({
    apiKey: "test-only", maxSearches: 1, maxFetchedUrls: 1,
    resolveHost: async () => [{ address: "93.184.216.34", family: 4 }],
    fetchImpl: async (url) => {
      const target = new URL(String(url));
      if (target.hostname === "serpapi.com") {
        return new Response(JSON.stringify({ organic_results: [{ position: 1, title: "Abaka AI profile", link: "https://news.example/abaka", snippet }] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response('<!doctype html><title>Abaka AI profile</title><meta name="description" content="Original publisher profile of Abaka AI"><h1>Abaka AI</h1><p>Abaka AI provides data services.</p>', { status: 200, headers: { "content-type": "text/html" } });
    },
  });
  const searched = await provider.search(context());
  assert.equal(searched.records.length, 1);
  const pages = await provider.fetchDetails(searched.records, context());
  const evidence = await provider.normalize(pages, context());
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].independentlyPublished, true);
  assert.equal(evidence[0].officialRecord, false);
  assert.equal(evidence[0].entityMatchConfidence, "Medium");
  assert.doesNotMatch(JSON.stringify(evidence), new RegExp(snippet));
  assert.match(evidence[0].rawText, /Original publisher profile/);
  assert.ok(evidence[0].limitations.some((item) => /snippet was not retained/i.test(item)));
});

test("Quick report still builds when SerpApi is unavailable", () => {
  const report = buildQuickCompanyIntelligenceReport({
    researchId: "research-no-serpapi",
    input: context().input,
    graph: context().identityGraph,
    providerPlan: [{ providerId: "serpApiWebSearch", providerName: "SerpApi original-source web research", sourceTier: 3, providerCategory: "independentVerification", selected: true, reason: "test" }],
    evidence: [], claims: [], informationGaps: [], generatedAt: "2026-08-28T00:00:00.000Z",
  });
  assert.equal(report.reportVersion, "clara-quick-v1");
  assert.equal(report.references.length, 0);
  assert.ok(report.sections.length > 0);
});
