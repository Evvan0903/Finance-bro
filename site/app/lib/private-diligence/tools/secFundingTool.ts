import { executePrivateProvider } from "../providers/providerTypes";
import type { PrivateProviderResult } from "../types";
import { toolMetadata, type ClaraTool } from "./types";

/** Deterministic provider execution. CIK candidates never enter through model arguments. */
export const secFundingTool: ClaraTool<Record<string, never>, PrivateProviderResult> = {
  name: "sec_funding",
  description: "Resolve a corroborated SEC issuer and retrieve bounded original Form D records for the locked target",
  inputSchema: { type: "object", required: [], properties: {}, additionalProperties: false },
  async execute(input, context) {
    const startedAt = new Date().toISOString();
    const provider = context.fundingSession?.secProvider;
    if (!input || Object.keys(input).length || !provider || context.identityGraph?.targetSelectionStatus !== "userSelected") {
      return { status: "failed", observations: [], evidence: [], gaps: [], errors: [{ code: "invalid_sec_action", message: "SEC lookup was not permitted", retryable: false }], metadata: toolMetadata("sec_funding", startedAt, context, []) };
    }
    const result = await executePrivateProvider(provider, { researchId: context.researchId, input: context.input, identityGraph: context.identityGraph, now: context.now ?? (() => new Date()) });
    return { status: result.status === "success" || result.status === "noData" ? "success" : "partial", data: result, evidence: result.evidence,
      observations: [{ code: "sec_funding_outcome", topic: "funding", description: result.status, evidenceIds: result.evidence.map((e) => e.evidenceId) }],
      gaps: result.diagnostic.sanitizedIssue ? [{ code: "sec_funding_gap", topic: "funding", description: result.diagnostic.sanitizedIssue, severity: "medium", retryable: false }] : [],
      errors: [], metadata: toolMetadata("sec_funding", startedAt, context, result.evidence) };
  },
};
