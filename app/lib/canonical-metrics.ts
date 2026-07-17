import type {
  MetricLocatorAudit,
  MetricLocatorResult,
  MetricSourceTier,
  MetricStatus,
} from "./metric-locator-types";

export const CANONICAL_METRIC_SCHEMA_VERSION = "1.0";
export const DEFAULT_CALCULATION_VERSION = "1.0";

export type CanonicalMetricSourceType =
  | "filing"
  | "filing-exhibit"
  | "investor-presentation"
  | "industry-research"
  | "market-data"
  | "analyst-assumption"
  | "calculation";

export type CanonicalMetricObject = {
  canonical_key: string;
  metric_id: string;
  company_id: string;
  sector: string;
  period: string;
  period_start: string | null;
  period_end: string;
  value: number | null;
  unit: string;
  currency: string | null;
  status: MetricStatus;
  definition_id: string;
  formula_id: CanonicalFormulaId | null;
  formula: string | null;
  input_metric_keys: string[];
  source_document: string | null;
  source_url: string | null;
  source_type: CanonicalMetricSourceType;
  source_date: string | null;
  filing_date: string | null;
  section: string | null;
  table: string | null;
  row_label: string | null;
  raw_value: string | null;
  extraction_method: string | null;
  confidence: number;
  retrieved_at: string;
  data_version: string;
  calculation_version: string;
  schema_version: string;
};

export type MetricRegistrySnapshot = {
  schema_version: string;
  data_version: string;
  calculation_version: string;
  metrics: CanonicalMetricObject[];
};

export type MetricQuery = {
  company_id: string;
  metric_id: string;
  period?: string;
  period_end?: string;
  definition_id?: string;
  currency?: string | null;
  unit?: string;
};

export type DerivedMetricRequest = {
  metric_id: string;
  company_id: string;
  sector: string;
  period: string;
  period_start?: string | null;
  period_end: string;
  definition_id: string;
  formula_id: CanonicalFormulaId;
  formula: string;
  input_metric_keys: string[];
  unit: string;
  currency?: string | null;
  source_document?: string;
  confidence?: number;
};

export type AnalystAssumptionRequest = {
  metric_id: string;
  company_id: string;
  sector: string;
  period: string;
  period_start?: string | null;
  period_end: string;
  definition_id: string;
  value: number;
  formula: string;
  input_metric_keys?: string[];
  unit: string;
  currency?: string | null;
  confidence?: number;
};

export type CanonicalFormulaId =
  | "add"
  | "subtract"
  | "multiply"
  | "scale"
  | "divide"
  | "growth-rate"
  | "growth-projection"
  | "period-change"
  | "cagr"
  | "average"
  | "analyst-assumption";

export class CanonicalMetricError extends Error {
  constructor(
    public readonly code:
      | "INVALID_METRIC"
      | "DUPLICATE_CANONICAL_KEY"
      | "DEFINITION_CONFLICT"
      | "METRIC_NOT_FOUND"
      | "FORMULA_DEPENDENCY"
      | "UNIT_MISMATCH"
      | "CURRENCY_MISMATCH"
      | "PERIOD_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "CanonicalMetricError";
  }
}

function keyPart(value: string | null) {
  return encodeURIComponent(value ?? "none");
}

export function canonicalMetricKey(input: {
  company_id: string;
  metric_id: string;
  period: string;
  definition_id: string;
  currency: string | null;
  unit: string;
  data_version: string;
}) {
  return [
    input.company_id,
    input.metric_id,
    input.period,
    input.definition_id,
    input.currency,
    input.unit,
    input.data_version,
  ].map(keyPart).join("|");
}

export function validateCanonicalMetric(metric: CanonicalMetricObject) {
  const errors: string[] = [];
  for (const [field, value] of Object.entries({
    metric_id: metric.metric_id,
    company_id: metric.company_id,
    sector: metric.sector,
    period: metric.period,
    period_end: metric.period_end,
    unit: metric.unit,
    definition_id: metric.definition_id,
    data_version: metric.data_version,
    calculation_version: metric.calculation_version,
    schema_version: metric.schema_version,
    retrieved_at: metric.retrieved_at,
  })) {
    if (!value) errors.push(`${field} is required`);
  }
  if (
    ["Reported", "Derived"].includes(metric.status) &&
    (metric.value === null || !Number.isFinite(metric.value))
  ) errors.push(`${metric.status} metrics require a finite canonical value`);
  if (
    !["Reported", "Derived"].includes(metric.status) &&
    metric.value !== null
  ) errors.push(`${metric.status} metrics must not publish a usable value`);
  if (metric.status === "Derived") {
    if (!metric.formula_id || !metric.formula) {
      errors.push("Derived metrics require formula_id and formula");
    }
    if (
      metric.formula_id !== "analyst-assumption" &&
      !metric.input_metric_keys.length
    ) {
      errors.push("Derived metrics require canonical input_metric_keys");
    }
  }
  if (metric.status === "Reported" && !metric.source_document) {
    errors.push("Reported metrics require a source document");
  }
  if (metric.confidence < 0 || metric.confidence > 1) {
    errors.push("confidence must be between 0 and 1");
  }
  const expectedKey = canonicalMetricKey(metric);
  if (metric.canonical_key !== expectedKey) errors.push("canonical_key does not match metric fields");
  if (errors.length) {
    throw new CanonicalMetricError("INVALID_METRIC", errors.join("; "));
  }
  return metric;
}

