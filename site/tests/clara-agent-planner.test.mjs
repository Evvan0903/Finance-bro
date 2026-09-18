import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const agentRoot = new URL("../app/lib/private-diligence/agent/", import.meta.url);
const coverageRoot = new URL("../app/lib/private-diligence/coverage/", import.meta.url);
const { parseClaraPlanDecision } = await tsImport(new URL("plannerSchema.ts", agentRoot).href, import.meta.url);
const { validatePlanDecision, validatesToolInput } = await tsImport(new URL("plannerValidator.ts", agentRoot).href, import.meta.url);
const { buildClaraPlannerContext } = await tsImport(new URL("plannerContext.ts", agentRoot).href, import.meta.url);
const { planNextClaraAction } = await tsImport(new URL("planner.ts", agentRoot).href, import.meta.url);
const { runClaraAgentStep } = await tsImport(new URL("runClaraAgentStep.ts", agentRoot).href, import.meta.url);
const { evaluateCoverage } = await tsImport(new URL("coverageEvaluator.ts", coverageRoot).href, import.meta.url);

const companyInput = {
  companyName: "Acme", website: "https://acme.example", city: null, state: null, country: null,
  founderOrExecutive: null, industry: null, researchObjective: "General diligence", locale: "en",
  reportDepth: "Compact", workflowMode: "quick", quickResearchPurpose: "General Research",
};
const graph = {
  entityId: "entity-acme", canonicalName: "Acme", legalNames: [], dbaNames: [], formerNames: [], domains: ["acme.example"],
  emailDomains: [], addresses: [], phoneNumbers: [], founders: [], executives: [], directors: [], registrationNumbers: [],
  registrationJurisdictions: [], cikCandidates: [], ueiCandidates: [], cageCodes: [], samEntityIds: [],
  usaSpendingRecipientIds: [], patentAssigneeNames: [], trademarkOwnerNames: [], parentCompanies: [], subsidiaries: [],
  affiliatedEntities: [], socialProfiles: [], termsPageLegalNames: [], privacyPageLegalNames: [], productCategories: [],
  industryLabels: [], identityConfidence: "High", resolutionStatus: "userConfirmed", targetSelectionStatus: "userSelected",
  identityVerificationStatus: "verified", identityLimitations: [],
};

function state(overrides = {}) {
  return {
    id: "state-1", researchRequestId: "research-1", objective: "General company research", companyId: "entity-acme",
    confirmedCompany: { entityId: "entity-acme", canonicalName: "Acme", primaryDomain: "acme.example", identityConfidence: "High", targetSelectionStatus: "userSelected" },
    status: "researching", observations: [], gaps: [], evidenceRefs: [], executionIds: [],
    createdAt: "2026-09-02T10:00:00.000Z", updatedAt: "2026-09-02T10:00:00.000Z", ...overrides,
  };
}

function reference(executionId = "web-1") {
  return {
    evidenceId: "evidence-web-1", toolExecutionId: executionId, entityId: "entity-acme",
    evidenceType: "Company-controlled original page", sourceTitle: "Acme", sourceUrl: "https://acme.example",
    retrievedAt: "2026-09-02T10:01:01.000Z", companyReported: true, officialRecord: false, independentlyPublished: false,
  };
}

function execution(toolName, status, attempt = 1, overrides = {}) {
  return {
    id: `${toolName}-${attempt}`, researchStateId: "state-1", toolName, attempt, input: {}, status,
    startedAt: `2026-09-02T10:0${attempt}:00.000Z`, completedAt: `2026-09-02T10:0${attempt}:01.000Z`,
    observations: [], gaps: [], resolvedGapCodes: [], evidenceRefs: [], errors: [],
    metadata: { toolName, startedAt: `2026-09-02T10:0${attempt}:00.000Z`, completedAt: `2026-09-02T10:0${attempt}:01.000Z`, retrievalTime: `2026-09-02T10:0${attempt}:01.000Z`, sourceCount: 0 },
    ...overrides,
  };
}

function validationContext(overrides = {}) {
  return { authoritativeCompanyInput: companyInput, identityGraph: graph, ...overrides };
}

