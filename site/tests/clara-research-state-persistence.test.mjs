import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

function run(script, databasePath) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, CLARA_LOCAL_DATABASE_PATH: databasePath };
    for (const key of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "LIBSQL_DATABASE_URL", "LIBSQL_AUTH_TOKEN"]) delete env[key];
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

test("ResearchState and chronological tool attempts survive a fresh LibSQL connection", async () => {
  const directory = await mkdtemp(join(tmpdir(), "finbro-clara-state-"));
  const databasePath = join(directory, "clara.db");
  try {
    const created = JSON.parse(await run(`
      import { researchStateStore as store } from "./app/lib/private-diligence/state/researchStateStore.ts";
      import { executeClaraTool } from "./app/lib/private-diligence/state/executeClaraTool.ts";
      const graph = { entityId: "entity-acme", canonicalName: "Acme", domains: ["acme.example"], identityConfidence: "High", targetSelectionStatus: "userSelected" };
      const companyInput = { companyName: "Acme", website: "https://acme.example", city: null, state: null, country: null, founderOrExecutive: null, industry: null, researchObjective: "General diligence", locale: "en", reportDepth: "Compact", workflowMode: "quick", quickResearchPurpose: "General Research" };
      const first = await store.createResearchState({ objective: "General private-company diligence", researchRequestId: "research-1", identityGraph: graph, now: () => new Date("2026-09-01T10:00:00.000Z") });
      const second = await store.createResearchState({ objective: "Investigate AI hiring and international expansion", researchRequestId: "research-2", identityGraph: graph, now: () => new Date("2026-09-01T10:00:30.000Z") });
      const metadata = (toolName, startedAt, completedAt, sourceCount = 0) => ({ toolName, startedAt, completedAt, retrievalTime: completedAt, sourceCount });
      await store.recordToolExecution({ researchStateId: first.id, toolName: "hiring_intelligence", input: { Authorization: "Bearer secret-auth", apiKey: "secret-key", token: "secret-token", cookie: "secret-cookie", nested: { env: { KEY: "secret-env" } }, rawHtml: "secret-html" }, identityGraph: graph, result: { status: "failed", observations: [], evidence: [], gaps: [{ code: "careers_source_unavailable", topic: "hiring activity", description: "Careers source unavailable", severity: "medium", retryable: true }], errors: [{ code: "timeout", message: "Timed out", retryable: true }], metadata: metadata("hiring_intelligence", "2026-09-01T10:01:00.000Z", "2026-09-01T10:01:01.000Z") } });
      await store.recordToolExecution({ researchStateId: first.id, toolName: "web_research", input: {}, identityGraph: graph, result: { status: "partial", observations: [{ code: "official_page", topic: "public web research", description: "Official company page retrieved", evidenceIds: ["evidence-web-1"] }], evidence: [{ evidenceId: "evidence-web-1", researchId: "research-1", entityId: "entity-acme", providerId: "companyWebsite", sourceTier: 2, sourceType: "Company-controlled web page", sourceTitle: "Acme", sourceUrl: "https://acme.example", publicReferenceUrl: "https://acme.example", publicationDate: null, retrievedAt: "2026-09-01T10:02:00.000Z", rawText: "Acme", structuredData: {}, matchedEntitySignals: ["confirmed domain"], entityMatchConfidence: "High", companyReported: true, officialRecord: false, independentlyPublished: false, contentHash: "hash-web", limitations: [] }], gaps: [{ code: "independent_source_missing", topic: "public web research", description: "Independent evidence unavailable", severity: "medium", retryable: true }], errors: [{ code: "search_timeout", message: "Search timed out", retryable: true }], metadata: metadata("web_research", "2026-09-01T10:02:00.000Z", "2026-09-01T10:02:01.000Z", 1) } });
      await store.recordToolExecution({ researchStateId: first.id, toolName: "hiring_intelligence", input: {}, identityGraph: graph, result: { status: "success", observations: [{ code: "public_jobs_observed", topic: "hiring activity", description: "0 public jobs were observed at retrieval time; this is not a headcount estimate", evidenceIds: [] }], evidence: [], gaps: [], errors: [], metadata: metadata("hiring_intelligence", "2026-09-01T10:03:00.000Z", "2026-09-01T10:03:01.000Z") } });
      await executeClaraTool({ researchStateId: second.id, toolName: "company_identity", input: { company: companyInput }, context: { researchId: "research-2", input: companyInput, identityGraph: graph, now: () => new Date("2026-09-01T10:04:00.000Z") } });
      console.log(JSON.stringify({ firstId: first.id, secondId: second.id }));
    `, databasePath));

    const loaded = JSON.parse(await run(`
      import { researchStateStore as store } from "./app/lib/private-diligence/state/researchStateStore.ts";
      import { evaluateResearchCoverage } from "./app/lib/private-diligence/coverage/coverageEvaluator.ts";
      const first = await store.getResearchState("${created.firstId}");
      const second = await store.getResearchState("${created.secondId}");
      const executions = await store.listToolExecutions(first.id);
      const secondExecutions = await store.listToolExecutions(second.id);
      const companyStates = await store.listResearchStates({ companyId: "entity-acme" });
      const coverage = await evaluateResearchCoverage(first.id, "general_company_research", () => new Date("2026-09-01T11:00:00.000Z"));
      console.log(JSON.stringify({
        first, second, executions, secondExecutions, coverage, companyStateIds: companyStates.map((item) => item.id),
        hiringAttempts: await store.getToolAttemptCount(first.id, "hiring_intelligence"),
        latestHiring: (await store.getLatestToolExecution(first.id, "hiring_intelligence"))?.status,
        hiringSucceeded: await store.hasToolSucceeded(first.id, "hiring_intelligence"),
      }));
    `, databasePath));

    assert.notEqual(loaded.first.id, loaded.second.id);
    assert.equal(loaded.first.objective, "General private-company diligence");
    assert.equal(loaded.second.objective, "Investigate AI hiring and international expansion");
    assert.equal(loaded.first.companyId, loaded.second.companyId);
    assert.equal(Number.isNaN(Date.parse(loaded.first.createdAt)), false);
    assert.deepEqual(new Set(loaded.companyStateIds), new Set([loaded.first.id, loaded.second.id]));
    assert.equal(loaded.secondExecutions[0].toolName, "company_identity");
    assert.equal(loaded.secondExecutions[0].status, "success");
    assert.deepEqual(loaded.executions.map((item) => item.status), ["failed", "partial", "success"]);
    assert.deepEqual(loaded.executions.filter((item) => item.toolName === "hiring_intelligence").map((item) => item.attempt), [1, 2]);
    assert.equal(loaded.executions.find((item) => item.toolName === "web_research").attempt, 1);
    assert.equal(loaded.hiringAttempts, 2);
    assert.equal(loaded.latestHiring, "success");
    assert.equal(loaded.hiringSucceeded, true);
    assert.equal(loaded.first.gaps.find((gap) => gap.code === "careers_source_unavailable").status, "resolved");
    assert.equal(loaded.first.gaps.find((gap) => gap.code === "independent_source_missing").status, "open");
    assert.equal(loaded.first.evidenceRefs[0].sourceUrl, "https://acme.example");
    assert.equal(loaded.first.executionIds.length, 3);
    assert.equal(loaded.coverage.researchStateId, loaded.first.id);
    assert.equal(loaded.coverage.overallStatus, "partial");
    assert.equal(loaded.coverage.readyToComplete, false);
    const serializedExecutions = JSON.stringify(loaded.executions);
    for (const secret of ["secret-auth", "secret-key", "secret-token", "secret-cookie", "secret-env", "secret-html"]) {
      assert.equal(serializedExecutions.includes(secret), false);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
