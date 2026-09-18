import type { CoverageAssessment, CoverageProfile, ResearchTopic } from "../coverage/types";
import type { ResearchState, ResearchStateGap, ToolExecutionRecord } from "../state/types";
import type { ClaraToolInputSchema } from "../tools/types";
import type { ClaraToolName } from "../tools/registry";
import type { PrivateCompanyInput } from "../types";

export type PlannerToolDefinition = {
  name: ClaraToolName;
  description: string;
  inputSchema: ClaraToolInputSchema;
};

export type PlannerExecutionSummary = {
  toolName: string;
  attemptCount: number;
  successfulAttemptCount: number;
  failedAttemptCount: number;
  latestStatus: ToolExecutionRecord["status"];
  latestCompletedAt: string;
  latestErrorCodes: string[];
};

export type ClaraPlannerContext = {
  researchState: {
    id: string;
    objective: string;
    confirmedCompany: ResearchState["confirmedCompany"];
    status: ResearchState["status"];
    observations: ResearchState["observations"];
    activeGaps: ResearchStateGap[];
    verification?: { verified: import('../verification/types').VerificationFinding[]; unverified: import('../verification/types').VerificationFinding[]; rejected: import('../verification/types').VerificationFinding[] };
  };
  coverage: CoverageAssessment;
  availableTools: PlannerToolDefinition[];
  executionSummary: PlannerExecutionSummary[];
  authoritativeCompanyInput: PrivateCompanyInput | null;
};

export type ExecuteToolReasonCode =
  | "missing_required_topic"
  | "active_research_gap"
  | "retryable_failure"
  | "missing_identity"
  | "missing_web_evidence";

export type StopReasonCode =
  | "coverage_sufficient"
  | "requires_user_confirmation"
  | "blocked"
  | "no_permitted_action";

export type ClaraPlanDecision =
  | {
      action: "execute_tool";
      toolName: ClaraToolName;
      input: Record<string, unknown>;
      reasonCode: ExecuteToolReasonCode;
      targetTopics: ResearchTopic[];
    }
  | {
      action: "stop";
      reasonCode: StopReasonCode;
      message?: string;
    };

export type PlannerValidationCode =
  | "approved"
  | "coverage_sufficient"
  | "awaiting_user_confirmation"
  | "planner_failed"
  | "invalid_decision"
  | "invalid_tool"
  | "invalid_tool_input"
  | "unsafe_target_override"
  | "company_not_confirmed"
  | "irrelevant_target_topic"
  | "unnecessary_duplicate"
  | "retry_limit_reached"
  | "invalid_stop_reason"
  | "permitted_action_available"
  | "research_context_unavailable";

export type PlannerValidationResult = {
  approved: boolean;
  code: PlannerValidationCode;
  message: string;
};

export type ClaraAgentStepResult = {
  researchState: ResearchState;
  coverageBefore: CoverageAssessment;
  planDecision?: ClaraPlanDecision;
  validation: PlannerValidationResult;
  execution?: ToolExecutionRecord;
  coverageAfter: CoverageAssessment;
  nextStatus: "tool_executed" | "ready_to_complete" | "awaiting_confirmation" | "blocked" | "planner_failed";
  failure?: { code: string; message: string };
};

export type RunClaraAgentStepInput = {
  researchStateId: string;
  profile?: CoverageProfile;
};
