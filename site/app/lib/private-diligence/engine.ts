import { buildInformationGaps, buildDiligenceQuestions, buildRiskFindings } from "./analysis/riskAndGapEngine";
import { assertClaimsHaveEvidence, buildClaimRegistry } from "./evidence/claimRegistry";
import { reconcileClaims } from "./evidence/claimReconciler";
import { normalizeEvidenceRegistry } from "./evidence/evidenceRegistry";
import { buildPrivateDiligenceProviderPlan } from "./planning/researchPlanner";
import { buildQuickCompanyIntelligencePlan } from "./planning/quickResearchPlanner";
import { createPrivateProviderRegistry, type PrivateProviderRegistryOptions } from "./providers/providerRegistry";
import { executePrivateProvider } from "./providers/providerTypes";
import { buildPrivateDiligenceReport } from "./reports/reportBuilder";
import { buildQuickCompanyIntelligenceReport } from "./reports/quickReportBuilder";
import type { EntityIdentityGraph, PrivateCompanyInput } from "./types";

export class PrivateDiligenceEngineError extends Error {
  constructor(readonly code: "ENTITY_NOT_RESOLVED" | "INSUFFICIENT_PUBLIC_INFORMATION", message: string) {
    super(message);
    this.name = "PrivateDiligenceEngineError";
  }
}

export async function runPrivateDiligence(
  researchId: string,
  input: PrivateCompanyInput,
  graph: EntityIdentityGraph,
  options: PrivateProviderRegistryOptions & { now?: () => Date } = {},
) {
  if (!graph.legalNames.length || (graph.identityConfidence === "Low" && graph.resolutionStatus !== "userConfirmed")) {
    throw new PrivateDiligenceEngineError("ENTITY_NOT_RESOLVED", "The target entity is not sufficiently resolved");
  }
  const now = options.now ?? (() => new Date());
  const quickMode = input.workflowMode === "quick";
  const providerPlan = quickMode ? buildQuickCompanyIntelligencePlan(input, graph) : buildPrivateDiligenceProviderPlan(input, graph);
  const registry = createPrivateProviderRegistry(options);
  const selected = providerPlan.filter((item) => item.selected)
    .map((item) => registry.get(item.providerId)).filter(Boolean);
  const providerResults = [];
  for (let index = 0; index < selected.length; index += 3) {
    const batch = selected.slice(index, index + 3);
    providerResults.push(...await Promise.all(batch.map((provider) => executePrivateProvider(provider!, {
      researchId, input, identityGraph: graph, now,
    }))));
  }
  const rawEvidence = providerResults.flatMap((result) => result.evidence);
  const normalizedEvidence = normalizeEvidenceRegistry(rawEvidence);
  const eligibleEvidence = normalizedEvidence.filter((item) =>
    item.verificationEligibility === "finalEvidence" || item.verificationEligibility === "supportingEvidence",
  );
  if (!eligibleEvidence.length) {
    throw new PrivateDiligenceEngineError(
      "INSUFFICIENT_PUBLIC_INFORMATION",
      "Insufficient public information was identified to produce a reliable diligence report",
    );
  }
  const seededClaims = assertClaimsHaveEvidence(buildClaimRegistry(researchId, graph.entityId, eligibleEvidence));
  const reconciled = reconcileClaims(seededClaims, eligibleEvidence);
  const risks = buildRiskFindings(graph, reconciled.claims, reconciled.conflicts);
  const informationGaps = buildInformationGaps(reconciled.claims, eligibleEvidence);
  const questions = buildDiligenceQuestions(informationGaps, reconciled.conflicts);
  const generatedAt = now().toISOString();
  const reportArgs = {
    researchId, input, graph, providerPlan, evidence: eligibleEvidence,
    claims: reconciled.claims, conflicts: reconciled.conflicts, risks,
    informationGaps, questions, generatedAt,
  };
  const report = quickMode ? buildQuickCompanyIntelligenceReport(reportArgs) : buildPrivateDiligenceReport(reportArgs);
  return { providerPlan, providerResults, rawEvidence, normalizedEvidence, report };
}
