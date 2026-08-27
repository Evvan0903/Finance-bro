import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

function run(script, databasePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
      cwd: new URL("..", import.meta.url),
      env: { ...process.env, CLARA_LOCAL_DATABASE_PATH: databasePath, DEEPSEEK_API_KEY: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr || `child exited ${code}`)));
  });
}

test("candidate ownership persists across separate runtime processes without module memory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "finbro-clara-"));
  const databasePath = join(directory, "clara.db");
  const researchId = "10000000-0000-4000-8000-000000000001";
  const candidateId = "20000000-0000-4000-8000-000000000001";
  try {
    await run(`
      import { privateDiligenceStore as store } from "./app/lib/private-diligence/persistence/researchStore.ts";
      const candidate = { candidateId: "${candidateId}", researchRequestId: "${researchId}", displayName: "Abaka AI", legalName: "Abaka AI, Inc.", dbaNames: [], formerNames: [], website: "https://www.abaka.ai/", domain: "abaka.ai", city: null, state: null, country: null, industry: "AI", founders: [], executives: [], registrationJurisdiction: null, registrationNumbers: [], addresses: [], phoneNumbers: [], emailDomains: [], websiteOrganizationNames: ["Abaka AI"], termsLegalNames: ["Abaka AI, Inc."], privacyLegalNames: [], pageTitles: ["Abaka AI"], socialProfiles: [], productCategories: [], affiliateNames: [], websiteReachable: true, unresolvedIdentityFields: [], sourceIds: ["public-source-1"], matchSignals: ["Exact confirmed domain match"], matchScore: 90, matchConfidence: "High", resolutionStatus: "requiresUserConfirmation", targetSelectionStatus: "unselected", identityVerificationStatus: "unverified", relationshipType: "Target operating company" };
      const now = new Date().toISOString();
      await store.set({ researchId: "${researchId}", createdAt: now, updatedAt: now, stage: "entityResolution", stageStatus: "requiresConfirmation", input: { companyName: "Abaka AI", website: "https://www.abaka.ai/", city: null, state: null, country: null, founderOrExecutive: null, industry: null, researchObjective: "General diligence", locale: "en", reportDepth: "Standard", workflowMode: "quick", quickResearchPurpose: "General Research" }, candidates: [candidate], confirmedCandidate: null, identityGraph: null, providerPlan: [], providerResults: [], rawEvidence: [], normalizedEvidence: [], report: null, errorCode: null });
    `, databasePath);

    const loaded = await run(`
      import { privateDiligenceStore as store } from "./app/lib/private-diligence/persistence/researchStore.ts";
      const record = await store.get("${researchId}");
      const candidate = await store.getCandidate("${researchId}", "${candidateId}");
      const crossRequest = await store.getCandidate("30000000-0000-4000-8000-000000000001", "${candidateId}");
      console.log(JSON.stringify({ requestId: record?.researchId, candidateRequestId: candidate?.researchRequestId, crossRequest }));
    `, databasePath);
    assert.deepEqual(JSON.parse(loaded), { requestId: researchId, candidateRequestId: researchId, crossRequest: null });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("persistence source contains normalized tables and no process-local record Map", async () => {
  const { readFile } = await import("node:fs/promises");
  const [schema, store] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/private-diligence/persistence/researchStore.ts", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /researchRequests/);
  assert.match(schema, /entityCandidates/);
  assert.match(schema, /selectedTargets/);
  assert.doesNotMatch(store, /globalThis|new Map/);
});
