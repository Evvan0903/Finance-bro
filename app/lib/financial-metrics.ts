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

export type IssuerReportedMetric = {
  metricId: string;
  definitionId: string;
  period: string;
  periodStart: string | null;
  periodEnd: string;
  value: number;
  unit: string;
  currency: string | null;
  sourceDocument: string;
  sourceUrl: string;
  sourceDate: string;
  filingDate: string;
  section: string;
  table: string;
  rowLabel: string;
  rawValue: string;
  extractionMethod: string;
  confidence: number;
};

const FINANCIAL_METRICS: MetricConfig[] = [
  {
    metricId: "revenue",
    definitionId: "reported-revenue",
    duration: true,
    concepts: [
      ["us-gaap", "RevenueFromContractWithCustomerExcludingAssessedTax"],
      ["us-gaap", "Revenues"],
      ["us-gaap", "RevenuesNetOfInterestExpense"],
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
    metricId: "cost-of-revenue",
    definitionId: "reported-cost-of-revenue",
    duration: true,
    concepts: [
      ["us-gaap", "CostOfGoodsAndServicesSold"],
      ["us-gaap", "CostOfGoodsSold"],
      ["ifrs-full", "CostOfSales"],
    ],
  },
  {
    metricId: "research-and-development",
    definitionId: "reported-research-and-development-expense",
    duration: true,
    concepts: [
      ["us-gaap", "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost"],
      ["us-gaap", "ResearchAndDevelopmentExpense"],
      ["ifrs-full", "ResearchAndDevelopmentExpense"],
    ],
  },
  {
    metricId: "operating-income",
    definitionId: "reported-operating-income",
    duration: true,
    concepts: [["us-gaap", "OperatingIncomeLoss"], ["ifrs-full", "ProfitLossFromOperatingActivities"]],
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
    metricId: "net-interest-income",
    definitionId: "reported-net-interest-income",
    duration: true,
    concepts: [["us-gaap", "InterestIncomeExpenseNet"]],
  },
  {
    metricId: "noninterest-expense",
    definitionId: "reported-noninterest-expense",
    duration: true,
    concepts: [["us-gaap", "NoninterestExpense"]],
  },
  {
    metricId: "credit-loss-provision",
    definitionId: "reported-credit-loss-provision",
    duration: true,
    concepts: [
      ["us-gaap", "ProvisionForLoanLeaseAndOtherLosses"],
      ["us-gaap", "ProvisionForLoanAndLeaseLosses"],
      ["us-gaap", "ProvisionForLoanLossesExpensed"],
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
    metricId: "deposits",
    definitionId: "reported-deposits",
    duration: false,
    concepts: [["us-gaap", "Deposits"]],
  },
  {
    metricId: "loans",
    definitionId: "reported-net-loans",
    duration: false,
    concepts: [
      ["us-gaap", "LoansAndLeasesReceivableNetReportedAmount"],
      ["us-gaap", "FinancingReceivableExcludingAccruedInterestAfterAllowanceForCreditLoss"],
      ["us-gaap", "LoansReceivableNet"],
    ],
  },
  {
    metricId: "credit-loss-allowance",
    definitionId: "reported-credit-loss-allowance",
    duration: false,
    concepts: [
      ["us-gaap", "FinancingReceivableAllowanceForCreditLossExcludingAccruedInterest"],
      ["us-gaap", "FinancingReceivableAllowanceForCreditLosses"],
      ["us-gaap", "LoansAndLeasesReceivableAllowance"],
    ],
  },
  {
    metricId: "goodwill",
    definitionId: "reported-goodwill",
    duration: false,
    concepts: [["us-gaap", "Goodwill"]],
  },
  {
    metricId: "intangible-assets",
    definitionId: "reported-finite-lived-intangible-assets",
    duration: false,
    concepts: [
      ["us-gaap", "FiniteLivedIntangibleAssetsNet"],
      ["us-gaap", "OtherIntangibleAssetsNet"],
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
  {
    metricId: "dividends",
    definitionId: "reported-cash-dividends",
    duration: true,
    concepts: [["us-gaap", "PaymentsOfDividends"]],
  },
  {
    metricId: "share-buybacks",
    definitionId: "reported-common-share-buybacks",
    duration: true,
    concepts: [["us-gaap", "PaymentsForRepurchaseOfCommonStock"]],
  },
];

export const FINANCIAL_DEFINITION_IDS = {
  revenue: "reported-revenue",
  grossProfit: "reported-gross-profit",
  derivedGrossProfit: "revenue-less-cost-of-revenue",
  costOfRevenue: "reported-cost-of-revenue",
  researchAndDevelopment: "reported-research-and-development-expense",
  operatingIncome: "reported-operating-income",
  netIncome: "reported-net-income",
  netInterestIncome: "reported-net-interest-income",
  noninterestExpense: "reported-noninterest-expense",
  creditLossProvision: "reported-credit-loss-provision",
  operatingCashFlow: "reported-operating-cash-flow",
  investingCashFlow: "reported-investing-cash-flow",
  cashCapex: "cash-purchases-property-plant-equipment",
  issuerCashCapex: "issuer-reported-cash-capex",
  freeCashFlow: "ocf-less-cash-capex",
  assets: "reported-total-assets",
  liabilities: "reported-total-liabilities",
  equity: "reported-equity",
  cash: "reported-cash-and-equivalents",
  deposits: "reported-deposits",
  depositCost: "issuer-reported-total-deposit-average-interest-rate",
  loans: "reported-net-loans",
  netChargeOffs: "issuer-reported-net-charge-offs",
  creditLossAllowance: "reported-credit-loss-allowance",
  goodwill: "reported-goodwill",
  intangibleAssets: "reported-finite-lived-intangible-assets",
  dividends: "reported-cash-dividends",
  shareBuybacks: "reported-common-share-buybacks",
  loanGrowth: "year-over-year-loan-growth",
  allowanceCoverage: "allowance-over-loans",
  efficiencyRatio: "noninterest-expense-over-net-revenue",
  roeProxy: "net-income-over-period-end-equity",
  equityLessGoodwill: "equity-less-goodwill",
  tangibleBookValue: "equity-less-goodwill-and-intangibles",
  capitalReturns: "dividends-plus-share-buybacks",
  netInterestMargin: "firmwide-net-yield-on-average-interest-earning-assets-managed-basis",
  cet1Ratio: "standardized-cet1-capital-ratio",
  liquidityCoverageRatio: "firm-average-liquidity-coverage-ratio",
  returnOnCommonEquity: "issuer-reported-return-on-common-equity",
  returnOnTangibleCommonEquity: "issuer-reported-return-on-tangible-common-equity",
  tangibleBookValuePerShare: "issuer-reported-tangible-book-value-per-share",
  investmentBankingFees: "issuer-reported-investment-banking-fees",
  tradingRevenue: "issuer-reported-markets-revenue",
  inventory: "reported-inventory",
  currentAssets: "reported-current-assets",
  currentLiabilities: "reported-current-liabilities",
  workingCapital: "current-assets-less-current-liabilities",
  totalDebt: "reported-total-debt",
  derivedTotalDebt: "current-plus-noncurrent-debt",
  issuerNetDebt: "issuer-reported-net-debt",
  normalizedNetDebt: "normalized-debt-less-cash",
  revenueGrowth: "year-over-year-revenue-growth",
  revenueCagr: "multi-period-revenue-cagr",
  netMargin: "net-income-over-revenue",
  netMarginChange: "year-over-year-net-margin-change",
  grossMargin: "gross-profit-over-revenue",
  operatingMargin: "operating-income-over-revenue",
  operatingCashFlowMargin: "operating-cash-flow-over-revenue",
  freeCashFlowMargin: "free-cash-flow-over-revenue",
  cashConversion: "free-cash-flow-over-net-income",
  currentRatio: "current-assets-over-current-liabilities",
  liabilitiesAssets: "liabilities-over-assets",
  priceCostImpact: "price-realization-plus-manufacturing-cost-impact",
  nearTermBacklogShare: "near-term-backlog-over-total-backlog",
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
  issuerReportedMetrics?: IssuerReportedMetric[];
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
  for (const metric of input.issuerReportedMetrics ?? []) {
    registry.register(createCanonicalMetric({
      metric_id: metric.metricId,
      company_id: input.companyId,
      sector: input.sector,
      period: metric.period,
      period_start: metric.periodStart,
      period_end: metric.periodEnd,
      value: metric.value,
      unit: metric.unit,
      currency: metric.currency,
      status: "Reported",
      definition_id: metric.definitionId,
      formula_id: null,
      formula: null,
      input_metric_keys: [],
      source_document: metric.sourceDocument,
      source_url: metric.sourceUrl,
      source_type: "filing",
      source_date: metric.sourceDate,
      filing_date: metric.filingDate,
      section: metric.section,
      table: metric.table,
      row_label: metric.rowLabel,
      raw_value: metric.rawValue,
      extraction_method: metric.extractionMethod,
      confidence: metric.confidence,
      retrieved_at: input.retrievedAt,
      data_version: input.dataVersion,
      calculation_version: registry.calculationVersion,
    }));
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
    const isBank = sector === "banks";
    const revenue = firstDefinition(
      registry,
      companyId,
      "revenue",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.revenue],
    );
    let grossProfit = firstDefinition(
      registry,
      companyId,
      "gross-profit",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.grossProfit],
    );
    const costOfRevenue = firstDefinition(
      registry,
      companyId,
      "cost-of-revenue",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.costOfRevenue],
    );
    const costOfRevenueRatio =
      typeof revenue?.value === "number" &&
      revenue.value !== 0 &&
      typeof costOfRevenue?.value === "number"
        ? Math.abs(costOfRevenue.value / revenue.value)
        : null;
    const costOfRevenueSupportsConsolidatedGrossProfit =
      costOfRevenueRatio !== null &&
      costOfRevenueRatio >= 0.01 &&
      costOfRevenueRatio <= 1.5;
    if (
      !grossProfit &&
      revenue &&
      costOfRevenue &&
      costOfRevenueSupportsConsolidatedGrossProfit
    ) {
      grossProfit = registerDerived(registry, {
        metricId: "gross-profit",
        companyId,
        sector,
        period,
        periodEnd,
        definitionId: FINANCIAL_DEFINITION_IDS.derivedGrossProfit,
        formulaId: "subtract",
        formula: "revenue - cost_of_revenue",
        inputs: [revenue, costOfRevenue],
        unit: revenue.unit,
        currency: revenue.currency,
      });
    }
    const operatingIncome = firstDefinition(
      registry,
      companyId,
      "operating-income",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.operatingIncome],
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
    const backlog = firstDefinition(
      registry,
      companyId,
      "backlog",
      periodEnd,
      ["issuer-reported-firm-order-backlog"],
    );
    const nearTermBacklog = firstDefinition(
      registry,
      companyId,
      "near-term-backlog",
      periodEnd,
      ["issuer-reported-backlog-expected-within-one-year"],
    );
    const priceRealizationImpact = firstDefinition(
      registry,
      companyId,
      "price-realization-impact",
      periodEnd,
      ["issuer-reported-full-year-price-realization-impact"],
    );
    const manufacturingCostImpact = firstDefinition(
      registry,
      companyId,
      "manufacturing-cost-impact",
      periodEnd,
      ["issuer-reported-full-year-manufacturing-cost-impact"],
    );
    const loans = firstDefinition(
      registry,
      companyId,
      "loans",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.loans],
    );
    const creditLossAllowance = firstDefinition(
      registry,
      companyId,
      "credit-loss-allowance",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.creditLossAllowance],
    );
    const noninterestExpense = firstDefinition(
      registry,
      companyId,
      "noninterest-expense",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.noninterestExpense],
    );
    const equity = firstDefinition(
      registry,
      companyId,
      "equity",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.equity],
    );
    const goodwill = firstDefinition(
      registry,
      companyId,
      "goodwill",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.goodwill],
    );
    const intangibleAssets = firstDefinition(
      registry,
      companyId,
      "intangible-assets",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.intangibleAssets],
    );
    const dividends = firstDefinition(
      registry,
      companyId,
      "dividends",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.dividends],
    );
    const shareBuybacks = firstDefinition(
      registry,
      companyId,
      "share-buybacks",
      periodEnd,
      [FINANCIAL_DEFINITION_IDS.shareBuybacks],
    );
    const freeCashFlow = !isBank && operatingCashFlow && cashCapex
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
    if (currentAssets && currentLiabilities) {
      registerDerived(registry, {
        metricId: "working-capital",
        companyId,
        sector,
        period,
        periodEnd,
        definitionId: FINANCIAL_DEFINITION_IDS.workingCapital,
        formulaId: "subtract",
        formula: "current_assets - current_liabilities",
        inputs: [currentAssets, currentLiabilities],
        unit: currentAssets.unit,
        currency: currentAssets.currency,
      });
    }
    if (priceRealizationImpact && manufacturingCostImpact) {
      registerDerived(registry, {
        metricId: "price-cost-impact",
        companyId,
        sector,
        period,
        periodEnd,
        definitionId: FINANCIAL_DEFINITION_IDS.priceCostImpact,
        formulaId: "add",
        formula: "price_realization_impact + manufacturing_cost_impact",
        inputs: [priceRealizationImpact, manufacturingCostImpact],
        unit: priceRealizationImpact.unit,
        currency: priceRealizationImpact.currency,
      });
    }
    if (nearTermBacklog && backlog && backlog.value !== 0) {
      registerDerived(registry, {
        metricId: "near-term-backlog-share",
        companyId,
        sector,
        period,
        periodEnd,
        definitionId: FINANCIAL_DEFINITION_IDS.nearTermBacklogShare,
        formulaId: "divide",
        formula: "near_term_backlog / total_firm_backlog",
        inputs: [nearTermBacklog, backlog],
        unit: "ratio",
        currency: null,
      });
    }
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
    const equityLessGoodwill = equity && goodwill
      ? registerDerived(registry, {
          metricId: "equity-less-goodwill",
          companyId,
          sector,
          period,
          periodEnd,
          definitionId: FINANCIAL_DEFINITION_IDS.equityLessGoodwill,
          formulaId: "subtract",
          formula: "stockholders_equity - goodwill",
          inputs: [equity, goodwill],
          unit: equity.unit,
          currency: equity.currency,
        })
      : null;
    if (equityLessGoodwill && intangibleAssets) {
      registerDerived(registry, {
        metricId: "tangible-book-value",
        companyId,
        sector,
        period,
        periodEnd,
        definitionId: FINANCIAL_DEFINITION_IDS.tangibleBookValue,
        formulaId: "subtract",
        formula: "equity_less_goodwill - finite_lived_intangible_assets",
        inputs: [equityLessGoodwill, intangibleAssets],
        unit: equity.unit,
        currency: equity.currency,
      });
    }
    if (dividends && shareBuybacks) {
      registerDerived(registry, {
        metricId: "capital-returns",
        companyId,
        sector,
        period,
        periodEnd,
        definitionId: FINANCIAL_DEFINITION_IDS.capitalReturns,
        formulaId: "add",
        formula: "cash_dividends + common_share_buybacks",
        inputs: [dividends, shareBuybacks],
        unit: dividends.unit,
        currency: dividends.currency,
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
        metricId: "operating-margin",
        definitionId: FINANCIAL_DEFINITION_IDS.operatingMargin,
        numerator: operatingIncome,
        denominator: revenue,
        formula: "operating_income / revenue",
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
      {
        metricId: "allowance-coverage",
        definitionId: FINANCIAL_DEFINITION_IDS.allowanceCoverage,
        numerator: creditLossAllowance,
        denominator: loans,
        formula: "credit_loss_allowance / net_loans",
      },
      {
        metricId: "efficiency-ratio",
        definitionId: FINANCIAL_DEFINITION_IDS.efficiencyRatio,
        numerator: noninterestExpense,
        denominator: revenue,
        formula: "noninterest_expense / net_revenue",
      },
      {
        metricId: "roe-proxy",
        definitionId: FINANCIAL_DEFINITION_IDS.roeProxy,
        numerator: netIncome,
        denominator: equity,
        formula: "net_income / period_end_stockholders_equity",
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
  const loans = registry.getMetricHistory(
    companyId,
    "loans",
    FINANCIAL_DEFINITION_IDS.loans,
  );
  for (let index = 1; index < loans.length; index += 1) {
    const current = loans[index];
    const prior = loans[index - 1];
    registerDerived(registry, {
      metricId: "loan-growth",
      companyId,
      sector: current.sector,
      period: current.period,
      periodEnd: current.period_end,
      definitionId: FINANCIAL_DEFINITION_IDS.loanGrowth,
      formulaId: "growth-rate",
      formula: "current_net_loans / prior_net_loans - 1",
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
      grossProfit: selectedMetric(registry, companyId, "gross-profit", periodEnd, [FINANCIAL_DEFINITION_IDS.grossProfit, FINANCIAL_DEFINITION_IDS.derivedGrossProfit]),
      researchAndDevelopment: selectedMetric(registry, companyId, "research-and-development", periodEnd, [FINANCIAL_DEFINITION_IDS.researchAndDevelopment]),
      operatingIncome: selectedMetric(registry, companyId, "operating-income", periodEnd, [FINANCIAL_DEFINITION_IDS.operatingIncome]),
      netIncome: selectedMetric(registry, companyId, "net-income", periodEnd, [FINANCIAL_DEFINITION_IDS.netIncome]),
      netInterestIncome: selectedMetric(registry, companyId, "net-interest-income", periodEnd, [FINANCIAL_DEFINITION_IDS.netInterestIncome]),
      deposits: selectedMetric(registry, companyId, "deposits", periodEnd, [FINANCIAL_DEFINITION_IDS.deposits]),
      depositCost: selectedMetric(registry, companyId, "deposit-cost", periodEnd, [FINANCIAL_DEFINITION_IDS.depositCost]),
      loans: selectedMetric(registry, companyId, "loans", periodEnd, [FINANCIAL_DEFINITION_IDS.loans]),
      loanGrowth: selectedMetric(registry, companyId, "loan-growth", periodEnd, [FINANCIAL_DEFINITION_IDS.loanGrowth]),
      creditLossProvision: selectedMetric(registry, companyId, "credit-loss-provision", periodEnd, [FINANCIAL_DEFINITION_IDS.creditLossProvision]),
      netChargeOffs: selectedMetric(registry, companyId, "net-charge-offs", periodEnd, [FINANCIAL_DEFINITION_IDS.netChargeOffs]),
      creditLossAllowance: selectedMetric(registry, companyId, "credit-loss-allowance", periodEnd, [FINANCIAL_DEFINITION_IDS.creditLossAllowance]),
      allowanceCoverage: selectedMetric(registry, companyId, "allowance-coverage", periodEnd, [FINANCIAL_DEFINITION_IDS.allowanceCoverage]),
      efficiencyRatio: selectedMetric(registry, companyId, "efficiency-ratio", periodEnd, [FINANCIAL_DEFINITION_IDS.efficiencyRatio]),
      roeProxy: selectedMetric(registry, companyId, "roe-proxy", periodEnd, [FINANCIAL_DEFINITION_IDS.roeProxy]),
      returnOnCommonEquity: selectedMetric(registry, companyId, "return-on-common-equity", periodEnd, [FINANCIAL_DEFINITION_IDS.returnOnCommonEquity]),
      returnOnTangibleCommonEquity: selectedMetric(registry, companyId, "return-on-tangible-common-equity", periodEnd, [FINANCIAL_DEFINITION_IDS.returnOnTangibleCommonEquity]),
      tangibleBookValue: selectedMetric(registry, companyId, "tangible-book-value", periodEnd, [FINANCIAL_DEFINITION_IDS.tangibleBookValue]),
      tangibleBookValuePerShare: selectedMetric(registry, companyId, "tangible-book-value-per-share", periodEnd, [FINANCIAL_DEFINITION_IDS.tangibleBookValuePerShare]),
      dividends: selectedMetric(registry, companyId, "dividends", periodEnd, [FINANCIAL_DEFINITION_IDS.dividends]),
      shareBuybacks: selectedMetric(registry, companyId, "share-buybacks", periodEnd, [FINANCIAL_DEFINITION_IDS.shareBuybacks]),
      capitalReturns: selectedMetric(registry, companyId, "capital-returns", periodEnd, [FINANCIAL_DEFINITION_IDS.capitalReturns]),
      investmentBankingFees: selectedMetric(registry, companyId, "investment-banking-fees", periodEnd, [FINANCIAL_DEFINITION_IDS.investmentBankingFees]),
      tradingRevenue: selectedMetric(registry, companyId, "trading-revenue", periodEnd, [FINANCIAL_DEFINITION_IDS.tradingRevenue]),
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
      workingCapital: selectedMetric(registry, companyId, "working-capital", periodEnd, [FINANCIAL_DEFINITION_IDS.workingCapital]),
      totalDebt: selectedMetric(registry, companyId, "total-debt", periodEnd, [FINANCIAL_DEFINITION_IDS.totalDebt, FINANCIAL_DEFINITION_IDS.derivedTotalDebt]),
      netDebt: selectedMetric(registry, companyId, "net-debt", periodEnd, [FINANCIAL_DEFINITION_IDS.issuerNetDebt, FINANCIAL_DEFINITION_IDS.normalizedNetDebt]),
      revenueGrowth: selectedMetric(registry, companyId, "revenue-growth", periodEnd, [FINANCIAL_DEFINITION_IDS.revenueGrowth]),
      revenueCagr: selectedMetric(registry, companyId, "revenue-cagr", periodEnd, [FINANCIAL_DEFINITION_IDS.revenueCagr]),
      netMargin: selectedMetric(registry, companyId, "net-margin", periodEnd, [FINANCIAL_DEFINITION_IDS.netMargin]),
      netMarginChange: selectedMetric(registry, companyId, "net-margin-change", periodEnd, [FINANCIAL_DEFINITION_IDS.netMarginChange]),
      grossMargin: selectedMetric(registry, companyId, "gross-margin", periodEnd, [FINANCIAL_DEFINITION_IDS.grossMargin]),
      operatingMargin: selectedMetric(registry, companyId, "operating-margin", periodEnd, [FINANCIAL_DEFINITION_IDS.operatingMargin]),
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
      researchAndDevelopment: value(selections.researchAndDevelopment),
      operatingIncome: value(selections.operatingIncome),
      netIncome: value(selections.netIncome),
      netInterestIncome: value(selections.netInterestIncome),
      deposits: value(selections.deposits),
      depositCost: value(selections.depositCost),
      loans: value(selections.loans),
      loanGrowth: value(selections.loanGrowth),
      creditLossProvision: value(selections.creditLossProvision),
      netChargeOffs: value(selections.netChargeOffs),
      creditLossAllowance: value(selections.creditLossAllowance),
      allowanceCoverage: value(selections.allowanceCoverage),
      efficiencyRatio: value(selections.efficiencyRatio),
      roeProxy: value(selections.roeProxy),
      returnOnCommonEquity: value(selections.returnOnCommonEquity),
      returnOnTangibleCommonEquity: value(selections.returnOnTangibleCommonEquity),
      tangibleBookValue: value(selections.tangibleBookValue),
      tangibleBookValuePerShare: value(selections.tangibleBookValuePerShare),
      dividends: value(selections.dividends),
      shareBuybacks: value(selections.shareBuybacks),
      capitalReturns: value(selections.capitalReturns),
      investmentBankingFees: value(selections.investmentBankingFees),
      tradingRevenue: value(selections.tradingRevenue),
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
      workingCapital: value(selections.workingCapital),
      totalDebt: value(selections.totalDebt),
      netDebt: value(selections.netDebt),
      revenueGrowth: value(selections.revenueGrowth),
      revenueCagr: value(selections.revenueCagr),
      netMargin: value(selections.netMargin),
      netMarginChange: value(selections.netMarginChange),
      grossMargin: value(selections.grossMargin),
      operatingMargin: value(selections.operatingMargin),
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
