import { readMarketProviderConfiguration, providerConfigurationStatus } from "../config/marketEnv";
import { fetchOfficialJson } from "../security";
import type { MarketDataProvider, MarketEvidence } from "../types";
import type { ProviderFactoryOptions } from "./providerTypes";
import { evidenceId, numeric, publicReference } from "./shared";

type FredSeries = {
  id?: string;
  title?: string;
  units?: string;
  frequency?: string;
  seasonal_adjustment?: string;
  last_updated?: string;
};

type FredObservation = { date?: string; value?: string };
type FredRaw = Array<{ series: FredSeries; observations: FredObservation[] }>;

export function createFredProvider(options: ProviderFactoryOptions = {}): MarketDataProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const selectedSeries = (request: Parameters<MarketDataProvider["fetchData"]>[0]) =>
    request.marketDefinition.officialClassificationMappings.filter(
      (item) => item.providerId === "fred" && item.kind === "fredSeries",
    );
  return {
    providerId: "fred",
    providerName: "Federal Reserve Economic Data",
    providerType: "macroeconomic",
    isConfigured: () => readMarketProviderConfiguration().fred.configured,
    supports: (request) => selectedSeries(request).length > 0,
    validateConfiguration: () => providerConfigurationStatus("fred"),
    fetchMetadata: async () => ({}),
    fetchData: async (request) => {
      const key = readMarketProviderConfiguration().fred.key;
      if (!key) return [];
      const output: FredRaw = [];
      for (const mapping of selectedSeries(request)) {
        const common = `api_key=${encodeURIComponent(key)}&file_type=json&series_id=${encodeURIComponent(mapping.code)}`;
        const [metadata, observations] = await Promise.all([
          fetchOfficialJson<{ seriess?: FredSeries[] }>(
            `https://api.stlouisfed.org/fred/series?${common}`,
            {},
            fetchImpl,
          ),
          fetchOfficialJson<{ observations?: FredObservation[] }>(
            `https://api.stlouisfed.org/fred/series/observations?${common}&observation_start=${request.scope.startYear}-01-01&observation_end=${request.scope.endYear}-12-31&sort_order=asc`,
            {},
            fetchImpl,
          ),
        ]);
        output.push({
          series: metadata.seriess?.[0] ?? { id: mapping.code, title: mapping.officialLabel },
          observations: observations.observations ?? [],
        });
      }
      return output;
    },
    normalizeResponse: (raw, request, retrievedAt) => {
      if (!Array.isArray(raw)) return [];
      const output: MarketEvidence[] = [];
      for (const group of raw as FredRaw) {
        const seriesId = group.series.id ?? "unknown";
        const mapping = selectedSeries(request).find((item) => item.code === seriesId);
        for (const observation of group.observations) {
          const value = numeric(observation.value);
          if (value === null || !observation.date) continue;
          output.push({
            evidenceId: evidenceId("fred", seriesId, observation.date, request.scope.geography),
            providerId: "fred",
            dataset: "FRED Series",
            seriesOrTableId: seriesId,
            sourceTitle: group.series.title ?? mapping?.officialLabel ?? seriesId,
            officialSourceUrl: `https://fred.stlouisfed.org/series/${encodeURIComponent(seriesId)}`,
            retrievedAt,
            publicationDate: group.series.last_updated ?? null,
            observationPeriod: observation.date,
            geography: request.scope.geography,
            industryCode: null,
            marketScope: mapping?.includedScope ?? "Macroeconomic context",
            metricLabel: group.series.title ?? mapping?.officialLabel ?? seriesId,
            value,
            unit: group.series.units ?? "Index or rate as reported",
            currency: null,
            frequency: /month/i.test(group.series.frequency ?? "") ? "monthly" : "annual",
            seasonalAdjustment: group.series.seasonal_adjustment ?? null,
            isReported: true,
            isCalculated: false,
            isProxy: true,
            isForecast: false,
            calculationMethod: null,
            confidence: mapping?.confidence ?? "medium",
            notes: [mapping?.reason ?? "Official macroeconomic indicator"],
          });
        }
      }
      return output;
    },
    buildSourceReference: (evidence) => publicReference("Federal Reserve Economic Data", evidence),
  };
}
