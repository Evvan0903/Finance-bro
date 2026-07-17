import {
  calculateFromCanonicalInputs,
  canonicalMetricKey,
  validateCanonicalMetric,
} from "./canonical-metrics";
import type { CanonicalMetricObject } from "./canonical-metrics";
import type { FinancialPeriod, ResearchReport, Scenario } from "./research-types";

export type ConsistencyIssue = {
  code:
    | "DUPLICATE_KEY"
    | "CONFLICTING_VALUE"
    | "INVALID_CANONICAL_OBJECT"
    | "CACHE_VERSION_MISMATCH"
    | "MISSING_INPUT"
    | "FORMULA_MISMATCH"
    | "FORMULA_NOT_REPRODUCIBLE"
    | "ROUNDED_CALCULATION_INPUT"
    | "PERIOD_MISMATCH"
    | "UNIT_MISMATCH"
    | "CURRENCY_MISMATCH"
    | "STATUS_DEFINITION_MISMATCH"
    | "SOURCE_LINEAGE_MISMATCH"
    | "SURFACE_REFERENCE_MISSING"
    | "SURFACE_VALUE_MISMATCH"
    | "SURFACE_MODEL_MISMATCH"
    | "STALE_SOURCE";
  scope: string;
  canonicalKey: string | null;
  message: string;
  expected?: unknown;
  actual?: unknown;
};

export type MetricConsistencyAudit = {
  schemaVersion: "1.0";
  passed: boolean;
  dataVersion: string;
  totalCanonicalMetrics: number;
  totalSurfaceReferences: number;
  checks: {
    registry: boolean;
    formulas: boolean;
    lineage: boolean;
    cache: boolean;
    json: boolean;
    tables: boolean;
    charts: boolean;
    narrative: boolean;
    scenarios: boolean;
    valuation: boolean;
    webPdf: boolean;
  };
  issues: ConsistencyIssue[];
};

export type ReproducibilityMismatch = {
  scope: "canonical-object" | "scenario" | "valuation" | "citation" | "status";
  key: string;
  kind:
    | "mismatched-object"
    | "missing-object"
    | "changed-definition"
    | "changed-formula"
    | "changed-source"
    | "changed-output";
  first: unknown;
  second: unknown;
};

export type ReproducibilityComparison = {
  schemaVersion: "1.0";
  passed: boolean;
  matchedObjects: string[];
  mismatchedObjects: ReproducibilityMismatch[];
  missingObjects: ReproducibilityMismatch[];
  changedDefinitions: ReproducibilityMismatch[];
  changedFormulas: ReproducibilityMismatch[];
  changedSources: ReproducibilityMismatch[];
  changedOutputs: ReproducibilityMismatch[];
};

const PERIOD_VALUE_FIELDS: Array<keyof FinancialPeriod> = [
  "revenue",
  "grossProfit",
  "netIncome",
  "operatingCashFlow",
  "investingCashFlow",
  "cashCapex",
  "freeCashFlowProxy",
  "assets",
  "liabilities",
  "equity",
  "cash",
  "inventory",
  "currentAssets",
  "currentLiabilities",
  "totalDebt",
  "netDebt",
  "revenueGrowth",
  "revenueCagr",
  "netMargin",
  "netMarginChange",
  "grossMargin",
  "operatingCashFlowMargin",
  "freeCashFlowMargin",
  "cashConversion",
  "currentRatio",
  "liabilitiesAssets",
];

const SCENARIO_VALUE_FIELDS: Array<keyof Scenario> = [
  "revenueGrowth",
  "netMargin",
  "operatingCashFlowMargin",
  "capexFactor",
  "projectedRevenue",
  "projectedNetIncome",
  "projectedFreeCashFlow",
  "enterpriseValueMultiple",
  "valuationStartingPoint",
  "valuationMetric",
  "modelImpliedEnterpriseValue",
];

function pushIssue(
  issues: ConsistencyIssue[],
  issue: ConsistencyIssue,
) {
  issues.push(issue);
}

