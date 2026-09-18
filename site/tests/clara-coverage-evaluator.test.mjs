import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const { coverageProfileForObjective, evaluateCoverage } = await tsImport(
  new URL("../app/lib/private-diligence/coverage/coverageEvaluator.ts", import.meta.url).href,
  import.meta.url,
);

function reference(executionId = "web-1", overrides = {}) {
  return {
    evidenceId: "evidence-web-1", toolExecutionId: executionId, entityId: "entity-acme",
    evidenceType: "Company-controlled web page", sourceTitle: "Acme", sourceUrl: "https://acme.example",
    retrievedAt: "2026-09-01T10:01:00.000Z", companyReported: true, officialRecord: false,
    independentlyPublished: false, ...overrides,
  };
}

function state(overrides = {}) {
  return {
    id: "state-1", researchRequestId: "research-1", objective: "General private-company diligence",
    companyId: "entity-acme", confirmedCompany: { entityId: "entity-acme", canonicalName: "Acme",
      primaryDomain: "acme.example", identityConfidence: "High", targetSelectionStatus: "userSelected" },
    status: "researching", observations: [], gaps: [], evidenceRefs: [], executionIds: [],
    createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "2026-09-01T10:00:00.000Z", ...overrides,
  };
}

function execution(toolName, status, attempt = 1, overrides = {}) {
  const minute = String(attempt).padStart(2, "0");
  return {
    id: `${toolName}-${attempt}`, researchStateId: "state-1", toolName, attempt, input: {}, status,
    startedAt: `2026-09-01T10:${minute}:00.000Z`, completedAt: `2026-09-01T10:${minute}:01.000Z`,
    observations: [], gaps: [], resolvedGapCodes: [], evidenceRefs: [], errors: [],
    metadata: { toolName, startedAt: `2026-09-01T10:${minute}:00.000Z`, completedAt: `2026-09-01T10:${minute}:01.000Z`, retrievalTime: `2026-09-01T10:${minute}:01.000Z`, sourceCount: 0 },
    ...overrides,
  };
}

function gap(overrides = {}) {
  return {
    key: "web_research:source_missing:public web research", code: "source_missing", topic: "public web research",
    description: "Independent source missing", severity: "medium", retryable: true, sourceToolName: "web_research",
    status: "open", createdAt: "2026-09-01T10:01:01.000Z", updatedAt: "2026-09-01T10:01:01.000Z",
    resolvedAt: null, lastExecutionId: "web_research-1", ...overrides,
  };
}

function topic(assessment, name) {
  return assessment.topics.find((item) => item.topic === name);
}

test("requires an existing confirmed-company reference for identity coverage", () => {
  const covered = evaluateCoverage(state(), [], "general_company_research", "2026-09-01T11:00:00.000Z");
  assert.equal(topic(covered, "company_identity").status, "covered");
  const missing = evaluateCoverage(state({ confirmedCompany: null }), [], "general_company_research", "2026-09-01T11:00:00.000Z");
  assert.equal(topic(missing, "company_identity").status, "missing");
  assert.ok(missing.blockers.some((item) => item.code === "company_not_confirmed"));
});

test("maps successful, partial, and failed web research without using evidence count as the rule", () => {
  const webRef = reference("web_research-1");
  const successful = evaluateCoverage(state({ evidenceRefs: [webRef] }), [execution("web_research", "success", 1, { evidenceRefs: [webRef] })], "general_company_research");
  assert.equal(topic(successful, "company_web_presence").status, "covered");
  assert.equal(successful.readyToComplete, true);
  assert.equal(topic(successful, "company_web_presence").evidenceRefs[0].evidenceId, "evidence-web-1");

  const partial = evaluateCoverage(state({ evidenceRefs: [webRef] }), [execution("web_research", "partial", 1, { evidenceRefs: [webRef] })], "general_company_research");
  assert.equal(topic(partial, "company_web_presence").status, "partial");
  assert.equal(partial.readyToComplete, false);

  const failed = evaluateCoverage(state(), [execution("web_research", "failed")], "general_company_research");
  assert.equal(topic(failed, "company_web_presence").status, "missing");
  assert.ok(failed.blockers.some((item) => item.code === "evidence_unavailable"));
});

