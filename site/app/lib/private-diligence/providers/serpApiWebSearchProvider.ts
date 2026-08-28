import { createHash } from "node:crypto";
import { extractCompanyPage, type ExtractedCompanyPage } from "../extraction/htmlExtractor";
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
};

type SerpApiFetchedPage = {
  url: string;
  title: string;
  topics: SerpApiSearchTopic[];
  extracted: ExtractedCompanyPage;
  publicationDate: string | null;
};

export type SerpApiWebSearchProviderOptions = {
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
  resolveHost?: Parameters<typeof safeCompanyFetch>[1]["resolveHost"];
  maxSearches?: number;
  resultsPerSearch?: number;
  maxFetchedUrls?: number;
  timeoutMs?: number;
};

class SerpApiProviderError extends Error {
  constructor(readonly code: "invalidConfiguration" | "rateLimited" | "timeout" | "malformedResponse" | "responseTooLarge" | "upstreamUnavailable") {
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
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if ((url.protocol === "https:" && url.port && url.port !== "443") ||
        (url.protocol === "http:" && url.port && url.port !== "80")) return null;
    if (/(?:^|\.)(?:google\.[a-z.]+|serpapi\.com)$/i.test(url.hostname)) return null;
    if (/(?:^|\.)(?:facebook\.com|instagram\.com|tiktok\.com|x\.com|twitter\.com|youtube\.com|reddit\.com)$/i.test(url.hostname)) return null;
    if (/\.(?:pdf|docx?|xlsx?|pptx?|zip|jpe?g|png|gif|webp)$/i.test(url.pathname)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|gclid|fbclid|ref|source)$/i.test(key)) url.searchParams.delete(key);
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

function responseError(status: number) {
  if (status === 401 || status === 403) return new SerpApiProviderError("invalidConfiguration");
  if (status === 429) return new SerpApiProviderError("rateLimited");
  return new SerpApiProviderError("upstreamUnavailable");
}

async function parseSearchResponse(response: Response) {
  if (!response.ok) throw responseError(response.status);
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 1_000_000) throw new SerpApiProviderError("responseTooLarge");
  let payload: unknown;
  try { payload = JSON.parse(text); } catch { throw new SerpApiProviderError("malformedResponse"); }
  if (payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string") {
    throw new SerpApiProviderError("upstreamUnavailable");
  }
  return payload;
}

function publicationDate(html: string, extracted: ExtractedCompanyPage) {
  const candidates = [
    ...extracted.jsonLd.flatMap((item) => [item.datePublished, item.dateModified]),
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
  return text.includes(name)
    ? { confidence: "Medium" as const, signals: ["original page names selected company"] }
    : { confidence: "Low" as const, signals: ["search lead lacked a strong original-page entity match"] };
}

function statusPriority(statuses: string[]) {
  if (statuses.includes("rateLimited")) return "rateLimited" as const;
  if (statuses.includes("invalidConfiguration")) return "authenticationFailed" as const;
  if (statuses.includes("timeout")) return "timeout" as const;
  if (statuses.includes("malformedResponse") || statuses.includes("responseTooLarge")) return "parseFailed" as const;
  return "upstreamUnavailable" as const;
}

export function createSerpApiWebSearchProvider(
  options: SerpApiWebSearchProviderOptions = {},
): PrivateCompanyProvider {
  const apiKey = options.apiKey === undefined ? process.env.SERPAPI_API_KEY?.trim() || null : options.apiKey?.trim() || null;
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxSearches = Math.max(1, Math.min(options.maxSearches ?? 6, 6));
  const resultsPerSearch = Math.max(1, Math.min(options.resultsPerSearch ?? 4, 6));
  const maxFetchedUrls = Math.max(1, Math.min(options.maxFetchedUrls ?? 10, 12));
  const timeoutMs = Math.max(2_000, Math.min(options.timeoutMs ?? 8_000, 12_000));

  return {
    providerId: "serpApiWebSearch",
    providerName: "SerpApi original-source web research",
    sourceTier: 3,
    providerCategory: "independentVerification",
    isConfigured: () => Boolean(apiKey),
    supports: (context) => context.input.workflowMode === "quick" &&
      ["userSelected", "autoSelected"].includes(context.identityGraph.targetSelectionStatus),
    validateConfiguration: () => apiKey ? "success" : "invalidConfiguration",
    search: async (context): Promise<ProviderSearchResult> => {
      if (!apiKey) return { status: "invalidConfiguration", records: [], sanitizedIssue: "Required server configuration is missing" };
      const queries = buildSerpApiQueries(context).slice(0, maxSearches);
      const attempts = await Promise.all(queries.map(async (item) => {
        try {
          const url = new URL("https://serpapi.com/search.json");
          url.search = new URLSearchParams({ engine: "google", q: item.query, api_key: apiKey, num: String(resultsPerSearch), output: "json", hl: "en", safe: "active" }).toString();
          const response = await fetchImpl(url, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
          const payload = await parseSearchResponse(response);
          return { status: "success" as const, leads: normalizeSerpApiOrganicResults(payload, item.topic, resultsPerSearch) };
        } catch (error) {
          if (error instanceof SerpApiProviderError) return { status: error.code, leads: [] };
          if (error instanceof Error && error.name === "AbortError") return { status: "timeout", leads: [] };
          return { status: "upstreamUnavailable", leads: [] };
        }
      }));
      const leads = deduplicateSerpApiLeads(attempts.flatMap((item) => item.leads)).slice(0, maxFetchedUrls);
      const failures = attempts.filter((item) => item.status !== "success").map((item) => item.status);
      if (!attempts.some((item) => item.status === "success")) {
        return { status: statusPriority(failures), records: [], sanitizedIssue: "Web search provider did not return usable discovery leads" };
      }
      return {
        status: leads.length ? (failures.length ? "partial" : "success") : "noData",
        records: leads,
        sanitizedIssue: leads.length ? null : "Web search returned no supported original-page URLs",
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
          return { url: response.url, title: extracted.title || lead.title, topics: lead.topics, extracted, publicationDate: publicationDate(response.text, extracted) };
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
          organizationName: organizationNames[0] ?? (companyReported ? context.identityGraph.canonicalName : null),
          organizationNames,
          description: overviewTopic ? extracted.description : null,
          products: overviewTopic ? extracted.products : [],
          services: overviewTopic ? extracted.services : [],
          founders: page.topics.includes("leadership") ? extracted.founders : [],
          executives: page.topics.includes("leadership") ? extracted.executives : [],
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
          "SerpApi was used only to locate this original page; the search-result snippet was not retained as evidence.",
          companyReported
            ? "Statements on the selected company's domain remain Company Reported unless independently corroborated."
            : "Independent publication does not make this source an official company or government record.",
        ],
      };
    }),
    buildPublicReference: (evidence) => evidence.publicReferenceUrl,
  };
}