function exactValueCheck(input: {
  issues: ConsistencyIssue[];
  metrics: Map<string, CanonicalMetricObject>;
  scope: string;
  canonicalKey: string;
  actual: number | null;
}) {
  const metric = input.metrics.get(input.canonicalKey);
  if (!metric) {
    pushIssue(input.issues, {
      code: "SURFACE_REFERENCE_MISSING",
      scope: input.scope,
      canonicalKey: input.canonicalKey,
      message: "Surface references a canonical key that is absent from the Registry",
    });
    return;
  }
  if (!Object.is(metric.value, input.actual)) {
    pushIssue(input.issues, {
      code: "SURFACE_VALUE_MISMATCH",
      scope: input.scope,
      canonicalKey: input.canonicalKey,
      message: "Surface raw value does not exactly match the canonical value",
      expected: metric.value,
      actual: input.actual,
    });
  }
}

function referenceArray(report: ResearchReport) {
  return [
    ...(report.driverExposure ?? []).flatMap((item) => item.metricReferences),
    ...(report.thesis ?? []).flatMap((item) => item.metricReferences),
    ...(report.investmentDebates ?? []).flatMap((item) => item.metricReferences),
    ...(report.risks ?? []).flatMap((item) => item.metricReferences),
    ...(report.filingWatchlist ?? []).flatMap((item) => item.metricReferences),
    ...Object.values(report.catalysts ?? {}).flat().flatMap((item) => item.metricReferences),
    ...(report.sectorKpis ?? []).map((item) => item.canonicalKey),
    ...(report.peerComparison ?? []).flatMap((item) => Object.values(item.metricReferences)),
    ...(report.scenarios ?? []).flatMap((item) => Object.values(item.metricReferences)),
  ].filter(Boolean);
}

