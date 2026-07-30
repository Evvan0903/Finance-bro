import { calculateIndustryMetrics } from "./calculationEngine";
import { buildProviderPlan } from "./researchPlan";
import { createProviderRegistry } from "../providers/providerRegistry";
import { executeProvider } from "../providers/shared";
import { buildComparisonScorecard, buildReportSections } from "../reports/reportBuilders";
import { buildReportReferences, validateReferences } from "../reports/reportReferences";
import type {
  DataCoverage,
  MarketDataProvider,
  MarketDefinition,
  MarketReport,
  MarketScopeInput,
  ProviderId,
  ProviderPlan,
  ProviderResult,
} from "../types";

export type MarketEngineOptions = {
  providers?: Map<ProviderId, MarketDataProvider>;
  now?: () => Date;
  researchId?: string;
};

function dataCoverage(
  definition: MarketDefinition,
  plan: ProviderPlan,
  results: ProviderResult[],
  metricCount: number,
  proxyCount: number,
  generatedAt: string,
): DataCoverage {
  const selected = plan.items.filter((item) => item.selected);
  const used = results.filter((result) => result.status === "used");
  const unavailable = results.filter((result) =>
    result.status === "unavailable" ||
    result.status === "missingConfiguration" ||
    result.status === "incomplete",
  );
  const status: DataCoverage["status"] =
    metricCount === 0
      ? "Insufficient structured data"
      : unavailable.length === 0 && proxyCount === 0
        ? "Complete for selected public-data scope"
        : proxyCount >= Math.max(1, Math.ceil(metricCount * 0.6))
          ? "Limited proxy-based coverage"
          : "Partial public-data coverage";
  const evidence = results.flatMap((result) => result.evidence);
  return {
    status,
    providersConfigured: selected
      .filter((item) => item.configurationStatus === "configured")
      .map((item) => item.providerId),
    providersUsed: used.map((item) => item.providerId),
    providersUnavailable: unavailable.map((item) => item.providerId),
    providersNotRelevant: results.filter((result) => result.status === "notRelevant").map((item) => item.providerId),
    datasetsUsed: [...new Set(evidence.map((item) => item.dataset))],
    industryMappings: definition.officialClassificationMappings.map((item) => `${item.kind}: ${item.code}`),
    geographiesCovered: [...new Set(evidence.map((item) => item.geography))],
    timePeriodsCovered: [...new Set(evidence.map((item) => item.observationPeriod))].sort(),
    metricsWithCompleteEvidence: metricCount - proxyCount,
    metricsUsingProxies: proxyCount,
    metricsUnavailable: unavailable.flatMap((item) => item.limitations),
    dataRetrievedAt: used.map((item) => item.retrievedAt).filter(Boolean).sort().at(-1) ?? null,
    reportGeneratedAt: generatedAt,
  };
}

export async function runMarketAnalysis(
  scope: MarketScopeInput,
  marketDefinition: MarketDefinition,
  options: MarketEngineOptions = {},
): Promise<MarketReport> {
  const now = options.now ?? (() => new Date());
  const generatedAt = now().toISOString();
  const providerPlan = buildProviderPlan(scope, marketDefinition, generatedAt);
  const request = { scope, marketDefinition, plan: providerPlan };
  const registry = options.providers ?? createProviderRegistry();
  const providerResults: ProviderResult[] = [];
  for (const item of providerPlan.items) {
    const provider = registry.get(item.providerId);
    if (!provider) continue;
    providerResults.push(await executeProvider(provider, request, now));
  }
  const evidence = providerResults.flatMap((result) => result.evidence);
  const metrics = calculateIndustryMetrics(evidence);
  const coverage = dataCoverage(
    marketDefinition,
    providerPlan,
    providerResults,
    metrics.length,
    metrics.filter((metric) => metric.isProxy).length,
    generatedAt,
  );
  if (coverage.status === "Insufficient structured data") {
    throw new Error("Current official data unavailable");
  }
  const references = buildReportReferences(providerResults);
  const referenceFindings = validateReferences(references);
  const sections = buildReportSections(request, metrics, coverage);
  const uncited = metrics.filter((metric) => metric.evidenceIds.length === 0);
  const qaFindings = [
    ...referenceFindings,
    ...(uncited.length ? [`${uncited.length} metrics lack evidence IDs`] : []),
    ...(sections.at(-1)?.title.match(/References|参考资料/) ? [] : ["References are not the final section"]),
  ];
  return {
    researchId: options.researchId ?? crypto.randomUUID(),
    mode: scope.mode,
    locale: scope.locale,
    generatedAt,
    title: `${marketDefinition.marketName} — Official Data Market Analysis`,
    scope,
    marketDefinition,
    providerPlan,
    providerResults,
    evidence,
    metrics,
    comparisonScorecard: buildComparisonScorecard(request, evidence),
    sections,
    references,
    dataCoverage: coverage,
    disclosures: [
      "Mason uses official public datasets and user-confirmed industry mappings to analyze market conditions.",
      "Public-data indicators may not correspond exactly to the commercial definition of a market.",
      "This report does not provide investment advice, proprietary market share, or guaranteed forecasts.",
    ],
    methodology: [
      "Provider selection follows the confirmed market definition, geography, analysis mode, focus areas, and configured server credentials.",
      "Every numerical metric links to MarketEvidence and reported facts remain separate from deterministic calculations and proxy indicators.",
      "Industry gross output and value added are economic-footprint measures and are not automatically labeled commercial market size.",
    ],
    qa: {
      status: qaFindings.length ? "requiresReview" : "passed",
      findings: qaFindings,
    },
  };
}
