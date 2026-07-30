import { secClient, type SecCompanyRecord } from "../../sec-client";
import type { MarketDataProvider, MarketEvidence } from "../types";
import { evidenceId, numeric, publicReference } from "./shared";

type SecRaw = Array<{
  company: SecCompanyRecord;
  submissions: Record<string, unknown>;
  facts: {
    facts?: Record<string, Record<string, {
      label?: string;
      units?: Record<string, Array<{
        val?: number;
        end?: string;
        filed?: string;
        fy?: number;
        fp?: string;
        form?: string;
        accn?: string;
      }>>;
    }>>;
  };
}>;

const REVENUE_CONCEPTS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
];

export function createSecProvider(): MarketDataProvider {
  return {
    providerId: "sec",
    providerName: "SEC EDGAR",
    providerType: "companyDisclosure",
    isConfigured: () => true,
    supports: (request) => request.scope.tickers.length > 0,
    validateConfiguration: () => "configured",
    fetchMetadata: async () => ({}),
    fetchData: async (request) => {
      const output: SecRaw = [];
      for (const ticker of request.scope.tickers) {
        const company = await secClient.resolveCompany(ticker);
        const [submissions, facts] = await Promise.all([
          secClient.getSubmissions<Record<string, unknown>>(company.cik),
          secClient.getCompanyFacts<SecRaw[number]["facts"]>(company.cik),
        ]);
        output.push({ company, submissions, facts });
      }
      return output;
    },
    normalizeResponse: (raw, request, retrievedAt) => {
      if (!Array.isArray(raw)) return [];
      const output: MarketEvidence[] = [];
      for (const item of raw as SecRaw) {
        const taxonomies = item.facts.facts ?? {};
        const concepts = { ...(taxonomies["us-gaap"] ?? {}), ...(taxonomies.ifrs ?? {}) };
        const conceptName = REVENUE_CONCEPTS.find((name) => concepts[name]);
        const concept = conceptName ? concepts[conceptName] : null;
        if (!concept) continue;
        const units = concept.units ?? {};
        const candidates = Object.entries(units).flatMap(([unit, facts]) =>
          facts.map((fact) => ({ ...fact, unit })));
        const annual = candidates
          .filter((fact) =>
            fact.val !== undefined &&
            fact.end &&
            (fact.form === "10-K" || fact.form === "20-F") &&
            (fact.fp === "FY" || fact.fy !== undefined),
          )
          .sort((left, right) =>
            String(right.end).localeCompare(String(left.end)) ||
            String(right.filed).localeCompare(String(left.filed)),
          )[0];
        const value = numeric(annual?.val);
        if (!annual?.end || value === null) continue;
        output.push({
          evidenceId: evidenceId("sec", `${item.company.ticker}-${conceptName}`, annual.end, "Company"),
          providerId: "sec",
          dataset: "SEC Company Facts",
          seriesOrTableId: `${conceptName} · ${annual.accn ?? "accession unavailable"}`,
          sourceTitle: `${item.company.title} reported revenue`,
          officialSourceUrl: `https://www.sec.gov/edgar/browse/?CIK=${item.company.cikNumber}`,
          retrievedAt,
          publicationDate: annual.filed ?? null,
          observationPeriod: annual.end,
          geography: "Company reported",
          industryCode: null,
          marketScope: "Public-company evidence",
          metricLabel: `${item.company.ticker} company-reported revenue`,
          value,
          unit: annual.unit,
          currency: annual.unit === "USD" ? "USD" : null,
          frequency: "annual",
          seasonalAdjustment: null,
          isReported: true,
          isCalculated: false,
          isProxy: false,
          isForecast: false,
          calculationMethod: null,
          confidence: "high",
          notes: [
            "Company-reported revenue is public-company evidence and is not treated as total industry market size.",
          ],
        });
      }
      return output;
    },
    buildSourceReference: (evidence) => publicReference("SEC EDGAR", evidence),
  };
}
