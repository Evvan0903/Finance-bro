import { tsImport } from "tsx/esm/api";
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

async function pipeline(html, overrides = {}) {
  const extractor = await import(`${await moduleUrl("../app/lib/private-diligence/extraction/htmlExtractor.ts")}#extract-${Math.random()}`);
  const evidenceRegistry = await import(`${await moduleUrl("../app/lib/private-diligence/evidence/evidenceRegistry.ts")}#evidence-${Math.random()}`);
  const claimRegistry = await import(`${await moduleUrl("../app/lib/private-diligence/evidence/claimRegistry.ts")}#claims-${Math.random()}`);
  const reportBuilder = await tsImport(new URL("../app/lib/private-diligence/reports/quickReportBuilder.ts", import.meta.url).href, import.meta.url);
  const extracted = extractor.extractCompanyPage(html);
  const evidenceId = overrides.evidenceId ?? "website-r-1";
  const sourceUrl = overrides.sourceUrl ?? "https://northstar.example/services";
  const rawEvidence = {
    evidenceId,
    researchId: "research-1",
    entityId: "entity-northstar",
    providerId: "companyWebsite",
    sourceTier: 2,
    sourceType: "Company-controlled web page",
    sourceTitle: extracted.title,
    sourceUrl,
    publicReferenceUrl: sourceUrl,
    publicationDate: overrides.publicationDate ?? null,
    retrievedAt: "2026-09-15T20:00:00.000Z",
    rawText: extracted.bodyText,
    structuredData: {
      organizationName: "Northstar AI",
      description: extracted.description,
      products: extracted.products,
      services: extracted.services,
      founders: extracted.founders,
      executives: extracted.executives,
      factCandidates: extracted.factCandidates,
      searchTopics: overrides.searchTopics ?? ["overviewProducts", "leadership"],
    },
    matchedEntitySignals: ["user-confirmed company domain"],
    entityMatchConfidence: "High",
    companyReported: true,
    officialRecord: false,
    independentlyPublished: false,
    contentHash: overrides.contentHash ?? "content-1",
    limitations: ["Company Reported"],
  };
  const evidence = evidenceRegistry.normalizeEvidenceRegistry([rawEvidence]);
  const claims = claimRegistry.buildClaimRegistry("research-1", "entity-northstar", evidence);
  const input = {
    companyName: "Northstar AI", website: "https://northstar.example", city: null, state: null,
    country: null, founderOrExecutive: null, industry: null, researchObjective: "General diligence",
    locale: "en", reportDepth: "Standard", workflowMode: "quick", quickResearchPurpose: "General Research",
  };
  const graph = {
    entityId: "entity-northstar", canonicalName: "Northstar AI", legalNames: [], dbaNames: ["Northstar AI"], formerNames: [],
    domains: ["northstar.example"], emailDomains: [], addresses: [], phoneNumbers: [], founders: [], executives: [], directors: [],
    registrationNumbers: [], registrationJurisdictions: [], cikCandidates: [], ueiCandidates: [], cageCodes: [], samEntityIds: [],
    usaSpendingRecipientIds: [], patentAssigneeNames: [], trademarkOwnerNames: [], parentCompanies: [], subsidiaries: [],
    affiliatedEntities: [], socialProfiles: [], termsPageLegalNames: [], privacyPageLegalNames: [], productCategories: [], industryLabels: [],
    identityConfidence: "High", resolutionStatus: "userConfirmed", targetSelectionStatus: "userSelected",
    identityVerificationStatus: "partiallyVerified", identityLimitations: [],
  };
  const report = reportBuilder.buildQuickCompanyIntelligenceReport({
    researchId: "research-1", input, graph, providerPlan: [], evidence, claims,
    informationGaps: [], generatedAt: "2026-09-15T20:00:00.000Z", hiringIntelligence: overrides.hiringIntelligence ?? null,
  });
  return { extracted, evidence, claims, report };
}

test("explicit service and executive facts survive extraction through Quick report with provenance", async () => {
  const html = `<!doctype html><html><head><title>Northstar AI</title></head><body>
    <nav>Products Services Leadership</nav>
    <main>
      <section><h2>Data Operations</h2><p>Northstar AI offers data collection, data cleaning, and labeled datasets for frontier models.</p></section>
      <section><h2>Leadership</h2><article><h3>Tom Tang</h3><p>CEO</p></article></section>
    </main><footer>Products Services</footer>
  </body></html>`;
  const { evidence, claims, report } = await pipeline(html);
  const service = claims.find((claim) => claim.claimType === "service" && claim.normalizedValue === "data collection");
  const executive = claims.find((claim) => claim.claimType === "executiveRole" && claim.normalizedValue === "Tom Tang — CEO");
  assert.ok(service);
  assert.deepEqual(service.evidenceIds, ["website-r-1"]);
  assert.equal(service.companyReported, true);
  assert.ok(executive);
  assert.deepEqual(executive.evidenceIds, ["website-r-1"]);
  const serviceCandidate = evidence[0].factCandidates.find((candidate) => candidate.factType === "service" && candidate.value === "data collection");
  assert.equal(serviceCandidate.sourceUrl, "https://northstar.example/services");
  assert.match(serviceCandidate.excerpt, /offers data collection/i);
  assert.equal(serviceCandidate.locator, "Data Operations");
  assert.equal(serviceCandidate.retrievedAt, "2026-09-15T20:00:00.000Z");
  const executiveCandidate = evidence[0].factCandidates.find((candidate) => candidate.factType === "executiveRole");
  assert.equal(executiveCandidate.personName, "Tom Tang");
  assert.equal(executiveCandidate.role, "CEO");
  assert.match(report.sections.find((section) => section.sectionId === "02").paragraphs.join(" "), /data collection/i);
  assert.match(report.sections.find((section) => section.sectionId === "03").paragraphs.join(" "), /Tom Tang — CEO/);
  assert.equal(report.references[0].sourceUrl, "https://northstar.example/services");
});

