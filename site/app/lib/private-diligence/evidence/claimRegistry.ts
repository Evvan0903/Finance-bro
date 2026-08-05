import type { NormalizedEvidence, PrivateCompanyClaim } from "../types";

type ClaimSeed = Pick<PrivateCompanyClaim,
  "category" | "claimType" | "statement" | "normalizedValue" | "unit" | "period" | "geography" | "materiality">;

function seeds(evidence: NormalizedEvidence): ClaimSeed[] {
  const fields = evidence.normalizedFields;
  const output: ClaimSeed[] = [];
  const add = (category: string, claimType: string, statement: string, value: unknown, materiality: ClaimSeed["materiality"] = "Medium", unit: string | null = null) => {
    if (value === null || value === undefined || value === "") return;
    if (!["string", "number", "boolean"].includes(typeof value)) return;
    output.push({ category, claimType, statement, normalizedValue: value as string | number | boolean, unit, period: evidence.publicationDate, geography: null, materiality });
  };
  const identifiedName = fields.issuerLegalName ?? fields.organizationName ?? fields.recipientName;
  add("Entity", "legalName", `The identified legal or operating name is ${identifiedName}`, identifiedName, "Critical");
  add("Legal", "jurisdiction", `The entity reports or files in ${fields.jurisdiction}`, fields.jurisdiction, "High");
  add("Business model", "description", String(fields.description ?? ""), fields.description, "Medium");
  add("Financing", "offeringAmount", "SEC Form D reports an offering amount", fields.offeringAmount, "High", "USD");
  add("Financing", "amountSold", "SEC Form D reports an amount sold", fields.amountSold, "High", "USD");
  add("Financing", "firstSaleDate", "SEC Form D reports a first sale date", fields.firstSaleDate, "High");
  add("Financing", "numberOfInvestors", "SEC Form D reports the number of investors", fields.numberOfInvestors, "Medium", "Investors");
  add("Government", "award", `USAspending reports award ${fields.awardId}`, fields.awardId, "High");
  add("Government", "awardAmount", `USAspending reports an award amount for ${fields.awardId}`, fields.awardAmount, "High", "USD");
  add("Government", "awardAgency", `USAspending identifies ${fields.awardingAgency} as the awarding agency`, fields.awardingAgency, "Medium");
  for (const founder of Array.isArray(fields.founders) ? fields.founders : []) {
    add("Management", "founder", `${founder} is identified as a founder`, founder, "High");
  }
  for (const executive of Array.isArray(fields.executives) ? fields.executives : []) {
    add("Management", "executive", `${executive} is identified in company leadership information`, executive, "Medium");
  }
  for (const product of Array.isArray(fields.products) ? fields.products : []) {
    add("Business model", "product", `${product} is identified as a product`, product, "Medium");
  }
  return output;
}

export function buildClaimRegistry(
  researchId: string,
  entityId: string,
  evidence: NormalizedEvidence[],
) {
  const claims: PrivateCompanyClaim[] = [];
  for (const item of evidence) {
    if (item.verificationEligibility === "excluded" || item.verificationEligibility === "leadOnly") continue;
    for (const seed of seeds(item)) {
      claims.push({
        claimId: `claim-${claims.length + 1}`,
        researchId,
        entityId,
        ...seed,
        evidenceIds: [item.evidenceId],
        companyReported: item.companyReported,
        independentlyVerified: item.independentlyPublished,
        officiallyVerified: item.officialRecord,
        conflictingEvidenceIds: [],
        status: item.officialRecord ? "Verified" : item.companyReported ? "CompanyReported" : "PubliclyReported",
        confidence: item.entityMatchConfidence,
        limitations: [...item.limitations],
      });
    }
  }
  return claims;
}

export function assertClaimsHaveEvidence(claims: PrivateCompanyClaim[]) {
  const invalid = claims.filter((claim) => !claim.evidenceIds.length);
  if (invalid.length) throw new Error("Every private-company claim requires evidence");
  return claims;
}
