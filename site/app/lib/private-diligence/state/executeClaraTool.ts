import { getClaraTool } from "../tools/registry";
import type { ClaraToolContext, ClaraToolResult } from "../tools/types";
import { researchStateStore } from "./researchStateStore";

export class ClaraToolExecutionError extends Error {
  constructor(readonly code: "RESEARCH_STATE_NOT_FOUND" | "TOOL_NOT_REGISTERED" | "RESEARCH_CONTEXT_MISMATCH", message: string) {
    super(message);
    this.name = "ClaraToolExecutionError";
  }
}

export async function executeClaraTool<T = unknown>(args: {
  researchStateId: string;
  toolName: string;
  input: unknown;
  context: ClaraToolContext;
}): Promise<ClaraToolResult<T>> {
  const state = await researchStateStore.getResearchState(args.researchStateId);
  if (!state) throw new ClaraToolExecutionError("RESEARCH_STATE_NOT_FOUND", "ResearchState was not found");
  if (state.researchRequestId && state.researchRequestId !== args.context.researchId) {
    throw new ClaraToolExecutionError("RESEARCH_CONTEXT_MISMATCH", "ResearchState does not belong to this research request");
  }
  if (state.companyId && args.context.identityGraph && state.companyId !== args.context.identityGraph.entityId) {
    throw new ClaraToolExecutionError("RESEARCH_CONTEXT_MISMATCH", "ResearchState company does not match the tool context");
  }
  const tool = getClaraTool(args.toolName);
  if (!tool) throw new ClaraToolExecutionError("TOOL_NOT_REGISTERED", "The requested Clara tool is not registered");
  const now = args.context.now ?? (() => new Date());
  const startedAt = now().toISOString();
  let result: ClaraToolResult<T>;
  try {
    result = await tool.execute(args.input, args.context) as ClaraToolResult<T>;
  } catch {
    const completedAt = now().toISOString();
    result = {
      status: "failed",
      observations: [], evidence: [], gaps: [],
      errors: [{ code: "tool_execution_failed", message: "The Clara tool did not complete", retryable: true }],
      metadata: { toolName: tool.name, startedAt, completedAt, retrievalTime: completedAt, sourceCount: 0 },
    };
  }
  await researchStateStore.recordToolExecution({
    researchStateId: state.id,
    toolName: tool.name,
    input: args.input,
    result: result as ClaraToolResult<unknown>,
    identityGraph: args.context.identityGraph,
  });
  return result;
}