test("visible fallback ignores navigation keywords and ambiguous person-role prose", async () => {
  const html = `<!doctype html><html><head><title>Harbor Labs</title></head><body>
    <nav>Products Services Platform Leadership</nav>
    <main><section><h2>Welcome</h2><p>Learn more about our products and services.</p></section>
    <section><h2>Industry Discussion</h2><p>Avery Chen spoke with CEO Jordan Lee about market conditions.</p></section>
    <section><p>C-Suites Look To The CFO for Guidance.</p></section></main>
    <footer>Products Services Data Collection</footer>
  </body></html>`;
  const { extracted, claims } = await pipeline(html);
  assert.deepEqual(extracted.products, []);
  assert.deepEqual(extracted.services, []);
  assert.equal(extracted.executives.includes("Jordan Lee"), false);
  assert.equal(claims.some((claim) => ["product", "service", "executiveRole"].includes(claim.claimType)), false);
});

test("historical executive role remains qualified and is not promoted to a current role", async () => {
  const html = `<!doctype html><title>Harbor Labs</title><main><section><h2>Advisers</h2>
    <p>Morgan Shaw previously served as CEO.</p></section></main>`;
  const { extracted, claims, report } = await pipeline(html);
  assert.equal(extracted.executives.includes("Morgan Shaw"), false);
  assert.equal(claims.some((claim) => claim.claimType === "executiveRole"), false);
  const historical = claims.find((claim) => claim.claimType === "formerExecutiveRole");
  assert.ok(historical);
  assert.match(historical.statement, /previously held/i);
  assert.match(report.sections.find((section) => section.sectionId === "03").paragraphs.join(" "), /Historical executive roles/);
});

test("JSON-LD remains supported and duplicate body facts produce one report claim", async () => {
  const html = `<!doctype html><title>Northstar AI</title><main><section><h2>Implementation</h2>
    <p>Northstar AI offers Implementation Services.</p></section></main>
    <script type="application/ld+json">[
      {"@type":"Service","name":"Implementation Services"},
      {"@type":"Product","name":"Northstar Platform"},
      {"@type":"Person","name":"Riley Park","jobTitle":"Chief Technology Officer"}
    ]</script>`;
  const { extracted, evidence, claims } = await pipeline(html);
  assert.ok(extracted.products.includes("Northstar Platform"));
  assert.ok(extracted.services.includes("Implementation Services"));
  assert.ok(extracted.executives.includes("Riley Park"));
  assert.equal(evidence[0].factCandidates.filter((candidate) => candidate.factType === "service" && candidate.value === "Implementation Services").length, 1);
  assert.equal(claims.filter((claim) => claim.claimType === "service" && claim.normalizedValue === "Implementation Services").length, 1);
});

test("search-topic discovery alone does not mark relationships or activity covered", async () => {
  const { report } = await pipeline(`<!doctype html><title>Northstar AI</title><main><p>Northstar AI is a private company.</p></main>`, {
    searchTopics: ["customersPartners", "recentActivity", "fundingAcquisitions"],
  });
  const presentation = await tsImport(new URL("../app/lib/private-diligence/reports/quickReportPresentation.ts", import.meta.url).href, import.meta.url);
  const coverage = presentation.buildQuickReportVisualizations(report).coverage;
  assert.equal(coverage.find((item) => item.id === "customers").covered, false);
  assert.equal(coverage.find((item) => item.id === "partners").covered, false);
  assert.equal(coverage.find((item) => item.id === "recentActivity").covered, false);
  assert.equal(coverage.find((item) => item.id === "fundingAcquisitions").covered, false);
  assert.match(report.sections.find((section) => section.sectionId === "06").paragraphs.join(" "), /No attributable customer or partner fact/);
});

test("existing hiring snapshot remains covered without inferring growth", async () => {
  const { report } = await pipeline(`<!doctype html><title>Northstar AI</title><main><p>Northstar AI is a private company.</p></main>`, {
    hiringIntelligence: {
      companyId: "entity-northstar", status: "success_with_jobs", sourceCandidates: [], selectedSource: null,
      adapter: "FixtureAdapter", jobs: [], limitations: [], failures: [],
      summary: { companyId: "entity-northstar", totalOpenRoles: 2, byFunction: {}, bySeniority: {}, byLocation: {}, remoteRoles: 0,
        sources: [{ adapter: "FixtureAdapter", sourceUrl: "https://northstar.example/careers", retrievedAt: "2026-09-15T20:00:00.000Z", jobCount: 2 }], signals: [] },
    },
  });
  const presentation = await tsImport(new URL("../app/lib/private-diligence/reports/quickReportPresentation.ts", import.meta.url).href, import.meta.url);
  assert.equal(presentation.buildQuickReportVisualizations(report).coverage.find((item) => item.id === "hiring").covered, true);
  const text = report.sections.find((section) => section.sectionId === "04").paragraphs.join(" ");
  assert.match(text, /2 public open roles/);
  assert.match(text, /not a historical hiring trend or employee-growth measure/);
});
