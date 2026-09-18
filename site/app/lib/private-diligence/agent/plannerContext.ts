import type { CoverageAssessment } from "../coverage/types";
import type { ResearchState, ToolExecutionRecord } from "../state/types";
import { claraToolDefinitions } from "../tools/registry";
import type { PrivateCompanyInput } from "../types";
import type { ClaraPlannerContext, PlannerExecutionSummary } from "./types";

function executionSummaries(executions: ToolExecutionRecord[]): PlannerExecutionSummary[] {
  const grouped = new Map<string, ToolExecutionRecord[]>();
  for (const execution of executions) grouped.set(execution.toolName, [...(grouped.get(execution.toolName) ?? []), execution]);
  return [...grouped.entries()].map(([toolName, items]) => {
    const ordered = [...items].sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.attempt - b.attempt);
    const latest = ordered.at(-1)!;
    return {
      toolName,
      attemptCount: ordered.length,
      successfulAttemptCount: ordered.filter((item) => item.status === "success").length,
      failedAttemptCount: ordered.filter((item) => item.status === "failed").length,
      latestStatus: latest.status,
      latestCompletedAt: latest.completedAt,
      latestErrorCodes: latest.errors.map((error) => error.code),
    };
  }).sort((a, b) => a.toolName.localeCompare(b.toolName));
}

export function buildClaraPlannerContext(args: {
  state: ResearchState;
  coverage: CoverageAssessment;
  executions: ToolExecutionRecord[];
  authoritativeCompanyInput?: PrivateCompanyInput | null;
}): ClaraPlannerContext {
  return {
    researchState: {
      id: args.state.id,
      objective: args.state.objective,
      confirmedCompany: args.state.confirmedCompany,
      status: args.state.status,
      observations: args.state.observations.slice(-20),
      activeGaps: args.coverage.activeGaps,
      verification: {
        verified:(args.state.verification?.findings??[]).filter(f=>f.verification.status==='verified').slice(-30),
        unverified:(args.state.verification?.findings??[]).filter(f=>f.verification.status==='unverified').slice(-30),
        rejected:(args.state.verification?.findings??[]).filter(f=>f.verification.status==='rejected').slice(-10),
      },
    },
    coverage: args.coverage,
    availableTools: claraToolDefinitions,
    executionSummary: executionSummaries(args.executions),
    authoritativeCompanyInput: args.authoritativeCompanyInput ?? null,
  };
}
