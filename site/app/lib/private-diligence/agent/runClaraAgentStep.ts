import { evaluateCoverage, coverageProfileForObjective } from "../coverage/coverageEvaluator";
import { privateDiligenceStore } from "../persistence/researchStore";
import { executeClaraTool } from "../state/executeClaraTool";
import { researchStateStore } from "../state/researchStateStore";
import type { ResearchState, ToolExecutionRecord } from "../state/types";
import type { ClaraToolContext, ClaraToolResult } from "../tools/types";
import type { PrivateDiligenceResearchRecord } from "../types";
import { buildClaraPlannerContext } from "./plannerContext";
import { planNextClaraAction } from "./planner";
import { validatePlanDecision } from "./plannerValidator";
import type { ClaraAgentStepResult, ClaraPlanDecision, ClaraPlannerContext, PlannerValidationResult, RunClaraAgentStepInput } from "./types";

export class ClaraAgentStepError extends Error {
  constructor(readonly code: "RESEARCH_STATE_NOT_FOUND", message: string) {
    super(message);
    this.name = "ClaraAgentStepError";
  }
}

type AgentStepDependencies = {
  loadState?: (id: string) => Promise<ResearchState | null>;
  loadExecutions?: (id: string) => Promise<ToolExecutionRecord[]>;
  loadResearchRecord?: (id: string) => Promise<PrivateDiligenceResearchRecord | null>;
  planner?: (context: ClaraPlannerContext) => Promise<ClaraPlanDecision>;
  validator?: typeof validatePlanDecision;
  executeTool?: (args: { researchStateId: string; toolName: string; input: unknown; context: ClaraToolContext }) => Promise<ClaraToolResult<unknown>>;
  now?: () => Date;
};

function safeFailure(error: unknown, fallbackCode: string) {
  const rawCode = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : fallbackCode;
  return { code: rawCode.slice(0, 100), message: "Clara could not complete the bounded agent step" };
}

function plannerFailure(state: ResearchState, coverage: ClaraAgentStepResult["coverageBefore"], error: unknown): ClaraAgentStepResult {
  return {
    researchState: state,
    coverageBefore: coverage,
    validation: { approved: false, code: "planner_failed", message: "The Planner did not return a valid structured decision" },
    coverageAfter: coverage,
    nextStatus: "planner_failed",
    failure: safeFailure(error, "CLARA_PLANNER_FAILED"),
  };
}

export async function runClaraAgentStep(
  input: RunClaraAgentStepInput,
  dependencies: AgentStepDependencies = {},
): Promise<ClaraAgentStepResult> {
  const loadState = dependencies.loadState ?? ((id) => researchStateStore.getResearchState(id));
  const loadExecutions = dependencies.loadExecutions ?? ((id) => researchStateStore.listToolExecutions(id));
  const loadResearchRecord = dependencies.loadResearchRecord ?? ((id) => privateDiligenceStore.get(id));
  const now = dependencies.now ?? (() => new Date());
  const state = await loadState(input.researchStateId);
  if (!state) throw new ClaraAgentStepError("RESEARCH_STATE_NOT_FOUND", "ResearchState was not found");
  const executions = await loadExecutions(state.id);
  const profile = input.profile ?? coverageProfileForObjective(state.objective);
  const coverageBefore = evaluateCoverage(state, executions, profile, now().toISOString());
  if (coverageBefore.readyToComplete) {
    return {
      researchState: state,
      coverageBefore,
      validation: { approved: true, code: "coverage_sufficient", message: "Deterministic coverage requirements are satisfied" },
      coverageAfter: coverageBefore,
      nextStatus: "ready_to_complete",
    };
  }

  const record = state.researchRequestId ? await loadResearchRecord(state.researchRequestId) : null;
  const plannerContext = buildClaraPlannerContext({
    state,
    coverage: coverageBefore,
    executions,
    authoritativeCompanyInput: record?.input ?? null,
  });
  let planDecision: ClaraPlanDecision;
  try {
    planDecision = await (dependencies.planner ?? planNextClaraAction)(plannerContext);
  } catch (error) {
    return plannerFailure(state, coverageBefore, error);
  }

  let validation: PlannerValidationResult;
  try {
    validation = (dependencies.validator ?? validatePlanDecision)({
      decision: planDecision,
      state,
      coverage: coverageBefore,
      executions,
      context: { authoritativeCompanyInput: record?.input ?? null, identityGraph: record?.identityGraph ?? null },
    });
  } catch (error) {
    return plannerFailure(state, coverageBefore, error);
  }
  if (!validation.approved) {
    return {
      researchState: state,
      coverageBefore,
      planDecision,
      validation,
      coverageAfter: coverageBefore,
      nextStatus: validation.code === "awaiting_user_confirmation" ? "awaiting_confirmation" : "blocked",
    };
  }
  if (planDecision.action === "stop") {
    return {
      researchState: state,
      coverageBefore,
      planDecision,
      validation,
      coverageAfter: coverageBefore,
      nextStatus: planDecision.reasonCode === "coverage_sufficient" ? "ready_to_complete" :
        planDecision.reasonCode === "requires_user_confirmation" ? "awaiting_confirmation" : "blocked",
    };
  }
  if (!record) {
    return {
      researchState: state, coverageBefore, planDecision,
      validation: { approved: false, code: "research_context_unavailable", message: "The associated Clara research request is unavailable" },
      coverageAfter: coverageBefore, nextStatus: "blocked",
    };
  }

  const priorIds = new Set(executions.map((execution) => execution.id));
  try {
    await (dependencies.executeTool ?? executeClaraTool)({
      researchStateId: state.id,
      toolName: planDecision.toolName,
      input: planDecision.input,
      context: { researchId: record.researchId, input: record.input, identityGraph: record.identityGraph, now },
    });
  } catch (error) {
    return {
      researchState: state, coverageBefore, planDecision, validation,
      coverageAfter: coverageBefore, nextStatus: "blocked",
      failure: safeFailure(error, "CLARA_TOOL_EXECUTION_FAILED"),
    };
  }
  const [updatedState, updatedExecutions] = await Promise.all([loadState(state.id), loadExecutions(state.id)]);
  if (!updatedState) throw new ClaraAgentStepError("RESEARCH_STATE_NOT_FOUND", "ResearchState disappeared after tool execution");
  const execution = updatedExecutions.find((item) => !priorIds.has(item.id) && item.toolName === planDecision.toolName);
  const coverageAfter = evaluateCoverage(updatedState, updatedExecutions, profile, now().toISOString());
  if (!execution) {
    return {
      researchState: updatedState, coverageBefore, planDecision, validation,
      coverageAfter, nextStatus: "blocked",
      failure: { code: "TOOL_EXECUTION_AUDIT_RECORD_MISSING", message: "Clara could not verify the persisted tool execution" },
    };
  }
  return {
    researchState: updatedState,
    coverageBefore,
    planDecision,
    validation,
    execution,
    coverageAfter,
    nextStatus: coverageAfter.readyToComplete ? "ready_to_complete" : "tool_executed",
  };
}
