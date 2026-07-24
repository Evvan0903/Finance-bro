import type {
  CoverageCompanyType,
  MetricCoverageExpectation,
} from "./types";

const all = (metricId: string) => ({ metricId, applicableTo: "all" as const });
const nonFinancial = (metricId: string, excludedPackIds: string[] = []) => ({
  metricId,
  applicableTo: "non-financial" as const,
  excludedPackIds,
});

export const TIER_1_METRIC_IDS = [
  "revenue", "revenue-growth", "cost-of-revenue", "gross-profit",
  "gross-margin", "operating-income", "operating-margin", "net-income",
  "diluted-eps", "operating-cash-flow", "cash-capex", "fcf", "cash",
  "short-term-investments", "current-debt", "noncurrent-debt", "total-debt",
  "net-debt", "assets", "liabilities", "equity", "shares-outstanding",
  "dividends", "share-buybacks",
] as const;

export const TIER_2_METRIC_IDS = [
  "inventory", "accounts-receivable", "accounts-payable", "current-assets",
  "current-liabilities", "working-capital", "current-ratio",
  "stock-based-compensation", "depreciation-and-amortization",
  "research-and-development", "selling-general-and-administrative",
  "interest-expense", "income-tax-expense", "effective-tax-rate",
  "fcf-margin", "cash-conversion", "capex-intensity", "rd-intensity",
  "share-count-growth", "roe-proxy", "roa-proxy", "roic-proxy",
] as const;

const definitions: Record<string, string[]> = {
  revenue: ["reported-revenue"],
  "revenue-growth": ["year-over-year-revenue-growth"],
  "cost-of-revenue": ["reported-cost-of-revenue"],
  "gross-profit": ["reported-gross-profit", "revenue-less-cost-of-revenue"],
  "gross-margin": ["gross-profit-over-revenue"],
  "operating-income": ["reported-operating-income"],
  "operating-margin": ["operating-income-over-revenue"],
  "net-income": ["reported-net-income"],
  "diluted-eps": ["reported-diluted-earnings-per-share"],
  "operating-cash-flow": ["reported-operating-cash-flow"],
  "cash-capex": ["issuer-reported-cash-capex", "cash-purchases-property-plant-equipment"],
  fcf: ["ocf-less-cash-capex"],
  cash: ["reported-cash-and-equivalents"],
  "short-term-investments": ["reported-short-term-investments"],
  "current-debt": ["reported-current-debt"],
  "noncurrent-debt": ["reported-noncurrent-debt"],
  "total-debt": ["issuer-reported-total-debt", "reported-total-debt", "current-plus-noncurrent-debt"],
  "net-debt": ["issuer-reported-net-debt", "normalized-debt-less-cash"],
  assets: ["reported-total-assets"],
  liabilities: ["reported-total-liabilities"],
  equity: ["reported-equity"],
  "shares-outstanding": ["reported-common-shares-outstanding"],
  dividends: ["reported-cash-dividends"],
  "share-buybacks": ["reported-common-share-buybacks"],
  inventory: ["reported-inventory"],
  "accounts-receivable": ["reported-accounts-receivable"],
  "accounts-payable": ["reported-accounts-payable"],
  "current-assets": ["reported-current-assets"],
  "current-liabilities": ["reported-current-liabilities"],
  "working-capital": ["current-assets-less-current-liabilities"],
  "current-ratio": ["current-assets-over-current-liabilities"],
  "stock-based-compensation": ["reported-stock-based-compensation"],
  "depreciation-and-amortization": ["reported-depreciation-and-amortization"],
  "research-and-development": ["reported-research-and-development-expense"],
  "selling-general-and-administrative": ["reported-selling-general-and-administrative-expense"],
  "interest-expense": ["reported-interest-expense"],
  "income-tax-expense": ["reported-income-tax-expense"],
  "effective-tax-rate": ["income-tax-expense-over-pretax-income"],
  "fcf-margin": ["free-cash-flow-over-revenue"],
  "cash-conversion": ["free-cash-flow-over-net-income"],
  "capex-intensity": ["cash-capex-over-revenue"],
  "rd-intensity": ["research-and-development-over-revenue"],
  "share-count-growth": ["year-over-year-share-count-growth"],
  "roe-proxy": ["net-income-over-average-equity", "net-income-over-period-end-equity"],
  "roa-proxy": ["net-income-over-average-assets"],
  "roic-proxy": ["nopat-over-average-invested-capital"],
};

