import type { EvidenceFactCandidate, NormalizedEvidence, RawEvidence, VerificationEligibility } from "../types";

function eligibility(evidence: RawEvidence): VerificationEligibility {
  if (evidence.verification?.status === 'rejected') return 'excluded';
  if (evidence.verification?.status === 'unverified') return 'leadOnly';
  if (evidence.entityMatchConfidence === "Low") return evidence.sourceTier === 4 ? "excluded" : "leadOnly";
  if (evidence.sourceTier === 4) return "leadOnly";
  if (evidence.sourceTier === 1 && evidence.officialRecord) return "finalEvidence";
  if (evidence.sourceTier === 2 || evidence.sourceTier === 3) return "supportingEvidence";
  return "excluded";
}

function bounded(value: unknown, maximum: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length <= maximum ? cleaned : `${cleaned.slice(0, maximum - 1).trim()}…`;
}

function normalizedFactCandidates(evidence: RawEvidence) {
  const input = Array.isArray(evidence.structuredData.factCandidates)
    ? evidence.structuredData.factCandidates
    : [];
  const output = new Map<string, EvidenceFactCandidate>();
  for (const candidate of input) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Record<string, unknown>;
    const factType = row.factType;
    const value = bounded(row.value, 160);
    const excerpt = bounded(row.excerpt, 360);
    if (!value || !excerpt || !["product", "service", "executiveRole"].includes(String(factType))) continue;
    const temporalStatus = ["current", "historical", "notApplicable"].includes(String(row.temporalStatus))
      ? row.temporalStatus as EvidenceFactCandidate["temporalStatus"]
      : "notApplicable";
    const normalized: EvidenceFactCandidate = {
      factType: factType as EvidenceFactCandidate["factType"],
      value,
      personName: bounded(row.personName, 120),
      role: bounded(row.role, 120),
      temporalStatus,
      excerpt,
      locator: bounded(row.locator, 160),
      extractionMethod: row.extractionMethod === "jsonLd" ? "jsonLd" : "visibleText",
      evidenceId: evidence.evidenceId,
      sourceUrl: evidence.publicReferenceUrl,
      publicationDate: evidence.publicationDate,
      retrievedAt: evidence.retrievedAt,
      companyReported: evidence.companyReported,
    };
    const key = [normalized.factType, normalized.value, normalized.temporalStatus].join("|").toLowerCase();
    if (!output.has(key)) output.set(key, normalized);
  }
  return [...output.values()].slice(0, 80);
}

export function normalizeEvidenceRegistry(rawEvidence: RawEvidence[]) {
  const unique = new Map<string, RawEvidence>();
  for (const evidence of rawEvidence) {
    const key = `${evidence.contentHash}|${evidence.entityId}|${evidence.providerId}`;
    if (!unique.has(key)) unique.set(key, evidence);
  }
  return [...unique.values()].map((evidence): NormalizedEvidence => ({
    evidenceId: evidence.evidenceId,
    verification: evidence.verification,
    entityId: evidence.entityId,
    providerId: evidence.providerId,
    sourceTier: evidence.sourceTier,
    evidenceType: evidence.sourceType,
    subjectName: String(evidence.structuredData.issuerLegalName ?? evidence.structuredData.recipientName ?? evidence.structuredData.organizationName ?? "Company"),
    subjectIdentifiers: evidence.matchedEntitySignals,
    normalizedFields: Object.fromEntries(Object.entries(evidence.structuredData)
      .filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value) ||
        (Array.isArray(value) && value.every((item) => typeof item === "string"))) as Array<[string, string | number | boolean | null | string[]]>),
    fundingEvents: Array.isArray(evidence.structuredData.fundingEvents) ? evidence.structuredData.fundingEvents as import("../funding/types").FundingEvent[] : [],
    factCandidates: normalizedFactCandidates(evidence),
    researchFacts: Array.isArray(evidence.structuredData.researchFacts) ? evidence.structuredData.researchFacts as import("../research/types").SourceFact[] : [],
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
