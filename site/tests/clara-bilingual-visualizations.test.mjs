import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function moduleUrl(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}

const builder = await import(await moduleUrl("../app/lib/private-diligence/reports/quickReportBuilder.ts"));
const presentation = await import(await moduleUrl("../app/lib/private-diligence/reports/quickReportPresentation.ts"));

function input(locale = "en") {
  return {
    companyName: "Abaka AI", website: "https://abaka.ai/", city: null, state: null, country: null,
    founderOrExecutive: null, industry: null, researchObjective: "General diligence", locale,
    reportDepth: "Standard", workflowMode: "quick", quickResearchPurpose: "General Research",
  };
}

function graph() {
  return {
    entityId: "entity-abaka", canonicalName: "Abaka AI", legalNames: [], dbaNames: [], formerNames: [],
    domains: ["abaka.ai"], emailDomains: ["abaka.ai"], addresses: [], phoneNumbers: [], founders: [],
    executives: [], directors: [], registrationNumbers: [], registrationJurisdictions: [], cikCandidates: [],
    ueiCandidates: [], cageCodes: [], samEntityIds: [], usaSpendingRecipientIds: [], patentAssigneeNames: [],
    trademarkOwnerNames: [], parentCompanies: [], subsidiaries: [], affiliatedEntities: [], socialProfiles: [],
    termsPageLegalNames: [], privacyPageLegalNames: [], productCategories: [], industryLabels: [],
    identityConfidence: "Medium", resolutionStatus: "userConfirmed", targetSelectionStatus: "userSelected",
    identityVerificationStatus: "partiallyVerified", identityLimitations: [],
  };
}

function evidence({ id, topics = [], fields = {}, date = null, companyReported = false, officialRecord = false, independentlyPublished = true }) {
  return {
    evidenceId: id, entityId: "entity-abaka", providerId: "mockProvider", sourceTier: officialRecord ? 1 : companyReported ? 2 : 3,
    evidenceType: "Original page", subjectName: "Abaka AI", subjectIdentifiers: ["matched"],
    normalizedFields: { searchTopics: topics, sourceSummary: `Summary for ${id}`, ...fields },
    sourceTitle: `Source ${id}`, sourceUrl: `https://source.example/${id}`, publicationDate: date,
    retrievedAt: "2026-08-28T00:00:00.000Z", companyReported, officialRecord, independentlyPublished,
    entityMatchConfidence: "High", verificationEligibility: "supportingEvidence", limitations: [],
  };
}

function claim(id, status, claimType, evidenceId) {
  return {
    claimId: id, researchId: "research-abaka", entityId: "entity-abaka", category: "Test", claimType,
    statement: `Statement ${id}`, normalizedValue: id, unit: null, period: null, geography: null,
    evidenceIds: [evidenceId], companyReported: status === "CompanyReported", independentlyVerified: status === "Corroborated",
    officiallyVerified: status === "Verified", conflictingEvidenceIds: [], status, confidence: "High", materiality: "Medium", limitations: [],
  };
}

function fixture() {
  const evidenceRows = [
    evidence({ id: "overview", topics: ["overviewProducts"], fields: { organizationName: "Abaka AI", description: "AI data company", products: ["Dataset"], services: ["Annotation"] }, companyReported: true, independentlyPublished: false }),
    evidence({ id: "leadership", topics: ["leadership"], fields: { founders: ["Jack Lin"] } }),
    evidence({ id: "hiring", topics: ["hiring"], fields: { links: ["https://job-boards.greenhouse.io/abakaai/jobs/123", "https://job-boards.greenhouse.io/abakaai/jobs/123"], jobDepartments: ["Engineering", "Engineering"], jobLocations: ["London"] } }),
    evidence({ id: "relationships", topics: ["customersPartners"], fields: {} }),
    evidence({ id: "recent", topics: ["recentActivity"], fields: { sourceSummary: "Product launch announced" }, date: "2026-08-20" }),
    evidence({ id: "funding", topics: ["fundingAcquisitions"], fields: { sourceSummary: "Abaka AI raised a funding round" }, date: null, officialRecord: true }),
  ];
  const claims = [
    claim("claim-verified", "Verified", "legalName", "funding"),
    claim("claim-supported", "Corroborated", "description", "overview"),
    claim("claim-partial", "PubliclyReported", "founder", "leadership"),
    claim("claim-management", "CompanyReported", "product", "overview"),
    claim("claim-unverified", "Unverified", "customer", "relationships"),
    claim("claim-conflict", "Conflicting", "partner", "relationships"),
  ];
  return { evidenceRows, claims };
}

