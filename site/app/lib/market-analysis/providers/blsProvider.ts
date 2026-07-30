import { fetchOfficialJson } from "../security";
import type { MarketDataProvider, MarketEvidence } from "../types";
import type { ProviderFactoryOptions } from "./providerTypes";
import { evidenceId, numeric, publicReference } from "./shared";

type BlsRaw = {
  status?: string;
  message?: string[];
  Results?: {
    series?: Array<{
      seriesID?: string;
      data?: Array<{
        year?: string;
        period?: string;
        periodName?: string;
        value?: string;
        footnotes?: Array<{ text?: string }>;
      }>;
    }>;
  };
};

export function createBlsProvider(options: ProviderFactoryOptions = {}): MarketDataProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const mappings = (request: Parameters<MarketDataProvider["fetchData"]>[0]) =>
    request.marketDefinition.officialClassificationMappings.filter(
      (item) => item.providerId === "bls" && item.kind === "blsSeries",
    );
  return {
    providerId: "bls",
    providerName: "U.S. Bureau of Labor Statistics",
    providerType: "labor",
    isConfigured: () => true,
    supports: (request) => mappings(request).length > 0,
    validateConfiguration: () => "configured",
    fetchMetadata: async () => ({}),
    fetchData: async (request) => fetchOfficialJson<BlsRaw>(
      "https://api.bls.gov/publicAPI/v2/timeseries/data/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesid: mappings(request).map((item) => item.code).slice(0, 25),
          startyear: String(Math.max(request.scope.startYear, request.scope.endYear - 9)),
          endyear: String(request.scope.endYear),
        }),
      },
      fetchImpl,
    ),
    normalizeResponse: (raw, request, retrievedAt) => {
      const payload = raw as BlsRaw;
      if (payload.status !== "REQUEST_SUCCEEDED") return [];
      const output: MarketEvidence[] = [];
      for (const series of payload.Results?.series ?? []) {
        const mapping = mappings(request).find((item) => item.code === series.seriesID);
        for (const row of series.data ?? []) {
          const value = numeric(row.value);
          if (!row.year || !row.period || value === null) continue;
          const period = row.period === "M13" ? row.year : `${row.year}-${row.period.slice(1).padStart(2, "0")}`;
          output.push({
            evidenceId: evidenceId("bls", series.seriesID ?? "unknown", period, request.scope.geography),
            providerId: "bls",
            dataset: "BLS Public Data API",
            seriesOrTableId: series.seriesID ?? "Unknown series",
            sourceTitle: mapping?.officialLabel ?? series.seriesID ?? "BLS series",
            officialSourceUrl: "https://www.bls.gov/developers/",
            retrievedAt,
            publicationDate: null,
            observationPeriod: period,
            geography: request.scope.geography,
            industryCode: null,
            marketScope: mapping?.includedScope ?? "Labor-market indicator",
            metricLabel: mapping?.officialLabel ?? series.seriesID ?? "BLS indicator",
            value,
            unit: "Series-specific unit; confirm in BLS metadata",
            currency: null,
            frequency: row.period === "M13" ? "annual" : "monthly",
            seasonalAdjustment: null,
            isReported: true,
            isCalculated: false,
            isProxy: true,
            isForecast: false,
            calculationMethod: null,
            confidence: mapping?.confidence ?? "low",
            notes: [
              mapping?.reason ?? "BLS labor or price indicator",
              ...(row.footnotes ?? []).flatMap((footnote) => footnote.text ? [footnote.text] : []),
            ],
          });
        }
      }
      return output;
    },
    buildSourceReference: (evidence) => publicReference("U.S. Bureau of Labor Statistics", evidence),
  };
}
