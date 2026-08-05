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

const nonce = () => `#${Date.now()}-${Math.random()}`;

function input(overrides = {}) {
  return {
    companyName: "Acme Robotics, Inc.",
    website: "https://acme.example",
    city: "Austin",
    state: "Texas",
    country: "United States",
    founderOrExecutive: "Avery Chen",
    industry: "Robotics",
    researchObjective: "General diligence",
    locale: "en",
    reportDepth: "Standard",
    ...overrides,
  };
}

function graph(overrides = {}) {
  return {
    entityId: "entity-acme",
    canonicalName: "Acme Robotics, Inc.",
    legalNames: ["Acme Robotics, Inc."], dbaNames: ["Acme Robotics"], formerNames: [],
    domains: ["acme.example"], emailDomains: ["acme.example"],
    addresses: ["1 Main Street, Austin, Texas"], phoneNumbers: [],
    founders: ["Avery Chen"], executives: [], directors: [],
    registrationNumbers: [], registrationJurisdictions: ["Texas"],
    cikCandidates: [], ueiCandidates: [], cageCodes: [], samEntityIds: [],
    usaSpendingRecipientIds: [], patentAssigneeNames: ["Acme Robotics, Inc."],
    trademarkOwnerNames: ["Acme Robotics, Inc."], parentCompanies: [], subsidiaries: [],
    affiliatedEntities: [], socialProfiles: [], industryLabels: ["Robotics"],
    identityConfidence: "High", identityLimitations: [],
    ...overrides,
  };
}

function rawEvidence(overrides = {}) {
  return {
    evidenceId: "ev-1", researchId: "research-1", entityId: "entity-acme",
    providerId: "companyWebsite", sourceTier: 2,
    sourceType: "Company-controlled web page", sourceTitle: "Acme About",
    sourceUrl: "https://acme.example/about", publicReferenceUrl: "https://acme.example/about",
    publicationDate: null, retrievedAt: "2026-08-05T00:00:00.000Z", rawText: "Acme builds robots",
    structuredData: { organizationName: "Acme Robotics, Inc.", description: "Acme builds robots" },
    matchedEntitySignals: ["confirmed official domain"], entityMatchConfidence: "High",
    companyReported: true, officialRecord: false, independentlyPublished: false,
    contentHash: "hash-1", limitations: ["Company Reported"],
    ...overrides,
  };
}

test("validates Clara input and scores exact identity signals deterministically", async () => {
  const schema = await import((await moduleUrl("../app/lib/private-diligence/schema.ts")) + nonce());
  const matcher = await import((await moduleUrl("../app/lib/private-diligence/entity-resolution/entityMatcher.ts")) + nonce());
  assert.equal(schema.parsePrivateCompanyInput(input()).companyName, "Acme Robotics, Inc.");
  assert.throws(() => schema.parsePrivateCompanyInput({ companyName: "A", website: "file:///etc/passwd" }));
  const candidate = {
    candidateId: "candidate-1", displayName: "Acme Robotics", legalName: "Acme Robotics, Inc.",
    dbaNames: [], formerNames: [], website: "https://acme.example", domain: "acme.example",
    city: "Austin", state: "Texas", country: "United States", industry: "Robotics",
    founders: ["Avery Chen"], executives: [], registrationJurisdiction: "Texas",
    registrationNumbers: ["TX-123"], addresses: [], phoneNumbers: [],
    emailDomains: ["acme.example"], sourceIds: [],
  };
  const score = matcher.scoreEntityCandidate(input(), candidate);
  assert.equal(score.matchScore, 100);
  assert.equal(score.matchConfidence, "High");
  assert.equal(score.resolutionStatus, "autoConfirmed");
  assert.ok(score.matchSignals.includes("Exact confirmed domain match"));
  const sameNameOtherCity = { ...candidate, candidateId: "candidate-2", domain: "other.example", city: "Dallas", registrationNumbers: [] };
  assert.equal(matcher.candidatesAreDistinct({ ...candidate, ...score }, { ...sameNameOtherCity, ...matcher.scoreEntityCandidate(input(), sameNameOtherCity) }), true);
});

