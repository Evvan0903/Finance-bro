import { hiringEvidenceFromResult } from "../evidence/hiringEvidence";
import { researchHiringActivity } from "../hiring";
import type { HiringActivityResult } from "../hiring/types";
import { privateDiligenceStore } from "../persistence/researchStore";
import type { ClaraTool, ClaraToolResult } from "./types";
import { isConfirmedToolContext, toolMetadata } from "./types";

export type HiringIntelligenceToolInput = Record<string, never>;
type HiringResearch = typeof researchHiringActivity;
type HiringPersistence = (researchId: string, result: HiringActivityResult) => Promise<unknown>;

export function createHiringIntelligenceTool(dependencies: {
  research?: HiringResearch;
  persist?: HiringPersistence | null;
} = {}): ClaraTool<HiringIntelligenceToolInput, HiringActivityResult> {
  const research = dependencies.research ?? researchHiringActivity;
  const persist = dependencies.persist === undefined
    ? (researchId: string, result: HiringActivityResult) => privateDiligenceStore.persistHiringActivity(researchId, result)
    : dependencies.persist;
  const name = "hiring_intelligence";
  return {
    name,
    description: "Observe public hiring activity for a confirmed company using Clara's deterministic careers adapters",
    inputSchema: { type: "object", required: [], properties: {}, additionalProperties: false },
    async execute(_input, context): Promise<ClaraToolResult<HiringActivityResult>> {
      const startedAt = (context.now ?? (() => new Date()))().toISOString();
      if (!_input || typeof _input !== "object" || Object.keys(_input).length > 0) {
        return { status: "failed", observations: [], evidence: [], gaps: [], errors: [{ code: "invalid_tool_input", message: "Hiring Intelligence does not accept target overrides", retryable: false }], metadata: toolMetadata(name, startedAt, context, []) };
      }
      const graph = context.identityGraph;
      const officialDomain = graph?.domains[0];
      if (!isConfirmedToolContext(context) || !graph || !officialDomain) {
        return { status: "failed", observations: [], evidence: [], gaps: [], errors: [{ code: "target_not_confirmed", message: "Hiring research requires a confirmed target with an official domain", retryable: false }], metadata: toolMetadata(name, startedAt, context, []) };
      }
      try {
        const result = await research({ companyId: graph.entityId, officialUrl: `https://${officialDomain}`, ...context.hiringOptions, retrievedAt: (context.now ?? (() => new Date()))().toISOString() });
        const evidence = hiringEvidenceFromResult(context.researchId, graph, result);
        const executionFailed = ["retrieval_failed", "parse_failed", "browser_fallback_failed"].includes(result.status);
        let persistenceFailed = false;
        if (persist) {
          try { persistenceFailed = (await persist(context.researchId, result)) == null; }
          catch { persistenceFailed = true; }
        }
        const hasPartialCoverage = result.status === "partial" || result.failures.length > 0 || persistenceFailed;
        const status = executionFailed ? "failed" : hasPartialCoverage ? "partial" : "success";
        const sourceEvidenceIds = evidence.map((item) => item.evidenceId);
        return {
          status,
          data: result,
          observations: [
            ...(result.selectedSource ? [{ code: "careers_source_discovered", topic: "hiring activity", description: `A public careers source was processed with ${result.adapter ?? "a registered adapter"}`, evidenceIds: sourceEvidenceIds }] : []),
            ...(["success_with_jobs", "success_zero_jobs"].includes(result.status) ? [{ code: "public_jobs_observed", topic: "hiring activity", description: `${result.jobs.length} public job posting${result.jobs.length === 1 ? " was" : "s were"} observed at retrieval time; this is not a headcount or growth estimate`, evidenceIds: sourceEvidenceIds }] : []),
          ],
          evidence,
          gaps: [
            ...(result.status === "unsupported_source" ? [{ code: "careers_source_unavailable", topic: "hiring activity", description: "No supported public careers source was discovered", severity: "medium" as const, retryable: true }] : []),
            ...result.limitations.map((description, index) => ({ code: `hiring_limitation_${index + 1}`, topic: "hiring activity", description, severity: "low" as const, retryable: true })),
            ...(persistenceFailed ? [{ code: "hiring_snapshot_not_persisted", topic: "hiring activity", description: "The hiring result was produced but its durable snapshot was not persisted", severity: "high" as const, retryable: true }] : []),
          ],
          errors: [
            ...result.failures.map((failure) => ({ code: failure.status, message: failure.reason, retryable: true })),
            ...(persistenceFailed ? [{ code: "hiring_persistence_failed", message: "Hiring snapshot persistence did not complete", retryable: true }] : []),
          ],
          metadata: toolMetadata(name, startedAt, context, evidence),
        };
      } catch {
        return { status: "failed", observations: [], evidence: [], gaps: [], errors: [{ code: "hiring_tool_failed", message: "Hiring intelligence did not complete", retryable: true }], metadata: toolMetadata(name, startedAt, context, []) };
      }
    },
  };
}

export const hiringIntelligenceTool = createHiringIntelligenceTool();
