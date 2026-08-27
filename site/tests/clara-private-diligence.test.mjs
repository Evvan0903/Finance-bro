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
    termsPageLegalNames: [], privacyPageLegalNames: [], productCategories: [],
    identityConfidence: "High", resolutionStatus: "autoConfirmed", identityLimitations: [],
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

function entityCandidate(overrides = {}) {
  return {
    candidateId: "candidate-website", displayName: "Acme Robotics", legalName: null,
    dbaNames: [], formerNames: [], website: "https://acme.example", domain: "acme.example",
    city: null, state: null, country: null, industry: null, founders: [], executives: [],
    registrationJurisdiction: null, registrationNumbers: [], addresses: [], phoneNumbers: [],
    emailDomains: [], websiteOrganizationNames: [], termsLegalNames: [], privacyLegalNames: [],
    pageTitles: [], socialProfiles: [], productCategories: [], affiliateNames: [],
    websiteReachable: true, unresolvedIdentityFields: [], sourceIds: ["website-r-1"],
    ...overrides,
  };
}

test("accepts either company name or website and rejects an empty identity request", async () => {
  const schema = await import((await moduleUrl("../app/lib/private-diligence/schema.ts")) + nonce());
  assert.equal(schema.parsePrivateCompanyInput({ website: "abaka.ai" }).companyName, null);
  assert.equal(schema.parsePrivateCompanyInput({ companyName: "Abaka AI" }).website, null);
  assert.throws(() => schema.parsePrivateCompanyInput({}), /name or company website/i);
});