test("extracts website JSON-LD while preserving company-reported provenance", async () => {
  const htmlUrl = await moduleUrl("../app/lib/private-diligence/extraction/htmlExtractor.ts");
  const securityUrl = await moduleUrl("../app/lib/private-diligence/security.ts");
  const providerUrl = await moduleUrl("../app/lib/private-diligence/providers/companyWebsiteProvider.ts", {
    '"../extraction/htmlExtractor"': JSON.stringify(htmlUrl),
    '"../security"': JSON.stringify(securityUrl),
  });
  const { createCompanyWebsiteProvider } = await import(providerUrl + nonce());
  const html = `<!doctype html><title>Acme Robotics</title><meta name="description" content="Warehouse robots"><h1>Robots for warehouses</h1><script type="application/ld+json">{"@type":"Organization","name":"Acme Robotics","legalName":"Acme Robotics, Inc.","founder":{"name":"Avery Chen"},"address":{"addressLocality":"Austin","addressRegion":"TX"}}</script>`;
  const fetchImpl = async (url) => String(url).endsWith("robots.txt")
    ? new Response("User-agent: *\nDisallow:", { headers: { "content-type": "text/plain" } })
    : new Response(html, { headers: { "content-type": "text/html" } });
  const resolveHost = async () => [{ address: "93.184.216.34", family: 4 }];
  const provider = createCompanyWebsiteProvider({ fetchImpl, resolveHost, paths: ["/"] });
  const context = { researchId: "research-1", input: input(), identityGraph: graph(), now: () => new Date("2026-08-05T00:00:00Z") };
  const searched = await provider.search(context);
  assert.equal(searched.status, "partial");
  const evidence = await provider.normalize(searched.records, context);
  assert.equal(evidence[0].companyReported, true);
  assert.equal(evidence[0].officialRecord, false);
  assert.deepEqual(evidence[0].structuredData.founders, ["Avery Chen"]);
  assert.equal(evidence[0].structuredData.legalName, "Acme Robotics, Inc.");
});

test("blocks SSRF, cross-domain redirects, oversized responses, and unsupported content", async () => {
  const security = await import((await moduleUrl("../app/lib/private-diligence/security.ts")) + nonce());
  assert.equal(security.isBlockedNetworkAddress("127.0.0.1"), true);
  assert.equal(security.isBlockedNetworkAddress("10.1.2.3"), true);
  assert.equal(security.isBlockedNetworkAddress("93.184.216.34"), false);
  const publicDns = async () => [{ address: "93.184.216.34", family: 4 }];
  await assert.rejects(
    security.safeCompanyFetch("https://acme.example", {
      officialHostname: "acme.example", resolveHost: async () => [{ address: "127.0.0.1", family: 4 }],
      fetchImpl: async () => new Response("unused"),
    }), (error) => error.code === "blockedAddress",
  );
  await assert.rejects(
    security.safeCompanyFetch("https://acme.example", {
      officialHostname: "acme.example", resolveHost: publicDns,
      fetchImpl: async () => new Response(null, { status: 302, headers: { location: "https://evil.example" } }),
    }), (error) => error.code === "redirectRejected",
  );
  await assert.rejects(
    security.safeCompanyFetch("https://acme.example", {
      officialHostname: "acme.example", resolveHost: publicDns, maxBytes: 1024,
      fetchImpl: async () => new Response("x".repeat(2048), { headers: { "content-type": "text/html" } }),
    }), (error) => error.code === "responseTooLarge",
  );
  await assert.rejects(
    security.safeCompanyFetch("https://acme.example", {
      officialHostname: "acme.example", resolveHost: publicDns,
      fetchImpl: async () => new Response("%PDF", { headers: { "content-type": "application/pdf" } }),
    }), (error) => error.code === "unsupportedContentType",
  );
  assert.match(security.redactPrivateDiligenceText("https://x.example/?api_key=secret"), /REDACTED/);
  assert.doesNotMatch(security.redactPrivateDiligenceText("/Users/person/private.txt"), /Users\/person/);
});

