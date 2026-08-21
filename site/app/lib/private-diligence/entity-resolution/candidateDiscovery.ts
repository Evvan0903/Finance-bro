import { createCompanyWebsiteProvider } from "../providers/companyWebsiteProvider";
import { buildIdentityGraph } from "./identityGraphBuilder";
import { normalizeEntityName, scoreEntityCandidate } from "./entityMatcher";
import type { EntityCandidate, PrivateCompanyInput, RawEvidence } from "../types";

function fieldArray(record: RawEvidence | undefined, key: string) {
  const value = record?.structuredData[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function pageRecords(evidence: RawEvidence[], ...types: string[]) {
  return evidence.filter((item) => types.includes(String(item.structuredData.pageType ?? "")));
}

function meaningfulTitle(value: string) {
  const first = value.split(/\s+(?:\||—|–|-|·)\s+/)[0]?.trim() ?? "";
  return /^(?:home|welcome|untitled company page)$/i.test(first) || first.length < 2 ? null : first;
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function candidateWebsiteSeeds(companyName: string) {
  const tokens = normalizeEntityName(companyName).split(" ").filter(Boolean);
  const compactName = tokens.join("");
  const withoutAi = tokens.at(-1) === "ai" ? tokens.slice(0, -1).join("") : "";
  return unique([
    withoutAi ? `https://${withoutAi}.ai` : "",
    compactName ? `https://${compactName}.com` : "",
    tokens.length > 1 && tokens[0].length >= 4 ? `https://${tokens[0]}.com` : "",
  ]).slice(0, 3);
}

function unresolvedFields(candidate: Omit<EntityCandidate, "unresolvedIdentityFields" | "matchScore" | "matchConfidence" | "resolutionStatus" | "matchSignals">) {
  return [
    candidate.legalName ? null : "Legal entity name",
    candidate.addresses.length ? null : "Office location",
    candidate.industry ? null : "Industry",
    candidate.founders.length || candidate.executives.length ? null : "Founders or executives",
    candidate.registrationJurisdiction ? null : "Registration jurisdiction",
    candidate.registrationNumbers.length ? null : "Official registration identifier",
  ].filter((value): value is string => Boolean(value));
}

export type EntityDiscoveryResult = {
  candidates: EntityCandidate[];
  websiteEvidence: RawEvidence[];
  websiteStatus: "notProvided" | "reachable" | "unreachable" | "insufficientIdentity";
};

export async function discoverEntityCandidates(
  researchId: string,
  input: PrivateCompanyInput,
  options: Parameters<typeof createCompanyWebsiteProvider>[0] = {},
): Promise<EntityDiscoveryResult> {
  const source = input.website ? new URL(input.website.includes("://") ? input.website : `https://${input.website}`) : null;
  const base = {
    candidateId: crypto.randomUUID(),
    researchRequestId: researchId,
    displayName: input.companyName ?? "",
    legalName: null,
    dbaNames: [],
    formerNames: [],
    website: source?.toString() ?? null,
    domain: source?.hostname.replace(/^www\./, "").toLowerCase() ?? null,
    city: null,
    state: null,
    country: null,
    industry: null,
    founders: [],
    executives: [],
    registrationJurisdiction: null,
    registrationNumbers: [],
    addresses: [],
    phoneNumbers: [],
    emailDomains: [],
    websiteOrganizationNames: [],
    termsLegalNames: [],
    privacyLegalNames: [],
    pageTitles: [],
    socialProfiles: [],
    productCategories: [],
    affiliateNames: [],
    websiteReachable: false,
    sourceIds: [],
    targetSelectionStatus: "unselected" as const,
    identityVerificationStatus: "unverified" as const,
    relationshipType: "Target operating company" as const,
  };
  if (!source) {
    const attempts = await Promise.all(candidateWebsiteSeeds(input.companyName ?? "").map(async (website) => {
      const result = await discoverEntityCandidates(researchId, { ...input, website }, { ...options, maxPages: Math.min(options.maxPages ?? 4, 4), maxDepth: Math.min(options.maxDepth ?? 1, 1) });
      return result.candidates.map((candidate) => {
        const rescored = scoreEntityCandidate(input, candidate);
        return { ...candidate, ...rescored, targetSelectionStatus: "unselected" as const };
      }).filter((candidate) =>
        candidate.matchSignals.includes("Organization name confirmed on official website") &&
        !candidate.matchSignals.includes("Website organization differs from supplied company name"),
      ).map((candidate) => ({ candidate, evidence: result.websiteEvidence }));
    }));
    const discovered = attempts.flat();
    const uniqueCandidates = [...new Map(discovered.map((item) => [item.candidate.domain ?? item.candidate.candidateId, item])).values()];
    if (!uniqueCandidates.length && input.companyName) {
      const provisionalBase = {
        ...base,
        displayName: input.companyName,
        sourceIds: [`user-input-${researchId}`],
        unresolvedIdentityFields: unresolvedFields({ ...base, displayName: input.companyName, sourceIds: [`user-input-${researchId}`] }),
      };
      const scored = scoreEntityCandidate(input, provisionalBase);
      return {
        candidates: [{
          ...provisionalBase,
          ...scored,
          matchSignals: ["Company name supplied by user as discovery lead"],
          resolutionStatus: "requiresUserConfirmation",
          relationshipType: "Unknown relationship",
        }],
        websiteEvidence: [],
        websiteStatus: "notProvided",
      };
    }
    return {
      candidates: uniqueCandidates.map((item) => item.candidate),
      websiteEvidence: uniqueCandidates.flatMap((item) => item.evidence),
      websiteStatus: uniqueCandidates.length ? "reachable" : "notProvided",
    };
  }
  const seedCandidate: EntityCandidate = {
    ...base,
    unresolvedIdentityFields: unresolvedFields(base),
    matchSignals: ["Company website supplied as an identity lead"],
    matchScore: 0,
    matchConfidence: "Low",
    resolutionStatus: "unresolved",
    targetSelectionStatus: "unselected",
    identityVerificationStatus: "unverified",
    relationshipType: "Target operating company",
  };
  const provider = createCompanyWebsiteProvider({ ...options, maxPages: Math.min(options.maxPages ?? 12, 12), maxDepth: Math.min(options.maxDepth ?? 2, 2) });
  const context = { researchId, input, identityGraph: buildIdentityGraph(seedCandidate, input), now: () => new Date() };
  const search = await provider.search(context);
  const evidence = search.status === "success" || search.status === "partial"
    ? await provider.normalize(await provider.fetchDetails(search.records, context), context)
    : [];
  if (!evidence.length) {
    const fallback = input.companyName
      ? { ...base, unresolvedIdentityFields: unresolvedFields(base) }
      : null;
    return {
      candidates: fallback ? [{ ...fallback, ...scoreEntityCandidate(input, fallback) }] : [],
      websiteEvidence: [],
      websiteStatus: "unreachable",
    };
  }

  const legalNames = unique(evidence.flatMap((item) => fieldArray(item, "legalNames")));
  const organizationNames = unique(evidence.flatMap((item) => fieldArray(item, "organizationNames")));
  const pageTitles = unique(evidence.map((item) => meaningfulTitle(String(item.structuredData.pageTitle ?? ""))).filter((item): item is string => Boolean(item)));
  const terms = pageRecords(evidence, "terms", "legal");
  const privacy = pageRecords(evidence, "privacy");
  const termsLegalNames = unique(terms.flatMap((item) => [...fieldArray(item, "legalNames"), ...fieldArray(item, "legalEntityMentions")]));
  const privacyLegalNames = unique(privacy.flatMap((item) => [...fieldArray(item, "legalNames"), ...fieldArray(item, "legalEntityMentions")]));
  const discoveredNames = unique([...organizationNames, ...legalNames, ...termsLegalNames, ...privacyLegalNames, ...pageTitles]);
  const displayName = organizationNames[0] ?? legalNames[0] ?? termsLegalNames[0] ?? privacyLegalNames[0] ?? pageTitles[0] ?? "";
  if (!displayName || !discoveredNames.some((name) => normalizeEntityName(name))) {
    return { candidates: [], websiteEvidence: evidence, websiteStatus: "insufficientIdentity" };
  }
  const addresses = unique(evidence.flatMap((item) => fieldArray(item, "addresses")));
  const cities = unique(evidence.flatMap((item) => fieldArray(item, "cities")));
  const states = unique(evidence.flatMap((item) => fieldArray(item, "states")));
  const countries = unique(evidence.flatMap((item) => fieldArray(item, "countries")));
  const descriptions = unique(evidence.map((item) => item.structuredData.description)
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim())));
  const candidateBase = {
    ...base,
    displayName,
    legalName: termsLegalNames[0] ?? privacyLegalNames[0] ?? legalNames[0] ?? null,
    dbaNames: unique([...organizationNames, ...pageTitles].filter((name) => normalizeEntityName(name) !== normalizeEntityName(displayName))),
    city: cities[0] ?? null,
    state: states[0] ?? null,
    country: countries[0] ?? null,
    industry: unique(evidence.flatMap((item) => fieldArray(item, "industryLabels")))[0] ?? descriptions[0]?.slice(0, 160) ?? null,
    founders: unique(evidence.flatMap((item) => fieldArray(item, "founders"))),
    executives: unique(evidence.flatMap((item) => fieldArray(item, "executives"))),
    addresses,
    phoneNumbers: unique(evidence.flatMap((item) => fieldArray(item, "phoneNumbers"))),
    emailDomains: unique(evidence.flatMap((item) => fieldArray(item, "emailDomains"))),
    websiteOrganizationNames: organizationNames.length ? organizationNames : pageTitles.slice(0, 1),
    termsLegalNames,
    privacyLegalNames,
    pageTitles,
    socialProfiles: unique(evidence.flatMap((item) => fieldArray(item, "socialProfiles"))),
    productCategories: unique(evidence.flatMap((item) => [...fieldArray(item, "products"), ...fieldArray(item, "services")])),
    affiliateNames: unique(evidence.flatMap((item) => fieldArray(item, "affiliateNames"))),
    websiteReachable: true,
    sourceIds: evidence.map((item) => item.evidenceId),
  };
  const enriched = { ...candidateBase, unresolvedIdentityFields: unresolvedFields(candidateBase) };
  const scored = scoreEntityCandidate(input, enriched);
  return { candidates: [{ ...enriched, ...scored }], websiteEvidence: evidence, websiteStatus: "reachable" };
}