function auditRegistry(
  report: ResearchReport,
  metrics: Map<string, CanonicalMetricObject>,
  issues: ConsistencyIssue[],
) {
  const formulaByDefinition = new Map<string, string>();
  const statusByKey = new Map<string, string>();
  for (const metric of report.metricRegistry.metrics) {
    if (metrics.has(metric.canonical_key)) {
      const existing = metrics.get(metric.canonical_key)!;
      pushIssue(issues, {
        code:
          existing.value !== metric.value ||
          existing.raw_value !== metric.raw_value ||
          existing.formula !== metric.formula ||
          existing.source_document !== metric.source_document
            ? "CONFLICTING_VALUE"
            : "DUPLICATE_KEY",
        scope: "metric-registry",
        canonicalKey: metric.canonical_key,
        message:
          existing.value !== metric.value
            ? "The same canonical key contains different raw or canonical values"
            : "The Registry contains the same canonical key more than once",
        expected: existing,
        actual: metric,
      });
      continue;
    }
    metrics.set(metric.canonical_key, metric);
    try {
      validateCanonicalMetric(metric);
    } catch (error) {
      pushIssue(issues, {
        code: "INVALID_CANONICAL_OBJECT",
        scope: "metric-registry",
        canonicalKey: metric.canonical_key,
        message: error instanceof Error ? error.message : "Invalid canonical object",
      });
    }
    if (
      metric.data_version !== report.metricRegistry.data_version ||
      metric.calculation_version !== report.metricRegistry.calculation_version ||
      metric.canonical_key !== canonicalMetricKey(metric)
    ) {
      pushIssue(issues, {
        code: "CACHE_VERSION_MISMATCH",
        scope: "metric-registry",
        canonicalKey: metric.canonical_key,
        message: "Metric cache identity or version does not match the Registry snapshot",
      });
    }
    if (
      metric.source_date &&
      Date.parse(metric.source_date) > Date.parse(report.cutoff)
    ) {
      pushIssue(issues, {
        code: "STALE_SOURCE",
        scope: "metric-registry",
        canonicalKey: metric.canonical_key,
        message: "Metric source date is later than the report cutoff",
        expected: report.cutoff,
        actual: metric.source_date,
      });
    }
    if (
      metric.status === "Reported" &&
      (!metric.source_document || !metric.source_date)
    ) {
      pushIssue(issues, {
        code: "SOURCE_LINEAGE_MISMATCH",
        scope: "metric-registry",
        canonicalKey: metric.canonical_key,
        message: "Reported metric does not retain a source document and source date",
      });
    }
    const statusKey = [
      metric.company_id,
      metric.metric_id,
      metric.period,
      metric.definition_id,
      metric.currency,
      metric.unit,
    ].join("|");
    const priorStatus = statusByKey.get(statusKey);
    if (priorStatus && priorStatus !== metric.status) {
      pushIssue(issues, {
        code: "STATUS_DEFINITION_MISMATCH",
        scope: "metric-registry",
        canonicalKey: metric.canonical_key,
        message: "The same metric definition is published with conflicting statuses",
        expected: priorStatus,
        actual: metric.status,
      });
    }
    statusByKey.set(statusKey, metric.status);

    if (metric.status !== "Derived") continue;
    const formulaKey = `${metric.company_id}|${metric.metric_id}|${metric.definition_id}`;
    const formulaSignature = `${metric.formula_id}|${metric.formula}`;
    const priorFormula = formulaByDefinition.get(formulaKey);
    if (priorFormula && priorFormula !== formulaSignature) {
      pushIssue(issues, {
        code: "FORMULA_MISMATCH",
        scope: "metric-registry",
        canonicalKey: metric.canonical_key,
        message: "The same definition ID uses different formulas",
        expected: priorFormula,
        actual: formulaSignature,
      });
    }
    formulaByDefinition.set(formulaKey, formulaSignature);

    const inputs = metric.input_metric_keys
      .map((key) => metrics.get(key) ?? report.metricRegistry.metrics.find((item) => item.canonical_key === key))
      .filter((item): item is CanonicalMetricObject => item !== undefined);
    if (inputs.length !== metric.input_metric_keys.length) {
      pushIssue(issues, {
        code: "MISSING_INPUT",
        scope: "metric-registry",
        canonicalKey: metric.canonical_key,
        message: "Derived metric is missing one or more canonical input objects",
      });
      continue;
    }
    if (
      inputs.some((input) =>
        /rounded|presentation|display/i.test(input.extraction_method ?? "")
      )
    ) {
      pushIssue(issues, {
        code: "ROUNDED_CALCULATION_INPUT",
        scope: "metric-registry",
        canonicalKey: metric.canonical_key,
        message: "Derived metric uses a rounded presentation value as an input",
      });
    }
    const periodKinds = new Set(
      inputs.map((input) =>
        /^Q|quarter/i.test(input.period) ? "quarterly" : "annual"
      ),
    );
    if (periodKinds.size > 1) {
      pushIssue(issues, {
        code: "PERIOD_MISMATCH",
        scope: "metric-registry",
        canonicalKey: metric.canonical_key,
        message: "Derived metric mixes annual and quarterly canonical inputs",
      });
    }
    if (metric.formula_id === "analyst-assumption") continue;
    try {
      const reproduced = calculateFromCanonicalInputs(metric.formula_id!, inputs);
      if (!Object.is(reproduced, metric.value)) {
        pushIssue(issues, {
          code: "FORMULA_NOT_REPRODUCIBLE",
          scope: "metric-registry",
          canonicalKey: metric.canonical_key,
          message: "Canonical output cannot be reproduced exactly from full-precision inputs",
          expected: metric.value,
          actual: reproduced,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Formula failed";
      const code =
        /period/i.test(message) ? "PERIOD_MISMATCH"
          : /currency/i.test(message) ? "CURRENCY_MISMATCH"
            : /unit/i.test(message) ? "UNIT_MISMATCH"
              : "FORMULA_NOT_REPRODUCIBLE";
      pushIssue(issues, {
        code,
        scope: "metric-registry",
        canonicalKey: metric.canonical_key,
        message,
      });
    }
  }
}

export function auditResearchReport(report: ResearchReport): MetricConsistencyAudit {
  const issues: ConsistencyIssue[] = [];
  const metrics = new Map<string, CanonicalMetricObject>();
  auditRegistry(report, metrics, issues);

  for (const usage of report.metricUsage ?? []) {
    exactValueCheck({
      issues,
      metrics,
      scope: `metric-usage:${usage.module}`,
      canonicalKey: usage.canonicalKey,
      actual: usage.canonicalValue,
    });
  }

  for (const period of report.periods ?? []) {
    for (const field of PERIOD_VALUE_FIELDS) {
      const canonicalKey = period.metricKeys[String(field)];
      if (!canonicalKey) {
        if (period[field] !== null) {
          pushIssue(issues, {
            code: "SURFACE_REFERENCE_MISSING",
            scope: `historical-table:${period.periodEnd}:${String(field)}`,
            canonicalKey: null,
            message: "Historical value has no canonical key",
            actual: period[field],
          });
        }
        continue;
      }
      exactValueCheck({
        issues,
        metrics,
        scope: `historical-table:${period.periodEnd}:${String(field)}`,
        canonicalKey,
        actual: period[field] as number | null,
      });
    }
  }

  for (const scenario of report.scenarios ?? []) {
    for (const field of SCENARIO_VALUE_FIELDS) {
      const canonicalKey = scenario.metricReferences[String(field)];
      if (!canonicalKey) {
        if (scenario[field] !== null) {
          pushIssue(issues, {
            code: "SURFACE_REFERENCE_MISSING",
            scope: `scenario:${scenario.name}:${String(field)}`,
            canonicalKey: null,
            message: "Scenario value has no canonical key",
            actual: scenario[field],
          });
        }
        continue;
      }
      exactValueCheck({
        issues,
        metrics,
        scope: `scenario:${scenario.name}:${String(field)}`,
        canonicalKey,
        actual: scenario[field] as number | null,
      });
    }
  }

  for (const peer of report.peerComparison ?? []) {
    for (const field of ["revenueGrowth", "netMargin", "freeCashFlowMargin"] as const) {
      const canonicalKey = peer.metricReferences[field];
      if (canonicalKey) {
        exactValueCheck({
          issues,
          metrics,
          scope: `peer-comparison:${peer.ticker}:${field}`,
          canonicalKey,
          actual: peer[field],
        });
      } else if (peer[field] !== null) {
        pushIssue(issues, {
          code: "SURFACE_REFERENCE_MISSING",
          scope: `peer-comparison:${peer.ticker}:${field}`,
          canonicalKey: null,
          message: "Peer-comparison value has no canonical key",
        });
      }
    }
  }

  for (const canonicalKey of referenceArray(report)) {
    if (!metrics.has(canonicalKey)) {
      pushIssue(issues, {
        code: "SURFACE_REFERENCE_MISSING",
        scope: "narrative-or-report-module",
        canonicalKey,
        message: "Report module references a canonical key that is absent from the Registry",
      });
    }
  }

  const usageByModule = new Map<string, Set<string>>();
  for (const usage of report.metricUsage ?? []) {
    const keys = usageByModule.get(usage.module) ?? new Set<string>();
    keys.add(usage.canonicalKey);
    usageByModule.set(usage.module, keys);
  }
  const webKeys = usageByModule.get("web-report") ?? new Set();
  const pdfKeys = usageByModule.get("pdf-data-model") ?? new Set();
  if (
    report.renderingModel.web !== report.renderingModel.pdf ||
    webKeys.size !== pdfKeys.size ||
    [...webKeys].some((key) => !pdfKeys.has(key))
  ) {
    pushIssue(issues, {
      code: "SURFACE_MODEL_MISMATCH",
      scope: "web-pdf",
      canonicalKey: null,
      message: "Web and PDF do not share the same metric data model and canonical references",
      expected: { model: report.renderingModel.web, keys: [...webKeys].sort() },
      actual: { model: report.renderingModel.pdf, keys: [...pdfKeys].sort() },
    });
  }

  const issueCodes = new Set(issues.map((issue) => issue.code));
  const hasScope = (prefix: string) =>
    issues.some((issue) => issue.scope.startsWith(prefix));
  return {
    schemaVersion: "1.0",
    passed: issues.length === 0,
    dataVersion: report.metricRegistry.data_version,
    totalCanonicalMetrics: report.metricRegistry.metrics.length,
    totalSurfaceReferences: report.metricUsage.length,
    checks: {
      registry:
        !issueCodes.has("DUPLICATE_KEY") &&
        !issueCodes.has("CONFLICTING_VALUE") &&
        !issueCodes.has("INVALID_CANONICAL_OBJECT"),
      formulas:
        !issueCodes.has("FORMULA_MISMATCH") &&
        !issueCodes.has("FORMULA_NOT_REPRODUCIBLE") &&
        !issueCodes.has("ROUNDED_CALCULATION_INPUT") &&
        !issueCodes.has("MISSING_INPUT"),
      lineage: !issueCodes.has("SOURCE_LINEAGE_MISMATCH"),
      cache: !issueCodes.has("CACHE_VERSION_MISMATCH") && !issueCodes.has("STALE_SOURCE"),
      json: !hasScope("metric-usage:json-research-object"),
      tables: !hasScope("historical-table"),
      charts: !hasScope("metric-usage:trend-chart"),
      narrative:
        !hasScope("metric-usage:earnings-quality") &&
        !hasScope("metric-usage:investment-thesis") &&
        !hasScope("metric-usage:risks") &&
        !hasScope("metric-usage:investment-debates"),
      scenarios: !hasScope("scenario:"),
      valuation: !hasScope("metric-usage:valuation"),
      webPdf: !hasScope("web-pdf"),
    },
    issues,
  };
}

function stableMetric(metric: CanonicalMetricObject) {
  const stable = { ...metric } as Partial<CanonicalMetricObject>;
  delete stable.retrieved_at;
  return stable;
}

function stableSources(report: ResearchReport) {
  return report.sources.map((source) => {
    const stable = { ...source } as Partial<typeof source>;
    delete stable.retrievedAt;
    return stable;
  });
}

function stableScenario(scenario: Scenario) {
  return scenario;
}

function same(first: unknown, second: unknown) {
  return JSON.stringify(first) === JSON.stringify(second);
}

export function compareResearchReports(
  first: ResearchReport,
  second: ResearchReport,
): ReproducibilityComparison {
  const mismatches: ReproducibilityMismatch[] = [];
  const missing: ReproducibilityMismatch[] = [];
  const matchedObjects: string[] = [];
  const firstMetrics = new Map(
    first.metricRegistry.metrics.map((metric) => [metric.canonical_key, metric]),
  );
  const secondMetrics = new Map(
    second.metricRegistry.metrics.map((metric) => [metric.canonical_key, metric]),
  );
  for (const key of new Set([...firstMetrics.keys(), ...secondMetrics.keys()])) {
    const left = firstMetrics.get(key);
    const right = secondMetrics.get(key);
    if (!left || !right) {
      missing.push({
        scope: "canonical-object",
        key,
        kind: "missing-object",
        first: left ?? null,
        second: right ?? null,
      });
      continue;
    }
    if (same(stableMetric(left), stableMetric(right))) {
      matchedObjects.push(key);
      continue;
    }
    const kind =
      left.definition_id !== right.definition_id ? "changed-definition"
        : left.formula_id !== right.formula_id || left.formula !== right.formula
          ? "changed-formula"
          : left.source_document !== right.source_document ||
              left.source_url !== right.source_url ||
              left.source_date !== right.source_date
            ? "changed-source"
            : "mismatched-object";
    mismatches.push({
      scope: left.status !== right.status ? "status" : "canonical-object",
      key,
      kind,
      first: stableMetric(left),
      second: stableMetric(right),
    });
  }

  for (const name of ["Bear", "Base", "Bull"] as const) {
    const left = first.scenarios.find((scenario) => scenario.name === name);
    const right = second.scenarios.find((scenario) => scenario.name === name);
    if (!same(left ? stableScenario(left) : null, right ? stableScenario(right) : null)) {
      mismatches.push({
        scope: "scenario",
        key: name,
        kind: "changed-output",
        first: left ?? null,
        second: right ?? null,
      });
    }
  }
  if (!same(stableSources(first), stableSources(second))) {
    mismatches.push({
      scope: "citation",
      key: "sources",
      kind: "changed-source",
      first: stableSources(first),
      second: stableSources(second),
    });
  }

  const all = [...mismatches, ...missing];
  return {
    schemaVersion: "1.0",
    passed: all.length === 0,
    matchedObjects: matchedObjects.sort(),
    mismatchedObjects: mismatches.filter((item) => item.kind === "mismatched-object"),
    missingObjects: missing,
    changedDefinitions: mismatches.filter((item) => item.kind === "changed-definition"),
    changedFormulas: mismatches.filter((item) => item.kind === "changed-formula"),
    changedSources: mismatches.filter((item) => item.kind === "changed-source"),
    changedOutputs: mismatches.filter((item) => item.kind === "changed-output"),
  };
}