function assertCompatibleInputs(inputs: CanonicalMetricObject[]) {
  if (!inputs.length) {
    throw new CanonicalMetricError("FORMULA_DEPENDENCY", "At least one canonical input is required");
  }
  const company = inputs[0].company_id;
  const period = inputs[0].period;
  for (const input of inputs) {
    if (input.value === null || !["Reported", "Derived"].includes(input.status)) {
      throw new CanonicalMetricError(
        "FORMULA_DEPENDENCY",
        `Input ${input.canonical_key} does not have a usable canonical value`,
      );
    }
    if (input.company_id !== company) {
      throw new CanonicalMetricError("FORMULA_DEPENDENCY", "Canonical inputs mix companies");
    }
    if (input.period !== period) {
      throw new CanonicalMetricError("PERIOD_MISMATCH", "Canonical inputs mix reporting periods");
    }
  }
}

export function calculateFromCanonicalInputs(
  formulaId: CanonicalFormulaId,
  inputs: CanonicalMetricObject[],
) {
  if (["growth-rate", "period-change", "cagr", "average", "scale", "growth-projection"].includes(formulaId)) {
    if (["growth-rate", "period-change", "cagr", "scale", "growth-projection"].includes(formulaId) && inputs.length !== 2) {
      throw new CanonicalMetricError("FORMULA_DEPENDENCY", `${formulaId} requires two inputs`);
    }
    if (formulaId === "average" && !inputs.length) {
      throw new CanonicalMetricError("FORMULA_DEPENDENCY", "Average requires at least one input");
    }
    if (inputs.some((input) => input.company_id !== inputs[0].company_id)) {
      throw new CanonicalMetricError("FORMULA_DEPENDENCY", "Canonical inputs mix companies");
    }
    if (
      inputs.some((input) =>
        input.value === null || !["Reported", "Derived"].includes(input.status)
      )
    ) {
      throw new CanonicalMetricError("FORMULA_DEPENDENCY", "Growth inputs must have usable values");
    }
    if (
      ["growth-rate", "period-change", "cagr", "average"].includes(formulaId) &&
      inputs.some((input) => input.unit !== inputs[0].unit)
    ) {
      throw new CanonicalMetricError("UNIT_MISMATCH", "Growth inputs mix units");
    }
    if (
      ["growth-rate", "period-change", "cagr", "average"].includes(formulaId) &&
      inputs.some((input) => input.currency !== inputs[0].currency)
    ) {
      throw new CanonicalMetricError("CURRENCY_MISMATCH", "Growth inputs mix currencies");
    }
  } else {
    assertCompatibleInputs(inputs);
  }
  const values = inputs.map((input) => input.value!);
  if (["add", "subtract", "average"].includes(formulaId)) {
    const unit = inputs[0].unit;
    const currency = inputs[0].currency;
    if (inputs.some((input) => input.unit !== unit)) {
      throw new CanonicalMetricError("UNIT_MISMATCH", "Canonical inputs mix units");
    }
    if (inputs.some((input) => input.currency !== currency)) {
      throw new CanonicalMetricError("CURRENCY_MISMATCH", "Canonical inputs mix currencies");
    }
  }
  switch (formulaId) {
    case "add":
      return values.reduce((sum, value) => sum + value, 0);
    case "subtract":
      if (values.length !== 2) {
        throw new CanonicalMetricError("FORMULA_DEPENDENCY", "Subtract requires two inputs");
      }
      return values[0] - values[1];
    case "multiply":
      return values.reduce((product, value) => product * value, 1);
    case "scale":
      return values[0] * values[1];
    case "divide":
      if (values.length !== 2 || values[1] === 0) {
        throw new CanonicalMetricError("FORMULA_DEPENDENCY", "Divide requires two inputs and a non-zero denominator");
      }
      return values[0] / values[1];
    case "growth-rate":
      if (values.length !== 2 || values[1] === 0) {
        throw new CanonicalMetricError("FORMULA_DEPENDENCY", "Growth rate requires current and non-zero prior values");
      }
      return values[0] / values[1] - 1;
    case "growth-projection":
      return values[0] * (1 + values[1]);
    case "period-change":
      if (values.length !== 2) {
        throw new CanonicalMetricError("FORMULA_DEPENDENCY", "Period change requires current and prior values");
      }
      return values[0] - values[1];
    case "cagr": {
      if (values.length !== 2 || values[1] <= 0 || values[0] <= 0) {
        throw new CanonicalMetricError("FORMULA_DEPENDENCY", "CAGR requires positive latest and earliest values");
      }
      const years =
        (Date.parse(inputs[0].period_end) - Date.parse(inputs[1].period_end)) /
        31_557_600_000;
      if (!Number.isFinite(years) || years <= 0) {
        throw new CanonicalMetricError("PERIOD_MISMATCH", "CAGR requires ordered annual periods");
      }
      return Math.pow(values[0] / values[1], 1 / years) - 1;
    }
    case "average":
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    case "analyst-assumption":
      throw new CanonicalMetricError(
        "FORMULA_DEPENDENCY",
        "Analyst assumptions must be registered with registerAssumption",
      );
  }
}

