import { createHash } from "node:crypto";
import { extractCompanyPage, type ExtractedCompanyPage } from "../extraction/htmlExtractor";
import { normalizeOfficialCompanyUrl, robotsDisallows, safeCompanyFetch } from "../security";
import type { RawEvidence } from "../types";
import type { PrivateCompanyProvider, ProviderSearchResult } from "./providerTypes";

const PREFERRED_PATHS = [
  "/", "/about", "/company", "/team", "/leadership", "/contact",
  "/products", "/services", "/careers", "/news", "/terms", "/privacy",
];

const IDENTITY_PATH = /(?:^|\/)(?:about|company|team|leadership|contact|products?|services?|careers?|news|press|terms|privacy|legal)(?:\/|$)/i;

type WebsiteRecord = {
  url: string;
  pageType: string;
  depth: number;
  extracted: ExtractedCompanyPage;
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
      while (queue.length && records.length < maxPages) {
        const batchUrls = queue.splice(0, Math.min(3, maxPages - records.length))
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
            return { url: response.url, pageType: pageType(resolved), depth: urlDepth(resolved), extracted: extractCompanyPage(response.text) };
          } catch {
            return null;
          }
        }));
        const usable = batch.filter((item): item is WebsiteRecord => Boolean(item));
        records.push(...usable.filter((item) => !records.some((existing) => existing.url === item.url)));
        if (!options.paths) {
          const discovered = usable.flatMap((item) => selectIdentityLinks(new URL(item.url), item.extracted.links, maxDepth));
          const fallbacks = PREFERRED_PATHS.map((path) => new URL(path, official).toString());
          for (const next of [...discovered, ...fallbacks]) {
            if (!seen.has(next) && !queue.includes(next)) queue.push(next);
          }
        }
      }
      return {
        status: records.length ? (records.length < 2 ? "partial" : "success") : "noData",
        records,
        sanitizedIssue: records.length ? null : "No supported public HTML pages were retrieved",
      };
    },
    fetchDetails: async (records) => records,
    normalize: async (records, context) => {
      const output: RawEvidence[] = [];
      for (const [index, record] of (records as WebsiteRecord[]).entries()) {
        const extracted = record.extracted;
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
          publicationDate: null,
          retrievedAt: context.now().toISOString(),
          rawText,
          structuredData: {
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
            founders: extracted.founders,
            executives: extracted.executives,
            addresses: extracted.addresses,
            cities: extracted.cities,
            states: extracted.states,
            countries: extracted.countries,
            industryLabels: extracted.industryLabels,
            emailDomains: extracted.emailDomains,
            phoneNumbers: extracted.phoneNumbers,
            products: extracted.products,
            services: extracted.services,
            socialProfiles: extracted.socialProfiles,
            affiliateNames: extracted.affiliateNames,
            extractedFields: Object.entries({
              organizationName: extracted.organizationNames,
              legalName: [...extracted.legalNames, ...extracted.legalEntityMentions],
              location: extracted.addresses,
              founders: extracted.founders,
              executives: extracted.executives,
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
