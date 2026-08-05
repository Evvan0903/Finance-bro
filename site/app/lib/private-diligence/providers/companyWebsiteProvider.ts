import { createHash } from "node:crypto";
import { extractCompanyPage, type ExtractedCompanyPage } from "../extraction/htmlExtractor";
import { normalizeOfficialCompanyUrl, robotsDisallows, safeCompanyFetch } from "../security";
import type { RawEvidence } from "../types";
import type { PrivateCompanyProvider, ProviderSearchResult } from "./providerTypes";

const PREFERRED_PATHS = [
  "/", "/about", "/company", "/team", "/leadership", "/products", "/solutions",
  "/services", "/customers", "/case-studies", "/partners", "/careers", "/jobs",
  "/news", "/press", "/terms", "/privacy",
];

type WebsiteRecord = {
  url: string;
  extracted: ExtractedCompanyPage;
};

export type CompanyWebsiteProviderOptions = {
  fetchImpl?: typeof fetch;
  resolveHost?: Parameters<typeof safeCompanyFetch>[1]["resolveHost"];
  paths?: string[];
};

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
      let robots = "";
      try {
        robots = (await safeCompanyFetch(new URL("/robots.txt", official), {
          officialHostname: official.hostname,
          fetchImpl: options.fetchImpl,
          resolveHost: options.resolveHost,
          expectedContent: "text",
          maxBytes: 250_000,
        })).text;
      } catch {
        // Missing or unavailable robots.txt does not authorize restricted paths;
        // only explicit Disallow rules in a successful file are applied.
      }
      const paths = (options.paths ?? PREFERRED_PATHS)
        .filter((path) => !robots || !robotsDisallows(robots, path));
      for (let index = 0; index < paths.length; index += 3) {
        const batch = await Promise.all(paths.slice(index, index + 3).map(async (path) => {
          try {
            const response = await safeCompanyFetch(new URL(path, official), {
              officialHostname: official.hostname,
              fetchImpl: options.fetchImpl,
              resolveHost: options.resolveHost,
            });
            return { url: response.url, extracted: extractCompanyPage(response.text) };
          } catch {
            return null;
          }
        }));
        records.push(...batch.filter((item): item is WebsiteRecord => Boolean(item)));
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
            description: extracted.description,
            organizationName: extracted.organizationNames[0] ?? null,
            legalName: extracted.legalNames[0] ?? null,
            organizationNames: extracted.organizationNames,
            legalNames: extracted.legalNames,
            alternateNames: extracted.alternateNames,
            founders: extracted.founders,
            executives: extracted.executives,
            addresses: extracted.addresses,
            products: extracted.products,
            socialProfiles: extracted.socialProfiles,
          },
          matchedEntitySignals: ["confirmed official domain"],
          entityMatchConfidence: "High",
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
