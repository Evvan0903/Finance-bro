import { createCompanyWebsiteProvider } from "../providers/companyWebsiteProvider";
import { buildIdentityGraph } from "./identityGraphBuilder";
import { scoreEntityCandidate } from "./entityMatcher";
import type { EntityCandidate, PrivateCompanyInput, RawEvidence } from "../types";

function fieldArray(record: RawEvidence | undefined, key: string) {
  const value = record?.structuredData[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function addressParts(address: string | undefined, input: PrivateCompanyInput) {
  if (!address) return { city: null, state: null, country: null };
  const lower = address.toLowerCase();
  return {
    city: input.city && lower.includes(input.city.toLowerCase()) ? input.city : null,
    state: input.state && lower.includes(input.state.toLowerCase()) ? input.state : null,
    country: input.country && lower.includes(input.country.toLowerCase()) ? input.country : null,
  };
}

export async function discoverEntityCandidates(
  researchId: string,
  input: PrivateCompanyInput,
  options: Parameters<typeof createCompanyWebsiteProvider>[0] = {},
) {
  const source = input.website ? new URL(input.website.includes("://") ? input.website : `https://${input.website}`) : null;
  const base = {
    candidateId: crypto.randomUUID(),
    displayName: input.companyName,
    legalName: null,
    dbaNames: [],
    formerNames: [],
    website: source?.toString() ?? null,
    domain: source?.hostname.replace(/^www\./, "") ?? null,
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
    emailDomains: source ? [source.hostname.replace(/^www\./, "")] : [],
    sourceIds: [],
  };
  if (!source) {
    const scored = scoreEntityCandidate(input, base);
    return [{ ...base, ...scored, resolutionStatus: "unresolved" as const }];
  }
  const seedCandidate: EntityCandidate = {
    ...base,
    matchSignals: ["User-supplied company website"],
    matchScore: 0,
    matchConfidence: "Low",
    resolutionStatus: "requiresUserConfirmation",
  };
  const provider = createCompanyWebsiteProvider({ ...options, paths: ["/", "/about", "/terms", "/privacy"] });
  const context = { researchId, input, identityGraph: buildIdentityGraph(seedCandidate, input), now: () => new Date() };
  const search = await provider.search(context);
  const evidence = search.status === "success" || search.status === "partial"
    ? await provider.normalize(await provider.fetchDetails(search.records, context), context)
    : [];
  const primary = evidence[0];
  const legalNames = evidence.flatMap((item) => fieldArray(item, "legalNames"));
  const organizationNames = evidence.flatMap((item) => fieldArray(item, "organizationNames"));
  const pageTitles = evidence.map((item) => item.structuredData.pageTitle)
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  const addresses = [...new Set(evidence.flatMap((item) => fieldArray(item, "addresses")))];
  const location = addressParts(addresses[0], input);
  const candidateBase = {
    ...base,
    displayName: organizationNames[0] ?? input.companyName,
    legalName: legalNames[0] ?? organizationNames[0] ?? null,
    dbaNames: [...new Set([
      ...evidence.flatMap((item) => fieldArray(item, "alternateNames")),
      ...pageTitles,
    ])],
    founders: [...new Set(evidence.flatMap((item) => fieldArray(item, "founders")))],
    executives: [...new Set(evidence.flatMap((item) => fieldArray(item, "executives")))],
    addresses,
    phoneNumbers: [...new Set(evidence.flatMap((item) => fieldArray(item, "phoneNumbers")))],
    sourceIds: evidence.map((item) => item.evidenceId),
    ...location,
  };
  const scored = scoreEntityCandidate(input, candidateBase);
  return [{ ...candidateBase, ...scored, resolutionStatus: scored.resolutionStatus === "unresolved" && primary
    ? "requiresUserConfirmation" as const
    : scored.resolutionStatus }];
}