function report() {
  const { evidenceRows, claims } = fixture();
  return builder.buildQuickCompanyIntelligenceReport({
    researchId: "research-abaka", input: input("en"), graph: graph(), providerPlan: [],
    evidence: evidenceRows, claims, informationGaps: [], generatedAt: "2026-08-28T00:00:00.000Z",
  });
}

test("one canonical Quick report renders complete English and Chinese analysis", () => {
  const canonical = report();
  const en = presentation.quickReportParagraphs(canonical, "en");
  const zh = presentation.quickReportParagraphs(canonical, "zh");
  assert.equal(canonical.locale, "en");
  assert.deepEqual(en.map((section) => section.claimIds), zh.map((section) => section.claimIds));
  assert.deepEqual(en.map((section) => section.evidenceIds), zh.map((section) => section.evidenceIds));
  assert.notDeepEqual(en.map((section) => section.paragraphs), zh.map((section) => section.paragraphs));
  assert.match(en.flatMap((section) => section.paragraphs).join(" "), /Ownership is unverified/);
  assert.match(zh.flatMap((section) => section.paragraphs).join(" "), /所有权尚未验证/);
  assert.match(zh.flatMap((section) => section.paragraphs).join(" "), /研究目的：通用调查/);
  assert.doesNotMatch(zh.flatMap((section) => section.paragraphs).join(" "), /研究目的：General Research/);
  assert.equal(presentation.quickReportDisclosure(canonical, "zh"), canonical.disclosureByLocale.zh);
});

test("language toggle is client-only and does not call research or SerpApi", async () => {
  const workflow = await readFile(new URL("../app/ClaraPrivateDiligenceWorkflow.tsx", import.meta.url), "utf8");
  const toggleStart = workflow.indexOf('data-testid="clara-locale-toggle"');
  const toggle = toggleStart >= 0 ? workflow.slice(toggleStart, toggleStart + 280) : "";
  assert.match(toggle, /update\("locale"/);
  assert.doesNotMatch(toggle, /fetch|jsonRequest|runResearch|SerpApi/i);
  assert.match(workflow, /locale=\{report\.reportVersion === "clara-quick-v1" \? input\.locale : report\.locale\}/);
});

test("calculates deterministic coverage without treating it as confidence", () => {
  const data = presentation.buildQuickReportVisualizations(report());
  assert.deepEqual(data.coverage.map((item) => item.id), ["overview", "productsServices", "leadership", "hiring", "customers", "partners", "recentActivity", "fundingAcquisitions"]);
  assert.deepEqual(Object.fromEntries(data.coverage.map((item) => [item.id, item.covered])), {
    overview: true, productsServices: true, leadership: true, hiring: true,
    customers: true, partners: true, recentActivity: false, fundingAcquisitions: false,
  });
  assert.equal(data.coverage.find((item) => item.id === "customers").claimCount, 1);
  assert.equal(data.coverage.find((item) => item.id === "partners").claimCount, 1);
});

test("counts actual claim statuses in the six evidence-quality buckets", () => {
  const data = presentation.buildQuickReportVisualizations(report());
  assert.deepEqual(Object.fromEntries(data.evidenceQuality.map((item) => [item.id, item.count])), {
    verified: 1, externallySupported: 1, partiallyVerified: 1,
    managementReported: 1, unverified: 1, inconsistent: 1,
  });
});

test("aggregates only observed ATS roles and available job attributes", () => {
  const data = presentation.buildQuickReportVisualizations(report());
  assert.equal(data.hiring.observedRoleLinks, 1);
  assert.deepEqual(data.hiring.departments, [{ label: "Engineering", count: 2 }]);
  assert.deepEqual(data.hiring.locations, [{ label: "London", count: 1 }]);
  assert.deepEqual(data.hiring.workArrangements, []);
  assert.deepEqual(data.hiring.seniority, []);
});

test("does not create a timeline from topic tags and source summaries without event claims", () => {
  const data = presentation.buildQuickReportVisualizations(report());
  assert.deepEqual(data.timeline, []);
});

test("returns useful empty visualization data without fabricated values", () => {
  const canonical = report();
  const empty = { ...canonical, evidence: [], claims: [], references: [] };
  const data = presentation.buildQuickReportVisualizations(empty);
  assert.equal(data.coverage.every((item) => !item.covered && item.claimCount === 0 && item.evidenceCount === 0), true);
  assert.equal(data.evidenceQuality.every((item) => item.count === 0), true);
  assert.deepEqual(data.hiring, { observedRoleLinks: 0, roleUrls: [], departments: [], locations: [], workArrangements: [], seniority: [] });
  assert.deepEqual(data.timeline, []);
});
