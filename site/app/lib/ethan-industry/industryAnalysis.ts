import { runMarketAnalysis } from "../market-analysis/analysis/marketEngine";
import type { IndustryMetric, MarketReport } from "../market-analysis/types";
import type { FinancialPeriod } from "../research-types";
import {
  buildCompanyIndustryProfile,
  buildEthanMarketDefinition,
  buildEthanMarketScope,
} from "./companyIndustryProfile";
import type {
  BuildEthanIndustryAnalysisInput,
  CompanyIndustryComparison,
  EthanCompanyMetric,
  EthanIndustryAnalysis,
  EthanIndustryCoverage,
} from "./types";

function finite(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function annualCagr(first: EthanCompanyMetric, last: EthanCompanyMetric) {
  const firstYear = Number(first.period.slice(0, 4));
  const lastYear = Number(last.period.slice(0, 4));
  const years = lastYear - firstYear;
  if (!finite(first.value) || !finite(last.value) || first.value <= 0 || last.value < 0 || years <= 0) return null;
  return ((last.value / first.value) ** (1 / years) - 1) * 100;
}

function metricKey(period: FinancialPeriod, key: keyof FinancialPeriod["metricKeys"]) {
  return period.metricKeys[key] ?? null;
}

function companyMetrics(periods: FinancialPeriod[]): EthanCompanyMetric[] {
  const output: EthanCompanyMetric[] = [];
  for (const period of periods) {
    const rows: Array<{
      metricId: string;
      label: string;
      value: number | null;
      unit: string;
      canonicalKey: string | null;
      sourceType: "reported" | "derived";
    }> = [
      { metricId: "revenue", label: "Company-reported revenue", value: period.revenue, unit: "USD", canonicalKey: metricKey(period, "revenue"), sourceType: "reported" },
      { metricId: "cash-capex", label: "Cash capital expenditure", value: period.cashCapex, unit: "USD", canonicalKey: metricKey(period, "cashCapex"), sourceType: "reported" },
      { metricId: "gross-margin", label: "Gross margin", value: period.grossMargin, unit: "%", canonicalKey: metricKey(period, "grossMargin"), sourceType: "derived" },
      { metricId: "operating-margin", label: "Operating margin", value: period.operatingMargin, unit: "%", canonicalKey: metricKey(period, "operatingMargin"), sourceType: "derived" },
      { metricId: "free-cash-flow", label: "Free cash flow", value: period.freeCashFlowProxy, unit: "USD", canonicalKey: metricKey(period, "freeCashFlowProxy"), sourceType: "derived" },
    ];
    for (const row of rows) {
      if (!finite(row.value)) continue;
      output.push({
        metricId: row.metricId,
        label: row.label,
        value: row.value,
        unit: row.unit,
        period: period.periodEnd,
        canonicalKey: row.canonicalKey,
        sourceType: row.sourceType,
      });
    }
  }
  return output;
}

function companyCagr(metrics: EthanCompanyMetric[], metricId: string) {
  const rows = metrics
    .filter((item) => item.metricId === metricId)
    .sort((left, right) => left.period.localeCompare(right.period));
  if (rows.length < 2) return null;
  const value = annualCagr(rows[0], rows.at(-1)!);
  if (value === null) return null;
  return {
    metricId: `${metricId}-cagr`,
    label: `${rows[0].label} CAGR`,
    value,
    unit: "%",
    period: `${rows[0].period}–${rows.at(-1)!.period}`,
    canonicalKey: rows.at(-1)!.canonicalKey,
    sourceType: "derived" as const,
  };
}

function industryCagr(metrics: IndustryMetric[], expression: RegExp) {
  return metrics
    .filter((metric) => expression.test(metric.canonicalLabel) && /CAGR$/i.test(metric.canonicalLabel))
    .sort((left, right) => right.period.localeCompare(left.period))[0] ?? null;
}

function comparison(
  company: EthanCompanyMetric | null,
  industry: IndustryMetric | null,
  type: "revenue" | "capex" | "margin",
): CompanyIndustryComparison | null {
  if (!company || !industry) return null;
  const common = {
    companyMetricId: company.metricId,
    industryMetricId: industry.metricId,
    companyPeriod: company.period,
    industryPeriod: industry.period,
    companyUnit: company.unit,
    industryUnit: industry.unit,
    geography: industry.geography,
    classification: industry.industryScope,
    companyValue: company.value,
    industryValue: typeof industry.value === "number" ? industry.value : null,
    industryEvidenceIds: [...industry.evidenceIds],
  };
  if (type === "margin") {
    return {
      ...common,
      normalizationMethod: "None; company margin and industry activity index retain incompatible economic definitions and units.",
      compatibilityStatus: "Not comparable",
      interpretationLimitations: [
        "A company gross margin cannot be directly compared with an industry production index.",
        "No combined chart is eligible for this pair.",
      ],
      chartEligible: false,
    };
  }
  if (company.unit !== "%" || industry.unit !== "%" || typeof industry.value !== "number") {
    return {
      ...common,
      normalizationMethod: "No valid common growth-rate transformation was available.",
      compatibilityStatus: "Not comparable",
      interpretationLimitations: ["Raw company dollars and industry levels are not presented as directly comparable."],
      chartEligible: false,
    };
  }
  return {
    ...common,
    normalizationMethod: "Each series is converted independently to compound annual growth over its disclosed available endpoints; no level comparison is made.",
    compatibilityStatus: "Proxy comparison",
    interpretationLimitations: [
      "Periods can differ because NVIDIA has a January fiscal-year end while public indicators use calendar observations.",
      "The official indicator is a sector or investment proxy, not NVIDIA revenue, demand, market share, or proof of causation.",
    ],
    chartEligible: true,
  };
}

function buildComparisons(
  metrics: EthanCompanyMetric[],
  industryMetrics: IndustryMetric[],
): CompanyIndustryComparison[] {
  const revenue = companyCagr(metrics, "revenue");
  const capex = companyCagr(metrics, "cash-capex");
  const grossMargin = metrics
    .filter((item) => item.metricId === "gross-margin")
    .sort((left, right) => right.period.localeCompare(left.period))[0] ?? null;
  const production = industryCagr(industryMetrics, /Industrial Production: Semiconductor/i);
  const investment = industryCagr(industryMetrics, /Private fixed investment in information processing/i);
  return [
    comparison(revenue, production, "revenue"),
    comparison(capex, investment, "capex"),
    comparison(grossMargin, production, "margin"),
  ].filter((item): item is CompanyIndustryComparison => item !== null);
}

function disabledCoverage(): EthanIndustryCoverage {
  return {
    status: "disabled",
    providerPlan: null,
    providerResults: [],
    providersUsed: [],
    providersUnavailable: [],
    limitations: ["Industry and Market Analysis was not selected for this report."],
  };
}

function unavailableCoverage(message: string): EthanIndustryCoverage {
  return {
    status: "unavailable",
    providerPlan: null,
    providerResults: [],
    providersUsed: [],
    providersUnavailable: [],
    limitations: [message],
  };
}

function coverageFrom(report: MarketReport): EthanIndustryCoverage {
  const unavailable = report.providerResults.filter((result) =>
    result.status === "unavailable" ||
    result.status === "missingConfiguration" ||
    result.status === "incomplete",
  );
  return {
    status: unavailable.length ? "partial" : "available",
    providerPlan: report.providerPlan,
    providerResults: report.providerResults,
    providersUsed: report.providerResults
      .filter((result) => result.status === "used")
      .map((result) => result.providerName),
    providersUnavailable: unavailable.map((result) => result.providerName),
    limitations: [
      ...report.dataCoverage.metricsUnavailable,
      ...report.marketDefinition.definitionLimitations,
    ],
  };
}

/**
 * Builds a server-side official-data overlay for Ethan. It never sends a
 * browser request and never calls the Mason routes. SEC inputs remain owned by
 * the existing Ethan report pipeline, so the market run intentionally omits a
 * ticker and does not duplicate SEC submissions or Company Facts retrieval.
 */
export async function buildEthanIndustryAnalysis(
  input: BuildEthanIndustryAnalysisInput,
): Promise<EthanIndustryAnalysis> {
  const profile = buildCompanyIndustryProfile(input);
  const metrics = companyMetrics(input.periods);
  if (!input.includeIndustryMarketAnalysis) {
    return {
      included: false,
      profile,
      scope: null,
      marketDefinition: null,
      marketReport: null,
      companyMetrics: metrics,
      industryMetrics: [],
      comparisons: [],
      coverage: disabledCoverage(),
    };
  }
  const scope = buildEthanMarketScope({
    profile,
    selection: input.selection,
    periods: input.periods,
    locale: input.locale,
    now: input.now,
  });
  if (!scope) {
    return {
      included: true,
      profile,
      scope: null,
      marketDefinition: null,
      marketReport: null,
      companyMetrics: metrics,
      industryMetrics: [],
      comparisons: [],
      coverage: {
        status: "mapping-review",
        providerPlan: null,
        providerResults: [],
        providersUsed: [],
        providersUnavailable: [],
        limitations: [...profile.classificationLimitations],
      },
    };
  }
  const marketDefinition = buildEthanMarketDefinition(profile, scope);
  if (!marketDefinition) {
    return {
      included: true,
      profile,
      scope,
      marketDefinition: null,
      marketReport: null,
      companyMetrics: metrics,
      industryMetrics: [],
      comparisons: [],
      coverage: unavailableCoverage("No reviewed official market definition was available for this company."),
    };
  }
  try {
    const marketReport = await runMarketAnalysis(scope, marketDefinition, { now: input.now });
    return {
      included: true,
      profile,
      scope,
      marketDefinition,
      marketReport,
      companyMetrics: metrics,
      industryMetrics: marketReport.metrics,
      comparisons: buildComparisons(metrics, marketReport.metrics),
      coverage: coverageFrom(marketReport),
    };
  } catch {
    // Provider failures are intentionally non-fatal: Ethan's validated company
    // report remains available even when every optional official-data provider
    // is unavailable or a credential is absent.
    return {
      included: true,
      profile,
      scope,
      marketDefinition,
      marketReport: null,
      companyMetrics: metrics,
      industryMetrics: [],
      comparisons: [],
      coverage: unavailableCoverage(
        "Industry and market data is currently unavailable; the company research report remains available without this optional overlay.",
      ),
    };
  }
}
