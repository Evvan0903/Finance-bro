import { createHash } from "node:crypto";
import { extractFundingParagraphs, extractCompanyPage, extractPublicationDate, type ExtractedCompanyPage } from "../extraction/htmlExtractor";
import { normalizeOfficialCompanyUrl, robotsDisallows, safeCompanyFetch } from "../security";
import type { RawEvidence } from "../types";
import type { PrivateCompanyProvider, ProviderSearchResult } from "./providerTypes";

const PREFERRED_PATHS = [
  "/", "/about", "/company", "/team", "/leadership", "/contact",
  "/products", "/services", "/careers", "/news", "/terms", "/privacy",
];

const IDENTITY_PATH = /(?:^|\/)(?:about|company|team|leadership|contact|products?|services?|careers?|jobs|news|newsroom|press|blog|customers?|case-studies|partners?|partnerships|integrations|pricing|security|trust|compliance|terms|privacy|legal)(?:\/|$)/i;

type WebsiteRecord = {
  url: string;
  pageType: string;
  depth: number;
  extracted: ExtractedCompanyPage;
  fundingText: string;
  publicationDate: string | null;
};

export type CompanyWebsiteProviderOptions = {
  fetchImpl?: typeof fetch;
  resolveHost?: Parameters<typeof safeCompanyFetch>[1]["resolveHost"];
  paths?: string[];
  maxPages?: number;
  maxDepth?: number;
  timeoutMs?: number;
};

function pageType(url: URL) {
  const segment = url.pathname.toLowerCase().split("/").filter(Boolean).at(-1) ?? "homepage";
  if (/terms/.test(segment)) return "terms";
  if (/privacy/.test(segment)) return "privacy";
  if (/legal/.test(segment)) return "legal";
  if (/team|leadership/.test(segment)) return "leadership";
  if (/contact/.test(segment)) return "contact";
  if (/product/.test(segment)) return "products";
  if (/service/.test(segment)) return "services";
  if (/about|company/.test(segment)) return "about";
  return segment === "homepage" ? "homepage" : "other";
}

function urlDepth(url: URL) {
  return url.pathname.split("/").filter(Boolean).length;
}

export function selectIdentityLinks(base: URL, links: string[], maxDepth = 2) {
  const output: string[] = [];
  for (const link of links) {
    let target: URL;
    try { target = new URL(link, base); } catch { continue; }
    if (target.hostname.replace(/^www\./, "").toLowerCase() !== base.hostname.replace(/^www\./, "").toLowerCase()) continue;
    target.hash = "";
    if (!IDENTITY_PATH.test(target.pathname) || urlDepth(target) > maxDepth) continue;
    output.push(target.toString());
  }
  return [...new Set(output)];
}

/** One page per promising subject before another page from the same navigation group. */
export function diversifyResearchLinks(links: string[]) {
  const groups = [
    /\/(?:about|company|team|leadership)(?:\/|$)/i,
    /\/(?:products?|services?)(?:\/|$)/i,
    /\/(?:customers?|case-studies|partners?|partnerships|integrations)(?:\/|$)/i,
    /\/(?:careers?|jobs)(?:\/|$)/i,
    /\/(?:news|newsroom|press|blog)(?:\/|$)/i,
    /\/(?:pricing|security|trust|compliance)(?:\/|$)/i,
  ];
  const buckets: string[][] = Array.from({ length: groups.length + 1 }, () => []);
  for (const link of [...new Set(links)]) {
    const index = groups.findIndex(pattern => pattern.test(new URL(link).pathname));
    buckets[index < 0 ? groups.length : index].push(link);
  }
  return Array.from({ length: Math.max(0, ...buckets.map(b => b.length)) }, (_, position) =>
    buckets.flatMap(bucket => bucket[position] ? [bucket[position]] : [])).flat();
}

