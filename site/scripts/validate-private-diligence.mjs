const scenarios = [
  {
    profile: "venture-backed technology company",
    input: {
      companyName: "Anthropic PBC", website: "https://www.anthropic.com",
      city: "San Francisco", state: "California", country: "United States",
      founderOrExecutive: "Dario Amodei", industry: "Artificial intelligence",
      researchObjective: "Investor screening", locale: "en", reportDepth: "Standard",
    },
  },
  {
    profile: "government contractor and construction-services company",
    input: {
      companyName: "Turner Construction Company", website: "https://www.turnerconstruction.com",
      city: "New York", state: "New York", country: "United States",
      founderOrExecutive: null, industry: "Construction services",
      researchObjective: "Vendor diligence", locale: "en", reportDepth: "Standard",
    },
  },
  {
    profile: "small private company with limited public information",
    input: {
      companyName: "Pine Park Health", website: "https://www.pineparkhealth.com",
      city: "Oakland", state: "California", country: "United States",
      founderOrExecutive: null, industry: "Healthcare services",
      researchObjective: "Partnership review", locale: "en", reportDepth: "Compact",
    },
  },
];

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("clara-validation", `${Date.now()}-${Math.random()}`);
const { default: worker } = await import(workerUrl.href);
const environment = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const context = { waitUntil() {}, passThroughOnException() {} };

async function request(path, body) {
  const response = await worker.fetch(new Request(`http://localhost${path}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }), environment, context);
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path} ${response.status} ${payload.code ?? "ERROR"}: ${payload.message ?? "request failed"}`);
  return payload;
}

const results = [];
for (const scenario of scenarios) {
  const startedAt = Date.now();
  try {
    const discovered = await request("/api/private-diligence/candidates", { input: scenario.input });
    const candidate = discovered.candidates?.[0];
    if (!candidate) throw new Error("No plausible candidate was returned");
    const confirmed = await request("/api/private-diligence/confirm-entity", {
      researchId: discovered.researchId, candidateId: candidate.candidateId, explicitUserConfirmation: true,
    });
    await request("/api/private-diligence/plan", { researchId: discovered.researchId });
    const completed = await request("/api/private-diligence/run", { researchId: discovered.researchId });
    const report = completed.report;
    const providerStatuses = Object.fromEntries(report.providerPlan.map((item) => [item.providerId, item.selected ? "selected" : "not selected"]));
    results.push({
      profile: scenario.profile,
      company: report.entity.canonicalName,
      passed: true,
      candidateConfidence: candidate.matchConfidence,
      identityConfidence: confirmed.entity.identityConfidence,
      coverage: report.coverageStatus,
      evidenceCount: report.evidence.length,
      claimCount: report.claims.length,
      companyReportedClaims: report.claims.filter((claim) => claim.companyReported).length,
      officialEvidenceCount: report.evidence.filter((evidence) => evidence.officialRecord).length,
      conflicts: report.conflicts.length,
      risks: report.risks.length,
      informationGaps: report.informationGaps.length,
      followUpQuestions: report.questions.length,
      references: report.references.length,
      referencesSanitized: report.references.every((reference) =>
        /^https:\/\//.test(reference.sourceUrl) && !/(?:api_?key|token|secret)=/i.test(reference.sourceUrl)),
      claimsHaveEvidence: report.claims.every((claim) => claim.evidenceIds.length > 0),
      referencesFinal: report.sections.at(-1)?.number === "20",
      noUnsupportedPrecision: !/(exact private-company (?:revenue|valuation)|investment recommendation)/i.test(JSON.stringify(report)),
      providerPlan: providerStatuses,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    results.push({
      profile: scenario.profile,
      company: scenario.input.companyName,
      passed: false,
      issue: error instanceof Error ? error.message : "Unknown validation failure",
      elapsedMs: Date.now() - startedAt,
    });
  }
}

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  sourcePolicy: "Real public sources only; no findings are hardcoded into production code",
  scenarios: results,
  passed: results.every((result) => result.passed),
}, null, 2));

if (!results.every((result) => result.passed)) process.exitCode = 1;