test("Planner schema accepts only strict registered execute and stop decisions", () => {
  const execute = parseClaraPlanDecision({ action: "execute_tool", toolName: "web_research", input: {}, reasonCode: "missing_web_evidence", targetTopics: ["company_web_presence"] });
  assert.equal(execute.toolName, "web_research");
  assert.deepEqual(parseClaraPlanDecision({ action: "stop", reasonCode: "coverage_sufficient" }), { action: "stop", reasonCode: "coverage_sufficient" });
  assert.throws(() => parseClaraPlanDecision("not json"), /INVALID_OBJECT/);
  assert.throws(() => parseClaraPlanDecision({ action: "execute_tool", toolName: "unknown", input: {}, reasonCode: "missing_required_topic", targetTopics: ["company_web_presence"] }), /UNKNOWN_TOOL/);
  assert.throws(() => parseClaraPlanDecision({ action: "stop", reasonCode: "blocked", thought: "private reasoning" }), /INVALID_FIELDS/);
});

test("mocked Planner fixtures cover each bounded decision and reject malformed model output", async () => {
  const context = buildClaraPlannerContext({ state: state(), coverage: evaluateCoverage(state(), [], "general_company_research"), executions: [], authoritativeCompanyInput: companyInput });
  const fixtures = [
    { action: "execute_tool", toolName: "company_identity", input: { company: companyInput }, reasonCode: "missing_identity", targetTopics: ["company_identity"] },
    { action: "execute_tool", toolName: "web_research", input: {}, reasonCode: "missing_web_evidence", targetTopics: ["company_web_presence"] },
    { action: "execute_tool", toolName: "hiring_intelligence", input: {}, reasonCode: "missing_required_topic", targetTopics: ["hiring_activity"] },
    { action: "stop", reasonCode: "requires_user_confirmation" },
    { action: "stop", reasonCode: "coverage_sufficient" },
  ];
  for (const fixture of fixtures) {
    const decision = await planNextClaraAction(context, { runModel: async ({ schema }) => schema(fixture) });
    assert.deepEqual(decision, fixture);
  }
  await assert.rejects(() => planNextClaraAction(context, { runModel: async () => JSON.parse("{") }), /JSON/);
});

test("Planner context is compact and derives tool definitions from the registry", () => {
  const current = state({ gaps: [{ key: "web_research:source_missing:web", code: "source_missing", topic: "web", description: "Source missing", severity: "medium", retryable: true, sourceToolName: "web_research", status: "open", createdAt: "2026-09-02T10:00:00.000Z", updatedAt: "2026-09-02T10:00:00.000Z", resolvedAt: null, lastExecutionId: "web-1" }] });
  const executions = [execution("web_research", "failed", 1, { errors: [{ code: "timeout", message: "Timed out", retryable: true }] })];
  const coverage = evaluateCoverage(current, executions, "general_company_research");
  const context = buildClaraPlannerContext({ state: current, coverage, executions, authoritativeCompanyInput: companyInput });
  assert.deepEqual(context.availableTools.map((item) => item.name).sort(), ["company_identity", "funding_search", "hiring_intelligence", "sec_funding", "web_research"]);
  assert.deepEqual(context.executionSummary[0].latestErrorCodes, ["timeout"]);
  assert.equal("input" in context.executionSummary[0], false);
  assert.equal(JSON.stringify(context).includes("rawHtml"), false);
});

