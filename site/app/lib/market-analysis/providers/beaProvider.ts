import { providerConfigurationStatus, readMarketProviderConfiguration } from "../config/marketEnv";
import { fetchOfficialJson, MarketProviderError, sanitizeSecrets } from "../security";
import type { MarketDataProvider, MarketEvidence } from "../types";
import type { ProviderFactoryOptions } from "./providerTypes";
import { evidenceId, numeric, publicReference } from "./shared";

type BeaRow = {
  Industry?: string;
  IndustrYDescription?: string;
  IndustryDescription?: string;
  Year?: string;
  DataValue?: string;
  Unit?: string;
  UNIT_MULT?: string;
  CL_UNIT?: string;
};

export function createBeaProvider(options: ProviderFactoryOptions = {}): MarketDataProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const mappings = (request: Parameters<MarketDataProvider["fetchData"]>[0]) =>
    request.marketDefinition.officialClassificationMappings.filter(
      (item) => item.providerId === "bea" && item.kind === "beaIndustry",
    );
  return {
    providerId: "bea",
    providerName: "U.S. Bureau of Economic Analysis",
    providerType: "industryEconomic",
    isConfigured: () => readMarketProviderConfiguration().bea.configured,
    supports: (request) => mappings(request).length > 0,
    validateConfiguration: () => providerConfigurationStatus("bea"),
    fetchMetadata: async () => ({}),
    fetchData: async (request) => {
      const userId = readMarketProviderConfiguration().bea.userId;
      if (!userId) return [];
      const years = Array.from(
        { length: request.scope.endYear - request.scope.startYear + 1 },
        (_, index) => request.scope.startYear + index,
      ).join(",");
      const raw = await fetchOfficialJson<{
        BEAAPI?: { Results?: { Data?: BeaRow[]; Error?: unknown }; Request?: unknown };
      }>(
        `https://apps.bea.gov/api/data/?UserID=${encodeURIComponent(userId)}&method=GetData&datasetname=GDPbyIndustry&TableID=1&Frequency=A&Year=${years}&Industry=ALL&ResultFormat=JSON`,
        {},
        fetchImpl,
      );
      if (raw.BEAAPI?.Results?.Error) {
        const errorText = JSON.stringify(raw.BEAAPI.Results.Error);
        const rejected = /(?:invalid|missing|unregistered|rejected|not\s+valid).{0,40}(?:user\s?id|key)|(?:user\s?id|key).{0,40}(?:invalid|missing|unregistered|rejected|not\s+valid)/i.test(errorText);
        throw new MarketProviderError(
          rejected ? "invalidConfiguration" : "invalidRequest",
          rejected ? "BEA rejected its server-side UserID." : "BEA rejected the dataset request.",
        );
      }
      return sanitizeSecrets(raw.BEAAPI?.Results?.Data ?? [], [userId]);
    },
    normalizeResponse: (raw, request, retrievedAt) => {
      if (!Array.isArray(raw)) return [];
      const selected = new Set(mappings(request).map((item) => item.code));
      const output: MarketEvidence[] = [];
      for (const row of raw as BeaRow[]) {
        if (!row.Industry || !selected.has(row.Industry) || !row.Year) continue;
        const value = numeric(row.DataValue);
        if (value === null) continue;
        const multiplier = 10 ** (numeric(row.UNIT_MULT) ?? 0);
        const normalizedValue = value * multiplier;
        output.push({
          evidenceId: evidenceId("bea", row.Industry, row.Year, request.scope.geography),
          providerId: "bea",
          dataset: "GDP by Industry",
          seriesOrTableId: `Table 1 · ${row.Industry}`,
          sourceTitle: row.IndustrYDescription ?? row.IndustryDescription ?? "GDP by Industry",
          officialSourceUrl: "https://www.bea.gov/data/industries/gdp-by-industry",
          retrievedAt,
          publicationDate: null,
          observationPeriod: row.Year,
          geography: request.scope.geography,
          industryCode: row.Industry,
          marketScope: "Industry economic footprint",
          metricLabel: "Industry value added",
          value: normalizedValue,
          unit: row.CL_UNIT ?? row.Unit ?? "Millions of U.S. dollars",
          currency: "USD",
          frequency: "annual",
          seasonalAdjustment: null,
          isReported: true,
          isCalculated: false,
          isProxy: true,
          isForecast: false,
          calculationMethod: row.UNIT_MULT ? `Reported value × 10^${row.UNIT_MULT}` : null,
          confidence: "medium",
          notes: ["BEA economic footprint is a public-data proxy, not commercial market revenue."],
        });
      }
      return output;
    },
    buildSourceReference: (evidence) => publicReference("U.S. Bureau of Economic Analysis", evidence),
  };
}
