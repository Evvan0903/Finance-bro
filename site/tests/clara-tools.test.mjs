import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const toolsRoot = new URL("../app/lib/private-diligence/tools/", import.meta.url);
const { createCompanyIdentityTool } = await tsImport(new URL("companyIdentityTool.ts", toolsRoot).href, import.meta.url);
const { createHiringIntelligenceTool } = await tsImport(new URL("hiringIntelligenceTool.ts", toolsRoot).href, import.meta.url);
const { claraToolDefinitions, claraToolRegistry, createClaraToolRegistry } = await tsImport(new URL("registry.ts", toolsRoot).href, import.meta.url);
const { createWebResearchTool } = await tsImport(new URL("webResearchTool.ts", toolsRoot).href, import.meta.url);

const companyInput = {
  companyName: "Acme", website: "https://acme.example", city: null, state: null, country: null,
  founderOrExecutive: null, industry: null, researchObjective: "General diligence", locale: "en",
  reportDepth: "Compact", workflowMode: "quick", quickResearchPurpose: "General Research",
};

function graph(overrides = {}) {
  return {
    entityId: "entity-acme", canonicalName: "Acme", legalNames: [], dbaNames: ["Acme"], formerNames: [],
    domains: ["acme.example"], emailDomains: [], addresses: [], phoneNumbers: [], founders: [], executives: [],
    directors: [], registrationNumbers: [], registrationJurisdictions: [], cikCandidates: [], ueiCandidates: [],
    cageCodes: [], samEntityIds: [], usaSpendingRecipientIds: [], patentAssigneeNames: [], trademarkOwnerNames: [],
    parentCompanies: [], subsidiaries: [], affiliatedEntities: [], socialProfiles: [], termsPageLegalNames: [],
    privacyPageLegalNames: [], productCategories: [], industryLabels: [], identityConfidence: "High",
    resolutionStatus: "userConfirmed", targetSelectionStatus: "userSelected", identityVerificationStatus: "partiallyVerified",
    identityLimitations: [], ...overrides,
  };
}

function context(overrides = {}) {
  return { researchId: "research-1", input: companyInput, identityGraph: graph(), now: () => new Date("2026-09-01T12:00:00.000Z"), ...overrides };
}

function candidate(overrides = {}) {
  return {
    candidateId: "candidate-1", researchRequestId: "research-1", displayName: "Acme", legalName: null,
    dbaNames: [], formerNames: [], website: "https://acme.example", domain: "acme.example", city: null,
    state: null, country: null, industry: null, founders: [], executives: [], registrationJurisdiction: null,
    registrationNumbers: [], addresses: [], phoneNumbers: [], emailDomains: [], websiteOrganizationNames: ["Acme"],
    termsLegalNames: [], privacyLegalNames: [], pageTitles: ["Acme"], socialProfiles: [], productCategories: [],
    affiliateNames: [], websiteReachable: true, unresolvedIdentityFields: [], sourceIds: ["website-1"],
    matchSignals: ["Exact confirmed domain match", "Organization name confirmed on official website"], matchScore: 80,
    matchConfidence: "High", resolutionStatus: "requiresUserConfirmation", targetSelectionStatus: "unselected",
    identityVerificationStatus: "partiallyVerified", relationshipType: "Target operating company", ...overrides,
  };
}

function rawEvidence(overrides = {}) {
  return {
    evidenceId: "evidence-1", researchId: "research-1", entityId: "entity-acme", providerId: "companyWebsite",
    sourceTier: 2, sourceType: "Company-controlled web page", sourceTitle: "Acme", sourceUrl: "https://acme.example/about",
    publicReferenceUrl: "https://acme.example/about", publicationDate: null, retrievedAt: "2026-09-01T12:00:00.000Z",
    rawText: "Acme company page", structuredData: { organizationName: "Acme" }, matchedEntitySignals: ["confirmed domain"],
    entityMatchConfidence: "High", companyReported: true, officialRecord: false, independentlyPublished: false,
    contentHash: "hash-1", limitations: ["Company reported"], ...overrides,
  };
}