test("Validator enforces input, confirmation, relevance, duplicate, retry, and completion guards", () => {
  const current = state();
  const missingWeb = evaluateCoverage(current, [], "general_company_research");
  const webDecision = { action: "execute_tool", toolName: "web_research", input: {}, reasonCode: "missing_web_evidence", targetTopics: ["company_web_presence"] };
  assert.equal(validatePlanDecision({ decision: { ...webDecision, toolName: "unknown_tool" }, state: current, coverage: missingWeb, executions: [], context: validationContext() }).code, "invalid_tool");
  assert.equal(validatePlanDecision({ decision: webDecision, state: current, coverage: missingWeb, executions: [], context: validationContext() }).approved, true);
  assert.equal(validatesToolInput({ providerIds: ["companyWebsite"] }, { type: "object", required: [], properties: { providerIds: { type: "array", description: "providers", enum: ["companyWebsite"] } }, additionalProperties: false }), true);
  assert.equal(validatePlanDecision({ decision: { ...webDecision, input: { url: "https://other.example" } }, state: current, coverage: missingWeb, executions: [], context: validationContext() }).code, "invalid_tool_input");

  const unconfirmed = state({ companyId: null, confirmedCompany: null });
  const unconfirmedCoverage = evaluateCoverage(unconfirmed, [], "general_company_research");
  assert.equal(validatePlanDecision({ decision: webDecision, state: unconfirmed, coverage: unconfirmedCoverage, executions: [], context: validationContext({ identityGraph: null }) }).code, "company_not_confirmed");
  const identityDecision = { action: "execute_tool", toolName: "company_identity", input: { company: companyInput }, reasonCode: "missing_identity", targetTopics: ["company_identity"] };
  assert.equal(validatePlanDecision({ decision: identityDecision, state: unconfirmed, coverage: unconfirmedCoverage, executions: [], context: validationContext({ identityGraph: null }) }).approved, true);
  assert.equal(validatePlanDecision({ decision: { ...identityDecision, input: { company: { ...companyInput, website: "https://other.example" } } }, state: unconfirmed, coverage: unconfirmedCoverage, executions: [], context: validationContext({ identityGraph: null }) }).code, "unsafe_target_override");

  const webRef = reference();
  const success = execution("web_research", "success", 1, { evidenceRefs: [webRef] });
  const covered = evaluateCoverage(state({ evidenceRefs: [webRef] }), [success], "general_company_research");
  assert.equal(validatePlanDecision({ decision: webDecision, state: current, coverage: covered, executions: [success], context: validationContext() }).code, "unnecessary_duplicate");
  assert.equal(validatePlanDecision({ decision: { action: "stop", reasonCode: "coverage_sufficient" }, state: current, coverage: missingWeb, executions: [], context: validationContext() }).approved, false);
  assert.equal(validatePlanDecision({ decision: { action: "stop", reasonCode: "coverage_sufficient" }, state: current, coverage: covered, executions: [success], context: validationContext() }).approved, true);

  const retryGap = { key: "web_research:timeout:web", code: "timeout", topic: "web", description: "Web timed out", severity: "medium", retryable: true, sourceToolName: "web_research", status: "open", createdAt: "2026-09-02T10:00:00.000Z", updatedAt: "2026-09-02T10:02:00.000Z", resolvedAt: null, lastExecutionId: "web_research-2" };
  const failedTwice = [execution("web_research", "failed", 1), execution("web_research", "failed", 2)];
  const retryCoverage = evaluateCoverage(state({ gaps: [retryGap] }), failedTwice, "general_company_research");
  const retryDecision = { ...webDecision, reasonCode: "retryable_failure" };
  assert.equal(validatePlanDecision({ decision: retryDecision, state: state({ gaps: [retryGap] }), coverage: retryCoverage, executions: failedTwice, context: validationContext() }).code, "retry_limit_reached");
});

test("candidate discovery requires confirmation before downstream research", () => {
  const unconfirmed = state({ companyId: null, confirmedCompany: null });
  const identity = execution("company_identity", "success", 1, { observations: [{ code: "grounded_candidates_discovered", topic: "company identity", description: "Two candidates found", evidenceIds: [] }] });
  const coverage = evaluateCoverage(unconfirmed, [identity], "general_company_research");
  const stop = { action: "stop", reasonCode: "requires_user_confirmation" };
  assert.equal(validatePlanDecision({ decision: stop, state: unconfirmed, coverage, executions: [identity], context: validationContext({ identityGraph: null }) }).approved, true);
  const downstream = { action: "execute_tool", toolName: "web_research", input: {}, reasonCode: "missing_web_evidence", targetTopics: ["company_web_presence"] };
  assert.equal(validatePlanDecision({ decision: downstream, state: unconfirmed, coverage, executions: [identity], context: validationContext({ identityGraph: null }) }).code, "company_not_confirmed");
  const identityAgain = { action: "execute_tool", toolName: "company_identity", input: { company: companyInput }, reasonCode: "missing_identity", targetTopics: ["company_identity"] };
  assert.equal(validatePlanDecision({ decision: identityAgain, state: unconfirmed, coverage, executions: [identity], context: validationContext({ identityGraph: null }) }).code, "awaiting_user_confirmation");
});