test("discovers website-only identity signals and preserves Company Reported evidence", async () => {
  const htmlUrl = await moduleUrl("../app/lib/private-diligence/extraction/htmlExtractor.ts");
  const securityUrl = await moduleUrl("../app/lib/private-diligence/security.ts");
  const providerUrl = await moduleUrl("../app/lib/private-diligence/providers/companyWebsiteProvider.ts", {
    '"../extraction/htmlExtractor"': JSON.stringify(htmlUrl),
    '"../security"': JSON.stringify(securityUrl),
  });
  const graphUrl = await moduleUrl("../app/lib/private-diligence/entity-resolution/identityGraphBuilder.ts");
  const matcherUrl = await moduleUrl("../app/lib/private-diligence/entity-resolution/entityMatcher.ts");
  const modelUrl = `data:text/javascript,${encodeURIComponent('export async function runClaraModel(){throw new Error("MODEL_DISABLED_IN_FIXTURE") }')}`;
  const discoveryUrl = await moduleUrl("../app/lib/private-diligence/entity-resolution/candidateDiscovery.ts", {
    '"../providers/companyWebsiteProvider"': JSON.stringify(providerUrl),
    '"./identityGraphBuilder"': JSON.stringify(graphUrl),
    '"./entityMatcher"': JSON.stringify(matcherUrl),
    '"../modelRouter"': JSON.stringify(modelUrl),
  });
  const { discoverEntityCandidates } = await import(discoveryUrl + nonce());
  const pages = {
    "/": `<!doctype html><title>Acme Robotics | Automation</title><meta name="description" content="Industrial robotics"><a href="/terms">Terms</a><script type="application/ld+json">{"@type":"Organization","name":"Acme Robotics","industry":"Robotics","email":"hello@acme.example","address":{"addressLocality":"Austin","addressRegion":"Texas","addressCountry":"United States"}}</script><p>hello@acme.example</p>`,
    "/terms": `<!doctype html><title>Terms | Acme Robotics</title><p>These Terms are provided by Acme Robotics, Inc.</p>`,
    "/privacy": `<!doctype html><title>Privacy | Acme Robotics</title><p>Acme Robotics, Inc. controls this privacy policy.</p>`,
    "/contact": `<!doctype html><title>Contact | Acme Robotics</title><address>1 Main Street, Austin, Texas</address>`,
    "/team": `<!doctype html><title>Team | Acme Robotics</title><p>Founded by Avery Chen</p>`,
  };
  const fetchImpl = async (url) => {
    const target = new URL(String(url));
    if (target.pathname === "/robots.txt") return new Response("User-agent: *\nDisallow:", { headers: { "content-type": "text/plain" } });
    return new Response(pages[target.pathname] ?? "", { status: pages[target.pathname] ? 200 : 404, headers: { "content-type": "text/html" } });
  };
  const result = await discoverEntityCandidates("research-web", input({ companyName: null, website: "https://acme.example", city: null, state: null, founderOrExecutive: null, industry: null }), {
    fetchImpl, resolveHost: async () => [{ address: "93.184.216.34", family: 4 }],
    paths: ["/", "/terms", "/privacy", "/contact", "/team"],
  });
  assert.equal(result.websiteStatus, "reachable");
  assert.equal(result.candidates.length, 1);
  const candidate = result.candidates[0];
  assert.equal(candidate.displayName, "Acme Robotics");
  assert.equal(candidate.legalName, "Acme Robotics, Inc");
  assert.equal(candidate.city, "Austin");
  assert.equal(candidate.industry, "Robotics");
  assert.deepEqual(candidate.founders, ["Avery Chen"]);
  assert.ok(candidate.matchSignals.includes("Exact confirmed domain match"));
  assert.ok(candidate.matchSignals.includes("Organization name confirmed on official website"));
  assert.equal(result.websiteEvidence.every((item) => item.companyReported && !item.officialRecord), true);
  assert.equal(result.websiteEvidence.some((item) => item.structuredData.pageType === "terms" && item.structuredData.evidenceStatus === "Company Reported"), true);
  assert.equal(result.websiteEvidence.some((item) => item.structuredData.pageType === "privacy" && item.structuredData.legalEntityMentions.length > 0), true);

  const titleOnly = await discoverEntityCandidates("research-title", input({ companyName: null, website: "https://acme.example", city: null, state: null, country: null, founderOrExecutive: null, industry: null }), {
    fetchImpl: async (url) => String(url).endsWith("robots.txt")
      ? new Response("User-agent: *\nDisallow:", { headers: { "content-type": "text/plain" } })
      : new Response("<!doctype html><title>Beacon Labs | Home</title>", { headers: { "content-type": "text/html" } }),
    resolveHost: async () => [{ address: "93.184.216.34", family: 4 }], paths: ["/"],
  });
  assert.equal(titleOnly.candidates[0].displayName, "Beacon Labs");

  const ambiguous = await discoverEntityCandidates("research-multi", input({ companyName: "Acme AI", website: null, city: null, state: null, country: null, founderOrExecutive: null, industry: null }), {
    fetchImpl: async (url) => {
      const target = new URL(String(url));
      if (target.pathname === "/robots.txt") return new Response("User-agent: *\nDisallow:", { headers: { "content-type": "text/plain" } });
      return new Response(`<!doctype html><title>Acme AI</title><script type="application/ld+json">{"@type":"Organization","name":"Acme AI","url":"${target.origin}"}</script>`, { headers: { "content-type": "text/html" } });
    },
    resolveHost: async () => [{ address: "93.184.216.34", family: 4 }], paths: ["/"],
  });
  assert.ok(ambiguous.candidates.length >= 2 && ambiguous.candidates.length <= 5);
  assert.equal(ambiguous.candidates.every((item) => item.researchRequestId === "research-multi" && item.candidateId && item.sourceIds.length), true);

  const oneGrounded = await discoverEntityCandidates("research-one", input({ companyName: "Acme AI", website: null, city: null, state: null, country: null, founderOrExecutive: null, industry: null }), {
    fetchImpl: async (url) => {
      const target = new URL(String(url));
      if (target.pathname === "/robots.txt") return new Response("User-agent: *\nDisallow:", { headers: { "content-type": "text/plain" } });
      if (target.hostname !== "acme.ai") return new Response("", { status: 404, headers: { "content-type": "text/html" } });
      return new Response('<!doctype html><title>Acme AI</title><script type="application/ld+json">{"@type":"Organization","name":"Acme AI"}</script>', { headers: { "content-type": "text/html" } });
    },
    resolveHost: async () => [{ address: "93.184.216.34", family: 4 }], paths: ["/"],
  });
  assert.equal(oneGrounded.candidates.length, 1);
});

