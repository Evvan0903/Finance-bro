import type {
  CoverageTierSummary,
  MetricCoverageSummary,
  MetricExtractionAudit,
  PackCoverageSummary,
} from "./types";

function covered(status: MetricExtractionAudit["status"]) {
  return status === "found" || status === "derived";
}

function summarizeTier(
  audits: MetricExtractionAudit[],
  tier: 1 | 2,
): CoverageTierSummary {
  const applicable = audits.filter((audit) => audit.tier === tier && audit.applicable);
  const found = applicable.filter((audit) => audit.status === "found").length;
  const derived = applicable.filter((audit) => audit.status === "derived").length;
  const missing = applicable.length - found - derived;
  return {
    applicable: applicable.length,
    found,
    derived,
    missing,
    coverage: applicable.length ? (found + derived) / applicable.length : 0,
  };
}

function summarizePack(audits: MetricExtractionAudit[]): PackCoverageSummary {
  const applicable = audits.filter((audit) => audit.tier === 3 && audit.applicable);
  const found = applicable.filter((audit) => covered(audit.status)).length;
  return {
    applicable: applicable.length,
    found,
    missing: applicable.length - found,
    coverage: applicable.length ? found / applicable.length : 0,
  };
}

export function scoreMetricCoverage(
  audits: MetricExtractionAudit[],
): MetricCoverageSummary {
  const tier1 = summarizeTier(audits, 1);
  const tier2 = summarizeTier(audits, 2);
  const packSpecific = summarizePack(audits);
  const weighted = [
    { value: tier1.coverage, weight: 0.7, active: tier1.applicable > 0 },
    { value: tier2.coverage, weight: 0.2, active: tier2.applicable > 0 },
    { value: packSpecific.coverage, weight: 0.1, active: packSpecific.applicable > 0 },
  ].filter((item) => item.active);
  const weight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const overallCoverage = weight
    ? weighted.reduce((sum, item) => sum + item.value * item.weight, 0) / weight
    : 0;
  const missingReasonCounts = audits
    .filter((audit) => audit.applicable && !covered(audit.status))
    .reduce<Record<string, number>>((counts, audit) => {
      counts[audit.reason] = (counts[audit.reason] ?? 0) + 1;
      return counts;
    }, {});
  return {
    tier1,
    tier2,
    packSpecific,
    overallCoverage,
    reportMode:
      tier1.coverage >= 0.8
        ? "full"
        : tier1.coverage >= 0.55
          ? "standard"
          : "limited",
    filingLevelMetricCount: audits.filter((audit) =>
      covered(audit.status) &&
      audit.searchedSources.some((source) => source.startsWith("filing-"))
    ).length,
    missingReasonCounts,
  };
}
