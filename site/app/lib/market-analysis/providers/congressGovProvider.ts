import { providerConfigurationStatus, readMarketProviderConfiguration } from "../config/marketEnv";
import { fetchOfficialJson } from "../security";
import type { MarketDataProvider, MarketEvidence } from "../types";
import type { ProviderFactoryOptions } from "./providerTypes";
import { evidenceId, publicReference } from "./shared";

type CongressBill = {
  congress?: number;
  number?: string;
  originChamber?: string;
  title?: string;
  type?: string;
  updateDate?: string;
  url?: string;
};

export function createCongressGovProvider(options: ProviderFactoryOptions = {}): MarketDataProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    providerId: "congressGov",
    providerName: "Congress.gov",
    providerType: "policy",
    isConfigured: () => readMarketProviderConfiguration().dataGov.configured,
    supports: (request) => request.scope.focusAreas.includes("policyEnvironment"),
    validateConfiguration: () => providerConfigurationStatus("congressGov"),
    fetchMetadata: async () => ({}),
    fetchData: async () => {
      const key = readMarketProviderConfiguration().dataGov.key;
      if (!key) return [];
      const payload = await fetchOfficialJson<{ bills?: CongressBill[] }>(
        "https://api.congress.gov/v3/bill?format=json&limit=10&sort=updateDate+desc",
        { headers: { "X-Api-Key": key } },
        fetchImpl,
      );
      return payload.bills ?? [];
    },
    normalizeResponse: (raw, request, retrievedAt) => {
      if (!Array.isArray(raw)) return [];
      const marketWords = request.scope.market.toLowerCase().split(/\W+/).filter((word) => word.length > 3);
      return (raw as CongressBill[]).flatMap((bill): MarketEvidence[] => {
        const title = bill.title ?? "";
        if (!marketWords.some((word) => title.toLowerCase().includes(word))) return [];
        const id = `${bill.congress ?? "current"}-${bill.type ?? "bill"}-${bill.number ?? "unknown"}`;
        return [{
          evidenceId: evidenceId("congressGov", id, bill.updateDate ?? retrievedAt.slice(0, 10), "United States"),
          providerId: "congressGov",
          dataset: "Congress.gov API",
          seriesOrTableId: id,
          sourceTitle: title,
          officialSourceUrl: bill.url?.startsWith("https://www.congress.gov/")
            ? bill.url
            : "https://www.congress.gov/",
          retrievedAt,
          publicationDate: bill.updateDate ?? null,
          observationPeriod: bill.updateDate?.slice(0, 10) ?? retrievedAt.slice(0, 10),
          geography: "United States",
          industryCode: null,
          marketScope: "Policy context",
          metricLabel: "Pending bill record",
          value: "Pending bill; legislative status requires direct verification",
          unit: "Policy record",
          currency: null,
          frequency: "pointInTime",
          seasonalAdjustment: null,
          isReported: true,
          isCalculated: false,
          isProxy: false,
          isForecast: false,
          calculationMethod: null,
          confidence: "low",
          notes: ["A bill record is not treated as enacted law."],
        }];
      });
    },
    buildSourceReference: (evidence) => publicReference("Congress.gov", evidence),
  };
}