export class MetricRegistry {
  private readonly metrics = new Map<string, CanonicalMetricObject>();

  constructor(
    readonly dataVersion: string,
    readonly calculationVersion = DEFAULT_CALCULATION_VERSION,
    initialMetrics: CanonicalMetricObject[] = [],
  ) {
    initialMetrics.forEach((metric) => this.register(metric));
  }

  register(metric: CanonicalMetricObject) {
    validateCanonicalMetric(metric);
    if (metric.data_version !== this.dataVersion) {
      throw new CanonicalMetricError(
        "INVALID_METRIC",
        `Metric data version ${metric.data_version} does not match registry ${this.dataVersion}`,
      );
    }
    if (metric.calculation_version !== this.calculationVersion) {
      throw new CanonicalMetricError(
        "INVALID_METRIC",
        `Metric calculation version ${metric.calculation_version} does not match registry ${this.calculationVersion}`,
      );
    }
    if (this.metrics.has(metric.canonical_key)) {
      throw new CanonicalMetricError(
        "DUPLICATE_CANONICAL_KEY",
        `Duplicate canonical metric key: ${metric.canonical_key}`,
      );
    }
    this.metrics.set(metric.canonical_key, Object.freeze({
      ...metric,
      input_metric_keys: Object.freeze([...metric.input_metric_keys]) as unknown as string[],
    }));
    return metric;
  }

  registerOrVerify(metric: CanonicalMetricObject) {
    const existing = this.metrics.get(metric.canonical_key);
    if (!existing) return this.register(metric);
    if (
      existing.value !== metric.value ||
      existing.status !== metric.status ||
      existing.formula_id !== metric.formula_id ||
      existing.formula !== metric.formula
    ) {
      throw new CanonicalMetricError(
        "DUPLICATE_CANONICAL_KEY",
        `Conflicting values or formulas for canonical key: ${metric.canonical_key}`,
      );
    }
    return existing;
  }

  getByKey(canonicalKey: string) {
    const metric = this.metrics.get(canonicalKey);
    if (!metric) {
      throw new CanonicalMetricError("METRIC_NOT_FOUND", `Metric not found: ${canonicalKey}`);
    }
    return metric;
  }

  getMetric(query: MetricQuery) {
    const matches = this.values().filter((metric) =>
      metric.company_id === query.company_id &&
      metric.metric_id === query.metric_id &&
      (query.period === undefined || metric.period === query.period) &&
      (query.period_end === undefined || metric.period_end === query.period_end) &&
      (query.definition_id === undefined || metric.definition_id === query.definition_id) &&
      (query.currency === undefined || metric.currency === query.currency) &&
      (query.unit === undefined || metric.unit === query.unit)
    );
    if (!matches.length) {
      throw new CanonicalMetricError(
        "METRIC_NOT_FOUND",
        `No canonical metric matches ${JSON.stringify(query)}`,
      );
    }
    if (matches.length > 1) {
      throw new CanonicalMetricError(
        "DEFINITION_CONFLICT",
        `Query is ambiguous; provide an explicit definition, period, currency, and unit: ${JSON.stringify(query)}`,
      );
    }
    return matches[0];
  }