test("filters and parses SEC Form D without changing the shared SEC client", async () => {
  const extractorUrl = await moduleUrl("../app/lib/private-diligence/extraction/formDExtractor.ts");
  const secStub = "data:text/javascript,export const secClient={};";
  const providerUrl = await moduleUrl("../app/lib/private-diligence/providers/secFormDProvider.ts", {
    '"../../sec-client"': JSON.stringify(secStub),
    '"../extraction/formDExtractor"': JSON.stringify(extractorUrl),
  });
  const { createSecFormDProvider, selectFormDFilings } = await import(providerUrl + nonce());
  const payload = { filings: { recent: {
    form: ["D", "D/A", "10-K"], accessionNumber: ["0000000123-26-000001", "0000000123-26-000002", "bad"],
    filingDate: ["2026-01-03", "2026-02-04", "2026-03-01"], primaryDocument: ["primary_doc.xml", "amendment.xml", "tenk.htm"],
  } } };
  assert.deepEqual(selectFormDFilings(payload, "0000000123").map((item) => item.form), ["D", "D/A"]);
  const document = `<edgarSubmission><entityName>Acme Robotics, Inc.</entityName><jurisdictionOfInc>Delaware</jurisdictionOfInc><totalOfferingAmount>5000000</totalOfferingAmount><totalAmountSold>3250000</totalAmountSold><dateOfFirstSale>2026-01-01</dateOfFirstSale><relatedPersonInfo><firstName>Avery</firstName><lastName>Chen</lastName></relatedPersonInfo></edgarSubmission>`;
  const client = { getSubmissions: async () => payload, getFilingDocument: async () => document };
  const provider = createSecFormDProvider(client);
  const context = { researchId: "research-1", input: input(), identityGraph: graph({ cikCandidates: ["0000000123"] }), now: () => new Date("2026-08-05T00:00:00Z") };
  const searched = await provider.search(context);
  const evidence = await provider.normalize(await provider.fetchDetails(searched.records, context), context);
  assert.equal(evidence.length, 2);
  assert.equal(evidence[0].structuredData.offeringAmount, 5_000_000);
  assert.equal(evidence[0].structuredData.amountSold, 3_250_000);
  assert.deepEqual(evidence[0].structuredData.relatedPersons, ["Avery Chen"]);
  assert.match(evidence[0].limitations.join(" "), /not company valuation/i);
  const sharedSecSource = await readFile(new URL("../app/lib/sec-client.ts", import.meta.url), "utf8");
  assert.match(sharedSecSource, /export class SecClient/);
});

test("accepts exact USAspending recipients and rejects weak name-only matches", async () => {
  const matcherUrl = await moduleUrl("../app/lib/private-diligence/entity-resolution/entityMatcher.ts");
  const officialStub = `data:text/javascript,${encodeURIComponent(`export async function fetchOfficialJson(url, options, fetchImpl) { const response = await fetchImpl(url, options); if (!response.ok) { const error = new Error("provider"); error.code = response.status === 429 ? "rateLimited" : "temporarilyUnavailable"; throw error; } return response.json(); }`)}`;
  const providerUrl = await moduleUrl("../app/lib/private-diligence/providers/usaSpendingProvider.ts", {
    '"../../market-analysis/security"': JSON.stringify(officialStub),
    '"../entity-resolution/entityMatcher"': JSON.stringify(matcherUrl),
  });
  const { createUsaSpendingProvider } = await import(providerUrl + nonce());
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls <= 2) return Response.json({ results: { recipients: [
      { recipient_name: "Acme Robotics, Inc.", recipient_id: "R1" },
      { recipient_name: "Acme Robotics Services", recipient_id: "R2" },
    ], parent_recipient: [{ recipient_name: "Acme Holdings", recipient_id: "P1" }] } });
    return Response.json({ results: [{
      "Award ID": "A-100", "Recipient Name": "Acme Robotics, Inc.", "Award Amount": 125000,
      "Awarding Agency": "Department of Example", "Start Date": "2025-10-01", Description: "Robotics pilot",
    }] });
  };
  const provider = createUsaSpendingProvider(fetchImpl);
  const context = { researchId: "research-1", input: input(), identityGraph: graph(), now: () => new Date("2026-08-05T00:00:00Z") };
  const searched = await provider.search(context);
  assert.equal(searched.records.length, 1);
  assert.ok(searched.rejectedWeakMatches >= 2);
  const evidence = await provider.normalize(await provider.fetchDetails(searched.records, context), context);
  assert.equal(evidence[0].structuredData.awardAmount, 125000);
  assert.equal(evidence[0].entityMatchConfidence, "Medium");
  assert.equal(evidence[0].officialRecord, true);
});

