import { runClaraModel } from "../modelRouter";
import { parseClaraPlanDecision } from "./plannerSchema";
import type { ClaraPlanDecision, ClaraPlannerContext } from "./types";

type PlannerModelRunner = typeof runClaraModel;

export async function planNextClaraAction(
  context: ClaraPlannerContext,
  dependencies: { runModel?: PlannerModelRunner } = {},
): Promise<ClaraPlanDecision> {
  return (dependencies.runModel ?? runClaraModel)({
    tier: "medium",
    task: "plan_next_research_action",
    input: context,
    schema: parseClaraPlanDecision,
  });
}