  getMetricHistory(
    companyId: string,
    metricId: string,
    definitionId: string,
  ) {
    return this.values()
      .filter((metric) =>
        metric.company_id === companyId &&
        metric.metric_id === metricId &&
        metric.definition_id === definitionId
      )
      .sort((a, b) => a.period_end.localeCompare(b.period_end));
  }

  getSectorMetrics(companyId: string, sector: string) {
    return this.values().filter(
      (metric) => metric.company_id === companyId && metric.sector === sector,
    );
  }

  calculateDerived(request: DerivedMetricRequest) {
    const inputs = request.input_metric_keys.map((key) => this.getByKey(key));
    const value = calculateFromCanonicalInputs(request.formula_id, inputs);
    const metric = createCanonicalMetric({
      ...request,
      period_start: request.period_start ?? null,
      currency: request.currency ?? null,
      value,
      status: "Derived",
      source_type: "calculation",
      source_document: request.source_document ?? "ScopeLine Metric Registry",
      source_url: null,
      source_date: null,
      filing_date: null,
      section: "Canonical calculation",
      table: null,
      row_label: request.metric_id,
      raw_value: null,
      extraction_method: "deterministic-canonical-formula",
      confidence: request.confidence ?? Math.min(...inputs.map((input) => input.confidence)),
      retrieved_at: new Date().toISOString(),
      data_version: this.dataVersion,
      calculation_version: this.calculationVersion,
    });
    this.register(metric);
    return metric;
  }

  registerAssumption(request: AnalystAssumptionRequest) {
    const inputs = (request.input_metric_keys ?? []).map((key) => this.getByKey(key));
    if (inputs.some((input) => input.company_id !== request.company_id)) {
      throw new CanonicalMetricError(
        "FORMULA_DEPENDENCY",
        "Analyst-assumption inputs mix companies",
      );
    }
    const metric = createCanonicalMetric({
      ...request,
      period_start: request.period_start ?? null,
      currency: request.currency ?? null,
      status: "Derived",
      formula_id: "analyst-assumption",
      input_metric_keys: request.input_metric_keys ?? [],
      source_type: "analyst-assumption",
      source_document: "ScopeLine scenario assumptions",
      source_url: null,
      source_date: null,
      filing_date: null,
      section: "Scenario framework",
      table: null,
      row_label: request.metric_id,
      raw_value: String(request.value),
      extraction_method: "deterministic-scenario-assumption",
      confidence: request.confidence ?? 0.5,
      retrieved_at: new Date().toISOString(),
      data_version: this.dataVersion,
      calculation_version: this.calculationVersion,
    });
    this.register(metric);
    return metric;
  }

  values() {
    return [...this.metrics.values()];
  }

  findMetrics(query: Partial<MetricQuery>) {
    return this.values().filter((metric) =>
      (query.company_id === undefined || metric.company_id === query.company_id) &&
      (query.metric_id === undefined || metric.metric_id === query.metric_id) &&
      (query.period === undefined || metric.period === query.period) &&
      (query.period_end === undefined || metric.period_end === query.period_end) &&
      (query.definition_id === undefined || metric.definition_id === query.definition_id) &&
      (query.currency === undefined || metric.currency === query.currency) &&
      (query.unit === undefined || metric.unit === query.unit)
    );
  }

  snapshot(): MetricRegistrySnapshot {
    return {
      schema_version: CANONICAL_METRIC_SCHEMA_VERSION,
      data_version: this.dataVersion,
      calculation_version: this.calculationVersion,
      metrics: this.values().sort((a, b) => a.canonical_key.localeCompare(b.canonical_key)),
    };
  }
}

export function createCanonicalMetric(
  input: Omit<CanonicalMetricObject, "canonical_key" | "schema_version">,
): CanonicalMetricObject {
  const metric: CanonicalMetricObject = {
    ...input,
    schema_version: CANONICAL_METRIC_SCHEMA_VERSION,
    canonical_key: canonicalMetricKey(input),
  };
  return validateCanonicalMetric(metric);
}

function sourceType(sourceTier: MetricSourceTier | null): CanonicalMetricSourceType {
  if (sourceTier === "earnings-release-exhibit") return "filing-exhibit";
  if (sourceTier === "investor-presentation") return "investor-presentation";
  return "filing";
}

function periodLabel(periodEnd: string) {
  return `FY${periodEnd.slice(0, 4)}`;
}

