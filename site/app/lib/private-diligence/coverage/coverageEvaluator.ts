import { researchStateStore } from "../state/researchStateStore";
import type { ResearchState, ResearchStateGap, ToolExecutionRecord } from "../state/types";
import type { CoverageAssessment, CoverageBlocker, CoverageProfile, CoverageWarning, ResearchTopic, TopicCoverage } from "./types";

const PROFILE_REQUIREMENTS: Record<CoverageProfile, ResearchTopic[]> = {
  general_company_research: ["company_identity", "company_web_presence"],
  hiring_research: ["company_identity", "company_web_presence", "hiring_activity"],
};

const TOPIC_TOOL: Partial<Record<ResearchTopic, string>> = {
  company_identity: "company_identity",
  company_web_presence: "web_research",
  hiring_activity: "hiring_intelligence",
};

function uniqueBy<T>(values: T[], key: (value: T) => string) {
  return [...new Map(values.map((value) => [key(value), value])).values()];
}

function latestByTool(executions: ToolExecutionRecord[]) {
  const output = new Map<string, ToolExecutionRecord>();
  for (const execution of executions) {
    const current = output.get(execution.toolName);
    if (!current || execution.startedAt > current.startedAt ||
        (execution.startedAt === current.startedAt && execution.attempt > current.attempt)) {
      output.set(execution.toolName, execution);
    }
  }
  return output;
}

function executionEvidence(executions: ToolExecutionRecord[], toolName: string) {
  return uniqueBy(executions.filter((item) => item.toolName === toolName).flatMap((item) => item.evidenceRefs),
    (reference) => `${reference.toolExecutionId}:${reference.evidenceId}`);
}

function gapsForTool(activeGaps: ResearchStateGap[], toolName: string) {
  return activeGaps.filter((gap) => gap.sourceToolName === toolName);
}

function identityCoverage(state: ResearchState, executions: ToolExecutionRecord[], required: boolean): TopicCoverage {
  const confirmed = state.confirmedCompany?.targetSelectionStatus === "userSelected";
  const successfulExecutions = executions.filter((item) => item.toolName === "company_identity" && item.status === "success");
  return {
    topic: "company_identity",
    status: confirmed ? "covered" : "missing",
    required,
    evidenceRefs: executionEvidence(executions, "company_identity"),
    supportingToolNames: successfulExecutions.length ? ["company_identity"] : [],
    supportingExecutionIds: successfulExecutions.map((item) => item.id),
    activeGapKeys: gapsForTool(state.gaps.filter((gap) => gap.status === "open"), "company_identity").map((gap) => gap.key),
    reasonCodes: confirmed ? ["confirmed_company_reference"] : ["company_not_confirmed"],
  };
}

function webCoverage(state: ResearchState, executions: ToolExecutionRecord[], required: boolean): TopicCoverage {
  const toolName = "web_research";
  const latest = latestByTool(executions).get(toolName);
  const evidenceRefs = executionEvidence(executions, toolName);
  const activeGaps = gapsForTool(state.gaps.filter((gap) => gap.status === "open"), toolName);
  const materialGap = activeGaps.some((gap) => gap.severity !== "low");
  let status: TopicCoverage["status"] = "missing";
  const reasonCodes: string[] = [];
  if (latest?.status === "success" && evidenceRefs.length && !materialGap) {
    status = "covered";
    reasonCodes.push("original_page_evidence_available", "latest_web_execution_succeeded");
  } else if (evidenceRefs.length) {
    status = "partial";
    reasonCodes.push("original_page_evidence_available", latest?.status === "failed" ? "latest_web_execution_failed" : "web_research_incomplete");
  } else {
    reasonCodes.push(latest ? `${latest.status}_without_usable_web_evidence` : "web_research_not_run");
  }
  return {
    topic: "company_web_presence", status, required, evidenceRefs,
    supportingToolNames: latest ? [toolName] : [],
    supportingExecutionIds: latest ? [latest.id] : [],
    activeGapKeys: activeGaps.map((gap) => gap.key), reasonCodes,
  };
}