test("uses page-title fallback, flags name mismatches, and shares low-score confirmation rules", async () => {
  const matcher = await import((await moduleUrl("../app/lib/private-diligence/entity-resolution/entityMatcher.ts")) + nonce());
  const titleCandidate = entityCandidate({ websiteOrganizationNames: ["Beacon Labs"], pageTitles: ["Beacon Labs"] });
  const titleScore = matcher.scoreEntityCandidate(input({ companyName: null, website: "https://acme.example", city: null, state: null, country: null, founderOrExecutive: null, industry: null }), titleCandidate);
  assert.equal(titleScore.matchScore, 55);
  assert.equal(matcher.getEntityConfirmationEligibility({ ...titleCandidate, ...titleScore }).canConfirm, true);
  const mismatchScore = matcher.scoreEntityCandidate(input({ companyName: "Different Holdings", city: null, state: null, country: null, founderOrExecutive: null, industry: null }), titleCandidate);
  assert.ok(mismatchScore.matchSignals.includes("Website organization differs from supplied company name"));
  const low = { ...titleCandidate, matchScore: 35, matchConfidence: "Low", matchSignals: ["Exact confirmed domain match"], resolutionStatus: "requiresUserConfirmation" };
  assert.equal(matcher.getEntityConfirmationEligibility(low).canConfirm, false);
  assert.equal(matcher.getEntityConfirmationEligibility(low, true).canConfirm, true);
  const termsOnlyScore = matcher.scoreEntityCandidate(input({ companyName: null, website: "https://acme.example", city: null, state: null, country: null, founderOrExecutive: null, industry: null }), entityCandidate({
    termsLegalNames: ["Acme Robotics, Inc"],
  }));
  assert.equal(termsOnlyScore.matchScore, 55);
  assert.equal(matcher.getEntityConfirmationEligibility({ ...entityCandidate({ termsLegalNames: ["Acme Robotics, Inc"] }), ...termsOnlyScore }).canConfirm, true);
  assert.equal(matcher.getEntityConfirmationEligibility({ ...low, matchScore: 60, matchSignals: [] }).canConfirm, true);
  const duplicate = matcher.scoreEntityCandidate(input({ companyName: null, city: null, state: null, country: null, founderOrExecutive: null, industry: null }), entityCandidate({
    websiteOrganizationNames: ["Acme Robotics", "Acme Robotics"], pageTitles: ["Acme Robotics", "Acme Robotics"],
    emailDomains: ["acme.example", "acme.example"], termsLegalNames: ["Acme Robotics, Inc", "Acme Robotics, Inc"],
  }));
  assert.equal(duplicate.matchScore, 85);
  assert.equal(new Set(duplicate.matchSignals).size, duplicate.matchSignals.length);
});

test("enforces website crawl page and depth limits", async () => {
  const htmlUrl = await moduleUrl("../app/lib/private-diligence/extraction/htmlExtractor.ts");
  const securityUrl = await moduleUrl("../app/lib/private-diligence/security.ts");
  const providerUrl = await moduleUrl("../app/lib/private-diligence/providers/companyWebsiteProvider.ts", {
    '"../extraction/htmlExtractor"': JSON.stringify(htmlUrl),
    '"../security"': JSON.stringify(securityUrl),
  });
  const { createCompanyWebsiteProvider, selectIdentityLinks } = await import(providerUrl + nonce());
  assert.deepEqual(selectIdentityLinks(new URL("https://acme.example"), ["/about", "/legal/privacy", "/legal/a/privacy", "https://evil.example/about"], 2), [
    "https://acme.example/about", "https://acme.example/legal/privacy",
  ]);
  let htmlRequests = 0;
  const provider = createCompanyWebsiteProvider({
    paths: Array.from({ length: 20 }, (_, index) => `/about-${index}`), maxPages: 12, maxDepth: 2,
    resolveHost: async () => [{ address: "93.184.216.34", family: 4 }],
    fetchImpl: async (url) => {
      if (String(url).endsWith("robots.txt")) return new Response("User-agent: *\nDisallow:", { headers: { "content-type": "text/plain" } });
      htmlRequests += 1;
      return new Response("<!doctype html><title>Acme Robotics</title>", { headers: { "content-type": "text/html" } });
    },
  });
  const searched = await provider.search({ researchId: "r", input: input(), identityGraph: graph(), now: () => new Date() });
  assert.equal(searched.records.length, 12);
  assert.equal(htmlRequests, 12);
});