function canonicalFromLocatorResult(input: {
  result: MetricLocatorResult;
  companyId: string;
  sector: string;
  dataVersion: string;
  calculationVersion: string;
  retrievedAt: string;
  inputMetricKeys: string[];
  reportingPeriod: string;
}) {
  const { result } = input;
  const periodEnd = result.period ?? input.reportingPeriod;
  return createCanonicalMetric({
    metric_id: result.metricId,
    company_id: input.companyId,
    sector: input.sector,
    period: periodLabel(periodEnd),
    period_start: result.status === "Reported" && result.metricId === "net-debt"
      ? null
      : `${periodEnd.slice(0, 4)}-01-01`,
    period_end: periodEnd,
    value: result.selectedValue,
    unit: result.unit ?? "unresolved",
    currency: result.currency,
    status: result.status,
    definition_id: result.definitionId,
    formula_id: result.status === "Derived" ? "subtract" : null,
    formula: result.formula,
    input_metric_keys: input.inputMetricKeys,
    source_document: result.sourceDocument,
    source_url: result.sourceUrl,
    source_type: result.status === "Derived" ? "calculation" : sourceType(result.sourceTier),
    source_date: result.sourceDate,
    filing_date: result.filingDate,
    section: result.section,
    table: result.table,
    row_label: result.row ?? result.rawLabel,
    raw_value: result.rawValue,
    extraction_method: result.extractionMethod,
    confidence: result.confidence,
    retrieved_at: input.retrievedAt,
    data_version: input.dataVersion,
    calculation_version: input.calculationVersion,
  });
}

export function registryFromLocatorAudit(input: {
  audit: MetricLocatorAudit;
  companyId: string;
  sector: string;
  dataVersion: string;
  calculationVersion?: string;
  retrievedAt?: string;
}) {
  const calculationVersion = input.calculationVersion ?? DEFAULT_CALCULATION_VERSION;
  const retrievedAt = input.retrievedAt ?? input.audit.generatedAt;
  const registry = new MetricRegistry(input.dataVersion, calculationVersion);
  publishLocatorAuditToRegistry({
    registry,
    audit: input.audit,
    companyId: input.companyId,
    sector: input.sector,
    retrievedAt,
  });
  return registry;
}

export function publishLocatorAuditToRegistry(input: {
  registry: MetricRegistry;
  audit: MetricLocatorAudit;
  companyId: string;
  sector: string;
  retrievedAt?: string;
}) {
  const calculationVersion = input.registry.calculationVersion;
  const retrievedAt = input.retrievedAt ?? input.audit.generatedAt;
  const deferred: MetricLocatorResult[] = [];
  for (const result of input.audit.allResults) {
    if (result.status === "Derived") {
      deferred.push(result);
      continue;
    }
    input.registry.registerOrVerify(canonicalFromLocatorResult({
      result,
      companyId: input.companyId,
      sector: input.sector,
      dataVersion: input.registry.dataVersion,
      calculationVersion,
      retrievedAt,
      inputMetricKeys: [],
      reportingPeriod: input.audit.reportingPeriod,
    }));
  }
  for (const result of deferred) {
    const resultById = new Map(
      input.audit.allResults.map((auditResult) => [auditResult.metricId, auditResult]),
    );
    const inputMetricKeys = ["operating-cash-flow", "cash-capex"].map((metricId) => {
      const inputResult = resultById.get(metricId);
      return input.registry.getMetric({
        company_id: input.companyId,
        metric_id: metricId,
        period_end: result.period ?? undefined,
        definition_id: inputResult?.definitionId,
      }).canonical_key;
    });
    input.registry.registerOrVerify(canonicalFromLocatorResult({
      result,
      companyId: input.companyId,
      sector: input.sector,
      dataVersion: input.registry.dataVersion,
      calculationVersion,
      retrievedAt,
      inputMetricKeys,
      reportingPeriod: input.audit.reportingPeriod,
    }));
  }
  return input.registry;
}

export function formatMetricForDisplay(
  metric: CanonicalMetricObject,
  locale: "zh" | "en" = "en",
) {
  if (metric.value === null) return "—";
  const numberLocale = locale === "zh" ? "zh-CN" : "en-US";
  if (metric.currency && metric.unit === metric.currency) {
    const absolute = Math.abs(metric.value);
    const divisor = absolute >= 1e9 ? 1e9 : absolute >= 1e6 ? 1e6 : 1;
    const suffix = divisor === 1e9 ? "bn" : divisor === 1e6 ? "m" : "";
    return `${metric.currency} ${new Intl.NumberFormat(numberLocale, {
      maximumFractionDigits: divisor === 1 ? 2 : 3,
    }).format(metric.value / divisor)}${suffix}`;
  }
  if (metric.unit === "ratio") {
    return new Intl.NumberFormat(numberLocale, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(metric.value);
  }
  return `${new Intl.NumberFormat(numberLocale, {
    maximumFractionDigits: 3,
  }).format(metric.value)} ${metric.unit}`;
}
