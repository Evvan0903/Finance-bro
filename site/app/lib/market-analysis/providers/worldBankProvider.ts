import { fetchOfficialJson } from "../security";
import type { MarketDataProvider, MarketEvidence } from "../types";
import type { ProviderFactoryOptions } from "./providerTypes";
import { evidenceId, numeric, publicReference } from "./shared";

type WorldBankRow = {
  indicator?: { id?: string; value?: string };
  country?: { id?: string; value?: string };
  countryiso3code?: string;
  date?: string;
  value?: number | null;
  unit?: string;
};

export function createWorldBankProvider(options: ProviderFactoryOptions = {}): MarketDataProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const mappings = (request: Parameters<MarketDataProvider["fetchData"]>[0]) =>
    request.marketDefinition.officialClassificationMappings.filter(
      (item) => item.providerId === "worldBank" && item.kind === "worldBankIndicator",
    );
  const international = (request: Parameters<MarketDataProvider["supports"]>[0]) =>
    /international|global|country|china|europe|world/i.test(
      `${request.scope.geography} ${request.scope.geographyB ?? ""}`,
    );
  return {
    providerId: "worldBank",
    providerName: "World Bank Indicators",
    providerType: "international",
    isConfigured: () => true,
    supports: (request) => international(request) && mappings(request).length > 0,
    validateConfiguration: () => "configured",
    fetchMetadata: async () => ({}),
    fetchData: async (request) => {
      const countries = request.scope.geographyB ? "US;CN" : "all";
      const output: WorldBankRow[] = [];
      for (const mapping of mappings(request)) {
        let page = 1;
        let pages = 1;
        do {
          const payload = await fetchOfficialJson<[{
            pages?: number;
          }, WorldBankRow[]]>(
            `https://api.worldbank.org/v2/country/${countries}/indicator/${encodeURIComponent(mapping.code)}?format=json&date=${request.scope.startYear}:${request.scope.endYear}&per_page=1000&page=${page}`,
            {},
            fetchImpl,
          );
          pages = payload[0]?.pages ?? 1;
          output.push(...(payload[1] ?? []));
          page += 1;
        } while (page <= pages && page <= 10);
      }
      return output;
    },
    normalizeResponse: (raw, request, retrievedAt) => {
      if (!Array.isArray(raw)) return [];
      return (raw as WorldBankRow[]).flatMap((row): MarketEvidence[] => {
        const value = numeric(row.value);
        if (value === null || !row.date || !row.indicator?.id) return [];
        return [{
          evidenceId: evidenceId("worldBank", row.indicator.id, row.date, row.countryiso3code ?? "global"),
          providerId: "worldBank",
          dataset: "World Development Indicators",
          seriesOrTableId: row.indicator.id,
          sourceTitle: row.indicator.value ?? row.indicator.id,
          officialSourceUrl: `https://data.worldbank.org/indicator/${encodeURIComponent(row.indicator.id)}`,
          retrievedAt,
          publicationDate: null,
          observationPeriod: row.date,
          geography: row.country?.value ?? row.countryiso3code ?? request.scope.geography,
          industryCode: null,
          marketScope: "International macroeconomic context",
          metricLabel: row.indicator.value ?? row.indicator.id,
          value,
          unit: row.unit || "Indicator-specific unit",
          currency: null,
          frequency: "annual",
          seasonalAdjustment: null,
          isReported: true,
          isCalculated: false,
          isProxy: true,
          isForecast: false,
          calculationMethod: null,
          confidence: "high",
          notes: ["International context is included only for the user-selected geography."],
        }];
      });
    },
    buildSourceReference: (evidence) => publicReference("World Bank Indicators", evidence),
  };
}