const derivations: Record<string, string[]> = {
  "revenue-growth": ["revenue"],
  "gross-profit": ["revenue", "cost-of-revenue"],
  "gross-margin": ["gross-profit", "revenue"],
  "operating-margin": ["operating-income", "revenue"],
  fcf: ["operating-cash-flow", "cash-capex"],
  "total-debt": ["current-debt", "noncurrent-debt"],
  "net-debt": ["total-debt", "cash"],
  "working-capital": ["current-assets", "current-liabilities"],
  "current-ratio": ["current-assets", "current-liabilities"],
  "effective-tax-rate": ["income-tax-expense", "pretax-income"],
  "fcf-margin": ["fcf", "revenue"],
  "cash-conversion": ["fcf", "net-income"],
  "capex-intensity": ["cash-capex", "revenue"],
  "rd-intensity": ["research-and-development", "revenue"],
  "share-count-growth": ["shares-outstanding"],
  "roe-proxy": ["net-income", "equity"],
  "roa-proxy": ["net-income", "assets"],
  "roic-proxy": ["operating-income", "income-tax-expense", "invested-capital"],
};

const softwarePacks = ["software-saas-general", "internet-platform-general"];
const bankExcluded = ["banks", "diversified-financials-general"];

export const UNIVERSAL_COVERAGE_EXPECTATIONS: MetricCoverageExpectation[] = [
  ...TIER_1_METRIC_IDS.map((metricId) => ({
    metricId,
    definitionIds: definitions[metricId],
    tier: 1 as const,
    applicability: [
      "revenue", "net-income", "assets", "liabilities", "equity",
    ].includes(metricId)
      ? all(metricId)
      : nonFinancial(metricId, bankExcluded),
    derivationInputMetricIds: derivations[metricId],
  })),
  ...TIER_2_METRIC_IDS.map((metricId) => ({
    metricId,
    definitionIds: definitions[metricId],
    tier: 2 as const,
    applicability:
      metricId === "inventory"
        ? nonFinancial(metricId, [...bankExcluded, ...softwarePacks])
        : nonFinancial(metricId, bankExcluded),
    derivationInputMetricIds: derivations[metricId],
  })),
];

export function metricIsApplicable(input: {
  expectation: MetricCoverageExpectation;
  companyType: CoverageCompanyType;
  packId: string;
}) {
  const { applicability } = input.expectation;
  if (applicability.excludedPackIds?.includes(input.packId)) return false;
  if (
    applicability.requiredPackIds?.length &&
    !applicability.requiredPackIds.includes(input.packId)
  ) return false;
  if (applicability.applicableTo === "all") return true;
  if (Array.isArray(applicability.applicableTo)) {
    return applicability.applicableTo.includes(input.companyType);
  }
  if (applicability.applicableTo === "financial") {
    return input.companyType === "bank" || input.companyType === "diversified-financial";
  }
  if (applicability.applicableTo === "non-financial") {
    return input.companyType === "non-financial" ||
      input.companyType === "foreign-private-issuer";
  }
  return applicability.applicableTo === input.companyType;
}

export function companyTypeForPack(
  packId: string,
  foreignPrivateIssuer = false,
): CoverageCompanyType {
  if (packId === "banks") return "bank";
  if (packId === "diversified-financials-general") return "diversified-financial";
  return foreignPrivateIssuer ? "foreign-private-issuer" : "non-financial";
}
