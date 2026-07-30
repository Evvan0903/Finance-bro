import { providerConfigurationStatus, readMarketProviderSecrets } from "../config/marketEnv";
import { fetchOfficialJson } from "../security";
import type { MarketDataProvider, MarketEvidence } from "../types";
import type { ProviderFactoryOptions } from "./providerTypes";
import { evidenceId, publicReference } from "./shared";

type GovInfoResult = {
  packageId?: string;
  title?: string;
  dateIssued?: string;
  lastModified?: string;
  collectionCode?: string;
};

export function createGovInfoProvider(options: ProviderFactoryOptions = {}): MarketDataProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    providerId: "govInfo",
    providerName: "GovInfo",
    providerType: "policy",
    isConfigured: () => Boolean(readMarketProviderSecrets().dataGovApiKey),
    supports: (request) => request.scope.focusAreas.includes("policyEnvironment"),
    validateConfiguration: () => providerConfigurationStatus("govInfo"),
    fetchMetadata: async () => ({}),
    fetchData: async (request) => {
      const key = readMarketProviderSecrets().dataGovApiKey;
      if (!key) return [];
      const payload = await fetchOfficialJson<{
        results?: GovInfoResult[];
      }>(
        "https://api.govinfo.gov/search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Api-Key": key },
          body: JSON.stringify({
            query: request.scope.market,
            pageSize: 10,
            offsetMark: "*",
            sorts: [{ field: "lastModified", sortOrder: "DESC" }],
          }),
        },
        fetchImpl,
      );
      return payload.results ?? [];
    },
    normalizeResponse: (raw, request, retrievedAt) => {
      if (!Array.isArray(raw)) return [];
      return (raw as GovInfoResult[]).flatMap((item): MarketEvidence[] => {
        if (!item.packageId || !item.title) return [];
        return [{
          evidenceId: evidenceId("govInfo", item.packageId, item.dateIssued ?? retrievedAt.slice(0, 10), "United States"),
          providerId: "govInfo",
          dataset: item.collectionCode ?? "GovInfo official publications",
          seriesOrTableId: item.packageId,
          sourceTitle: item.title,
          officialSourceUrl: `https://www.govinfo.gov/app/details/${encodeURIComponent(item.packageId)}`,
          retrievedAt,
          publicationDate: item.dateIssued ?? item.lastModified ?? null,
          observationPeriod: item.dateIssued ?? item.lastModified ?? retrievedAt.slice(0, 10),
          geography: "United States",
          industryCode: null,
          marketScope: "Official publication context",
          metricLabel: "Official publication",
          value: "Official publication; legal effect requires document-level review",
          unit: "Policy record",
          currency: null,
          frequency: "pointInTime",
          seasonalAdjustment: null,
          isReported: true,
          isCalculated: false,
          isProxy: false,
          isForecast: false,
          calculationMethod: null,
          confidence: "medium",
          notes: ["Official publication context is not used to calculate market size."],
        }];
      });
    },
    buildSourceReference: (evidence) => publicReference("GovInfo", evidence),
  };
}