function provider(providerId, behavior) {
  return {
    providerId, providerName: providerId, sourceTier: 2, providerCategory: "companyDirect",
    isConfigured: () => true, supports: () => true, validateConfiguration: () => "success",
    search: async () => behavior.search,
    fetchDetails: async (records) => records,
    normalize: async () => behavior.evidence ?? [],
    buildPublicReference: (evidence) => evidence.sourceUrl,
  };
}

function hiringResult(overrides = {}) {
  return {
    companyId: "entity-acme", status: "success_zero_jobs", sourceCandidates: [], selectedSource: null,
    adapter: null, jobs: [], summary: { companyId: "entity-acme", totalOpenRoles: 0, byFunction: {}, bySeniority: {},
      byLocation: {}, remoteRoles: 0, sources: [], signals: [], limitations: [] }, limitations: [], failures: [], ...overrides,
  };
}

test("registers unique, agent-inspectable Clara tool definitions", () => {
  assert.deepEqual([...claraToolRegistry.keys()], ["company_identity", "web_research", "hiring_intelligence", "funding_search", "sec_funding"]);
  assert.equal(new Set(claraToolDefinitions.map((item) => item.name)).size, claraToolDefinitions.length);
  assert.ok(claraToolDefinitions.every((item) => item.description && item.inputSchema.type === "object"));
  assert.throws(() => createClaraToolRegistry([claraToolRegistry.get("company_identity"), claraToolRegistry.get("company_identity")]), /Duplicate Clara tool name/);
});

test("company identity preserves confirmation safeguards and represents a valid zero-result as success", async () => {
  const zeroTool = createCompanyIdentityTool({ discover: async () => ({ candidates: [], websiteEvidence: [], websiteStatus: "notProvided" }) });
  const zero = await zeroTool.execute({ company: companyInput }, context({ identityGraph: null }));
  assert.equal(zero.status, "success");
  assert.equal(zero.data.candidates.length, 0);
  assert.equal(zero.errors.length, 0);
  assert.equal(zero.gaps[0].code, "company_identity_not_found");

  const discoveryTool = createCompanyIdentityTool({ discover: async () => ({ candidates: [candidate()], websiteEvidence: [rawEvidence()], websiteStatus: "reachable" }) });
  const discovery = await discoveryTool.execute({ company: companyInput }, context({ identityGraph: null }));
  assert.deepEqual(discovery.data.confirmableCandidateIds, ["candidate-1"]);
  assert.equal(discovery.data.confirmedEntity, null);
  assert.match(discovery.observations[0].description, /explicit confirmation is still required/i);

  const confirmed = await discoveryTool.execute({ company: companyInput }, context());
  assert.equal(confirmed.data.confirmedEntity.entityId, "entity-acme");
  assert.equal(confirmed.data.candidates.length, 0);
});

test("web research reuses existing evidence and distinguishes no evidence, partial, and failed results", async () => {
  const noDataTool = createWebResearchTool({ createRegistry: () => new Map([
    ["companyWebsite", provider("companyWebsite", { search: { status: "noData", records: [], sanitizedIssue: "No pages" } })],
  ]) });
  const noData = await noDataTool.execute({ providerIds: ["companyWebsite"] }, context());
  assert.equal(noData.status, "success");
  assert.equal(noData.evidence.length, 0);
  assert.equal(noData.errors.length, 0);

  const partialTool = createWebResearchTool({ createRegistry: () => new Map([
    ["companyWebsite", provider("companyWebsite", { search: { status: "success", records: [{}] }, evidence: [rawEvidence()] })],
    ["serpApiWebSearch", provider("serpApiWebSearch", { search: { status: "upstreamUnavailable", records: [], sanitizedIssue: "Unavailable" } })],
  ]) });
  const partial = await partialTool.execute({}, context());
  assert.equal(partial.status, "partial");
  assert.equal(partial.evidence[0].sourceUrl, "https://acme.example/about");
  assert.equal(partial.data.normalizedEvidence[0].evidenceId, "evidence-1");
  assert.equal(partial.errors.length, 1);

  const failedTool = createWebResearchTool({ createRegistry: () => new Map([
    ["companyWebsite", provider("companyWebsite", { search: { status: "timeout", records: [], sanitizedIssue: "Timed out" } })],
  ]) });
  const failed = await failedTool.execute({ providerIds: ["companyWebsite"] }, context());
  assert.equal(failed.status, "failed");
  assert.equal(failed.evidence.length, 0);
  assert.equal(failed.errors[0].code, "companyWebsite_timeout");
});