test("maps provider failures to typed non-fatal statuses", async () => {
  const providerTypes = await import((await moduleUrl("../app/lib/private-diligence/providers/providerTypes.ts")) + nonce());
  for (const [code, expected] of [
    ["SEC_RATE_LIMITED", "rateLimited"], ["rateLimited", "rateLimited"],
    ["SEC_TIMEOUT", "timeout"], ["malformedResponse", "parseFailed"],
    ["blockedAddress", "invalidRequest"], ["SEC_FORBIDDEN", "authenticationFailed"],
  ]) assert.equal(providerTypes.classifyPrivateProviderError({ code }), expected);
  const failing = {
    providerId: "test", providerName: "Test", sourceTier: 1, providerCategory: "officialRegistration",
    isConfigured: () => true, supports: () => true, validateConfiguration: () => "success",
    search: async () => { throw Object.assign(new Error("limited"), { code: "SEC_RATE_LIMITED" }); },
    fetchDetails: async () => [], normalize: async () => [], buildPublicReference: () => "https://example.gov",
  };
  const result = await providerTypes.executePrivateProvider(failing, { researchId: "r", input: input(), identityGraph: graph(), now: () => new Date() });
  assert.equal(result.status, "rateLimited");
  assert.doesNotMatch(JSON.stringify(result), /limited.*secret|stack/i);
});

test("deduplicates evidence, excludes weak leads, requires evidence for claims, and preserves conflicts", async () => {
  const evidenceRegistry = await import((await moduleUrl("../app/lib/private-diligence/evidence/evidenceRegistry.ts")) + nonce());
  const claimRegistry = await import((await moduleUrl("../app/lib/private-diligence/evidence/claimRegistry.ts")) + nonce());
  const reconciler = await import((await moduleUrl("../app/lib/private-diligence/evidence/claimReconciler.ts")) + nonce());
  const website = rawEvidence();
  const official = rawEvidence({
    evidenceId: "ev-2", providerId: "stateRegistry", sourceTier: 1, officialRecord: true,
    companyReported: false, contentHash: "hash-2", structuredData: { issuerLegalName: "Acme Automation LLC", jurisdiction: "Delaware" },
  });
  const lead = rawEvidence({ evidenceId: "ev-3", providerId: "webDiscovery", sourceTier: 4, entityMatchConfidence: "Low", contentHash: "hash-3" });
  const normalized = evidenceRegistry.normalizeEvidenceRegistry([website, website, official, lead]);
  assert.equal(normalized.length, 3);
  assert.equal(normalized.find((item) => item.evidenceId === "ev-2").verificationEligibility, "finalEvidence");
  assert.equal(normalized.find((item) => item.evidenceId === "ev-3").verificationEligibility, "excluded");
  const claims = claimRegistry.buildClaimRegistry("research-1", "entity-acme", normalized);
  assert.ok(claims.every((claim) => claim.evidenceIds.length));
  assert.throws(() => claimRegistry.assertClaimsHaveEvidence([{ ...claims[0], evidenceIds: [] }]));
  const reconciled = reconciler.reconcileClaims(claims, normalized);
  assert.ok(reconciled.conflicts.some((item) => item.claimType === "legalName"));
  assert.ok(reconciled.claims.filter((item) => item.claimType === "legalName").every((item) => item.status === "Conflicting"));
});