test("builds a low-confidence user-confirmed graph with a visible identity limitation", async () => {
  const builder = await import((await moduleUrl("../app/lib/private-diligence/entity-resolution/identityGraphBuilder.ts")) + nonce());
  const low = entityCandidate({
    displayName: "Acme Robotics", matchScore: 35, matchConfidence: "Low",
    matchSignals: ["Exact confirmed domain match"], resolutionStatus: "userConfirmed",
    unresolvedIdentityFields: ["Legal entity name"],
  });
  const built = builder.buildIdentityGraph(low, input({ companyName: null }));
  assert.equal(built.resolutionStatus, "userConfirmed");
  assert.equal(built.identityConfidence, "Low");
  assert.match(built.identityLimitations.join(" "), /Target selected by the user before full legal-entity verification/i);
  assert.equal(built.targetSelectionStatus, "userSelected");
  assert.equal(built.identityVerificationStatus, "partiallyVerified");
});

test("separates explicit target selection from legal-entity verification", async () => {
  const matcher = await import((await moduleUrl("../app/lib/private-diligence/entity-resolution/entityMatcher.ts")) + nonce());
  const incomplete = entityCandidate({
    displayName: "Abaka AI", legalName: null, city: null, state: null, country: null,
    founders: [], executives: [], matchScore: 35, matchConfidence: "Low",
    resolutionStatus: "requiresUserConfirmation", sourceIds: ["public-discovery-1"],
    matchSignals: ["Public website discovered for supplied company name"],
  });
  assert.equal(matcher.getEntityConfirmationEligibility(incomplete, true).canConfirm, true);
  assert.equal(matcher.canSelectTarget(incomplete, true).selectable, true);
  assert.equal(matcher.selectTargetCandidate([incomplete], incomplete.candidateId).selectable, true);
  assert.equal(matcher.selectTargetCandidate([incomplete], "tampered-id").reason, "candidateNotInResearch");
  const second = { ...incomplete, candidateId: "candidate-second", displayName: "Abaka Analytics" };
  assert.equal(matcher.selectTargetCandidate([incomplete, second], second.candidateId).candidate.displayName, "Abaka Analytics");
  const unrelated = { ...incomplete, candidateId: "unrelated", relationshipType: "Likely unrelated" };
  assert.equal(matcher.canSelectTarget(unrelated, true).selectable, false);
  const noBasis = { ...incomplete, candidateId: "no-basis", sourceIds: [], matchSignals: [] };
  assert.equal(matcher.canSelectTarget(noBasis, true).selectable, false);
  for (const matchConfidence of ["Low", "Medium", "High"]) {
    const candidate = { ...incomplete, candidateId: `candidate-${matchConfidence}`, matchConfidence };
    const frontend = matcher.getEntityConfirmationEligibility(candidate, true).canConfirm;
    const backend = matcher.selectTargetCandidate([candidate], candidate.candidateId).selectable;
    assert.equal(frontend, backend, `${matchConfidence} frontend/backend selection parity`);
  }
});

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
    websiteOrganizationNames: ["Acme Robotics"], termsLegalNames: ["Acme Robotics, Inc."],
    privacyLegalNames: [], pageTitles: ["Acme Robotics"], socialProfiles: [],
    productCategories: [], affiliateNames: [], websiteReachable: true, unresolvedIdentityFields: [],
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
  await assert.rejects(
    security.safeCompanyFetch("https://acme.example", {
      officialHostname: "acme.example", resolveHost: publicDns, timeoutMs: 1_000,
      fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      }),
    }), (error) => error.code === "timeout",
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

test("keeps Clara UI bilingual, confirmation-consistent, export-safe, and isolated from other agents", async () => {
  const [workspace, workflow, confirmRoute, copy, css, exports, ethan, mason, nora] = await Promise.all([
    readFile(new URL("../app/TeamWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ClaraPrivateDiligenceWorkflow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/private-diligence/confirm-entity/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/private-diligence/copy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/private-diligence/export/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ResearchApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MasonMarketAnalysisWorkflow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/NoraRegulatoryWorkflow.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /\/workflows\/private-company-diligence/);
  assert.match(workflow, /Confirm target company|CLARA_COPY/);
  assert.match(workflow, /required=\{!input\.website\}/);
  assert.match(workflow, /required=\{!input\.companyName\}/);
  assert.match(workflow, /getEntityConfirmationEligibility/);
  assert.match(confirmRoute, /getEntityConfirmationEligibility\(candidate, true\)/);
  assert.doesNotMatch(confirmRoute, /A plausible target company must be confirmed/);
  assert.match(workflow, /Not identified|notIdentified/);
  assert.match(workflow, /lowConfidenceWebsite/);
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
