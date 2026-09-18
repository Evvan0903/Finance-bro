import type { CoverageAssessment, ResearchTopic } from "../coverage/types";
import type { ResearchState, ToolExecutionRecord } from "../state/types";
import { claraToolRegistry } from "../tools/registry";
import type { ClaraToolName } from "../tools/registry";
import type { ClaraToolInputSchema } from "../tools/types";
import type { EntityIdentityGraph, PrivateCompanyInput } from "../types";
import type { ClaraPlanDecision, ExecuteToolReasonCode, PlannerValidationResult } from "./types";

const TOOL_TOPIC: Record<ClaraToolName, ResearchTopic> = {
  company_identity: "company_identity",
  web_research: "company_web_presence",
  hiring_intelligence: "hiring_activity",
  funding_search: "company_web_presence",
  sec_funding: "company_web_presence",
};

export type PlannerValidationContext = {
  authoritativeCompanyInput: PrivateCompanyInput | null;
  identityGraph: EntityIdentityGraph | null;
};

function result(approved: boolean, code: PlannerValidationResult["code"], message: string): PlannerValidationResult {
  return { approved, code, message };
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (plainObject(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function validatesProperty(value: unknown, definition: ClaraToolInputSchema["properties"][string]) {
  if (definition.type === "array") {
    return Array.isArray(value) && (!definition.enum || value.every((item) => typeof item === "string" && definition.enum!.includes(item)));
  }
  if (definition.type === "object") return plainObject(value);
  if (definition.type === "string") return typeof value === "string" && (!definition.enum || definition.enum.includes(value));
  return typeof value === "boolean";
}

export function validatesToolInput(input: unknown, schema: ClaraToolInputSchema) {
  if (!plainObject(input)) return false;
  const keys = Object.keys(input);
  if (!schema.additionalProperties && keys.some((key) => !(key in schema.properties))) return false;
  if (schema.required.some((key) => !(key in input))) return false;
  return keys.every((key) => !schema.properties[key] || validatesProperty(input[key], schema.properties[key]));
}

function latestForTool(executions: ToolExecutionRecord[], toolName: string) {
  return executions.filter((item) => item.toolName === toolName)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.attempt - b.attempt).at(-1) ?? null;
}

function consecutiveFailures(executions: ToolExecutionRecord[], toolName: string) {
  const ordered = executions.filter((item) => item.toolName === toolName)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.attempt - a.attempt);
  let failures = 0;
  for (const execution of ordered) {
    if (execution.status !== "failed") break;
    failures += 1;
  }
  return failures;
}

function awaitingConfirmation(state: ResearchState, executions: ToolExecutionRecord[]) {
  return !state.confirmedCompany && executions.some((execution) => execution.toolName === "company_identity" &&
    execution.status !== "failed" && execution.observations.some((observation) => observation.code === "grounded_candidates_discovered"));
}

function hasActiveToolGap(coverage: CoverageAssessment, toolName: string) {
  return coverage.activeGaps.some((gap) => gap.sourceToolName === toolName);
}

function reasonMatchesState(
  reason: ExecuteToolReasonCode,
  topic: ReturnType<typeof topicCoverage>,
  toolName: ClaraToolName,
  coverage: CoverageAssessment,
  executions: ToolExecutionRecord[],
) {
  if (reason === "missing_identity") return toolName === "company_identity" && topic?.status === "missing";
  if (reason === "missing_web_evidence") return toolName === "web_research" && topic?.status !== "covered";
  if (reason === "active_research_gap") return hasActiveToolGap(coverage, toolName);
  if (reason === "retryable_failure") return latestForTool(executions, toolName)?.status === "failed" &&
    coverage.activeGaps.some((gap) => gap.sourceToolName === toolName && gap.retryable);
  return Boolean(topic?.required && topic.status !== "covered");
}

function topicCoverage(coverage: CoverageAssessment, topic: ResearchTopic) {
  return coverage.topics.find((item) => item.topic === topic);
}

function validateExecuteDecision(
  decision: Extract<ClaraPlanDecision, { action: "execute_tool" }>,
  state: ResearchState,
  coverage: CoverageAssessment,
  executions: ToolExecutionRecord[],
  context: PlannerValidationContext,
): PlannerValidationResult {
  const tool = claraToolRegistry.get(decision.toolName);
  if (!tool) return result(false, "invalid_tool", "The proposed tool is not registered");
  if (!validatesToolInput(decision.input, tool.inputSchema)) return result(false, "invalid_tool_input", "The proposed input does not satisfy the registered tool contract");
  const topic = TOOL_TOPIC[decision.toolName];
  const currentTopic = topicCoverage(coverage, topic);
  if (!decision.targetTopics.length || decision.targetTopics.some((target) => target !== topic)) {
    return result(false, "irrelevant_target_topic", "The proposed tool does not support the requested target topic");
  }
  const succeeded = executions.some((item) => item.toolName === decision.toolName && item.status === "success");
  if (currentTopic?.status === "covered" && succeeded && !hasActiveToolGap(coverage, decision.toolName)) {
    return result(false, "unnecessary_duplicate", "The relevant topic is already covered without an active tool gap");
  }
  if (!reasonMatchesState(decision.reasonCode, currentTopic, decision.toolName, coverage, executions)) {
    return result(false, "irrelevant_target_topic", "The proposed reason is not supported by current coverage or gaps");
  }
  if (!context.authoritativeCompanyInput) return result(false, "research_context_unavailable", "The associated Clara research request is unavailable");
  if (decision.toolName === "company_identity") {
    if (awaitingConfirmation(state, executions)) return result(false, "awaiting_user_confirmation", "Grounded candidates require explicit user confirmation");
    if (!sameValue(decision.input.company, context.authoritativeCompanyInput)) {
      return result(false, "unsafe_target_override", "Company Identity must use the persisted authoritative company input");
    }
  } else {
    const selected = context.identityGraph?.targetSelectionStatus;
    if (!state.confirmedCompany || !context.identityGraph || selected !== "userSelected" ||
        state.confirmedCompany.entityId !== context.identityGraph.entityId) {
      return result(false, "company_not_confirmed", "Downstream research requires the persisted confirmed company target");
    }
  }
  if (consecutiveFailures(executions, decision.toolName) >= 2) {
    return result(false, "retry_limit_reached", "The tool reached the automatic retry limit for this ResearchState");
  }
  return result(true, "approved", "The proposed single tool action is permitted");
}

function candidateDecision(toolName: ClaraToolName, coverage: CoverageAssessment, context: PlannerValidationContext): Extract<ClaraPlanDecision, { action: "execute_tool" }> {
  const topic = TOOL_TOPIC[toolName];
  const current = topicCoverage(coverage, topic);
  return {
    action: "execute_tool",
    toolName,
    input: toolName === "company_identity" ? { company: context.authoritativeCompanyInput } : {},
    reasonCode: hasActiveToolGap(coverage, toolName) ? "active_research_gap" :
      topic === "company_identity" ? "missing_identity" : topic === "company_web_presence" ? "missing_web_evidence" :
      current?.required ? "missing_required_topic" : "active_research_gap",
    targetTopics: [topic],
  };
}

function hasPermittedAction(
  state: ResearchState,
  coverage: CoverageAssessment,
  executions: ToolExecutionRecord[],
  context: PlannerValidationContext,
) {
  return (["company_identity", "web_research", "hiring_intelligence"] as ClaraToolName[])
    .some((toolName) => validateExecuteDecision(candidateDecision(toolName, coverage, context), state, coverage, executions, context).approved);
}

export function validatePlanDecision(args: {
  decision: ClaraPlanDecision;
  state: ResearchState;
  coverage: CoverageAssessment;
  executions: ToolExecutionRecord[];
  context: PlannerValidationContext;
}): PlannerValidationResult {
  const { decision, state, coverage, executions, context } = args;
  if (decision.action === "execute_tool") return validateExecuteDecision(decision, state, coverage, executions, context);
  if (decision.reasonCode === "coverage_sufficient") {
    return coverage.readyToComplete
      ? result(true, "coverage_sufficient", "Deterministic coverage requirements are satisfied")
      : result(false, "invalid_stop_reason", "The Planner cannot declare sufficient coverage while deterministic blockers remain");
  }
  if (decision.reasonCode === "requires_user_confirmation") {
    return awaitingConfirmation(state, executions)
      ? result(true, "awaiting_user_confirmation", "Explicit candidate confirmation is required")
      : result(false, "invalid_stop_reason", "Current state does not indicate a pending candidate confirmation");
  }
  if (hasPermittedAction(state, coverage, executions, context)) {
    return result(false, "permitted_action_available", "A relevant permitted single-tool action remains available");
  }
  return coverage.blockers.length
    ? result(true, "approved", "Research is blocked and no permitted automatic action remains")
    : result(true, "approved", "No permitted automatic action remains");
}
