import type { MetricRegistrySnapshot } from "../canonical-metrics";
import {
  UNIVERSAL_COVERAGE_EXPECTATIONS,
  metricIsApplicable,
} from "./coverage-expectations";
import type {
  CoverageCompanyType,
  MetricCoverageExpectation,
  MetricExtractionAudit,
} from "./types";
import { UNIVERSAL_METRIC_DEFINITIONS } from "../metric-knowledge/universal-metric-definitions";

function selectedMetric(
  registry: MetricRegistrySnapshot,
  companyId: string,
  periodEnd: string,
  expectation: MetricCoverageExpectation,
) {
  return registry.metrics
    .filter((metric) =>
      metric.company_id === companyId &&
      metric.period_end === periodEnd &&
      metric.metric_id === expectation.metricId &&
      expectation.definitionIds.includes(metric.definition_id) &&
      metric.value !== null
    )
    .sort((first, second) => {
      if (first.status !== second.status) return first.status === "Reported" ? -1 : 1;
      return second.confidence - first.confidence;
    })[0];
}

export function buildMetricExtractionAudit(input: {
  registry: MetricRegistrySnapshot;
  companyId: string;
  periodEnd: string;
  packId: string;
  companyType: CoverageCompanyType;
  searchedConcepts?: Partial<Record<string, string[]>>;
  candidateConcepts?: Partial<Record<string, string[]>>;
  additionalAudits?: MetricExtractionAudit[];
  traceId?: string;
}) {
  const additional = new Map(
    (input.additionalAudits ?? []).map((audit) => [audit.metricId, audit]),
  );
  return UNIVERSAL_COVERAGE_EXPECTATIONS.map((expectation): MetricExtractionAudit => {
    const enriched = additional.get(expectation.metricId);
    if (enriched) return enriched;
    const applicable = metricIsApplicable({
      expectation,
      companyType: input.companyType,
      packId: input.packId,
    });
    if (!applicable) {
      return {
        metricId: expectation.metricId,
        definitionId: null,
        tier: expectation.tier,
        applicable: false,
        status: "not-applicable",
        reason: "not-applicable",
        searchedSources: [],
        searchedConcepts: [],
        candidateConcepts: [],
        traceId: input.traceId,
      };
    }
    const metric = selectedMetric(
      input.registry,
      input.companyId,
      input.periodEnd,
      expectation,
    );
    const searchedConcepts = input.searchedConcepts?.[expectation.metricId] ??
      UNIVERSAL_METRIC_DEFINITIONS
        .filter((definition) => definition.metricId === expectation.metricId)
        .flatMap((definition) =>
          definition.standardConcepts.map(
            (concept) => `${concept.taxonomy}:${concept.concept}`,
          ),
        );
    const candidateConcepts = input.candidateConcepts?.[expectation.metricId] ?? [];
    if (metric) {
      const derived = metric.status === "Derived";
      const filingEnriched =
        metric.extraction_method?.startsWith("deterministic-filing-inline-xbrl") ??
        false;
      const supersededCompanyFacts =
        metric.extraction_method?.includes("superseding-company-facts") ?? false;
      return {
        metricId: expectation.metricId,
        definitionId: metric.definition_id,
        tier: expectation.tier,
        applicable: true,
        status: derived ? "derived" : "found",
        reason: derived
          ? "derived-from-components"
          : filingEnriched
            ? "standard-concept-match"
            : "standard-concept-match",
        searchedSources: derived
          ? ["company-facts", "derived-metric-engine"]
          : filingEnriched
            ? ["company-facts", "filing-inline-xbrl"]
            : ["company-facts"],
        searchedConcepts,
        candidateConcepts,
        selectedCanonicalKey: metric.canonical_key,
        selectedSourceUrl: metric.source_url ?? undefined,
        selectedPeriod: metric.period,
        selectedUnit: metric.unit,
        selectedValue: metric.value ?? undefined,
        selectedSelectionReason: supersededCompanyFacts
          ? "A later amended filing superseded an earlier Company Facts value after period, unit, duration, definition, and consolidated-context validation."
          : undefined,
        traceId: input.traceId,
      };
    }
    return {
      metricId: expectation.metricId,
      definitionId: expectation.definitionIds[0] ?? null,
      tier: expectation.tier,
      applicable: true,
      status: candidateConcepts.length ? "candidate-only" : "missing",
      reason: expectation.derivationInputMetricIds?.length
        ? "calculation-input-missing"
        : candidateConcepts.length
          ? "custom-tag-not-mapped"
          : "standard-tag-not-mapped",
      searchedSources: expectation.derivationInputMetricIds?.length
        ? ["company-facts", "derived-metric-engine"]
        : ["company-facts"],
      searchedConcepts,
      candidateConcepts,
      traceId: input.traceId,
    };
  });
}
