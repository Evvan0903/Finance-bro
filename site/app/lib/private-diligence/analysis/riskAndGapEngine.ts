import type { ConflictRecord, DueDiligenceQuestion, EntityIdentityGraph, InformationGap, NormalizedEvidence, PrivateCompanyClaim, RiskFinding } from "../types";

export function buildRiskFindings(
  graph: EntityIdentityGraph,
  claims: PrivateCompanyClaim[],
  conflicts: ConflictRecord[],
): RiskFinding[] {
  const output: RiskFinding[] = conflicts.map((conflict, index) => ({
    riskId: `risk-conflict-${index + 1}`,
    category: "information quality",
    title: `Conflicting ${conflict.claimType} evidence`,
    description: "Credible public sources report different values and management confirmation is required.",
    severity: conflict.materiality === "Critical" ? "High" : "Medium",
    evidenceIds: conflict.evidenceIds,
    claimIds: claims.filter((claim) => claim.claimType === conflict.claimType).map((claim) => claim.claimId),
    status: "Requires verification",
    mitigatingEvidence: [],
    limitations: ["A conflict is not evidence of misconduct."],
  }));
  if (graph.identityConfidence !== "High") {
    output.push({
      riskId: "risk-identity-resolution",
      category: "entity identity",
      title: "Entity identity requires additional confirmation",
      description: "Public identity signals did not establish a high-confidence official registration match.",
      severity: "Medium",
      evidenceIds: [],
      claimIds: [],
      status: "Requires verification",
      mitigatingEvidence: [],
      limitations: ["This is an identity-verification limitation, not an adverse finding."],
    });
  }
  return output;
}

export function buildInformationGaps(
  claims: PrivateCompanyClaim[],
  evidence: NormalizedEvidence[],
) {
  const claimTypes = new Set(claims.map((claim) => claim.claimType));
  const providers = new Set(evidence.map((item) => item.providerId));
  const definitions = [
    ["ownership", "Current cap table and beneficial ownership cannot be verified from the reviewed public sources", "Ownership and control affect governance, conflicts, and transaction approval", "Critical", ["Current fully diluted cap table", "Shareholder agreements", "Beneficial ownership schedule"]],
    ["financial", "Revenue, profitability, cash flow, liquidity, and debt are not publicly disclosed", "Private-company financial capacity cannot be assessed reliably without verified statements", "Critical", ["Audited or reviewed financial statements", "Current management accounts", "Debt schedule"]],
    ["customers", "Customer concentration and retention are not publicly verifiable", "Commercial durability and concentration risk remain unknown", "High", ["Customer concentration schedule", "Cohort retention analysis", "Material customer contracts"]],
    ["licensing", "Current licenses and regulatory standing require jurisdiction-specific verification", "Required licenses can affect the ability to operate", "High", ["License register", "Regulatory correspondence", "Compliance certificates"]],
    ["litigation", "No comprehensive litigation source was available in Clara V1", "Public-source review cannot establish complete litigation coverage", "High", ["Litigation schedule", "Counsel letter", "Claims history"]],
    ["cybersecurity", "Cybersecurity controls and incidents are not assessable from the reviewed public sources", "Security posture requires direct evidence and specialist review", "High", ["Security assessment", "Incident log", "SOC 2 or equivalent report"]],
  ] as const;
  return definitions.filter(([category]) => {
    if (category === "customers") return !claimTypes.has("customer");
    if (category === "licensing") return !providers.has("licensing");
    return true;
  }).map(([category, missingInformation, whyItMatters, priority, recommendedEvidence], index): InformationGap => ({
    gapId: `gap-${index + 1}`,
    category,
    missingInformation,
    whyItMatters,
    affectedClaims: [],
    affectedSections: category === "financial" ? ["06"] : category === "customers" ? ["08"] : ["03", "15"],
    priority,
    recommendedEvidence: [...recommendedEvidence],
    publicSearchCoverage: "Public sources reviewed; direct management or professional evidence remains required.",
  }));
}

export function buildDiligenceQuestions(gaps: InformationGap[], conflicts: ConflictRecord[]) {
  const questions: DueDiligenceQuestion[] = gaps.map((gap, index) => ({
    questionId: `question-gap-${index + 1}`,
    category: gap.category,
    question: `Please provide ${gap.recommendedEvidence[0].toLowerCase()}`,
    reason: gap.whyItMatters,
    claimBeingVerified: null,
    priority: gap.priority,
    recommendedEvidence: gap.recommendedEvidence,
    relatedGapIds: [gap.gapId],
  }));
  for (const [index, conflict] of conflicts.entries()) {
    questions.push({
      questionId: `question-conflict-${index + 1}`,
      category: "conflicting information",
      question: `Which reported ${conflict.claimType} value is current and how should the difference be explained`,
      reason: conflict.possibleExplanation,
      claimBeingVerified: conflict.claimType,
      priority: conflict.materiality,
      recommendedEvidence: ["Current official record", "Management representation", "Supporting dated documents"],
      relatedGapIds: [],
    });
  }
  return questions;
}