function hiringCoverage(state: ResearchState, executions: ToolExecutionRecord[], required: boolean): TopicCoverage {
  const toolName = "hiring_intelligence";
  const latest = latestByTool(executions).get(toolName);
  const evidenceRefs = executionEvidence(executions, toolName);
  const activeGaps = gapsForTool(state.gaps.filter((gap) => gap.status === "open"), toolName);
  const materialGap = activeGaps.some((gap) => gap.severity !== "low");
  const usableHistoricalResult = executions.some((item) => item.toolName === toolName && item.status === "success");
  let status: TopicCoverage["status"] = "missing";
  const reasonCodes: string[] = [];
  if (latest?.status === "success" && !materialGap) {
    status = "covered";
    reasonCodes.push("latest_hiring_execution_succeeded", evidenceRefs.length ? "public_job_evidence_available" : "valid_zero_job_result");
  } else if (evidenceRefs.length || usableHistoricalResult || latest?.status === "partial") {
    status = "partial";
    reasonCodes.push(latest?.status === "failed" ? "latest_hiring_execution_failed" : "hiring_research_incomplete");
  } else {
    reasonCodes.push(latest ? `${latest.status}_without_usable_hiring_result` : "hiring_research_not_run");
  }
  return {
    topic: "hiring_activity", status, required, evidenceRefs,
    supportingToolNames: latest ? [toolName] : [],
    supportingExecutionIds: latest ? [latest.id] : [],
    activeGapKeys: activeGaps.map((gap) => gap.key), reasonCodes,
  };
}

function addBlocker(blockers: CoverageBlocker[], blocker: CoverageBlocker) {
  if (!blockers.some((item) => item.code === blocker.code && item.topic === blocker.topic && item.message === blocker.message)) blockers.push(blocker);
}

function addWarning(warnings: CoverageWarning[], warning: CoverageWarning) {
  if (!warnings.some((item) => item.code === warning.code && item.topic === warning.topic && item.message === warning.message)) warnings.push(warning);
}

export function coverageProfileForObjective(objective: string): CoverageProfile {
  return /\b(?:hiring|recruit(?:ing|ment)?|talent|workforce)\b/i.test(objective)
    ? "hiring_research"
    : "general_company_research";
}

