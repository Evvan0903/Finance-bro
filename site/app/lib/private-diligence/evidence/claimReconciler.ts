import type { ConflictRecord, NormalizedEvidence, PrivateCompanyClaim } from "../types";

function valueKey(value: PrivateCompanyClaim["normalizedValue"], claimType = "") {
  const normalized = String(value).trim().toLowerCase();
  return claimType === "legalName"
    ? normalized.replace(/&/g, " and ")
      .replace(/\b(incorporated|inc|corp|corporation|company|co|limited|ltd|llc|lp|pllc|pbc)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")
    : normalized;
}

export function reconcileClaims(
  claims: PrivateCompanyClaim[],
  evidence: NormalizedEvidence[],
) {
  const evidenceMap = new Map(evidence.map((item) => [item.evidenceId, item]));
  const groups = new Map<string, PrivateCompanyClaim[]>();
  for (const claim of claims) {
    const source = evidenceMap.get(claim.evidenceIds[0]);
    const recordKey = claim.category === "Government"
      ? String(source?.normalizedFields.awardId ?? claim.evidenceIds[0])
      : claim.category === "Financing"
        ? String(source?.normalizedFields.accessionNumber ?? claim.period ?? claim.evidenceIds[0])
        : ["description", "product", "founder", "executive", "customer", "partner"].includes(claim.claimType)
          ? valueKey(claim.normalizedValue, claim.claimType)
          : "single-value";
    const key = `${claim.claimType}|${claim.entityId}|${recordKey}`;
    groups.set(key, [...(groups.get(key) ?? []), claim]);
  }
  const conflicts: ConflictRecord[] = [];
  for (const group of groups.values()) {
    const values = [...new Set(group.map((claim) => valueKey(claim.normalizedValue, claim.claimType)))];
    if (values.length > 1) {
      const evidenceIds = [...new Set(group.flatMap((claim) => claim.evidenceIds))];
      const sourceEvidence = evidenceIds.map((id) => evidenceMap.get(id)).filter(Boolean) as NormalizedEvidence[];
      const conflictId = `conflict-${conflicts.length + 1}`;
      conflicts.push({
        conflictId,
        claimType: group[0].claimType,
        subject: group[0].category,
        values: group.map((claim) => String(claim.normalizedValue)),
        evidenceIds,
        sourceDates: sourceEvidence.map((item) => item.publicationDate),
        sourceTiers: sourceEvidence.map((item) => item.sourceTier),
        materiality: group.some((claim) => claim.materiality === "Critical") ? "Critical" : "High",
        possibleExplanation: group[0].claimType.toLowerCase().includes("date")
          ? "The sources may use different event definitions or reporting dates."
          : "The sources may describe different entities, periods, or superseded information.",
        resolutionStatus: group[0].claimType === "foundingDate"
          ? "likelyDateDefinitionDifference"
          : "requiresManagementConfirmation",
      });
      for (const claim of group) {
        claim.status = "Conflicting";
        claim.conflictingEvidenceIds = evidenceIds.filter((id) => !claim.evidenceIds.includes(id));
      }
      continue;
    }
    const sources = group.flatMap((claim) => claim.evidenceIds).map((id) => evidenceMap.get(id)).filter(Boolean) as NormalizedEvidence[];
    const official = sources.some((item) => item.officialRecord);
    const company = sources.some((item) => item.companyReported);
    const independent = sources.some((item) => item.independentlyPublished);
    for (const claim of group) {
      claim.status = official ? "Verified"
        : company && independent ? "Corroborated"
          : company ? "CompanyReported"
            : independent ? "PubliclyReported"
              : "Unverified";
      claim.officiallyVerified = official;
      claim.independentlyVerified = independent;
    }
  }
  return { claims, conflicts };
}