export function createCompanyWebsiteProvider(
  options: CompanyWebsiteProviderOptions = {},
): PrivateCompanyProvider {
  return {
    providerId: "companyWebsite",
    providerName: "Company website",
    sourceTier: 2,
    providerCategory: "companyDirect",
    isConfigured: () => true,
    supports: (context) => Boolean(context.input.website || context.identityGraph.domains.length),
    validateConfiguration: () => "success",
    search: async (context): Promise<ProviderSearchResult> => {
      const source = context.input.website ?? `https://${context.identityGraph.domains[0]}`;
      const official = normalizeOfficialCompanyUrl(source);
      const records: WebsiteRecord[] = [];
      const maxPages = Math.max(1, Math.min(options.maxPages ?? 12, 12));
      const maxDepth = Math.max(0, Math.min(options.maxDepth ?? 2, 2));
      let robots = "";
      try {
        robots = (await safeCompanyFetch(new URL("/robots.txt", official), {
          officialHostname: official.hostname,
          fetchImpl: options.fetchImpl,
          resolveHost: options.resolveHost,
          expectedContent: "text",
          maxBytes: 250_000,
          timeoutMs: Math.min(options.timeoutMs ?? 5_000, 8_000),
        })).text;
      } catch {
        // Missing or unavailable robots.txt does not authorize restricted paths;
        // only explicit Disallow rules in a successful file are applied.
      }
      const configured = options.paths ?? [PREFERRED_PATHS[0]];
      const queue = configured.map((path) => new URL(path, official).toString());
      const seen = new Set<string>();
      // Failed guessed paths are also work: they must not consume an entire run.
      const maxAttempts = maxPages + 4;
      let failedPages = 0;
      while (queue.length && records.length < maxPages && seen.size < maxAttempts) {
        const batchUrls = queue.splice(0, Math.min(3, maxPages - records.length, maxAttempts - seen.size))
          .filter((value) => !seen.has(value));
        batchUrls.forEach((value) => seen.add(value));
        const batch = await Promise.all(batchUrls.map(async (value) => {
          try {
            const target = new URL(value);
            if (urlDepth(target) > maxDepth || (robots && robotsDisallows(robots, target.pathname))) return null;
            const response = await safeCompanyFetch(target, {
              officialHostname: official.hostname,
              fetchImpl: options.fetchImpl,
              resolveHost: options.resolveHost,
              timeoutMs: Math.min(options.timeoutMs ?? 5_000, 8_000),
            });
            const resolved = new URL(response.url);
            const extracted = extractCompanyPage(response.text);
            return { url: response.url, pageType: pageType(resolved), depth: urlDepth(resolved), extracted, fundingText: extractFundingParagraphs(response.text), publicationDate: extractPublicationDate(response.text, extracted) };
          } catch {
            failedPages++;
            return null;
          }
        }));
        const usable = batch.filter((item): item is WebsiteRecord => Boolean(item));
        records.push(...usable.filter((item) => !records.some((existing) => existing.url === item.url)));
        if (!options.paths) {
          const discovered = usable.flatMap((item) => selectIdentityLinks(new URL(item.url), item.extracted.links, maxDepth));
          const fallbacks = PREFERRED_PATHS.map((path) => new URL(path, official).toString());
          const candidates = diversifyResearchLinks([...queue.filter(url => !fallbacks.includes(url)), ...discovered]);
          queue.splice(0, queue.length, ...[...new Set([...candidates, ...fallbacks])].filter(url => !seen.has(url)));
        }
      }
      return {
        status: records.length ? (records.length < 2 || failedPages ? "partial" : "success") : failedPages ? 'upstreamUnavailable' : "noData",
        records,
        sanitizedIssue: records.length ? null : "No supported public HTML pages were retrieved",
      };
    },
    fetchDetails: async (records) => records,
    normalize: async (records, context) => {
      const output: RawEvidence[] = [];
      for (const [index, record] of (records as WebsiteRecord[]).entries()) {
        const extracted = record.extracted;
        const profilePage = !["terms","privacy","legal"].includes(record.pageType);
        const leadershipPage = ["about","leadership"].includes(record.pageType);
        const rawText = [extracted.description, ...extracted.headings, extracted.bodyText]
          .filter(Boolean).join("\n").slice(0, 120_000);
        const contentHash = createHash("sha256").update(rawText).digest("hex");
        output.push({
          evidenceId: `website-${context.researchId}-${index + 1}`,
          researchId: context.researchId,
          entityId: context.identityGraph.entityId,
          providerId: "companyWebsite",
          sourceTier: 2,
          sourceType: "Company-controlled web page",
          sourceTitle: extracted.title,
          sourceUrl: record.url,
          publicReferenceUrl: record.url,
          publicationDate: record.publicationDate,
          retrievedAt: context.now().toISOString(),
          rawText,
          structuredData: {
            fundingText: record.fundingText,
            pageTitle: extracted.title,
            pageType: record.pageType,
            crawlDepth: record.depth,
            description: extracted.description,
            organizationName: extracted.organizationNames[0] ?? null,
            legalName: extracted.legalNames[0] ?? null,
            organizationNames: extracted.organizationNames,
            legalNames: extracted.legalNames,
            legalEntityMentions: extracted.legalEntityMentions,
            alternateNames: extracted.alternateNames,
            founders: leadershipPage ? extracted.founders : extracted.organizationFounders,
            executives: leadershipPage ? extracted.executives : [],
            addresses: extracted.addresses,
            cities: extracted.cities,
            states: extracted.states,
            countries: extracted.countries,
            industryLabels: extracted.industryLabels,
            emailDomains: extracted.emailDomains,
            phoneNumbers: extracted.phoneNumbers,
            products: profilePage ? extracted.products : [],
            services: profilePage ? extracted.services : [],
            factCandidates: profilePage ? extracted.factCandidates.filter(c=>c.factType!=="executiveRole" || leadershipPage) : [],
            socialProfiles: extracted.socialProfiles,
            links: extracted.links,
            affiliateNames: extracted.affiliateNames,
            extractedFields: Object.entries({
              organizationName: extracted.organizationNames,
              legalName: [...extracted.legalNames, ...extracted.legalEntityMentions],
              location: extracted.addresses,
              founders: leadershipPage ? extracted.founders : extracted.organizationFounders,
              executives: leadershipPage ? extracted.executives : [],
              industry: extracted.industryLabels,
            }).filter(([, value]) => value.length).map(([key]) => key),
            evidenceStatus: "Company Reported",
          },
          matchedEntitySignals: [context.identityGraph.resolutionStatus === "autoConfirmed" || context.identityGraph.resolutionStatus === "userConfirmed"
            ? "user-confirmed company domain"
            : "company website identity lead"],
          entityMatchConfidence: context.identityGraph.identityConfidence,
          companyReported: true,
          officialRecord: false,
          independentlyPublished: false,
          contentHash,
          limitations: ["Website statements are Company Reported unless independently corroborated."],
        });
      }
      return output;
    },
    buildPublicReference: (evidence: RawEvidence) => evidence.publicReferenceUrl,
  };
}
