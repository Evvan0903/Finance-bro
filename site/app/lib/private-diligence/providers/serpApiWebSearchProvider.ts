import { createSharedSearch, safeDiscoveryUrl, searchProviderStatus, type DiscoveryLead, type SearchOptions } from "../search/sharedSearch";
import { createHash } from "node:crypto";
import { extractFundingParagraphs, extractCompanyPage, type ExtractedCompanyPage } from "../extraction/htmlExtractor";
import { normalizeEntityName } from "../entity-resolution/entityMatcher";
import { safeCompanyFetch } from "../security";
import type { RawEvidence } from "../types";
import type { PrivateCompanyProvider, PrivateProviderContext, ProviderSearchResult } from "./providerTypes";

export type SerpApiSearchTopic =
  | "overviewProducts"
  | "leadership"
  | "customersPartners"
  | "hiring"
  | "recentActivity"
  | "fundingAcquisitions";

export type SerpApiSearchQuery = { topic: SerpApiSearchTopic; query: string };

export type SerpApiSearchLead = {
  url: string;
  title: string;
  snippet: string | null;
  topics: SerpApiSearchTopic[];
  position: number;
  discovery?: Omit<DiscoveryLead, "snippet">;
};

type SerpApiFetchedPage = {
  url: string;
  title: string;
  topics: SerpApiSearchTopic[];
  extracted: ExtractedCompanyPage;
  fundingText?: string;
  publicationDate: string | null;
  discovery?: Omit<DiscoveryLead, "snippet">;
};

export type SerpApiWebSearchProviderOptions = Omit<SearchOptions, "session" | "fetchImpl"> & {
  searchSession?: SearchOptions["session"];
  searchFetchImpl?: typeof fetch;
  queries?: SerpApiSearchQuery[];
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
  resolveHost?: Parameters<typeof safeCompanyFetch>[1]["resolveHost"];
  maxSearches?: number;
  resultsPerSearch?: number;
  maxFetchedUrls?: number;
  timeoutMs?: number;
};