test("web and hiring tools reject unconfirmed targets before provider execution", async () => {
  let webCalled = false;
  const web = createWebResearchTool({ createRegistry: () => { webCalled = true; return new Map(); } });
  const webResult = await web.execute({}, context({ identityGraph: graph({ targetSelectionStatus: "unselected" }) }));
  assert.equal(webResult.status, "failed");
  assert.equal(webCalled, false);

  let hiringCalled = false;
  const hiring = createHiringIntelligenceTool({ research: async () => { hiringCalled = true; return hiringResult(); }, persist: null });
  const hiringResultValue = await hiring.execute({}, context({ identityGraph: graph({ targetSelectionStatus: "unselected" }) }));
  assert.equal(hiringResultValue.status, "failed");
  assert.equal(hiringCalled, false);
});

test("hiring tool preserves zero-job success, normalized jobs, provenance, timestamps, and cautious inference policy", async () => {
  let persisted = null;
  const zero = hiringResult({
    status: "success_zero_jobs", selectedSource: { url: "https://boards.greenhouse.io/acme", sourceType: "greenhouse", discoveryMethod: "linked_from_website", score: 100 },
    adapter: "GreenhouseAdapter", summary: { ...hiringResult().summary, sources: [{ adapter: "GreenhouseAdapter", sourceUrl: "https://boards.greenhouse.io/acme", retrievedAt: "2026-09-01T12:00:00.000Z", jobCount: 0 }] },
  });
  const zeroTool = createHiringIntelligenceTool({ research: async () => zero, persist: async (_id, value) => { persisted = value; return true; } });
  const zeroResult = await zeroTool.execute({}, context());
  assert.equal(zeroResult.status, "success");
  assert.equal(zeroResult.data.jobs.length, 0);
  assert.equal(zeroResult.errors.length, 0);
  assert.match(zeroResult.observations.at(-1).description, /not a headcount or growth estimate/i);
  assert.equal(persisted, zero);

  const observedJob = { id: "greenhouse-job-1", companyId: "entity-acme", title: "Data Engineer", location: "Remote",
    remote: true, seniority: "Mid", function: "Data / AI", sourceUrl: "https://boards.greenhouse.io/acme/jobs/1",
    sourceType: "greenhouse", sourceJobId: "1", retrievedAt: "2026-09-01T12:00:00.000Z" };
  const withJob = hiringResult({
    status: "success_with_jobs", selectedSource: zero.selectedSource, adapter: "GreenhouseAdapter", jobs: [observedJob],
    summary: { ...zero.summary, totalOpenRoles: 1, sources: [{ ...zero.summary.sources[0], jobCount: 1 }] },
  });
  const result = await createHiringIntelligenceTool({ research: async () => withJob, persist: async () => true }).execute({}, context());
  assert.deepEqual(result.data.jobs, [observedJob]);
  assert.equal(result.evidence[0].sourceUrl, observedJob.sourceUrl);
  assert.equal(result.evidence[0].structuredData.sourceJobId, observedJob.sourceJobId);
  assert.equal(result.evidence[0].retrievedAt, observedJob.retrievedAt);
  assert.doesNotMatch(JSON.stringify(result), /(?:indicates|shows|demonstrates) (?:headcount|employee) growth/i);
  assert.match(result.evidence[0].limitations.join(" "), /not evidence of headcount growth/i);
});

test("hiring provider failures cannot silently become zero observed jobs", async () => {
  const failedActivity = hiringResult({ status: "retrieval_failed", limitations: ["Careers source failed"], failures: [{ sourceUrl: "https://acme.example/careers", adapter: "GenericCareersAdapter", status: "retrieval_failed", reason: "Timed out" }] });
  const result = await createHiringIntelligenceTool({ research: async () => failedActivity, persist: async () => true }).execute({}, context());
  assert.equal(result.status, "failed");
  assert.equal(result.errors[0].code, "retrieval_failed");
  assert.equal(result.observations.some((item) => item.code === "public_jobs_observed"), false);
});