test("one agent step executes exactly one approved tool and then re-evaluates coverage", async () => {
  let current = state();
  let executions = [];
  let calls = 0;
  const record = { researchId: "research-1", input: companyInput, identityGraph: graph };
  const result = await runClaraAgentStep({ researchStateId: current.id, profile: "general_company_research" }, {
    loadState: async () => current,
    loadExecutions: async () => executions,
    loadResearchRecord: async () => record,
    planner: async () => ({ action: "execute_tool", toolName: "web_research", input: {}, reasonCode: "missing_web_evidence", targetTopics: ["company_web_presence"] }),
    executeTool: async () => {
      calls += 1;
      const webRef = reference("web_research-1");
      executions = [execution("web_research", "success", 1, { evidenceRefs: [webRef] })];
      current = { ...current, evidenceRefs: [webRef], executionIds: ["web_research-1"], updatedAt: "2026-09-02T10:01:01.000Z" };
      return { status: "success", observations: [], evidence: [], gaps: [], errors: [], metadata: executions[0].metadata };
    },
    now: () => new Date("2026-09-02T11:00:00.000Z"),
  });
  assert.equal(calls, 1);
  assert.equal(result.execution.id, "web_research-1");
  assert.equal(result.coverageBefore.readyToComplete, false);
  assert.equal(result.coverageAfter.readyToComplete, true);
  assert.equal(result.nextStatus, "ready_to_complete");
});

test("Planner invalid output or timeout executes zero tools and preserves state", async () => {
  const original = state();
  let calls = 0;
  const dependencies = (message) => ({
      loadState: async () => original,
      loadExecutions: async () => [],
      loadResearchRecord: async () => ({ researchId: "research-1", input: companyInput, identityGraph: graph }),
      planner: async () => { throw new Error(message); },
      executeTool: async () => { calls += 1; throw new Error("should not execute"); },
    });
  const result = await runClaraAgentStep({ researchStateId: original.id }, dependencies("CLARA_PLANNER_INVALID_FIELDS"));
  const timeout = await runClaraAgentStep({ researchStateId: original.id }, dependencies("TimeoutError"));
  assert.equal(calls, 0);
  assert.deepEqual(result.researchState, original);
  assert.equal(result.coverageAfter, result.coverageBefore);
  assert.equal(result.nextStatus, "planner_failed");
  assert.equal(timeout.nextStatus, "planner_failed");
  assert.equal(timeout.failure.code, "CLARA_PLANNER_FAILED");
});

test("single-step retry guard blocks a third failed attempt without executing", async () => {
  const retryGap = { key: "web_research:timeout:web", code: "timeout", topic: "web", description: "Web timed out", severity: "medium", retryable: true, sourceToolName: "web_research", status: "open", createdAt: "2026-09-02T10:00:00.000Z", updatedAt: "2026-09-02T10:02:00.000Z", resolvedAt: null, lastExecutionId: "web_research-2" };
  const current = state({ gaps: [retryGap] });
  const executions = [execution("web_research", "failed", 1), execution("web_research", "failed", 2)];
  let calls = 0;
  const result = await runClaraAgentStep({ researchStateId: current.id }, {
    loadState: async () => current,
    loadExecutions: async () => executions,
    loadResearchRecord: async () => ({ researchId: "research-1", input: companyInput, identityGraph: graph }),
    planner: async () => ({ action: "execute_tool", toolName: "web_research", input: {}, reasonCode: "retryable_failure", targetTopics: ["company_web_presence"] }),
    executeTool: async () => { calls += 1; throw new Error("should not execute"); },
  });
  assert.equal(calls, 0);
  assert.equal(result.validation.code, "retry_limit_reached");
  assert.equal(result.nextStatus, "blocked");
});
