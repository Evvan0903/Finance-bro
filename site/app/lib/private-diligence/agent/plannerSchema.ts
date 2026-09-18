import { claraToolRegistry } from "../tools/registry";
import type { ClaraToolName } from "../tools/registry";
import type { ResearchTopic } from "../coverage/types";
import type { ClaraPlanDecision, ExecuteToolReasonCode, StopReasonCode } from "./types";

const EXECUTE_REASONS = new Set<ExecuteToolReasonCode>([
  "missing_required_topic", "active_research_gap", "retryable_failure", "missing_identity", "missing_web_evidence",
]);
const STOP_REASONS = new Set<StopReasonCode>([
  "coverage_sufficient", "requires_user_confirmation", "blocked", "no_permitted_action",
]);
const TOPICS = new Set<ResearchTopic>(["company_identity", "company_web_presence", "hiring_activity"]);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("CLARA_PLANNER_INVALID_OBJECT");
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, required: string[], optional: string[] = []) {
  const keys = Object.keys(value);
  if (required.some((key) => !(key in value)) || keys.some((key) => !required.includes(key) && !optional.includes(key))) {
    throw new Error("CLARA_PLANNER_INVALID_FIELDS");
  }
}

export function parseClaraPlanDecision(value: unknown): ClaraPlanDecision {
  const decision = record(value);
  if (decision.action === "execute_tool") {
    exactKeys(decision, ["action", "toolName", "input", "reasonCode", "targetTopics"]);
    if (typeof decision.toolName !== "string" || !claraToolRegistry.has(decision.toolName)) throw new Error("CLARA_PLANNER_UNKNOWN_TOOL");
    if (typeof decision.reasonCode !== "string" || !EXECUTE_REASONS.has(decision.reasonCode as ExecuteToolReasonCode)) throw new Error("CLARA_PLANNER_INVALID_REASON");
    const input = record(decision.input);
    if (!Array.isArray(decision.targetTopics) || !decision.targetTopics.length ||
        decision.targetTopics.some((topic) => typeof topic !== "string" || !TOPICS.has(topic as ResearchTopic))) {
      throw new Error("CLARA_PLANNER_INVALID_TOPICS");
    }
    return {
      action: "execute_tool",
      toolName: decision.toolName as ClaraToolName,
      input,
      reasonCode: decision.reasonCode as ExecuteToolReasonCode,
      targetTopics: [...new Set(decision.targetTopics as ResearchTopic[])],
    };
  }
  if (decision.action === "stop") {
    exactKeys(decision, ["action", "reasonCode"], ["message"]);
    if (typeof decision.reasonCode !== "string" || !STOP_REASONS.has(decision.reasonCode as StopReasonCode)) throw new Error("CLARA_PLANNER_INVALID_REASON");
    if (decision.message !== undefined && (typeof decision.message !== "string" || decision.message.length > 300)) throw new Error("CLARA_PLANNER_INVALID_MESSAGE");
    return { action: "stop", reasonCode: decision.reasonCode as StopReasonCode, ...(decision.message ? { message: decision.message } : {}) };
  }
  throw new Error("CLARA_PLANNER_INVALID_ACTION");
}
