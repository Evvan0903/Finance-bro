import type { NormalizedEvidence, RawEvidence, VerificationEligibility } from "../types";

function eligibility(evidence: RawEvidence): VerificationEligibility {
  if (evidence.entityMatchConfidence === "Low") return evidence.sourceTier === 4 ? "excluded" : "leadOnly";
  if (evidence.sourceTier === 4) return "leadOnly";
  if (evidence.sourceTier === 1 && evidence.officialRecord) return "finalEvidence";
  if (evidence.sourceTier === 2 || evidence.sourceTier === 3) return "supportingEvidence";
  return "excluded";
}

export function normalizeEvidenceRegistry(rawEvidence: RawEvidence[]) {
  const unique = new Map<string, RawEvidence>();
  for (const evidence of rawEvidence) {
    const key = `${evidence.contentHash}|${evidence.entityId}|${evidence.providerId}`;
    if (!unique.has(key)) unique.set(key, evidence);
  }
  return [...unique.values()].map((evidence): NormalizedEvidence => ({
    evidenceId: evidence.evidenceId,
    entityId: evidence.entityId,
    providerId: evidence.providerId,
    sourceTier: evidence.sourceTier,
    evidenceType: evidence.sourceType,
    subjectName: String(evidence.structuredData.issuerLegalName ?? evidence.structuredData.recipientName ?? evidence.structuredData.organizationName ?? "Company"),
    subjectIdentifiers: evidence.matchedEntitySignals,
    normalizedFields: Object.fromEntries(Object.entries(evidence.structuredData)
      .filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value) ||
        (Array.isArray(value) && value.every((item) => typeof item === "string"))) as Array<[string, string | number | boolean | null | string[]]>),
    sourceTitle: evidence.sourceTitle,
    sourceUrl: evidence.publicReferenceUrl,
    publicationDate: evidence.publicationDate,
    retrievedAt: evidence.retrievedAt,
    companyReported: evidence.companyReported,
    officialRecord: evidence.officialRecord,
    independentlyPublished: evidence.independentlyPublished,
    entityMatchConfidence: evidence.entityMatchConfidence,
    verificationEligibility: eligibility(evidence),
    limitations: evidence.limitations,
  }));
}
