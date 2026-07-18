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
  equityValue: "scenario-model-implied-equity-value",
  pricePerShare: "scenario-model-implied-price-per-share",
  priceToEarnings: "scenario-implied-price-to-earnings",
  dividendYield: "scenario-implied-dividend-yield",
  costOfEquity: "scenario-cost-of-equity-assumption",
  rotceSpread: "scenario-rotce-less-cost-of-equity",
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
  formulaId: "multiply" | "divide" | "scale" | "subtract" | "growth-projection";
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

function buildBankScenarios(input: {
  registry: MetricRegistry;
  companyId: string;
  latest: FinancialPeriod;
  pack: SectorPack;
  locale: ResearchLocale;
}) {
  const tangibleBook = optionalMetric(
    input.registry,
    input.companyId,
    "tangible-book-value",
    input.latest.periodEnd,
    FINANCIAL_DEFINITION_IDS.tangibleBookValue,
  );
  if (!tangibleBook) return [];
  const tangibleBookPerShare = optionalMetric(
    input.registry,
    input.companyId,
    "tangible-book-value-per-share",
    input.latest.periodEnd,
    FINANCIAL_DEFINITION_IDS.tangibleBookValuePerShare,
  );
  const netIncome = optionalMetric(
    input.registry,
    input.companyId,
    "net-income",
    input.latest.periodEnd,
    FINANCIAL_DEFINITION_IDS.netIncome,
  );
  const dividends = optionalMetric(
    input.registry,
    input.companyId,
    "dividends",
    input.latest.periodEnd,
    FINANCIAL_DEFINITION_IDS.dividends,
  );
  const rotce = optionalMetric(
    input.registry,
    input.companyId,
    "return-on-tangible-common-equity",
    input.latest.periodEnd,
    FINANCIAL_DEFINITION_IDS.returnOnTangibleCommonEquity,
  );
  const nextYear = Number(input.latest.periodEnd.slice(0, 4)) + 1;
  const forecastEnd = `${nextYear}-12-31`;
  const scenarioContext = {
    registry: input.registry,
    companyId: input.companyId,
    sector: input.pack.id,
  };
  const assumptions = [
    { name: "Bear" as const, growth: -0.05, multiple: input.pack.valuation.multiples.bear },
    { name: "Base" as const, growth: 0.03, multiple: input.pack.valuation.multiples.base },
    { name: "Bull" as const, growth: 0.08, multiple: input.pack.valuation.multiples.bull },
  ];
  return assumptions.map((assumption): Scenario => {
    const period = `FY${nextYear}E-${assumption.name}`;
    const tangibleBookGrowth = registerAssumption({
      ...scenarioContext,
      scenario: assumption.name,
      period,
      periodEnd: forecastEnd,
      metricId: "scenario-tangible-book-growth",
      definitionId: "scenario-tangible-book-growth-assumption",
      value: assumption.growth,
      unit: "ratio",
      currency: null,
      formula: "Explicit tangible-book growth assumption constrained by earnings and capital risk",
      inputs: [tangibleBook],
    });
    const valuationMultiple = registerAssumption({
      ...scenarioContext,
      scenario: assumption.name,
      period,
      periodEnd: forecastEnd,
      metricId: "scenario-valuation-multiple",
      definitionId: SCENARIO_DEFINITIONS.valuationMultiple,
      value: assumption.multiple,
      unit: input.pack.valuation.multipleLabel,
      currency: null,
      formula: `Explicit ${input.pack.valuation.multipleLabel} scenario multiple`,
      inputs: [tangibleBook],
    });
    const costOfEquity = registerAssumption({
      ...scenarioContext,
      scenario: assumption.name,
      period,
      periodEnd: forecastEnd,
      metricId: "scenario-cost-of-equity",
      definitionId: SCENARIO_DEFINITIONS.costOfEquity,
      value: 0.1,
      unit: "ratio",
      currency: null,
      formula: "Explicit analyst cost-of-equity assumption used only as a ROTCE cross-check",
      inputs: rotce ? [rotce] : [tangibleBook],
    });
    const scenarioNetIncome = netIncome
      ? registerAssumption({
          ...scenarioContext,
          scenario: assumption.name,
          period,
          periodEnd: forecastEnd,
          metricId: "scenario-net-income",
          definitionId: "scenario-latest-net-income-roll-forward",
          value: netIncome.value!,
          unit: netIncome.unit,
          currency: netIncome.currency,
          formula: "Latest annual net income held flat solely for the P/E cross-check",
          inputs: [netIncome],
        })
      : null;
    const scenarioDividends = dividends
      ? registerAssumption({
          ...scenarioContext,
          scenario: assumption.name,
          period,
          periodEnd: forecastEnd,
          metricId: "scenario-cash-dividends",
          definitionId: "scenario-latest-cash-dividends-roll-forward",
          value: dividends.value!,
          unit: dividends.unit,
          currency: dividends.currency,
          formula: "Latest annual cash dividends held flat solely for the dividend-yield cross-check",
          inputs: [dividends],
        })
      : null;
    const scenarioRotce = rotce
      ? registerAssumption({
          ...scenarioContext,
          scenario: assumption.name,
          period,
          periodEnd: forecastEnd,
          metricId: "scenario-rotce",
          definitionId: "scenario-latest-rotce-roll-forward",
          value: rotce.value!,
          unit: rotce.unit,
          currency: null,
          formula: "Latest issuer-reported ROTCE held flat solely for the cost-of-equity cross-check",
          inputs: [rotce],
        })
      : null;
    const projectedTangibleBook = calculate({
      ...scenarioContext,
      scenario: assumption.name,
      period,
      periodEnd: forecastEnd,
      metricId: "scenario-tangible-book-value",
      definitionId: SCENARIO_DEFINITIONS.valuationMetric,
      formulaId: "growth-projection",
      formula: "latest_tangible_book_value * (1 + scenario_tangible_book_growth)",
      inputs: [tangibleBook, tangibleBookGrowth],
      unit: tangibleBook.unit,
      currency: tangibleBook.currency,
    });
    const equityValue = calculate({
      ...scenarioContext,
      scenario: assumption.name,
      period,
      periodEnd: forecastEnd,
      metricId: "model-implied-equity-value",
      definitionId: SCENARIO_DEFINITIONS.equityValue,
      formulaId: "scale",
      formula: "scenario_tangible_book_value * assumed_price_to_tangible_book_multiple",
      inputs: [projectedTangibleBook, valuationMultiple],
      unit: tangibleBook.unit,
      currency: tangibleBook.currency,
    });
    const projectedTangibleBookPerShare = tangibleBookPerShare
      ? calculate({
          ...scenarioContext,
          scenario: assumption.name,
          period,
          periodEnd: forecastEnd,
          metricId: "scenario-tangible-book-value-per-share",
          definitionId: SCENARIO_DEFINITIONS.pricePerShare,
          formulaId: "growth-projection",
          formula: "latest_tangible_book_value_per_share * (1 + scenario_tangible_book_growth)",
          inputs: [tangibleBookPerShare, tangibleBookGrowth],
          unit: tangibleBookPerShare.unit,
          currency: tangibleBookPerShare.currency,
        })
      : null;
    const impliedPricePerShare = projectedTangibleBookPerShare
      ? calculate({
          ...scenarioContext,
          scenario: assumption.name,
          period,
          periodEnd: forecastEnd,
          metricId: "model-implied-price-per-share",
          definitionId: SCENARIO_DEFINITIONS.pricePerShare,
          formulaId: "scale",
          formula: "scenario_tangible_book_value_per_share * assumed_price_to_tangible_book_multiple",
          inputs: [projectedTangibleBookPerShare, valuationMultiple],
          unit: projectedTangibleBookPerShare.unit,
          currency: projectedTangibleBookPerShare.currency,
        })
      : null;
    const impliedPriceToEarnings = scenarioNetIncome && scenarioNetIncome.value! > 0
      ? calculate({
          ...scenarioContext,
          scenario: assumption.name,
          period,
          periodEnd: forecastEnd,
          metricId: "scenario-implied-price-to-earnings",
          definitionId: SCENARIO_DEFINITIONS.priceToEarnings,
          formulaId: "divide",
          formula: "model_implied_equity_value / latest_reported_net_income",
          inputs: [equityValue, scenarioNetIncome],
          unit: "x",
          currency: null,
        })
      : null;
    const impliedDividendYield = scenarioDividends && equityValue.value! > 0
      ? calculate({
          ...scenarioContext,
          scenario: assumption.name,
          period,
          periodEnd: forecastEnd,
          metricId: "scenario-implied-cash-dividend-yield",
          definitionId: SCENARIO_DEFINITIONS.dividendYield,
          formulaId: "divide",
          formula: "latest_cash_dividends / model_implied_equity_value",
          inputs: [scenarioDividends, equityValue],
          unit: "ratio",
          currency: null,
        })
      : null;
    const rotceSpread = scenarioRotce
      ? calculate({
          ...scenarioContext,
          scenario: assumption.name,
          period,
          periodEnd: forecastEnd,
          metricId: "scenario-rotce-less-cost-of-equity",
          definitionId: SCENARIO_DEFINITIONS.rotceSpread,
          formulaId: "subtract",
          formula: "issuer_reported_rotce - analyst_cost_of_equity_assumption",
          inputs: [scenarioRotce, costOfEquity],
          unit: "ratio",
          currency: null,
        })
      : null;
    return {
      name: assumption.name,
      revenueGrowth: tangibleBookGrowth.value,
      netMargin: null,
      operatingCashFlowMargin: null,
      capexFactor: null,
      projectedRevenue: null,
      projectedNetIncome: null,
      projectedFreeCashFlow: null,
      enterpriseValueMultiple: valuationMultiple.value!,
      valuationMethod: input.pack.valuation.method[input.locale],
      valuationStartingPoint: tangibleBook.value,
      valuationMetric: projectedTangibleBook.value,
      multipleLabel: input.pack.valuation.multipleLabel,
      impliedValueLabel:
        input.locale === "zh" ? "模型隐含股权价值" : "Model-implied equity value",
      modelImpliedEnterpriseValue: equityValue.value,
      netDebtAdjustment: null,
      modelImpliedEquityValue: equityValue.value,
      dilutedShares: null,
      impliedPricePerShare: impliedPricePerShare?.value ?? null,
      impliedPriceToEarnings: impliedPriceToEarnings?.value ?? null,
      impliedDividendYield: impliedDividendYield?.value ?? null,
      costOfEquityAssumption: costOfEquity.value,
      rotceCostOfEquitySpread: rotceSpread?.value ?? null,
      metricReferences: {
        revenueGrowth: tangibleBookGrowth.canonical_key,
        enterpriseValueMultiple: valuationMultiple.canonical_key,
        valuationStartingPoint: tangibleBook.canonical_key,
        valuationMetric: projectedTangibleBook.canonical_key,
        modelImpliedEnterpriseValue: equityValue.canonical_key,
        modelImpliedEquityValue: equityValue.canonical_key,
        ...(impliedPricePerShare ? { impliedPricePerShare: impliedPricePerShare.canonical_key } : {}),
        ...(impliedPriceToEarnings ? { impliedPriceToEarnings: impliedPriceToEarnings.canonical_key } : {}),
        ...(impliedDividendYield ? { impliedDividendYield: impliedDividendYield.canonical_key } : {}),
        costOfEquityAssumption: costOfEquity.canonical_key,
        ...(rotceSpread ? { rotceCostOfEquitySpread: rotceSpread.canonical_key } : {}),
      },
    };
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
  if (input.pack.id === "banks") {
    return buildBankScenarios({
      ...input,
      latest,
    });
  }
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
  const latestOperatingCashFlow = optionalMetric(
    input.registry,
    input.companyId,
    "operating-cash-flow",
    latest.periodEnd,
    FINANCIAL_DEFINITION_IDS.operatingCashFlow,
  );
  const latestFreeCashFlow = optionalMetric(
    input.registry,
    input.companyId,
    "fcf",
    latest.periodEnd,
    FINANCIAL_DEFINITION_IDS.freeCashFlow,
  );
  const latestNetDebt = latest.metricKeys.netDebt
    ? input.registry.getByKey(latest.metricKeys.netDebt) ?? null
    : null;
  const dilutedShares = input.pack.id === "biopharma"
    ? optionalMetric(
        input.registry,
        input.companyId,
        "diluted-shares",
        latest.periodEnd,
        "issuer-reported-weighted-average-diluted-shares",
      )
    : null;
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
  const valuationStartingMetric =
    framework.metric === "revenue"
      ? latestRevenue
      : framework.metric === "operatingCashFlow"
        ? latestOperatingCashFlow
        : latestFreeCashFlow;
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
    const scenarioNetDebt =
      input.pack.id === "biopharma" && latestNetDebt
        ? registerAssumption({
            ...scenarioContext,
            scenario: assumption.name,
            period,
            periodEnd: forecastEnd,
            metricId: "scenario-net-debt-adjustment",
            definitionId: "scenario-latest-net-debt-roll-forward",
            value: latestNetDebt.value!,
            unit: latestNetDebt.unit,
            currency: latestNetDebt.currency,
            formula: "Latest annual net debt held flat solely for the enterprise-to-equity bridge",
            inputs: [latestNetDebt],
          })
        : null;
    const scenarioDilutedShares =
      input.pack.id === "biopharma" && dilutedShares
        ? registerAssumption({
            ...scenarioContext,
            scenario: assumption.name,
            period,
            periodEnd: forecastEnd,
            metricId: "scenario-diluted-shares",
            definitionId: "scenario-latest-diluted-shares-roll-forward",
            value: dilutedShares.value!,
            unit: dilutedShares.unit,
            currency: dilutedShares.currency,
            formula: "FY2025 diluted shares held flat solely for the model value-per-share bridge",
            inputs: [dilutedShares],
          })
        : null;
    const equityValue =
      input.pack.id === "biopharma" && enterpriseValue && scenarioNetDebt
        ? calculate({
            ...scenarioContext,
            scenario: assumption.name,
            period,
            periodEnd: forecastEnd,
            metricId: "model-implied-equity-value",
            definitionId: SCENARIO_DEFINITIONS.equityValue,
            formulaId: "subtract",
            formula: "model_implied_enterprise_value - latest_net_debt",
            inputs: [enterpriseValue, scenarioNetDebt],
            unit: enterpriseValue.unit,
            currency: enterpriseValue.currency,
          })
        : null;
    const impliedPricePerShare =
      equityValue && scenarioDilutedShares
        ? calculate({
            ...scenarioContext,
            scenario: assumption.name,
            period,
            periodEnd: forecastEnd,
            metricId: "model-implied-price-per-share",
            definitionId: SCENARIO_DEFINITIONS.pricePerShare,
            formulaId: "divide",
            formula: "model_implied_equity_value / latest_diluted_shares",
            inputs: [equityValue, scenarioDilutedShares],
            unit: "USD/share",
            currency: "USD",
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
      valuationStartingPoint: valuationStartingMetric?.value ?? null,
      valuationMetric: valuationMetric?.value ?? null,
      multipleLabel: framework.multipleLabel,
      impliedValueLabel:
        input.locale === "zh" ? "模型隐含企业价值" : "Model-implied enterprise value",
      modelImpliedEnterpriseValue: enterpriseValue?.value ?? null,
      netDebtAdjustment: scenarioNetDebt?.value ?? null,
      modelImpliedEquityValue: equityValue?.value ?? null,
      dilutedShares: scenarioDilutedShares?.value ?? null,
      impliedPricePerShare: impliedPricePerShare?.value ?? null,
      impliedPriceToEarnings: null,
      impliedDividendYield: null,
      costOfEquityAssumption: null,
      rotceCostOfEquitySpread: null,
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
          ["valuationStartingPoint", valuationStartingMetric],
          ["valuationMetric", valuationMetric],
          ["modelImpliedEnterpriseValue", enterpriseValue],
          ["netDebtAdjustment", scenarioNetDebt],
          ["modelImpliedEquityValue", equityValue],
          ["dilutedShares", scenarioDilutedShares],
          ["impliedPricePerShare", impliedPricePerShare],
        ].filter((entry): entry is [string, CanonicalMetricObject] => entry[1] !== null)
          .map(([field, metric]) => [field, metric.canonical_key]),
      ),
    };
  });
}
