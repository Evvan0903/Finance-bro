import {
  CanonicalMetricError,
  MetricRegistry,
} from "./canonical-metrics";
import type { CanonicalMetricObject } from "./canonical-metrics";
import { FINANCIAL_DEFINITION_IDS } from "./financial-metrics";
import type { FinancialPeriod, ResearchLocale, Scenario } from "./research-types";
import type { SectorPack } from "./sector-types";

type ScenarioName = "Bear" | "Base" | "Bull";

const SCENARIO_DEFINITIONS = {
  revenueGrowth: "scenario-revenue-growth-assumption",
  netMargin: "scenario-net-margin-assumption",
  operatingCashFlowMargin: "scenario-operating-cash-flow-margin-assumption",
  capexFactor: "scenario-cash-capex-factor-assumption",
  valuationMultiple: "scenario-valuation-multiple-assumption",
  projectedRevenue: "scenario-projected-revenue",
  projectedNetIncome: "scenario-projected-net-income",
  projectedOperatingCashFlow: "scenario-projected-operating-cash-flow",
  projectedCashCapex: "scenario-projected-cash-capex",
  projectedFreeCashFlow: "scenario-projected-free-cash-flow",
  valuationMetric: "scenario-valuation-metric",
  enterpriseValue: "scenario-model-implied-enterprise-value",
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function optionalMetric(
  registry: MetricRegistry,
  companyId: string,
  metricId: string,
  periodEnd: string,
  definitionId: string,
) {
  const matches = registry.findMetrics({
    company_id: companyId,
    metric_id: metricId,
    period_end: periodEnd,
    definition_id: definitionId,
  });
  if (matches.length > 1) {
    throw new CanonicalMetricError(
      "DEFINITION_CONFLICT",
      `Scenario input is ambiguous: ${metricId} ${periodEnd} ${definitionId}`,
    );
  }
  return matches[0] ?? null;
}

function averageMetric(
  registry: MetricRegistry,
  companyId: string,
  metricId: string,
  definitionId: string,
  latest: FinancialPeriod,
  sector: string,
) {
  const inputs = registry
    .getMetricHistory(companyId, metricId, definitionId)
    .filter((metric) => metric.value !== null)
    .slice(-3);
  if (!inputs.length) return null;
  if (inputs.length === 1) return inputs[0];
  return registry.calculateDerived({
    metric_id: `${metricId}-three-year-average`,
    company_id: companyId,
    sector,
    period: `FY${latest.periodEnd.slice(0, 4)}`,
    period_end: latest.periodEnd,
    definition_id: `trailing-three-period-average-${definitionId}`,
    formula_id: "average",
    formula: `average(${inputs.map((metric) => metric.metric_id).join(", ")})`,
    input_metric_keys: inputs.map((metric) => metric.canonical_key),
    unit: inputs[0].unit,
    currency: inputs[0].currency,
  });
}

function registerAssumption(input: {
  registry: MetricRegistry;
  companyId: string;
  sector: string;
  scenario: ScenarioName;
  period: string;
  periodEnd: string;
  metricId: string;
  definitionId: string;
  value: number;
  unit: string;
  currency: string | null;
  formula: string;
  inputs: CanonicalMetricObject[];
}) {
  return input.registry.registerAssumption({
    metric_id: input.metricId,
    company_id: input.companyId,
    sector: input.sector,
    period: input.period,
    period_end: input.periodEnd,
    definition_id: `${input.definitionId}-${input.scenario.toLowerCase()}`,
    value: input.value,
    formula: input.formula,
    input_metric_keys: input.inputs.map((metric) => metric.canonical_key),
    unit: input.unit,
    currency: input.currency,
  });
}

function calculate(input: {
  registry: MetricRegistry;
  companyId: string;
  sector: string;
  scenario: ScenarioName;
  period: string;
  periodEnd: string;
  metricId: string;
  definitionId: string;
  formulaId: "multiply" | "scale" | "subtract" | "growth-projection";
  formula: string;
  inputs: CanonicalMetricObject[];
  unit: string;
  currency: string | null;
}) {
  return input.registry.calculateDerived({
    metric_id: input.metricId,
    company_id: input.companyId,
    sector: input.sector,
    period: input.period,
    period_end: input.periodEnd,
    definition_id: `${input.definitionId}-${input.scenario.toLowerCase()}`,
    formula_id: input.formulaId,
    formula: input.formula,
    input_metric_keys: input.inputs.map((metric) => metric.canonical_key),
    unit: input.unit,
    currency: input.currency,
  });
}

export function buildCanonicalScenarios(input: {
  registry: MetricRegistry;
  companyId: string;
  periods: FinancialPeriod[];
  pack: SectorPack;
  locale: ResearchLocale;
}): Scenario[] {
  const latest = input.periods.at(-1);
  if (!latest) return [];
  const latestRevenue = optionalMetric(
    input.registry,
    input.companyId,
    "revenue",
    latest.periodEnd,
    FINANCIAL_DEFINITION_IDS.revenue,
  );
  if (!latestRevenue) return [];

  const revenueCagr = optionalMetric(
    input.registry,
    input.companyId,
    "revenue-cagr",
    latest.periodEnd,
    FINANCIAL_DEFINITION_IDS.revenueCagr,
  );
  const averageNetMargin = averageMetric(
    input.registry,
    input.companyId,
    "net-margin",
    FINANCIAL_DEFINITION_IDS.netMargin,
    latest,
    input.pack.id,
  );
  const averageOcfMargin = averageMetric(
    input.registry,
    input.companyId,
    "operating-cash-flow-margin",
    FINANCIAL_DEFINITION_IDS.operatingCashFlowMargin,
    latest,
    input.pack.id,
  );
  const latestNetMargin = optionalMetric(
    input.registry,
    input.companyId,
    "net-margin",
    latest.periodEnd,
    FINANCIAL_DEFINITION_IDS.netMargin,
  );
  const latestOcfMargin = optionalMetric(
    input.registry,
    input.companyId,
    "operating-cash-flow-margin",
    latest.periodEnd,
    FINANCIAL_DEFINITION_IDS.operatingCashFlowMargin,
  );
  const capexDefinitionPriority: string[] = [
    FINANCIAL_DEFINITION_IDS.issuerCashCapex,
    FINANCIAL_DEFINITION_IDS.cashCapex,
  ];
  const latestCashCapex = input.registry.findMetrics({
    company_id: input.companyId,
    metric_id: "cash-capex",
    period_end: latest.periodEnd,
  }).sort((left, right) =>
    capexDefinitionPriority.indexOf(left.definition_id) -
    capexDefinitionPriority.indexOf(right.definition_id)
  )[0] ?? null;

  const baseGrowth = input.pack.id === "semiconductors"
    ? clamp(revenueCagr?.value ?? 0.08, -0.05, 0.3)
    : clamp(revenueCagr?.value ?? 0, -0.08, 0.08);
  const baseNetMargin = averageNetMargin ?? latestNetMargin;
  const baseOcfMargin = averageOcfMargin ?? latestOcfMargin;
  const useFallback =
    input.pack.valuation.metric === "freeCashFlow" &&
    (!latestCashCapex || !latestOcfMargin) &&
    input.pack.valuation.fallback !== undefined;
  const framework = useFallback ? input.pack.valuation.fallback! : input.pack.valuation;
  const nextYear = Number(latest.periodEnd.slice(0, 4)) + 1;
  const forecastEnd = `${nextYear}-12-31`;
  const growthSpread = input.pack.id === "semiconductors" ? 0.08 : 0.05;
  const assumptions = [
    { name: "Bear" as const, growth: baseGrowth - growthSpread, marginDelta: -0.03, capexFactor: 1.1, multiple: framework.multiples.bear },
    { name: "Base" as const, growth: baseGrowth, marginDelta: 0, capexFactor: 1, multiple: framework.multiples.base },
    { name: "Bull" as const, growth: baseGrowth + growthSpread, marginDelta: 0.03, capexFactor: 0.95, multiple: framework.multiples.bull },
  ];
  const scenarioContext = {
    registry: input.registry,
    companyId: input.companyId,
    sector: input.pack.id,
  };

  return assumptions.map((assumption) => {
    const period = `FY${nextYear}E-${assumption.name}`;
    const growth = registerAssumption({
      ...scenarioContext,
      scenario: assumption.name,
      period,
      periodEnd: forecastEnd,
      metricId: "scenario-revenue-growth",
      definitionId: SCENARIO_DEFINITIONS.revenueGrowth,
      value: clamp(assumption.growth, -0.25, 0.45),
      unit: "ratio",
      currency: null,
      formula: "Sector-bounded historical revenue CAGR plus scenario spread",
      inputs: revenueCagr ? [revenueCagr] : [latestRevenue],
    });
    const netMargin = baseNetMargin
      ? registerAssumption({
          ...scenarioContext,
          scenario: assumption.name,
          period,
          periodEnd: forecastEnd,
          metricId: "scenario-net-margin",
          definitionId: SCENARIO_DEFINITIONS.netMargin,
          value: clamp(baseNetMargin.value! + assumption.marginDelta, -0.3, 0.65),
          unit: "ratio",
          currency: null,
          formula: "Trailing-three-period average net margin plus scenario spread",
          inputs: [baseNetMargin],
        })
      : null;
    const ocfMargin = baseOcfMargin
      ? registerAssumption({
          ...scenarioContext,
          scenario: assumption.name,
          period,
          periodEnd: forecastEnd,
          metricId: "scenario-operating-cash-flow-margin",
          definitionId: SCENARIO_DEFINITIONS.operatingCashFlowMargin,
          value: clamp(baseOcfMargin.value! + assumption.marginDelta, -0.25, 0.7),
          unit: "ratio",
          currency: null,
          formula: "Trailing-three-period average OCF margin plus scenario spread",
          inputs: [baseOcfMargin],
        })
      : null;
    const capexFactor = registerAssumption({
      ...scenarioContext,
      scenario: assumption.name,
      period,
      periodEnd: forecastEnd,
      metricId: "scenario-cash-capex-factor",
      definitionId: SCENARIO_DEFINITIONS.capexFactor,
      value: assumption.capexFactor,
      unit: "ratio",
      currency: null,
      formula: "Explicit scenario cash-capex scaling factor",
      inputs: latestCashCapex ? [latestCashCapex] : [latestRevenue],
    });
    const valuationMultiple = registerAssumption({
      ...scenarioContext,
      scenario: assumption.name,
      period,
      periodEnd: forecastEnd,
      metricId: "scenario-valuation-multiple",
      definitionId: SCENARIO_DEFINITIONS.valuationMultiple,
      value: assumption.multiple,
      unit: framework.multipleLabel,
      currency: null,
      formula: `Explicit ${framework.multipleLabel} scenario multiple`,
      inputs: [latestRevenue],
    });
    const projectedRevenue = calculate({
      ...scenarioContext,
      scenario: assumption.name,
      period,
      periodEnd: forecastEnd,
      metricId: "projected-revenue",
      definitionId: SCENARIO_DEFINITIONS.projectedRevenue,
      formulaId: "growth-projection",
      formula: "latest_revenue * (1 + scenario_revenue_growth)",
      inputs: [latestRevenue, growth],
      unit: latestRevenue.unit,
      currency: latestRevenue.currency,
    });
    const projectedNetIncome = netMargin
      ? calculate({
          ...scenarioContext,
          scenario: assumption.name,
          period,
          periodEnd: forecastEnd,
          metricId: "projected-net-income",
          definitionId: SCENARIO_DEFINITIONS.projectedNetIncome,
          formulaId: "multiply",
          formula: "projected_revenue * scenario_net_margin",
          inputs: [projectedRevenue, netMargin],
          unit: projectedRevenue.unit,
          currency: projectedRevenue.currency,
        })
      : null;
    const projectedOcf = ocfMargin
      ? calculate({
          ...scenarioContext,
          scenario: assumption.name,
          period,
          periodEnd: forecastEnd,
          metricId: "projected-operating-cash-flow",
          definitionId: SCENARIO_DEFINITIONS.projectedOperatingCashFlow,
          formulaId: "multiply",
          formula: "projected_revenue * scenario_operating_cash_flow_margin",
          inputs: [projectedRevenue, ocfMargin],
          unit: projectedRevenue.unit,
          currency: projectedRevenue.currency,
        })
      : null;
    const projectedCapex = latestCashCapex
      ? calculate({
          ...scenarioContext,
          scenario: assumption.name,
          period,
          periodEnd: forecastEnd,
          metricId: "projected-cash-capex",
          definitionId: SCENARIO_DEFINITIONS.projectedCashCapex,
          formulaId: "scale",
          formula: "latest_cash_capex * scenario_cash_capex_factor",
          inputs: [latestCashCapex, capexFactor],
          unit: latestCashCapex.unit,
          currency: latestCashCapex.currency,
        })
      : null;
    const projectedFcf = projectedOcf && projectedCapex
      ? calculate({
          ...scenarioContext,
          scenario: assumption.name,
          period,
          periodEnd: forecastEnd,
          metricId: "projected-fcf",
          definitionId: SCENARIO_DEFINITIONS.projectedFreeCashFlow,
          formulaId: "subtract",
          formula: "projected_operating_cash_flow - projected_cash_capex",
          inputs: [projectedOcf, projectedCapex],
          unit: projectedOcf.unit,
          currency: projectedOcf.currency,
        })
      : null;
    const valuationMetric =
      framework.metric === "revenue"
        ? projectedRevenue
        : framework.metric === "operatingCashFlow"
          ? projectedOcf
          : projectedFcf;
    const enterpriseValue = valuationMetric && valuationMetric.value! > 0
      ? calculate({
          ...scenarioContext,
          scenario: assumption.name,
          period,
          periodEnd: forecastEnd,
          metricId: "model-implied-enterprise-value",
          definitionId: SCENARIO_DEFINITIONS.enterpriseValue,
          formulaId: "scale",
          formula: `scenario_valuation_metric * assumed_${framework.multipleLabel.toLowerCase().replace(/[^a-z]+/g, "_")}`,
          inputs: [valuationMetric, valuationMultiple],
          unit: valuationMetric.unit,
          currency: valuationMetric.currency,
        })
      : null;

    return {
      name: assumption.name,
      revenueGrowth: growth.value,
      netMargin: netMargin?.value ?? null,
      operatingCashFlowMargin: ocfMargin?.value ?? null,
      capexFactor: capexFactor.value!,
      projectedRevenue: projectedRevenue.value,
      projectedNetIncome: projectedNetIncome?.value ?? null,
      projectedFreeCashFlow: projectedFcf?.value ?? null,
      enterpriseValueMultiple: valuationMultiple.value!,
      valuationMethod: framework.method[input.locale],
      valuationMetric: valuationMetric?.value ?? null,
      multipleLabel: framework.multipleLabel,
      modelImpliedEnterpriseValue: enterpriseValue?.value ?? null,
      metricReferences: Object.fromEntries(
        [
          ["revenueGrowth", growth],
          ["netMargin", netMargin],
          ["operatingCashFlowMargin", ocfMargin],
          ["capexFactor", capexFactor],
          ["projectedRevenue", projectedRevenue],
          ["projectedNetIncome", projectedNetIncome],
          ["projectedOperatingCashFlow", projectedOcf],
          ["projectedCashCapex", projectedCapex],
          ["projectedFreeCashFlow", projectedFcf],
          ["enterpriseValueMultiple", valuationMultiple],
          ["valuationMetric", valuationMetric],
          ["modelImpliedEnterpriseValue", enterpriseValue],
        ].filter((entry): entry is [string, CanonicalMetricObject] => entry[1] !== null)
          .map(([field, metric]) => [field, metric.canonical_key]),
      ),
    };
  });
}
