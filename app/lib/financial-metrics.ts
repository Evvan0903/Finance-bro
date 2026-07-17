import {
  CanonicalMetricError,
  MetricRegistry,
  createCanonicalMetric,
} from "./canonical-metrics";
import type { CanonicalMetricObject, MetricQuery } from "./canonical-metrics";
import type { CompanyFactsPayload, CompanyFactEntry } from "./metric-locator-types";
import type { FinancialPeriod } from "./research-types";

const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"]);

type Concept = [taxonomy: string, concept: string];
type MetricConfig = {
  metricId: string;
  definitionId: string;
  duration: boolean;
  concepts: Concept[];
};
type SelectedFact = {
  value: number;
  unit: string;
  start?: string;
  end: string;
  filed: string;
  form: string;
  taxonomy: string;
  concept: string;
  label: string;
  description: string;
  accession: string;
  priority: number;
  durationDistance: number;
};

const FINANCIAL_METRICS: MetricConfig[] = [
  {
    metricId: "revenue",
    definitionId: "reported-revenue",
    duration: true,
    concepts: [
      ["us-gaap", "RevenueFromContractWithCustomerExcludingAssessedTax"],
      ["us-gaap", "Revenues"],
      ["us-gaap", "SalesRevenueNet"],
      ["ifrs-full", "Revenue"],
    ],
  },
  {
    metricId: "gross-profit",
    definitionId: "reported-gross-profit",
    duration: true,
    concepts: [["us-gaap", "GrossProfit"], ["ifrs-full", "GrossProfit"]],
  },
  {
    metricId: "net-income",
    definitionId: "reported-net-income",
    duration: true,
    concepts: [
      ["us-gaap", "NetIncomeLoss"],
      ["us-gaap", "ProfitLoss"],
      ["ifrs-full", "ProfitLossAttributableToOwnersOfParent"],
      ["ifrs-full", "ProfitLoss"],
    ],
  },
  {
    metricId: "operating-cash-flow",
    definitionId: "reported-operating-cash-flow",
    duration: true,
    concepts: [
      ["us-gaap", "NetCashProvidedByUsedInOperatingActivities"],
      ["us-gaap", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
      ["ifrs-full", "CashFlowsFromUsedInOperatingActivities"],
    ],
  },
  {
    metricId: "investing-cash-flow",
    definitionId: "reported-investing-cash-flow",
    duration: true,
    concepts: [
      ["us-gaap", "NetCashProvidedByUsedInInvestingActivities"],
      ["ifrs-full", "CashFlowsFromUsedInInvestingActivities"],
    ],
  },
  {
    metricId: "cash-capex",
    definitionId: "cash-purchases-property-plant-equipment",
    duration: true,
    concepts: [
      ["us-gaap", "PaymentsToAcquirePropertyPlantAndEquipment"],
      ["us-gaap", "PaymentsToAcquireProductiveAssets"],
      ["ifrs-full", "PurchaseOfPropertyPlantAndEquipment"],
    ],
  },
  {
    metricId: "assets",
    definitionId: "reported-total-assets",
    duration: false,
    concepts: [["us-gaap", "Assets"], ["ifrs-full", "Assets"]],
  },
  {
    metricId: "liabilities",
    definitionId: "reported-total-liabilities",
    duration: false,
    concepts: [["us-gaap", "Liabilities"], ["ifrs-full", "Liabilities"]],
  },
  {
    metricId: "equity",
    definitionId: "reported-equity",
    duration: false,
    concepts: [
      ["us-gaap", "StockholdersEquity"],
      ["us-gaap", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
      ["ifrs-full", "Equity"],
      ["ifrs-full", "EquityAttributableToOwnersOfParent"],
    ],
  },
  {
    metricId: "cash",
    definitionId: "reported-cash-and-equivalents",
    duration: false,
    concepts: [
      ["us-gaap", "CashAndCashEquivalentsAtCarryingValue"],
      ["us-gaap", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
      ["ifrs-full", "CashAndCashEquivalents"],
    ],
  },
  {
    metricId: "inventory",
    definitionId: "reported-inventory",
    duration: false,
    concepts: [["us-gaap", "InventoryNet"], ["ifrs-full", "Inventories"]],
  },
  {
    metricId: "current-assets",
    definitionId: "reported-current-assets",
    duration: false,
    concepts: [["us-gaap", "AssetsCurrent"], ["ifrs-full", "CurrentAssets"]],
  },
  {
    metricId: "current-liabilities",
    definitionId: "reported-current-liabilities",
    duration: false,
    concepts: [["us-gaap", "LiabilitiesCurrent"], ["ifrs-full", "CurrentLiabilities"]],
  },
  {
    metricId: "total-debt",
    definitionId: "reported-total-debt",
    duration: false,
    concepts: [
      ["us-gaap", "LongTermDebtAndFinanceLeaseObligations"],
      ["us-gaap", "LongTermDebtAndCapitalLeaseObligations"],
      ["ifrs-full", "Borrowings"],
    ],
  },
  {
    metricId: "current-debt",
    definitionId: "reported-current-debt",
    duration: false,
    concepts: [
      ["us-gaap", "LongTermDebtAndFinanceLeaseObligationsCurrent"],
      ["us-gaap", "ShortTermBorrowings"],
      ["ifrs-full", "CurrentBorrowings"],
    ],
  },
  {
    metricId: "noncurrent-debt",
    definitionId: "reported-noncurrent-debt",
    duration: false,
    concepts: [
      ["us-gaap", "LongTermDebtAndFinanceLeaseObligationsNoncurrent"],
      ["us-gaap", "LongTermDebtNoncurrent"],
      ["ifrs-full", "NoncurrentBorrowings"],
    ],
  },
];

export const FINANCIAL_DEFINITION_IDS = {
  revenue: "reported-revenue",
  grossProfit: "reported-gross-profit",
  netIncome: "reported-net-income",
  operatingCashFlow: "reported-operating-cash-flow",
  investingCashFlow: "reported-investing-cash-flow",
  cashCapex: "cash-purchases-property-plant-equipment",
  issuerCashCapex: "issuer-reported-cash-capex",
  freeCashFlow: "ocf-less-cash-capex",
  assets: "reported-total-assets",
  liabilities: "reported-total-liabilities",
  equity: "reported-equity",
  cash: "reported-cash-and-equivalents",
  inventory: "reported-inventory",
  currentAssets: "reported-current-assets",
  currentLiabilities: "reported-current-liabilities",
  totalDebt: "reported-total-debt",
  derivedTotalDebt: "current-plus-noncurrent-debt",
  issuerNetDebt: "issuer-reported-net-debt",
  normalizedNetDebt: "normalized-debt-less-cash",
  revenueGrowth: "year-over-year-revenue-growth",
  revenueCagr: "multi-period-revenue-cagr",
  netMargin: "net-income-over-revenue",
  netMarginChange: "year-over-year-net-margin-change",
  grossMargin: "gross-profit-over-revenue",
  operatingCashFlowMargin: "operating-cash-flow-over-revenue",
  freeCashFlowMargin: "free-cash-flow-over-revenue",
  cashConversion: "free-cash-flow-over-net-income",
  currentRatio: "current-assets-over-current-liabilities",
  liabilitiesAssets: "liabilities-over-assets",
} as const;

function selectFacts(
  facts: CompanyFactsPayload,
  config: MetricConfig,
) {
  const selected = new Map<string, SelectedFact>();
  config.concepts.forEach(([taxonomy, concept], priority) => {
    const fact = facts.facts[taxonomy]?.[concept];
    if (!fact?.units) return;
    for (const [unit, entries] of Object.entries(fact.units)) {
      for (const entry of entries) {
        if (!usableFact(entry, config.duration)) continue;
        const durationDistance = config.duration
          ? Math.abs(
              365 -
              (Date.parse(entry.end!) - Date.parse(entry.start!)) / 86_400_000,
            )
          : 0;
        const candidate: SelectedFact = {
          value: entry.val!,
          unit,
          start: entry.start,
          end: entry.end!,
          filed: entry.filed ?? "",
          form: entry.form!,
          taxonomy,
          concept,
          label: fact.label ?? concept,
          description: fact.description ?? fact.label ?? concept,
          accession: entry.accn ?? "",
          priority,
          durationDistance,
        };
        const existing = selected.get(candidate.end);
        if (
          !existing ||
          candidate.priority < existing.priority ||
          (
            candidate.priority === existing.priority &&
            candidate.durationDistance < existing.durationDistance
          ) ||
          (
            candidate.priority === existing.priority &&
            candidate.durationDistance === existing.durationDistance &&
            candidate.filed > existing.filed
          )
        ) selected.set(candidate.end, candidate);
      }
    }
  });
  return selected;
}

function usableFact(entry: CompanyFactEntry, duration: boolean) {
  if (
    !entry.end ||
    typeof entry.val !== "number" ||
    !Number.isFinite(entry.val) ||
    !entry.form ||
    !ANNUAL_FORMS.has(entry.form)
  ) return false;
  if (!duration) return !entry.start;
  if (!entry.start) return false;
  const days = (Date.parse(entry.end) - Date.parse(entry.start)) / 86_400_000;
  return Number.isFinite(days) && days >= 280 && days <= 430;
}

function sourceUrl(facts: CompanyFactsPayload) {
  return `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(facts.cik).padStart(10, "0")}.json`;
}

function periodLabel(periodEnd: string) {
  return `FY${periodEnd.slice(0, 4)}`;
}

export function buildFinancialMetricRegistry(input: {
  facts: CompanyFactsPayload;
  companyId: string;
  sector: string;
  dataVersion: string;
  retrievedAt: string;
}) {
  const registry = new MetricRegistry(input.dataVersion);
  for (const config of FINANCIAL_METRICS) {
    for (const fact of selectFacts(input.facts, config).values()) {
      registry.register(createCanonicalMetric({
        metric_id: config.metricId,
        company_id: input.companyId,
        sector: input.sector,
        period: periodLabel(fact.end),
        period_start: fact.start ?? null,
        period_end: fact.end,
        value: fact.value,
        unit: fact.unit,
        currency: /^[A-Z]{3}$/.test(fact.unit) ? fact.unit : null,
        status: "Reported",
        definition_id: config.definitionId,
        formula_id: null,
        formula: null,
        input_metric_keys: [],
        source_document: `SEC Company Facts — ${fact.form}`,
        source_url: sourceUrl(input.facts),
        source_type: "filing",
        source_date: fact.filed,
        filing_date: fact.filed,
        section: "Standardized XBRL facts",
        table: fact.taxonomy,
        row_label: fact.label,
        raw_value: String(fact.value),
        extraction_method: `deterministic-sec-xbrl:${fact.taxonomy}:${fact.concept}`,
        confidence: 0.99,
        retrieved_at: input.retrievedAt,
        data_version: input.dataVersion,
        calculation_version: registry.calculationVersion,
      }));
    }
  }
  ensureCoreDerivedMetrics(registry, input.companyId);
  return registry;
}

function optionalMetric(registry: MetricRegistry, query: MetricQuery) {
  try {
    return registry.getMetric(query);
  } catch (error) {
    if (error instanceof CanonicalMetricError && error.code === "METRIC_NOT_FOUND") return null;
    throw error;
  }
}

function firstDefinition(
  registry: MetricRegistry,
  companyId: string,
  metricId: string,
  periodEnd: string,
  definitionIds: string[],
) {
  for (const definitionId of definitionIds) {
    const metric = optionalMetric(registry, {
      company_id: companyId,
      metric_id: metricId,
      period_end: periodEnd,
      definition_id: definitionId,
    });
    if (metric) return metric;
  }
  return null;
}

function registerDerived(
  registry: MetricRegistry,
  input: {
    metricId: string;
    companyId: string;
    sector: string;
    period: string;
    periodEnd: string;
    definitionId: string;
    formulaId:
      | "add"
      | "subtract"
      | "divide"
      | "growth-rate"
      | "period-change"
      | "cagr";
    formula: string;
    inputs: CanonicalMetricObject[];
    unit: string;
    currency: string | null;
  },
) {
  const existing = optionalMetric(registry, {
    company_id: input.companyId,
    metric_id: input.metricId,
    period: input.period,
    definition_id: input.definitionId,
    unit: input.unit,
    currency: input.currency,
  });
  if (existing) return existing;
  return registry.calculateDerived({
    metric_id: input.metricId,
    company_id: input.companyId,
    sector: input.sector,
    period: input.period,
    period_end: input.periodEnd,
    definition_id: input.definitionId,
    formula_id: input.formulaId,
    formula: input.formula,
    input_metric_keys: input.inputs.map((metric) => metric.canonical_key),
    unit: input.unit,
    currency: input.currency,
  });
}

export function ensureCoreDerivedMetrics(
  registry: MetricRegistry,
  companyId: string,
) {
  const companyMetrics = registry.values().filter((metric) => metric.company_id === companyId);
  const periods = [...new Set(companyMetrics.map((metric) => metric.period_end))].sort();
  for (const periodEnd of periods) {
    const period = periodLabel(periodEnd);
    const sector = companyMetrics.find((metric) => metric.period_end === periodEnd)?.sector ?? "";
    const revenue = firstDefinition(
      registry,
      companyId,
      "revenue",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.revenue],
    );
    const grossProfit = firstDefinition(
      registry,
      companyId,
      "gross-profit",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.grossProfit],
    );
    const netIncome = firstDefinition(
      registry,
      companyId,
      "net-income",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.netIncome],
    );
    const operatingCashFlow = firstDefinition(
      registry,
      companyId,
      "operating-cash-flow",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.operatingCashFlow],
    );
    const cashCapex = firstDefinition(
      registry,
      companyId,
      "cash-capex",
      periodEnd,
      [
        FINANCIAL_DEFINITION_IDS.issuerCashCapex,
        FINANCIAL_DEFINITION_IDS.cashCapex,
      ],
    );
    const currentDebt = firstDefinition(
      registry,
      companyId,
      "current-debt",
      periodEnd,
      ["reported-current-debt"],
    );
    const noncurrentDebt = firstDefinition(
      registry,
      companyId,
      "noncurrent-debt",
      periodEnd,
      ["reported-noncurrent-debt"],
    );
    let totalDebt = firstDefinition(
      registry,
      companyId,
      "total-debt",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.totalDebt, FINANCIAL_DEFINITION_IDS.derivedTotalDebt],
    );
    if (!totalDebt && currentDebt && noncurrentDebt) {
      totalDebt = registerDerived(registry, {
        metricId: "total-debt",
        companyId,
        sector,
        period,
        periodEnd,
        definitionId: FINANCIAL_DEFINITION_IDS.derivedTotalDebt,
        formulaId: "add",
        formula: "current_debt + noncurrent_debt",
        inputs: [currentDebt, noncurrentDebt],
        unit: currentDebt.unit,
        currency: currentDebt.currency,
      });
    }
    const cash = firstDefinition(
      registry,
      companyId,
      "cash",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.cash],
    );
    const assets = firstDefinition(
      registry,
      companyId,
      "assets",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.assets],
    );
    const liabilities = firstDefinition(
      registry,
      companyId,
      "liabilities",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.liabilities],
    );
    const currentAssets = firstDefinition(
      registry,
      companyId,
      "current-assets",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.currentAssets],
    );
    const currentLiabilities = firstDefinition(
      registry,
      companyId,
      "current-liabilities",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.currentLiabilities],
    );
    const freeCashFlow = operatingCashFlow && cashCapex
      ? registerDerived(registry, {
          metricId: "fcf",
          companyId,
          sector,
          period,
          periodEnd,
          definitionId: FINANCIAL_DEFINITION_IDS.freeCashFlow,
          formulaId: "subtract",
          formula: "operating_cash_flow - cash_capex",
          inputs: [operatingCashFlow, cashCapex],
          unit: operatingCashFlow.unit,
          currency: operatingCashFlow.currency,
        })
      : null;
    if (totalDebt && cash) {
      registerDerived(registry, {
        metricId: "net-debt",
        companyId,
        sector,
        period,
        periodEnd,
        definitionId: FINANCIAL_DEFINITION_IDS.normalizedNetDebt,
        formulaId: "subtract",
        formula: "total_debt - cash_and_equivalents",
        inputs: [totalDebt, cash],
        unit: totalDebt.unit,
        currency: totalDebt.currency,
      });
    }
    for (const ratio of [
      {
        metricId: "net-margin",
        definitionId: FINANCIAL_DEFINITION_IDS.netMargin,
        numerator: netIncome,
        denominator: revenue,
        formula: "net_income / revenue",
      },
      {
        metricId: "gross-margin",
        definitionId: FINANCIAL_DEFINITION_IDS.grossMargin,
        numerator: grossProfit,
        denominator: revenue,
        formula: "gross_profit / revenue",
      },
      {
        metricId: "operating-cash-flow-margin",
        definitionId: FINANCIAL_DEFINITION_IDS.operatingCashFlowMargin,
        numerator: operatingCashFlow,
        denominator: revenue,
        formula: "operating_cash_flow / revenue",
      },
      {
        metricId: "fcf-margin",
        definitionId: FINANCIAL_DEFINITION_IDS.freeCashFlowMargin,
        numerator: freeCashFlow,
        denominator: revenue,
        formula: "free_cash_flow / revenue",
      },
      {
        metricId: "cash-conversion",
        definitionId: FINANCIAL_DEFINITION_IDS.cashConversion,
        numerator: freeCashFlow,
        denominator: netIncome,
        formula: "free_cash_flow / net_income",
      },
      {
        metricId: "current-ratio",
        definitionId: FINANCIAL_DEFINITION_IDS.currentRatio,
        numerator: currentAssets,
        denominator: currentLiabilities,
        formula: "current_assets / current_liabilities",
      },
      {
        metricId: "liabilities-assets",
        definitionId: FINANCIAL_DEFINITION_IDS.liabilitiesAssets,
        numerator: liabilities,
        denominator: assets,
        formula: "liabilities / assets",
      },
    ]) {
      if (ratio.numerator && ratio.denominator && ratio.denominator.value !== 0) {
        registerDerived(registry, {
          metricId: ratio.metricId,
          companyId,
          sector,
          period,
          periodEnd,
          definitionId: ratio.definitionId,
          formulaId: "divide",
          formula: ratio.formula,
          inputs: [ratio.numerator, ratio.denominator],
          unit: "ratio",
          currency: null,
        });
      }
    }
  }

  const revenues = registry.getMetricHistory(
    companyId,
    "revenue",
    FINANCIAL_DEFINITION_IDS.revenue,
  );
  for (let index = 1; index < revenues.length; index += 1) {
    const current = revenues[index];
    const prior = revenues[index - 1];
    registerDerived(registry, {
      metricId: "revenue-growth",
      companyId,
      sector: current.sector,
      period: current.period,
      periodEnd: current.period_end,
      definitionId: FINANCIAL_DEFINITION_IDS.revenueGrowth,
      formulaId: "growth-rate",
      formula: "current_revenue / prior_revenue - 1",
      inputs: [current, prior],
      unit: "ratio",
      currency: null,
    });
  }
  if (revenues.length >= 2) {
    const latest = revenues.at(-1)!;
    const earliest = revenues[0];
    registerDerived(registry, {
      metricId: "revenue-cagr",
      companyId,
      sector: latest.sector,
      period: latest.period,
      periodEnd: latest.period_end,
      definitionId: FINANCIAL_DEFINITION_IDS.revenueCagr,
      formulaId: "cagr",
      formula: "((latest_revenue / earliest_revenue) ^ (1 / elapsed_years)) - 1",
      inputs: [latest, earliest],
      unit: "ratio",
      currency: null,
    });
  }
  const netMargins = registry.getMetricHistory(
    companyId,
    "net-margin",
    FINANCIAL_DEFINITION_IDS.netMargin,
  );
  for (let index = 1; index < netMargins.length; index += 1) {
    const current = netMargins[index];
    const prior = netMargins[index - 1];
    registerDerived(registry, {
      metricId: "net-margin-change",
      companyId,
      sector: current.sector,
      period: current.period,
      periodEnd: current.period_end,
      definitionId: FINANCIAL_DEFINITION_IDS.netMarginChange,
      formulaId: "period-change",
      formula: "current_net_margin - prior_net_margin",
      inputs: [current, prior],
      unit: "ratio",
      currency: null,
    });
  }
  return registry;
}