export function evaluateCoverage(
  state: ResearchState,
  executions: ToolExecutionRecord[],
  profile: CoverageProfile = coverageProfileForObjective(state.objective),
  evaluatedAt = new Date().toISOString(),
): CoverageAssessment {
  const requiredTopics = new Set(PROFILE_REQUIREMENTS[profile]);
  const activeGaps = uniqueBy(state.gaps.filter((gap) => gap.status === "open"), (gap) => gap.key);
  const stateWithActiveGaps = { ...state, gaps: activeGaps };
  const topics = [
    identityCoverage(stateWithActiveGaps, executions, requiredTopics.has("company_identity")),
    webCoverage(stateWithActiveGaps, executions, requiredTopics.has("company_web_presence")),
    hiringCoverage(stateWithActiveGaps, executions, requiredTopics.has("hiring_activity")),
  ];
  const blockers: CoverageBlocker[] = [];
  const warnings: CoverageWarning[] = [];
  const identity = topics.find((topic) => topic.topic === "company_identity")!;
  if (identity.status !== "covered") addBlocker(blockers, { code: "company_not_confirmed", topic: "company_identity", message: "The company target is not confirmed", retryable: false });
  for (const topic of topics) {
    if (topic.required && topic.status === "missing") addBlocker(blockers, { code: "required_topic_missing", topic: topic.topic, message: `Required topic ${topic.topic} is missing`, retryable: true });
    if (topic.required && topic.status === "partial") addBlocker(blockers, { code: "required_topic_incomplete", topic: topic.topic, message: `Required topic ${topic.topic} remains partial`, retryable: true });
    if (!topic.required && topic.status === "missing") addWarning(warnings, { code: "optional_topic_missing", topic: topic.topic, message: `Optional topic ${topic.topic} has not been covered` });
    if (topic.status === "partial") addWarning(warnings, { code: topic.topic === "company_web_presence" ? "web_research_partial" : "hiring_research_partial", topic: topic.topic, message: `${topic.topic} has usable but incomplete coverage` });
  }
  const latest = latestByTool(executions);
  for (const topic of topics.filter((item) => item.required && item.topic !== "company_identity")) {
    const toolName = TOPIC_TOOL[topic.topic]!;
    if (!executions.some((item) => item.toolName === toolName && item.status === "success")) {
      addBlocker(blockers, { code: "required_tool_never_succeeded", topic: topic.topic, message: `${toolName} has not completed successfully`, retryable: true });
    }
    if (topic.topic === "company_web_presence" && !topic.evidenceRefs.length) {
      addBlocker(blockers, { code: "evidence_unavailable", topic: topic.topic, message: "No usable original-page web evidence is available", retryable: true });
    }
  }
  for (const gap of activeGaps) {
    const topic = gap.sourceToolName === "company_identity" ? "company_identity" : gap.sourceToolName === "web_research" ? "company_web_presence" : gap.sourceToolName === "hiring_intelligence" ? "hiring_activity" : null;
    if (gap.severity === "high") addBlocker(blockers, { code: "high_severity_gap_open", topic, message: gap.description, retryable: gap.retryable });
    else addWarning(warnings, { code: gap.code === "hiring_snapshot_not_persisted" ? "hiring_snapshot_persistence_partial" : "active_research_gap", topic, message: gap.description });
  }
  const webEvidence = topics.find((topic) => topic.topic === "company_web_presence")!.evidenceRefs;
  if (webEvidence.length && webEvidence.every((item) => item.companyReported && !item.independentlyPublished && !item.officialRecord)) {
    addWarning(warnings, { code: "only_company_reported_evidence", topic: "company_web_presence", message: "Web coverage currently relies only on company-reported sources" });
  }
  for (const [toolName, current] of latest) {
    const earlierFailure = executions.some((item) => item.toolName === toolName && item.status === "failed" && item.id !== current.id);
    if (earlierFailure && current.status === "success") addWarning(warnings, { code: "previous_tool_failures", topic: toolName === "web_research" ? "company_web_presence" : toolName === "hiring_intelligence" ? "hiring_activity" : toolName === "company_identity" ? "company_identity" : null, message: `${toolName} succeeded after an earlier failed attempt` });
  }
  const readyToComplete = blockers.length === 0 && topics.filter((topic) => topic.required).every((topic) => topic.status === "covered");
  const coveredTopicCount = topics.filter((topic) => topic.status === "covered").length;
  const partialTopicCount = topics.filter((topic) => topic.status === "partial").length;
  const missingTopicCount = topics.filter((topic) => topic.status === "missing").length;
  const latestExecutions = [...latest.values()];
  return {
    researchStateId: state.id,
    profile,
    overallStatus: readyToComplete ? "sufficient" : coveredTopicCount || partialTopicCount ? "partial" : "insufficient",
    readyToComplete,
    topics,
    activeGaps,
    blockers,
    warnings,
    summary: {
      coveredTopicCount, partialTopicCount, missingTopicCount,
      evidenceCount: state.evidenceRefs.length,
      successfulToolCount: latestExecutions.filter((item) => item.status === "success").length,
      failedToolCount: latestExecutions.filter((item) => item.status === "failed").length,
    },
    evaluatedAt,
  };
}

export async function evaluateResearchCoverage(
  researchStateId: string,
  profile?: CoverageProfile,
  now: () => Date = () => new Date(),
): Promise<CoverageAssessment> {
  const state = await researchStateStore.getResearchState(researchStateId);
  if (!state) {
    return {
      researchStateId,
      profile: profile ?? "general_company_research",
      overallStatus: "insufficient",
      readyToComplete: false,
      topics: [], activeGaps: [],
      blockers: [{ code: "research_state_not_found", topic: null, message: "ResearchState was not found", retryable: false }],
      warnings: [],
      summary: { coveredTopicCount: 0, partialTopicCount: 0, missingTopicCount: 0, evidenceCount: 0, successfulToolCount: 0, failedToolCount: 0 },
      evaluatedAt: now().toISOString(),
    };
  }
  const executions = await researchStateStore.listToolExecutions(researchStateId);
  return evaluateCoverage(state, executions, profile ?? coverageProfileForObjective(state.objective), now().toISOString());
}