class SerpApiProviderError extends Error {
  constructor(readonly code: "quotaExhausted" | "invalidConfiguration" | "rateLimited" | "timeout" | "malformedResponse" | "responseTooLarge" | "upstreamUnavailable") {
    super(code);
    this.name = "SerpApiProviderError";
  }
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function queryKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function deduplicateSerpApiQueries(queries: SerpApiSearchQuery[]) {
  const seen = new Set<string>();
  return queries.filter((item) => {
    const key = queryKey(item.query);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function safeQuotedName(value: string) {
  return value.replace(/["\\]/g, " ").trim().replace(/\s+/g, " ");
}

export function buildSerpApiQueries(context: PrivateProviderContext) {
  const name = safeQuotedName(context.identityGraph.canonicalName);
  const quoted = `"${name}"`;
  const year = context.now().getUTCFullYear();
  return deduplicateSerpApiQueries([
    { topic: "overviewProducts", query: `${quoted} company overview products services` },
    { topic: "leadership", query: `${quoted} founder CEO leadership` },
    { topic: "customersPartners", query: `${quoted} customers partners case study` },
    { topic: "hiring", query: `${quoted} jobs hiring careers` },
    { topic: "recentActivity", query: `${quoted} news ${year} ${year - 1}` },
    { topic: "fundingAcquisitions", query: `${quoted} funding acquisition investors` },
  ]);
}

function canonicalResultUrl(value: string) {
  try {
    const safe = safeDiscoveryUrl(value);
    if (!safe) return null;
    const url = new URL(safe);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if ((url.protocol === "https:" && url.port && url.port !== "443") ||
        (url.protocol === "http:" && url.port && url.port !== "80")) return null;
    if (/(?:^|\.)(?:google\.[a-z.]+|serpapi\.com)$/i.test(url.hostname)) return null;
    if (/(?:^|\.)(?:facebook\.com|instagram\.com|tiktok\.com|x\.com|twitter\.com|youtube\.com|reddit\.com)$/i.test(url.hostname)) return null;
    if (/\.(?:pdf|docx?|xlsx?|pptx?|zip|jpe?g|png|gif|webp)$/i.test(url.pathname)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|gclid|fbclid)$/i.test(key)) url.searchParams.delete(key);
    }
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeSerpApiOrganicResults(
  payload: unknown,
  topic: SerpApiSearchTopic,
  resultLimit = 4,
): SerpApiSearchLead[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { organic_results?: unknown }).organic_results)) {
    throw new SerpApiProviderError("malformedResponse");
  }
  return (payload as { organic_results: unknown[] }).organic_results.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const url = typeof row.link === "string" ? canonicalResultUrl(row.link) : null;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    if (!url || !title) return [];
    return [{
      url,
      title: title.slice(0, 240),
      snippet: typeof row.snippet === "string" ? row.snippet.slice(0, 600) : null,
      topics: [topic],
      position: typeof row.position === "number" ? row.position : index + 1,
    }];
  }).slice(0, Math.max(1, Math.min(resultLimit, 6)));
}

export function deduplicateSerpApiLeads(leads: SerpApiSearchLead[]) {
  const output = new Map<string, SerpApiSearchLead>();
  for (const lead of leads) {
    const key = canonicalResultUrl(lead.url);
    if (!key) continue;
    const existing = output.get(key);
    if (existing) {
      existing.topics = unique([...existing.topics, ...lead.topics]);
      existing.position = Math.min(existing.position, lead.position);
      continue;
    }
    output.set(key, { ...lead, url: key, topics: unique(lead.topics) });
  }
  return [...output.values()];
}

export function publicationDate(html: string, extracted: ExtractedCompanyPage) {
  const candidates = [
    ...extracted.jsonLd.flatMap((item) => [item.datePublished]),
    ...[...html.matchAll(/<meta\b[^>]*(?:property|name)=["'](?:article:published_time|date|datePublished)["'][^>]*content=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]),
  ];
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function sameCompanyDomain(hostname: string, domains: string[]) {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return domains.some((value) => {
    const domain = value.toLowerCase().replace(/^www\./, "");
    return host === domain || host.endsWith(`.${domain}`);
  });
}

function entityMatch(page: SerpApiFetchedPage, context: PrivateProviderContext) {
  const officialDomain = sameCompanyDomain(new URL(page.url).hostname, context.identityGraph.domains);
  if (officialDomain) return { confidence: "High" as const, signals: ["user-confirmed company domain"] };
  const name = normalizeEntityName(context.identityGraph.canonicalName);
  const text = normalizeEntityName([page.extracted.title, page.extracted.description, page.extracted.bodyText].filter(Boolean).join(" "));
  const domainLinked = page.extracted.links.some(link => {
    try { return sameCompanyDomain(new URL(link, page.url).hostname, context.identityGraph.domains); } catch { return false; }
  }) || context.identityGraph.domains.some(domain => page.extracted.bodyText.toLowerCase().includes(domain.toLowerCase()));
  return text.includes(name) && domainLinked
    ? { confidence: "Medium" as const, signals: ["original page names selected company and links its confirmed domain"] }
    : { confidence: "Low" as const, signals: ["search lead lacked a strong original-page entity match"] };
}

export function createSerpApiWebSearchProvider(
  options: SerpApiWebSearchProviderOptions = {},
): PrivateCompanyProvider {

  const fetchImpl = options.fetchImpl ?? fetch;
  const maxSearches = Math.max(1, Math.min(options.maxSearches ?? 6, 6));
  const resultsPerSearch = Math.max(1, Math.min(options.resultsPerSearch ?? 4, 6));
  const maxFetchedUrls = Math.max(1, Math.min(options.maxFetchedUrls ?? 10, 12));
  const timeoutMs = Math.max(2_000, Math.min(options.timeoutMs ?? 8_000, 12_000));

  const router = createSharedSearch({ ...options, session: options.searchSession, fetchImpl: options.searchFetchImpl ?? fetchImpl, maxAttempts: options.maxAttempts ?? maxSearches, timeoutMs });
  return {
    getSearchDiagnostics: () => router.diagnostics.length ? router.diagnostics.map(result => ({ reason: result.reason, attempts: result.attempts, cacheHit: result.cacheHit })) : router.isConfigured() ? [] : [{ reason: "missingConfiguration", attempts: ["serpapi", "tavily"].map(provider => ({ provider: provider as "serpapi" | "tavily", attempted: false, reason: "missingConfiguration" as const })) }],
    providerId: "serpApiWebSearch",
    providerName: "Original-source web research",
    sourceTier: 3,
    providerCategory: "independentVerification",
    isConfigured: () => router.isConfigured(),
    supports: (context) => context.input.workflowMode === "quick" &&
      context.identityGraph.targetSelectionStatus === "userSelected",
    validateConfiguration: () => router.isConfigured() ? "success" : "invalidConfiguration",
    search: async (context): Promise<ProviderSearchResult> => {
      const queries = (options.queries ?? buildSerpApiQueries(context)).slice(0, maxSearches);
      // Sequential dispatch allows a confirmed auth/quota failure to stop later paid attempts.
      const attempts: Array<{reason: import("../search/sharedSearch").SearchReason; leads: SerpApiSearchLead[]}> = [];
      for (const item of queries) {
        const result = await router.search({ query: item.query, limit: resultsPerSearch });
        attempts.push({ ...result, leads: result.leads.map((lead) => {
          const discovery = { url: lead.url, title: lead.title, position: lead.position, searchProvider: lead.searchProvider, searchRetrievedAt: lead.searchRetrievedAt, providerRequestId: lead.providerRequestId, relevanceScore: lead.relevanceScore, publicationDateHint: lead.publicationDateHint };
          return { ...lead, topics: [item.topic], discovery };
        }) });
      }
      const balanced = Array.from({length:resultsPerSearch},(_,position)=>attempts.flatMap(attempt=>attempt.leads[position] ? [attempt.leads[position]] : [])).flat();
      const leads = deduplicateSerpApiLeads(balanced).slice(0, maxFetchedUrls);
      const failures = attempts.filter((item) => !["results", "empty", "filteredOut"].includes(item.reason));
      return {
        status: leads.length ? (failures.length ? "partial" : "success") : failures.length ? searchProviderStatus(failures[0].reason) : "noData",
        records: leads,
        sanitizedIssue: failures.length ? `Search limitation: ${failures.map(item => item.reason).join(", ")}` : leads.length ? null : "Web search returned no supported original-page URLs",
      };
    },
    fetchDetails: async (records) => {
      const leads = deduplicateSerpApiLeads(records as SerpApiSearchLead[]).slice(0, maxFetchedUrls);
      const pages = await Promise.all(leads.map(async (lead): Promise<SerpApiFetchedPage | null> => {
        try {
          const source = new URL(lead.url);
          const response = await safeCompanyFetch(source, {
            officialHostname: source.hostname,
            fetchImpl,
            resolveHost: options.resolveHost,
            timeoutMs,
            maxBytes: 1_500_000,
          });
          const extracted = extractCompanyPage(response.text);
          return { url: response.url, title: extracted.title || lead.title, topics: lead.topics, discovery: lead.discovery, extracted, fundingText: extractFundingParagraphs(response.text), publicationDate: publicationDate(response.text, extracted) };
        } catch {
          return null;
        }
      }));
      return pages.filter((item): item is SerpApiFetchedPage => Boolean(item));
    },
    normalize: async (records, context) => (records as SerpApiFetchedPage[]).map((page, index): RawEvidence => {
      const match = entityMatch(page, context);
      const companyReported = sameCompanyDomain(new URL(page.url).hostname, context.identityGraph.domains);
      const extracted = page.extracted;
      const rawText = [extracted.description, ...extracted.headings, extracted.bodyText].filter(Boolean).join("\n").slice(0, 120_000);
      const organizationNames = extracted.organizationNames.filter((name) =>
        normalizeEntityName(name) === normalizeEntityName(context.identityGraph.canonicalName));
      const overviewTopic = page.topics.includes("overviewProducts");
      const leadershipTopic = page.topics.includes("leadership") && !/\/(?:products?|customers?|case-studies|solutions?)\b/i.test(new URL(page.url).pathname);
      const canonicalName = normalizeEntityName(context.identityGraph.canonicalName);
      const factCandidates = extracted.factCandidates.filter((candidate) => {
        const topicMatches = ((candidate.factType === "product" || candidate.factType === "service") && overviewTopic) ||
          (candidate.factType === "executiveRole" && leadershipTopic);
        if (!topicMatches) return false;
        return companyReported || normalizeEntityName(candidate.excerpt).includes(canonicalName);
      });
      const products = factCandidates.filter((candidate) => candidate.factType === "product").map((candidate) => candidate.value);
      const services = factCandidates.filter((candidate) => candidate.factType === "service").map((candidate) => candidate.value);
      const executives = factCandidates
        .filter((candidate) => candidate.factType === "executiveRole" && candidate.temporalStatus === "current" && candidate.personName)
        .map((candidate) => candidate.personName!);
      return {
        evidenceId: `serpapi-${context.researchId}-${index + 1}`,
        researchId: context.researchId,
        entityId: context.identityGraph.entityId,
        providerId: "serpApiWebSearch",
        sourceTier: companyReported ? 2 : 3,
        sourceType: companyReported ? "Company-controlled original page discovered through web search" : "Independently published original web page",
        sourceTitle: extracted.title || page.title,
        sourceUrl: page.url,
        publicReferenceUrl: page.url,
        publicationDate: page.publicationDate,
        retrievedAt: context.now().toISOString(),
        rawText,
        structuredData: {
          searchDiscovery: page.discovery ?? null,
          fundingText: page.fundingText ?? "",
          organizationName: organizationNames[0] ?? (companyReported ? context.identityGraph.canonicalName : null),
          organizationNames,
          description: overviewTopic ? extracted.description : null,
          products,
          services,
          founders: leadershipTopic ? extracted.founders : [],
          executives,
          factCandidates,
          links: page.topics.includes("hiring") ? extracted.links : [],
          sourceSummary: extracted.description,
          searchTopics: page.topics,
          pageTitle: extracted.title,
          evidenceStatus: companyReported ? "Company Reported" : "Publicly Reported",
        },
        matchedEntitySignals: match.signals,
        entityMatchConfidence: match.confidence,
        companyReported,
        officialRecord: false,
        independentlyPublished: !companyReported,
        contentHash: createHash("sha256").update(`${page.url}\n${rawText}`).digest("hex"),
        limitations: [
          `${page.discovery?.searchProvider ?? "Web search"} was used only to locate this original page; the search-result snippet was not retained as evidence.`,
          companyReported
            ? "Statements on the selected company's domain remain Company Reported unless independently corroborated."
            : "Independent publication does not make this source an official company or government record.",
        ],
      };
    }),
    buildPublicReference: (evidence) => evidence.publicReferenceUrl,
  };
}