function selectedMetric(
  registry: MetricRegistry,
  companyId: string,
  metricId: string,
  periodEnd: string,
  definitions: string[],
) {
  return firstDefinition(registry, companyId, metricId, periodEnd, definitions);
}

export function financialPeriodsFromRegistry(
  registry: MetricRegistry,
  companyId: string,
) {
  const anchorDates = registry
    .getMetricHistory(companyId, "revenue", FINANCIAL_DEFINITION_IDS.revenue)
    .map((metric) => metric.period_end)
    .slice(-5);
  const periods: FinancialPeriod[] = anchorDates.map((periodEnd) => {
    const selections = {
      revenue: selectedMetric(registry, companyId, "revenue", periodEnd, [FINANCIAL_DEFINITION_IDS.revenue]),
      grossProfit: selectedMetric(registry, companyId, "gross-profit", periodEnd, [FINANCIAL_DEFINITION_IDS.grossProfit]),
      netIncome: selectedMetric(registry, companyId, "net-income", periodEnd, [FINANCIAL_DEFINITION_IDS.netIncome]),
      operatingCashFlow: selectedMetric(registry, companyId, "operating-cash-flow", periodEnd, [FINANCIAL_DEFINITION_IDS.operatingCashFlow]),
      investingCashFlow: selectedMetric(registry, companyId, "investing-cash-flow", periodEnd, [FINANCIAL_DEFINITION_IDS.investingCashFlow]),
      cashCapex: selectedMetric(registry, companyId, "cash-capex", periodEnd, [FINANCIAL_DEFINITION_IDS.issuerCashCapex, FINANCIAL_DEFINITION_IDS.cashCapex]),
      freeCashFlowProxy: selectedMetric(registry, companyId, "fcf", periodEnd, [FINANCIAL_DEFINITION_IDS.freeCashFlow]),
      assets: selectedMetric(registry, companyId, "assets", periodEnd, [FINANCIAL_DEFINITION_IDS.assets]),
      liabilities: selectedMetric(registry, companyId, "liabilities", periodEnd, [FINANCIAL_DEFINITION_IDS.liabilities]),
      equity: selectedMetric(registry, companyId, "equity", periodEnd, [FINANCIAL_DEFINITION_IDS.equity]),
      cash: selectedMetric(registry, companyId, "cash", periodEnd, [FINANCIAL_DEFINITION_IDS.cash]),
      inventory: selectedMetric(registry, companyId, "inventory", periodEnd, [FINANCIAL_DEFINITION_IDS.inventory]),
      currentAssets: selectedMetric(registry, companyId, "current-assets", periodEnd, [FINANCIAL_DEFINITION_IDS.currentAssets]),
      currentLiabilities: selectedMetric(registry, companyId, "current-liabilities", periodEnd, [FINANCIAL_DEFINITION_IDS.currentLiabilities]),
      totalDebt: selectedMetric(registry, companyId, "total-debt", periodEnd, [FINANCIAL_DEFINITION_IDS.totalDebt, FINANCIAL_DEFINITION_IDS.derivedTotalDebt]),
      netDebt: selectedMetric(registry, companyId, "net-debt", periodEnd, [FINANCIAL_DEFINITION_IDS.issuerNetDebt, FINANCIAL_DEFINITION_IDS.normalizedNetDebt]),
      revenueGrowth: selectedMetric(registry, companyId, "revenue-growth", periodEnd, [FINANCIAL_DEFINITION_IDS.revenueGrowth]),
      revenueCagr: selectedMetric(registry, companyId, "revenue-cagr", periodEnd, [FINANCIAL_DEFINITION_IDS.revenueCagr]),
      netMargin: selectedMetric(registry, companyId, "net-margin", periodEnd, [FINANCIAL_DEFINITION_IDS.netMargin]),
      netMarginChange: selectedMetric(registry, companyId, "net-margin-change", periodEnd, [FINANCIAL_DEFINITION_IDS.netMarginChange]),
      grossMargin: selectedMetric(registry, companyId, "gross-margin", periodEnd, [FINANCIAL_DEFINITION_IDS.grossMargin]),
      operatingCashFlowMargin: selectedMetric(registry, companyId, "operating-cash-flow-margin", periodEnd, [FINANCIAL_DEFINITION_IDS.operatingCashFlowMargin]),
      freeCashFlowMargin: selectedMetric(registry, companyId, "fcf-margin", periodEnd, [FINANCIAL_DEFINITION_IDS.freeCashFlowMargin]),
      cashConversion: selectedMetric(registry, companyId, "cash-conversion", periodEnd, [FINANCIAL_DEFINITION_IDS.cashConversion]),
      currentRatio: selectedMetric(registry, companyId, "current-ratio", periodEnd, [FINANCIAL_DEFINITION_IDS.currentRatio]),
      liabilitiesAssets: selectedMetric(registry, companyId, "liabilities-assets", periodEnd, [FINANCIAL_DEFINITION_IDS.liabilitiesAssets]),
    };
    const value = (metric: CanonicalMetricObject | null) => metric?.value ?? null;
    return {
      periodEnd,
      revenue: value(selections.revenue),
      grossProfit: value(selections.grossProfit),
      netIncome: value(selections.netIncome),
      operatingCashFlow: value(selections.operatingCashFlow),
      investingCashFlow: value(selections.investingCashFlow),
      cashCapex: value(selections.cashCapex),
      freeCashFlowProxy: value(selections.freeCashFlowProxy),
      assets: value(selections.assets),
      liabilities: value(selections.liabilities),
      equity: value(selections.equity),
      cash: value(selections.cash),
      inventory: value(selections.inventory),
      currentAssets: value(selections.currentAssets),
      currentLiabilities: value(selections.currentLiabilities),
      totalDebt: value(selections.totalDebt),
      netDebt: value(selections.netDebt),
      revenueGrowth: value(selections.revenueGrowth),
      revenueCagr: value(selections.revenueCagr),
      netMargin: value(selections.netMargin),
      netMarginChange: value(selections.netMarginChange),
      grossMargin: value(selections.grossMargin),
      operatingCashFlowMargin: value(selections.operatingCashFlowMargin),
      freeCashFlowMargin: value(selections.freeCashFlowMargin),
      cashConversion: value(selections.cashConversion),
      currentRatio: value(selections.currentRatio),
      liabilitiesAssets: value(selections.liabilitiesAssets),
      metricKeys: Object.fromEntries(
        Object.entries(selections)
          .filter((entry): entry is [string, CanonicalMetricObject] => entry[1] !== null)
          .map(([field, metric]) => [field, metric.canonical_key]),
      ),
    };
  });
  const currency = registry.getMetricHistory(
    companyId,
    "revenue",
    FINANCIAL_DEFINITION_IDS.revenue,
  ).at(-1)?.currency ?? "USD";
  return { periods, currency };
}
