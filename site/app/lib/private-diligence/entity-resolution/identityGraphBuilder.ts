import type { EntityCandidate, EntityIdentityGraph, PrivateCompanyInput } from "../types";

function compact(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

export function buildIdentityGraph(
  candidate: EntityCandidate,
  input: PrivateCompanyInput,
): EntityIdentityGraph {
  const jurisdiction = compact([candidate.registrationJurisdiction]);
  const targetSelectionStatus = candidate.targetSelectionStatus ??
    (candidate.resolutionStatus === "autoConfirmed" ? "autoSelected" : candidate.resolutionStatus === "userConfirmed" ? "userSelected" : "unselected");
  const identityVerificationStatus = candidate.identityVerificationStatus ??
    (candidate.registrationNumbers.length && candidate.legalName && candidate.matchConfidence === "High"
      ? "verified" : candidate.websiteReachable || candidate.legalName ? "partiallyVerified" : "unverified");
  return {
    entityId: `entity-${candidate.candidateId}`,
    canonicalName: candidate.legalName ?? candidate.displayName,
    legalNames: compact([candidate.legalName, ...candidate.termsLegalNames, ...candidate.privacyLegalNames]),
    dbaNames: compact([candidate.displayName, ...candidate.dbaNames, ...candidate.websiteOrganizationNames]),
    formerNames: compact(candidate.formerNames),
    domains: compact([candidate.domain]),
    emailDomains: compact(candidate.emailDomains),
    addresses: compact(candidate.addresses),
    phoneNumbers: compact(candidate.phoneNumbers),
    founders: compact(candidate.founders),
    executives: compact(candidate.executives),
    directors: [],
    registrationNumbers: compact(candidate.registrationNumbers),
    registrationJurisdictions: jurisdiction,
    cikCandidates: candidate.registrationNumbers
      .filter((value) => /^CIK[:\s-]*\d{1,10}$/i.test(value))
      .map((value) => value.replace(/\D/g, "").padStart(10, "0")),
    ueiCandidates: candidate.registrationNumbers
      .filter((value) => /^UEI[:\s-]*/i.test(value)).map((value) => value.replace(/^UEI[:\s-]*/i, "")),
    cageCodes: candidate.registrationNumbers
      .filter((value) => /^CAGE[:\s-]*/i.test(value)).map((value) => value.replace(/^CAGE[:\s-]*/i, "")),
    samEntityIds: [],
    usaSpendingRecipientIds: [],
    patentAssigneeNames: compact([candidate.legalName, candidate.displayName, ...candidate.termsLegalNames, ...candidate.privacyLegalNames, ...candidate.dbaNames, ...candidate.formerNames]),
    trademarkOwnerNames: compact([candidate.legalName, candidate.displayName, ...candidate.termsLegalNames, ...candidate.privacyLegalNames, ...candidate.dbaNames, ...candidate.formerNames]),
    parentCompanies: [],
    subsidiaries: [],
    affiliatedEntities: compact(candidate.affiliateNames),
    socialProfiles: compact(candidate.socialProfiles),
    termsPageLegalNames: compact(candidate.termsLegalNames),
    privacyPageLegalNames: compact(candidate.privacyLegalNames),
    productCategories: compact(candidate.productCategories),
    industryLabels: compact([candidate.industry, input.industry]),
    identityConfidence: candidate.matchConfidence,
    resolutionStatus: candidate.resolutionStatus,
    targetSelectionStatus,
    identityVerificationStatus,
    identityLimitations: [
      ...(candidate.registrationNumbers.length ? [] : ["No official registration number was confirmed during entity resolution."]),
      ...(candidate.matchConfidence === "High" ? [] : ["The target entity required user confirmation because public identity signals were incomplete."]),
      ...(targetSelectionStatus === "userSelected" && candidate.matchConfidence === "Low"
        ? ["Target selected by the user before full legal-entity verification. Clara will continue verifying the entity during research."]
        : []),
      ...candidate.unresolvedIdentityFields.map((field) => `${field} was not identified during website-first entity resolution.`),
      ...(input.founderOrExecutive && !candidate.founders.includes(input.founderOrExecutive)
        ? ["The user-supplied founder or executive was used as a search lead but was not independently confirmed during entity resolution."]
        : []),
      "Affiliates, parents, subsidiaries, and founder-owned entities remain separate unless a relationship is explicitly evidenced.",
    ],
  };
}
