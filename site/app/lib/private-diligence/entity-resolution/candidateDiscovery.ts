import { createCompanyWebsiteProvider } from "../providers/companyWebsiteProvider";
import { buildIdentityGraph } from "./identityGraphBuilder";
import { normalizeEntityName, scoreEntityCandidate } from "./entityMatcher";
import { runClaraModel } from "../modelRouter";
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

type PublicWebsiteSeed = { website: string; sourceId: string; displayName: string; description: string | null };

export async function wikidataWebsiteSeeds(companyName: string, fetchImpl: typeof fetch): Promise<PublicWebsiteSeed[]> {
  try {
    const searchUrl = new URL("https://www.wikidata.org/w/api.php");
    searchUrl.search = new URLSearchParams({ action: "wbsearchentities", search: companyName, language: "en", format: "json", limit: "8", origin: "*" }).toString();
    const searchResponse = await fetchImpl(searchUrl, { headers: { Accept: "application/json", "User-Agent": "FinBro-Clara/1.0 public-company-discovery" }, signal: AbortSignal.timeout(7_000) });
    if (!searchResponse.ok || Number(searchResponse.headers.get("content-length") ?? 0) > 1_000_000) return [];
    const searchPayload = await searchResponse.json() as { search?: Array<{ id?: string; label?: string; description?: string }> };
    const normalizedQuery = normalizeEntityName(companyName);
    const possibleOrganizations = (searchPayload.search ?? []).filter((item) => {
      const label = normalizeEntityName(item.label ?? "");
      const description = item.description ?? "";
      return Boolean(item.id && label && (label === normalizedQuery || label.startsWith(`${normalizedQuery} `)) && /company|business|bank|startup|corporation|manufacturer|software|technology|organisation|organization|brand/i.test(description));
    }).slice(0, 6);
    const entityIds = possibleOrganizations.map((item) => item.id!);
    const wikipediaEntityIds: string[] = [];
    const entityContext = new Map(possibleOrganizations.map((item) => [item.id!, { displayName: item.label ?? companyName, description: item.description ?? null }]));
    const wikipediaTitles = new Map<string, string>();
    {
      const wikipediaUrl = new URL("https://en.wikipedia.org/w/api.php");
      wikipediaUrl.search = new URLSearchParams({ action: "query", list: "search", srsearch: `${companyName} company`, format: "json", srlimit: "10", origin: "*" }).toString();
      const wikipediaResponse = await fetchImpl(wikipediaUrl, { headers: { Accept: "application/json", "User-Agent": "FinBro-Clara/1.0 public-company-discovery" }, signal: AbortSignal.timeout(7_000) });
      if (wikipediaResponse.ok && Number(wikipediaResponse.headers.get("content-length") ?? 0) <= 1_000_000) {
        const wikipediaPayload = await wikipediaResponse.json() as { query?: { search?: Array<{ title?: string; snippet?: string }> } };
        const titles = (wikipediaPayload.query?.search ?? []).filter((item) => {
          const title = normalizeEntityName(item.title ?? "");
          return (title === normalizedQuery || title.startsWith(`${normalizedQuery} `)) && /company|business|bank|startup|corporation|manufacturer|software|technology|brand/i.test(item.snippet ?? "");
        }).map((item) => item.title!).slice(0, 8);
        if (titles.length) {
          const pagePropsUrl = new URL("https://en.wikipedia.org/w/api.php");
          pagePropsUrl.search = new URLSearchParams({ action: "query", prop: "pageprops", titles: titles.join("|"), format: "json", origin: "*" }).toString();
          const pagePropsResponse = await fetchImpl(pagePropsUrl, { headers: { Accept: "application/json", "User-Agent": "FinBro-Clara/1.0 public-company-discovery" }, signal: AbortSignal.timeout(7_000) });
          if (pagePropsResponse.ok && Number(pagePropsResponse.headers.get("content-length") ?? 0) <= 1_000_000) {
            const pagePropsPayload = await pagePropsResponse.json() as { query?: { pages?: Record<string, { title?: string; pageprops?: { wikibase_item?: string } }> } };
            for (const page of Object.values(pagePropsPayload.query?.pages ?? {})) {
              const entityId = page.pageprops?.wikibase_item;
              if (!entityId) continue;
              wikipediaEntityIds.push(entityId);
              if (page.title) wikipediaTitles.set(entityId, page.title);
              const searchResult = (wikipediaPayload.query?.search ?? []).find((item) => item.title === page.title);
              entityContext.set(entityId, { displayName: (page.title ?? companyName).replace(/\s*\([^)]*\)\s*$/, ""), description: searchResult?.snippet?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? null });
            }
          }
        }
      }
    }
    const details = await Promise.all(unique([...wikipediaEntityIds, ...entityIds]).slice(0, 8).map(async (entityId) => {
      const entityResponse = await fetchImpl(`https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(entityId)}.json`, { headers: { Accept: "application/json", "User-Agent": "FinBro-Clara/1.0 public-company-discovery" }, signal: AbortSignal.timeout(7_000) });
      if (!entityResponse.ok || Number(entityResponse.headers.get("content-length") ?? 0) > 1_000_000) return null;
      const payload = await entityResponse.json() as { entities?: Record<string, { claims?: { P856?: Array<{ mainsnak?: { datavalue?: { value?: unknown } } }> } }> };
      const context = entityContext.get(entityId) ?? { displayName: companyName, description: null };
      let website = payload.entities?.[entityId]?.claims?.P856?.[0]?.mainsnak?.datavalue?.value;
      if ((typeof website !== "string" || !/^https?:\/\//i.test(website)) && wikipediaTitles.has(entityId)) {
        const externalLinksUrl = new URL("https://en.wikipedia.org/w/api.php");
        externalLinksUrl.search = new URLSearchParams({ action: "query", prop: "extlinks", titles: wikipediaTitles.get(entityId)!, ellimit: "50", format: "json", origin: "*" }).toString();
        const externalLinksResponse = await fetchImpl(externalLinksUrl, { headers: { Accept: "application/json", "User-Agent": "FinBro-Clara/1.0 public-company-discovery" }, signal: AbortSignal.timeout(7_000) });
        if (externalLinksResponse.ok && Number(externalLinksResponse.headers.get("content-length") ?? 0) <= 1_000_000) {
          const externalLinksPayload = await externalLinksResponse.json() as { query?: { pages?: Record<string, { extlinks?: Array<{ "*"?: string }> }> } };
          const nameToken = normalizeEntityName(context.displayName).split(" ").find((token) => token.length >= 3) ?? "";
          const blocked = /(?:wikipedia|wikimedia|bloomberg|forbes|techcrunch|fortune|businessinsider|theinformation|axios|reuters|linkedin|facebook|instagram|twitter|x\.com|youtube)\./i;
          website = Object.values(externalLinksPayload.query?.pages ?? {}).flatMap((page) => page.extlinks ?? []).map((item) => item["*"]).filter((link): link is string => {
            if (!link || !/^https?:\/\//i.test(link)) return false;
            const hostname = new URL(link).hostname.replace(/^www\./, "").toLowerCase();
            return !blocked.test(hostname) && Boolean(nameToken && normalizeEntityName(hostname).includes(nameToken));
          }).sort((left, right) => new URL(left).pathname.length - new URL(right).pathname.length)[0];
        }
      }
      if (typeof website !== "string" || !/^https?:\/\//i.test(website)) return null;
      return { website, sourceId: `wikidata-${entityId}`, ...context };
    }));
    return [...new Map(details.filter((item): item is PublicWebsiteSeed => Boolean(item)).map((item) => [new URL(item.website).hostname.replace(/^www\./, ""), item])).values()].slice(0, 5);
  } catch {
    return [];
  }
}

export function candidateWebsiteSeeds(companyName: string) {
  const tokens = normalizeEntityName(companyName).split(" ").filter(Boolean);
  const compactName = tokens.join("");
  const withoutAi = tokens.at(-1) === "ai" ? tokens.slice(0, -1).join("") : "";
  return unique([
    withoutAi ? `https://${withoutAi}.ai` : "",
    compactName ? `https://${compactName}.com` : "",
    compactName ? `https://${compactName}.ai` : "",
    tokens.length > 1 ? `https://${tokens.join("-")}.com` : "",
    tokens.length > 1 && tokens[0].length >= 4 ? `https://${tokens[0]}.com` : "",
  ]).slice(0, 5);
}

const RELATIONSHIPS = new Set(["Target operating company", "Possible legal entity", "Parent", "Subsidiary", "Affiliate", "DBA / Brand"]);
const CONFIDENCE = new Set(["High", "Medium", "Low"]);

async function semanticallyRankGroundedCandidates(input: PrivateCompanyInput, candidates: EntityCandidate[]) {
  if (!process.env.DEEPSEEK_API_KEY || !candidates.length) return candidates;
  try {
    const result = await runClaraModel({
      tier: "medium",
      task: "discover_company_candidates",
      input: {
        companyName: input.companyName,
        website: input.website,
        groundedPublicResults: candidates.map((candidate) => ({
          candidateId: candidate.candidateId,
          displayName: candidate.displayName,
          legalName: candidate.legalName,
          website: candidate.website,
          location: [candidate.city, candidate.state, candidate.country].filter(Boolean).join(", ") || null,
          industry: candidate.industry,
          knownPeople: [...candidate.founders, ...candidate.executives],
          publicSourceIds: candidate.sourceIds,
          deterministicMatchSignals: candidate.matchSignals,
        })),
      },
      schema(value) {
        if (!value || typeof value !== "object" || !Array.isArray((value as { candidates?: unknown }).candidates)) throw new Error("INVALID_DISCOVERY_JSON");
        return (value as { candidates: unknown[] }).candidates.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const row = item as Record<string, unknown>;
          const candidateId = typeof row.candidateId === "string" ? row.candidateId : "";
          const relationshipType = typeof row.relationshipType === "string" && RELATIONSHIPS.has(row.relationshipType) ? row.relationshipType : "Target operating company";
          const confidence = typeof row.confidence === "string" && CONFIDENCE.has(row.confidence) ? row.confidence : null;
          const matchReasons = Array.isArray(row.matchReasons) ? row.matchReasons.filter((reason): reason is string => typeof reason === "string" && reason.length <= 180).slice(0, 3) : [];
          return candidateId ? [{ candidateId, relationshipType, confidence, matchReasons }] : [];
        });
      },
    });
    const grounded = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
    const selected = result.flatMap((selection) => {
      const candidate = grounded.get(selection.candidateId);
      if (!candidate) return [];
      return [{
        ...candidate,
        relationshipType: selection.relationshipType as EntityCandidate["relationshipType"],
        matchConfidence: (selection.confidence ?? candidate.matchConfidence) as EntityCandidate["matchConfidence"],
        matchSignals: unique([...candidate.matchSignals, ...selection.matchReasons]),
      }];
    });
    const selectedById = new Map(selected.map((candidate) => [candidate.candidateId, candidate]));
    return candidates.map((candidate) => selectedById.get(candidate.candidateId) ?? candidate).slice(0, 5);
  } catch {
    return candidates;
  }
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
    const publicSeeds = await wikidataWebsiteSeeds(input.companyName ?? "", options.fetchImpl ?? fetch);
    const publicSeedByHost = new Map(publicSeeds.map((item) => [new URL(item.website).hostname.replace(/^www\./, "").toLowerCase(), item]));
    const websites = unique([...publicSeeds.map((item) => item.website), ...candidateWebsiteSeeds(input.companyName ?? "")]).slice(0, 8);
    const attempts = await Promise.all(websites.map(async (website) => {
      const result = await discoverEntityCandidates(researchId, { ...input, website }, { ...options, maxPages: Math.min(options.maxPages ?? 4, 4), maxDepth: Math.min(options.maxDepth ?? 1, 1) });
      const host = new URL(website).hostname.replace(/^www\./, "").toLowerCase();
      const publicSeed = publicSeedByHost.get(host);
      const publicLead = publicSeed ? {
        ...base,
        candidateId: crypto.randomUUID(),
        displayName: publicSeed.displayName,
        website: publicSeed.website,
        domain: host,
        industry: publicSeed.description,
        sourceIds: [publicSeed.sourceId],
        unresolvedIdentityFields: unresolvedFields({ ...base, displayName: publicSeed.displayName, website: publicSeed.website, domain: host, industry: publicSeed.description, sourceIds: [publicSeed.sourceId] }),
        matchSignals: ["Public entity and official website identified by Wikidata"],
        matchScore: 35,
        matchConfidence: "Low" as const,
        resolutionStatus: "requiresUserConfirmation" as const,
      } : null;
      const enrichedCandidates = result.candidates.map((candidate) => {
        const rescored = scoreEntityCandidate(input, candidate);
        const seed = candidate.domain ? publicSeedByHost.get(candidate.domain) : null;
        return { ...candidate, ...rescored, sourceIds: unique([...candidate.sourceIds, ...(seed ? [seed.sourceId] : [])]), targetSelectionStatus: "unselected" as const };
      }).filter((candidate) =>
        candidate.matchSignals.includes("Organization name confirmed on official website") && !candidate.matchSignals.includes("Website organization differs from supplied company name"),
      );
      const groundedCandidates = enrichedCandidates.length ? enrichedCandidates : publicLead ? [publicLead] : [];
      return groundedCandidates.map((candidate) => ({ candidate, evidence: enrichedCandidates.length ? result.websiteEvidence : [] }));
    }));
    const discovered = attempts.flat();
    const uniqueCandidates = [...new Map(discovered.map((item) => [item.candidate.domain ?? item.candidate.candidateId, item])).values()];
    const ranked = await semanticallyRankGroundedCandidates(input, uniqueCandidates.map((item) => item.candidate));
    return {
      candidates: ranked,
      websiteEvidence: uniqueCandidates.flatMap((item) => item.evidence),
      websiteStatus: ranked.length ? "reachable" : "notProvided",
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
