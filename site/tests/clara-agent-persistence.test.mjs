import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

function run(script, databasePath) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, CLARA_LOCAL_DATABASE_PATH: databasePath };
    for (const key of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "LIBSQL_DATABASE_URL", "LIBSQL_AUTH_TOKEN", "DEEPSEEK_API_KEY"]) delete env[key];
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
      cwd: new URL("..", import.meta.url), env, stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr || `child exited ${code}`)));
  });
}

test("single-step execution uses executeClaraTool and survives a fresh LibSQL connection", async () => {
  const directory = await mkdtemp(join(tmpdir(), "finbro-clara-agent-"));
  const databasePath = join(directory, "clara.db");
  try {
    const created = JSON.parse(await run(`
      import { researchStateStore } from "./app/lib/private-diligence/state/researchStateStore.ts";
      import { privateDiligenceStore } from "./app/lib/private-diligence/persistence/researchStore.ts";
      import { runClaraAgentStep } from "./app/lib/private-diligence/agent/runClaraAgentStep.ts";
      const input = { companyName: "Acme", website: "https://acme.example", city: null, state: null, country: null, founderOrExecutive: null, industry: null, researchObjective: "General diligence", locale: "en", reportDepth: "Compact", workflowMode: "quick", quickResearchPurpose: "General Research" };
      const graph = { entityId: "entity-acme", canonicalName: "Acme", legalNames: [], dbaNames: [], formerNames: [], domains: ["acme.example"], emailDomains: [], addresses: [], phoneNumbers: [], founders: [], executives: [], directors: [], registrationNumbers: [], registrationJurisdictions: [], cikCandidates: [], ueiCandidates: [], cageCodes: [], samEntityIds: [], usaSpendingRecipientIds: [], patentAssigneeNames: [], trademarkOwnerNames: [], parentCompanies: [], subsidiaries: [], affiliatedEntities: [], socialProfiles: [], termsPageLegalNames: [], privacyPageLegalNames: [], productCategories: [], industryLabels: [], identityConfidence: "High", resolutionStatus: "userConfirmed", targetSelectionStatus: "userSelected", identityVerificationStatus: "verified", identityLimitations: [] };
      await privateDiligenceStore.set({ researchId: "research-agent-1", createdAt: "2026-09-02T10:00:00.000Z", updatedAt: "2026-09-02T10:00:00.000Z", stage: "entityResolution", stageStatus: "running", input, candidates: [], confirmedCandidate: null, identityGraph: graph, providerPlan: [], providerResults: [], rawEvidence: [], normalizedEvidence: [], hiringIntelligence: null, report: null, errorCode: null });
      const state = await researchStateStore.createResearchState({ objective: "General company research", researchRequestId: "research-agent-1", now: () => new Date("2026-09-02T10:00:00.000Z") });
      const result = await runClaraAgentStep({ researchStateId: state.id }, { planner: async () => ({ action: "execute_tool", toolName: "company_identity", input: { company: input }, reasonCode: "missing_identity", targetTopics: ["company_identity"] }), now: () => new Date("2026-09-02T10:01:00.000Z") });
      console.log(JSON.stringify({ stateId: state.id, executionId: result.execution?.id, nextStatus: result.nextStatus }));
    `, databasePath));
    assert.ok(created.executionId);
    assert.equal(created.nextStatus, "tool_executed");

    const loaded = JSON.parse(await run(`
      import { researchStateStore } from "./app/lib/private-diligence/state/researchStateStore.ts";
      const state = await researchStateStore.getResearchState("${created.stateId}");
      const executions = await researchStateStore.listToolExecutions("${created.stateId}");
      console.log(JSON.stringify({ state, executions }));
    `, databasePath));
    assert.equal(loaded.executions.length, 1);
    assert.equal(loaded.executions[0].id, created.executionId);
    assert.equal(loaded.executions[0].toolName, "company_identity");
    assert.equal(loaded.executions[0].status, "success");
    assert.equal(loaded.state.confirmedCompany.entityId, "entity-acme");
    assert.deepEqual(loaded.state.executionIds, [created.executionId]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
