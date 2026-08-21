const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("clara-website-first", `${Date.now()}-${Math.random()}`);
const { default: worker } = await import(workerUrl.href);
const environment = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const context = { waitUntil() {}, passThroughOnException() {} };

async function request(path, body) {
  const response = await worker.fetch(new Request(`http://localhost${path}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }), environment, context);
  const payload = await response.json();
  return { ok: response.ok, status: response.status, payload };
}

function baseInput(overrides) {
  return {
    companyName: null, website: null, city: null, state: null, country: "United States",
    founderOrExecutive: null, industry: null, researchObjective: "General diligence",
    locale: "en", reportDepth: "Compact", ...overrides,
  };
}

async function discover(input) {
  const response = await request("/api/private-diligence/candidates", { input });
  if (!response.ok) throw new Error(response.payload.message ?? "Candidate request failed");
  return response.payload;
}

async function confirm(discovered) {
  const candidate = discovered.candidates?.[0];
  if (!candidate) return null;
  if (discovered.autoConfirmedCandidateId === candidate.candidateId) return candidate;
  const response = await request("/api/private-diligence/confirm-entity", {
    researchId: discovered.researchId, candidateId: candidate.candidateId, explicitUserConfirmation: true,
  });
  if (!response.ok) throw new Error(response.payload.message ?? "Confirmation failed");
  return candidate;
}

const scenarios = [];

const abaka = await discover(baseInput({ website: "https://www.abaka.ai/" }));
const abakaCandidate = await confirm(abaka);
if (!abakaCandidate) throw new Error("Abaka website-only discovery returned no candidate");
await request("/api/private-diligence/plan", { researchId: abaka.researchId });
const abakaRun = await request("/api/private-diligence/run", { researchId: abaka.researchId });
scenarios.push({
  scenario: "website-only Abaka AI",
  passed: Boolean(abakaCandidate.websiteReachable && abakaCandidate.matchSignals.includes("Exact confirmed domain match") && abakaRun.ok),
  displayName: abakaCandidate.displayName,
  legalName: abakaCandidate.legalName,
  confidence: abakaCandidate.matchConfidence,
  score: abakaCandidate.matchScore,
  people: [...abakaCandidate.founders, ...abakaCandidate.executives],
  location: [abakaCandidate.city, abakaCandidate.state, abakaCandidate.country].filter(Boolean),
  industry: abakaCandidate.industry,
  unresolved: abakaCandidate.unresolvedIdentityFields,
  reportGenerated: abakaRun.ok,
  companyReportedEvidenceOnly: abakaRun.ok && abakaRun.payload.report.evidence
    .filter((item) => item.providerId === "companyWebsite").every((item) => item.companyReported),
});

const second = await discover(baseInput({ website: "https://www.anthropic.com/" }));
const secondCandidate = await confirm(second);
scenarios.push({
  scenario: "website-only second private company",
  passed: Boolean(secondCandidate?.websiteReachable),
  displayName: secondCandidate?.displayName ?? null,
  confidence: secondCandidate?.matchConfidence ?? null,
  score: secondCandidate?.matchScore ?? null,
});

const nameOnly = await discover(baseInput({ companyName: "Abaka AI" }));
const nameOnlyCandidate = await confirm(nameOnly);
const nameOnlyRun = nameOnlyCandidate
  ? await request("/api/private-diligence/run", { researchId: nameOnly.researchId })
  : { ok: false };
scenarios.push({
  scenario: "company-name-only",
  passed: Boolean(nameOnlyCandidate && nameOnlyRun.ok),
  needsMoreInformation: nameOnly.needsMoreInformation,
  candidateConfidence: nameOnlyCandidate?.matchConfidence ?? null,
  targetSelected: Boolean(nameOnlyCandidate),
  reportGenerated: nameOnlyRun.ok,
});

const mismatch = await discover(baseInput({ companyName: "Unrelated Holdings", website: "https://www.abaka.ai/" }));
scenarios.push({
  scenario: "mismatched name and website",
  passed: mismatch.candidates?.[0]?.matchSignals.includes("Website organization differs from supplied company name") === true,
  signals: mismatch.candidates?.[0]?.matchSignals ?? [],
});

const unreachable = await discover(baseInput({ website: "https://clara-unreachable.invalid/" }));
scenarios.push({
  scenario: "unreachable website",
  passed: unreachable.needsMoreInformation === true && unreachable.candidates.length === 0,
  message: unreachable.message,
});

const lowInformation = await discover(baseInput({ website: "https://example.com/" }));
scenarios.push({
  scenario: "low-information website",
  passed: Boolean(lowInformation.candidates?.[0]?.websiteReachable && lowInformation.candidates?.[0]?.unresolvedIdentityFields.length),
  displayName: lowInformation.candidates?.[0]?.displayName ?? null,
  confidence: lowInformation.candidates?.[0]?.matchConfidence ?? null,
  unresolved: lowInformation.candidates?.[0]?.unresolvedIdentityFields ?? [],
});

const output = {
  generatedAt: new Date().toISOString(),
  sourcePolicy: "Live public websites; no validation findings are hardcoded into production code",
  scenarios,
  passed: scenarios.every((scenario) => scenario.passed),
};
console.log(JSON.stringify(output, null, 2));
if (!output.passed) process.exitCode = 1;
