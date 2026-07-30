import { readMarketProviderSecrets } from "../config/marketEnv";
import { fetchOfficialJson } from "../security";
import type { MarketDataProvider, MarketEvidence } from "../types";
import type { ProviderFactoryOptions } from "./providerTypes";
import { evidenceId, numeric, publicReference } from "./shared";
import { censusGeographyTargets } from "../analysis/geographyNormalizer";

type CensusRaw = Array<{
  year: number;
  naics: string;
  geographyName: string;
  rows: string[][];
}>;

export function createCensusProvider(options: ProviderFactoryOptions = {}): MarketDataProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const naicsMappings = (request: Parameters<MarketDataProvider["fetchData"]>[0]) =>
    request.marketDefinition.officialClassificationMappings.filter(
      (item) => item.providerId === "census" && item.kind === "naics",
    );
  return {
    providerId: "census",
    providerName: "U.S. Census Bureau",
    providerType: "businessDemographic",
    isConfigured: () => true,
    supports: (request) => naicsMappings(request).length > 0,
    validateConfiguration: () => "configured",
    fetchMetadata: async () => ({}),
    fetchData: async (request) => {
      const key = readMarketProviderSecrets().censusApiKey;
      const output: CensusRaw = [];
      // County Business Patterns releases lag the analysis year. Request only
      // through the latest validated API year and show the resulting period.
      const lastApiYear = Math.min(request.scope.endYear, 2023);
      for (let year = request.scope.startYear; year <= lastApiYear; year += 1) {
        for (const mapping of naicsMappings(request)) {
          for (const geography of censusGeographyTargets(
            request.scope.geography,
            request.scope.geographyB,
          )) {
            const keyParameter = key ? `&key=${encodeURIComponent(key)}` : "";
            const rows = await fetchOfficialJson<string[][]>(
              `https://api.census.gov/data/${year}/cbp?get=NAME,NAICS2017_LABEL,ESTAB,EMP,PAYANN&for=${encodeURIComponent(geography.censusFor)}&NAICS2017=${encodeURIComponent(mapping.code)}${keyParameter}`,
              {},
              fetchImpl,
            );
            output.push({
              year,
              naics: mapping.code,
              geographyName: geography.name,
              rows,
            });
          }
        }
      }
      return output;
    },
    normalizeResponse: (raw, request, retrievedAt) => {
      if (!Array.isArray(raw)) return [];
      const output: MarketEvidence[] = [];
      for (const group of raw as CensusRaw) {
        const [headers, ...rows] = group.rows;
        if (!headers) continue;
        const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
        for (const row of rows) {
          const geography = row[indexes.NAME] ?? group.geographyName;
          for (const [field, label, unit, currency] of [
            ["ESTAB", "Establishment count", "Establishments", null],
            ["EMP", "Employment", "Employees", null],
            ["PAYANN", "Annual payroll", "Thousands of U.S. dollars", "USD"],
          ] as const) {
            const value = numeric(row[indexes[field]]);
            if (value === null) continue;
            output.push({
              evidenceId: evidenceId("census", `${group.naics}-${field}`, String(group.year), geography),
              providerId: "census",
              dataset: "County Business Patterns",
              seriesOrTableId: `${group.year} CBP · NAICS2017 ${group.naics} · ${field}`,
              sourceTitle: row[indexes.NAICS2017_LABEL] ?? "County Business Patterns",
              officialSourceUrl: `https://api.census.gov/data/${group.year}/cbp.html`,
              retrievedAt,
              publicationDate: null,
              observationPeriod: String(group.year),
              geography,
              industryCode: group.naics,
              marketScope: "Employer-establishment footprint",
              metricLabel: label,
              value,
              unit,
              currency,
              frequency: "annual",
              seasonalAdjustment: null,
              isReported: true,
              isCalculated: false,
              isProxy: false,
              isForecast: false,
              calculationMethod: null,
              confidence: "high",
              notes: [
                "An establishment is a physical business location and is not the same as a company.",
              ],
            });
          }
        }
      }
      return output;
    },
    buildSourceReference: (evidence) => publicReference("U.S. Census Bureau", evidence),
  };
}