test("generates an evidence-backed report with references last and explicit gaps", async () => {
  const copyUrl = await moduleUrl("../app/lib/private-diligence/copy.ts");
  const reportBuilderUrl = await moduleUrl("../app/lib/private-diligence/reports/reportBuilder.ts", {
    '"../copy"': JSON.stringify(copyUrl),
  });
  const riskUrl = await moduleUrl("../app/lib/private-diligence/analysis/riskAndGapEngine.ts");
  const { buildPrivateDiligenceReport } = await import(reportBuilderUrl + nonce());
  const risk = await import(riskUrl + nonce());
  const evidence = [{
    evidenceId: "ev-1", entityId: "entity-acme", providerId: "companyWebsite", sourceTier: 2,
    evidenceType: "Company-controlled web page", subjectName: "Acme Robotics, Inc.", subjectIdentifiers: ["domain"],
    normalizedFields: { organizationName: "Acme Robotics, Inc.", description: "Acme builds robots" },
    sourceTitle: "Acme About", sourceUrl: "https://acme.example/about", publicationDate: null,
    retrievedAt: "2026-08-05T00:00:00.000Z", companyReported: true, officialRecord: false,
    independentlyPublished: false, entityMatchConfidence: "High", verificationEligibility: "supportingEvidence", limitations: [],
  }];
  const claims = [{
    claimId: "claim-1", researchId: "research-1", entityId: "entity-acme", category: "Business model",
    claimType: "description", statement: "Acme builds robots", normalizedValue: "Acme builds robots",
    unit: null, period: null, geography: null, evidenceIds: ["ev-1"], companyReported: true,
    independentlyVerified: false, officiallyVerified: false, conflictingEvidenceIds: [], status: "CompanyReported",
    confidence: "High", materiality: "Medium", limitations: [],
  }];
  const gaps = risk.buildInformationGaps(claims, evidence);
  const questions = risk.buildDiligenceQuestions(gaps, []);
  const report = buildPrivateDiligenceReport({
    researchId: "research-1", input: input(), graph: graph(), providerPlan: [], evidence, claims,
    conflicts: [], risks: [], informationGaps: gaps, questions, generatedAt: "2026-08-05T00:00:00.000Z",
  });
  assert.equal(report.sections.at(-1).number, "20");
  assert.ok(report.sections.every((section) => section.paragraphs.length));
  assert.match(report.disclosure, /publicly accessible information/i);
  assert.match(JSON.stringify(report.informationGaps), /not evidence of misconduct|cannot be verified|not publicly disclosed/i);
  assert.doesNotMatch(JSON.stringify(report), /investment recommendation|exact private-company valuation/i);
  assert.ok(report.claims.every((claim) => claim.evidenceIds.length));
});

test("keeps Clara UI bilingual, responsive, export-safe, and isolated from other agents", async () => {
  const [workspace, workflow, copy, css, exports, ethan, mason, nora] = await Promise.all([
    readFile(new URL("../app/TeamWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ClaraPrivateDiligenceWorkflow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/private-diligence/copy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/private-diligence/export/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ResearchApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MasonMarketAnalysisWorkflow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/NoraRegulatoryWorkflow.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /\/workflows\/private-company-diligence/);
  assert.match(workflow, /Confirm target company|CLARA_COPY/);
  assert.match(workflow, /downloadMarkdown/);
  assert.match(workflow, /evidenceXlsx/);
  assert.match(copy, /Clara 应该研究哪家私营公司/);
  assert.doesNotMatch(copy, /(?:heading|confirmHeading|assign|generate):\s*"[^"]+[。.]"/u);
  assert.match(css, /@media \(max-width: 840px\)/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(exports, /function safeCell/);
  assert.match(exports, /\^\\s\*\[=\+\\-@\]/);
  assert.doesNotMatch(exports, /rawText/);
  assert.match(ethan, /FinBro Equity Research/);
  assert.match(mason, /Mason/);
  assert.match(nora, /Nora/);
});