test("treats successful hiring with jobs or a valid zero result as covered", () => {
  const jobRef = reference("hiring_intelligence-1", { evidenceId: "job-1", evidenceType: "Public greenhouse job posting", sourceUrl: "https://boards.greenhouse.io/acme/jobs/1" });
  const withJobs = evaluateCoverage(state({ evidenceRefs: [jobRef] }), [execution("hiring_intelligence", "success", 1, { evidenceRefs: [jobRef] })], "hiring_research");
  assert.equal(topic(withJobs, "hiring_activity").status, "covered");

  const zeroJobs = evaluateCoverage(state(), [execution("hiring_intelligence", "success")], "hiring_research");
  assert.equal(topic(zeroJobs, "hiring_activity").status, "covered");
  assert.ok(topic(zeroJobs, "hiring_activity").reasonCodes.includes("valid_zero_job_result"));

  const failed = evaluateCoverage(state(), [execution("hiring_intelligence", "failed")], "hiring_research");
  assert.equal(topic(failed, "hiring_activity").status, "missing");
});

test("uses the latest hiring retry and retains earlier failures as warnings", () => {
  const history = [execution("hiring_intelligence", "failed", 1), execution("hiring_intelligence", "success", 2)];
  const assessment = evaluateCoverage(state(), history, "hiring_research");
  assert.equal(topic(assessment, "hiring_activity").status, "covered");
  assert.ok(assessment.warnings.some((item) => item.code === "previous_tool_failures"));
  assert.equal(assessment.summary.failedToolCount, 0);
});

test("active high-severity gaps block completion while resolved and duplicate gaps do not", () => {
  const webRef = reference("web_research-1");
  const webExecution = execution("web_research", "success", 1, { evidenceRefs: [webRef] });
  const highGap = gap({ key: "web_research:legal_identity:public web research", code: "legal_identity", severity: "high", description: "Legal identity evidence is incomplete" });
  const blocked = evaluateCoverage(state({ evidenceRefs: [webRef], gaps: [highGap, { ...highGap }] }), [webExecution], "general_company_research");
  assert.equal(blocked.activeGaps.length, 1);
  assert.equal(blocked.blockers.filter((item) => item.code === "high_severity_gap_open").length, 1);
  assert.equal(blocked.readyToComplete, false);

  const resolved = evaluateCoverage(state({ evidenceRefs: [webRef], gaps: [{ ...highGap, status: "resolved", resolvedAt: "2026-09-01T10:05:00.000Z" }] }), [webExecution], "general_company_research");
  assert.equal(resolved.activeGaps.length, 0);
  assert.equal(resolved.readyToComplete, true);
});

test("applies explicit general and hiring profiles without semantic guessing", () => {
  const webRef = reference("web_research-1");
  const history = [execution("web_research", "success", 1, { evidenceRefs: [webRef] })];
  const general = evaluateCoverage(state({ evidenceRefs: [webRef] }), history, "general_company_research");
  const hiring = evaluateCoverage(state({ evidenceRefs: [webRef] }), history, "hiring_research");
  assert.equal(general.readyToComplete, true);
  assert.equal(hiring.readyToComplete, false);
  assert.ok(hiring.blockers.some((item) => item.topic === "hiring_activity"));
  assert.equal(coverageProfileForObjective("Investigate AI hiring and international expansion"), "hiring_research");
  assert.equal(coverageProfileForObjective("Investigate international expansion"), "general_company_research");
});

test("cannot fabricate coverage from many references or one run of every tool", () => {
  const manyRefs = Array.from({ length: 20 }, (_, index) => reference("web_research-1", { evidenceId: `evidence-${index}` }));
  const unconfirmed = evaluateCoverage(state({ confirmedCompany: null, evidenceRefs: manyRefs }), [execution("web_research", "success", 1, { evidenceRefs: manyRefs })], "general_company_research");
  assert.equal(unconfirmed.readyToComplete, false);

  const allRanWithoutWebEvidence = evaluateCoverage(state(), [
    execution("company_identity", "success"), execution("web_research", "success"), execution("hiring_intelligence", "success"),
  ], "general_company_research");
  assert.equal(topic(allRanWithoutWebEvidence, "company_web_presence").status, "missing");
  assert.equal(allRanWithoutWebEvidence.readyToComplete, false);
  assert.equal(allRanWithoutWebEvidence.overallStatus, "partial");
});
