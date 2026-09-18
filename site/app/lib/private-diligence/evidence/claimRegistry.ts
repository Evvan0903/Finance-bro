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
  for (const service of Array.isArray(fields.services) ? fields.services : []) {
    add("Business model", "service", `${service} is identified as a service`, service, "Medium");
  }
  return output;
}

function factCandidateSeeds(evidence: NormalizedEvidence): ClaimSeed[] {
  return (evidence.factCandidates ?? []).map((candidate): ClaimSeed => {
    if (candidate.factType === "executiveRole") {
      const historical = candidate.temporalStatus === "historical";
      return {
        category: "Management",
        claimType: historical ? "formerExecutiveRole" : "executiveRole",
        statement: historical
          ? `${candidate.personName ?? candidate.value} previously held the role ${candidate.role ?? candidate.value}`
          : `${candidate.personName ?? candidate.value} is identified as ${candidate.role ?? candidate.value}`,
        normalizedValue: candidate.value,
        unit: null,
        period: evidence.publicationDate,
        geography: null,
        materiality: "Medium",
      };
    }
    return {
      category: "Business model",
      claimType: candidate.factType,
      statement: `${candidate.value} is identified as a ${candidate.factType}`,
      normalizedValue: candidate.value,
      unit: null,
      period: evidence.publicationDate,
      geography: null,
      materiality: "Medium",
    };
  });
}

export function buildClaimRegistry(
  researchId: string,
  entityId: string,
  evidence: NormalizedEvidence[],
) {
  const claims: PrivateCompanyClaim[] = [];
  const deduplicatedFacts = new Map<string, PrivateCompanyClaim>();
  const addClaim = (item: NormalizedEvidence, seed: ClaimSeed) => {
    const canDeduplicate = ["product", "service", "executiveRole", "formerExecutiveRole"].includes(seed.claimType);
    const key = `${seed.claimType}|${String(seed.normalizedValue).trim().toLowerCase()}`;
    const existing = canDeduplicate ? deduplicatedFacts.get(key) : null;
    if (existing) {
      existing.evidenceIds = [...new Set([...existing.evidenceIds, item.evidenceId])];
      existing.companyReported ||= item.companyReported;
      existing.independentlyVerified ||= item.independentlyPublished;
      existing.officiallyVerified ||= item.officialRecord;
      existing.limitations = [...new Set([...existing.limitations, ...item.limitations])];
      return;
    }
    const claim: PrivateCompanyClaim = {
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
    };
    claims.push(claim);
    if (canDeduplicate) deduplicatedFacts.set(key, claim);
  };
  for (const item of evidence) {
    if (item.verificationEligibility === "excluded" || item.verificationEligibility === "leadOnly") continue;
    for (const fact of item.researchFacts ?? []) {
      addClaim(item, {category:fact.topic === "people" ? "Management" : "Business model",claimType:`research.${fact.topic}`,statement:fact.value,normalizedValue:fact.value,unit:null,period:fact.publicationDate,geography:null,materiality:"Medium"});
      claims[claims.length-1].researchFact = fact;
    }
    for (const event of item.fundingEvents ?? []) {
      for (const [key, field] of Object.entries(event.fields)) {
        const seed: ClaimSeed = { category: "Financing", claimType: `funding.${key}`, statement: `${key}: ${field.value}`, normalizedValue: field.value, unit: key === "amount" ? String(event.fields.currency?.value ?? "Unspecified") : key === "valuation" ? String(event.fields.valuationCurrency?.value ?? "Unspecified") : null, period: String(event.fields.eventDate?.value ?? item.publicationDate ?? ""), geography: null, materiality: "High" };
        addClaim(item, seed);
        Object.assign(claims[claims.length - 1], { fundingEventId: event.eventId, fundingField: field, officiallyVerified: false, independentlyVerified: false, status: item.companyReported ? "CompanyReported" : "PubliclyReported" });
      }
    }
    for (const seed of [...seeds(item), ...factCandidateSeeds(item)]) addClaim(item, seed);
  }
  return claims;
}

export function assertClaimsHaveEvidence(claims: PrivateCompanyClaim[]) {
  const invalid = claims.filter((claim) => !claim.evidenceIds.length);
  if (invalid.length) throw new Error("Every private-company claim requires evidence");
  return claims;
}
