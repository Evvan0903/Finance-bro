import { STANDARD_CONCEPT_ALIASES } from "./standard-concept-aliases";
import {
  DURATION_CURRENCY_RULES,
  INSTANT_CURRENCY_RULES,
  NON_NEGATIVE_DURATION_RULES,
  NON_NEGATIVE_INSTANT_RULES,
  RATIO_RULES,
} from "./validation-rules";
import type { UniversalMetricDefinition } from "./types";

const bankPacks = ["banks", "diversified-financials-general"];
const all = { metricId: "", applicableTo: "all" as const };
const nonFinancial = (metricId: string) => ({
  metricId,
  applicableTo: "non-financial" as const,
  excludedPackIds: bankPacks,
});

const reported = (
  metricId: string,
  displayName: string,
  definitionId: string,
  statement: UniversalMetricDefinition["statement"],
  periodType: UniversalMetricDefinition["periodType"],
  acceptedUnits: string[],
  validationRules: UniversalMetricDefinition["validationRules"],
  applicableToAll = false,
): UniversalMetricDefinition => ({
  metricId,
  displayName,
  definitionId,
  statement,
  periodType,
  acceptedUnits,
  standardConcepts: STANDARD_CONCEPT_ALIASES[metricId] ?? [],
  commonLabels: [displayName],
  applicability: applicableToAll ? { ...all, metricId } : nonFinancial(metricId),
  validationRules,
});

const currency = ["currency"];
const duration = DURATION_CURRENCY_RULES;
const nonNegativeDuration = NON_NEGATIVE_DURATION_RULES;
const instant = INSTANT_CURRENCY_RULES;
const nonNegativeInstant = NON_NEGATIVE_INSTANT_RULES;

export const UNIVERSAL_METRIC_DEFINITIONS: UniversalMetricDefinition[] = [
  reported("revenue", "Revenue", "reported-revenue", "income", "duration", currency, duration, true),
  reported("cost-of-revenue", "Cost of revenue", "reported-cost-of-revenue", "income", "duration", currency, nonNegativeDuration),
  reported("gross-profit", "Gross profit", "reported-gross-profit", "income", "duration", currency, duration),
  reported("operating-income", "Operating income", "reported-operating-income", "income", "duration", currency, duration),
  reported("net-income", "Net income", "reported-net-income", "income", "duration", currency, duration, true),
  reported("diluted-eps", "Diluted EPS", "reported-diluted-earnings-per-share", "per-share", "duration", ["currency/shares"], duration),
  reported("shares-outstanding", "Shares outstanding", "reported-common-shares-outstanding", "balance-sheet", "instant", ["shares"], nonNegativeInstant),
  reported("operating-cash-flow", "Operating cash flow", "reported-operating-cash-flow", "cash-flow", "duration", currency, duration),
  reported("investing-cash-flow", "Investing cash flow", "reported-investing-cash-flow", "cash-flow", "duration", currency, duration),
  reported("cash-capex", "Cash capital expenditure", "cash-purchases-property-plant-equipment", "cash-flow", "duration", currency, nonNegativeDuration),
  reported("cash", "Cash and equivalents", "reported-cash-and-equivalents", "balance-sheet", "instant", currency, nonNegativeInstant),
  reported("short-term-investments", "Short-term investments", "reported-short-term-investments", "balance-sheet", "instant", currency, nonNegativeInstant),
  reported("assets", "Total assets", "reported-total-assets", "balance-sheet", "instant", currency, nonNegativeInstant, true),
  reported("liabilities", "Total liabilities", "reported-total-liabilities", "balance-sheet", "instant", currency, nonNegativeInstant, true),
  reported("equity", "Total equity", "reported-equity", "balance-sheet", "instant", currency, instant, true),
  reported("current-assets", "Current assets", "reported-current-assets", "balance-sheet", "instant", currency, nonNegativeInstant),
  reported("current-liabilities", "Current liabilities", "reported-current-liabilities", "balance-sheet", "instant", currency, nonNegativeInstant),
  reported("current-debt", "Current debt", "reported-current-debt", "balance-sheet", "instant", currency, nonNegativeInstant),
  reported("noncurrent-debt", "Noncurrent debt", "reported-noncurrent-debt", "balance-sheet", "instant", currency, nonNegativeInstant),
  reported("total-debt", "Total debt", "reported-total-debt", "balance-sheet", "instant", currency, nonNegativeInstant),
  reported("dividends", "Dividends paid", "reported-cash-dividends", "cash-flow", "duration", currency, nonNegativeDuration),
  reported("share-buybacks", "Share buybacks", "reported-common-share-buybacks", "cash-flow", "duration", currency, nonNegativeDuration),
  reported("inventory", "Inventory", "reported-inventory", "balance-sheet", "instant", currency, nonNegativeInstant),
  reported("accounts-receivable", "Accounts receivable", "reported-accounts-receivable", "balance-sheet", "instant", currency, nonNegativeInstant),
  reported("accounts-payable", "Accounts payable", "reported-accounts-payable", "balance-sheet", "instant", currency, nonNegativeInstant),
  reported("stock-based-compensation", "Stock-based compensation", "reported-stock-based-compensation", "cash-flow", "duration", currency, nonNegativeDuration),
  reported("depreciation-and-amortization", "Depreciation and amortization", "reported-depreciation-and-amortization", "cash-flow", "duration", currency, nonNegativeDuration),
  reported("research-and-development", "Research and development", "reported-research-and-development-expense", "income", "duration", currency, nonNegativeDuration),
  reported("selling-general-and-administrative", "Selling, general and administrative", "reported-selling-general-and-administrative-expense", "income", "duration", currency, nonNegativeDuration),
  reported("interest-expense", "Interest expense", "reported-interest-expense", "income", "duration", currency, nonNegativeDuration),
  reported("income-tax-expense", "Income tax expense", "reported-income-tax-expense", "income", "duration", currency, duration),
  reported("pretax-income", "Pretax income", "reported-pretax-income", "income", "duration", currency, duration),
  reported("goodwill", "Goodwill", "reported-goodwill", "balance-sheet", "instant", currency, nonNegativeInstant),
  reported("intangible-assets", "Intangible assets", "reported-finite-lived-intangible-assets", "balance-sheet", "instant", currency, nonNegativeInstant),
  reported("deposits", "Deposits", "reported-deposits", "balance-sheet", "instant", currency, nonNegativeInstant, true),
  reported("loans", "Loans", "reported-net-loans", "balance-sheet", "instant", currency, nonNegativeInstant, true),
  reported("credit-loss-allowance", "Credit loss allowance", "reported-credit-loss-allowance", "balance-sheet", "instant", currency, nonNegativeInstant, true),
  reported("net-interest-income", "Net interest income", "reported-net-interest-income", "income", "duration", currency, duration, true),
  reported("noninterest-expense", "Noninterest expense", "reported-noninterest-expense", "income", "duration", currency, nonNegativeDuration, true),
  reported("credit-loss-provision", "Credit loss provision", "reported-credit-loss-provision", "income", "duration", currency, duration, true),
  {
    metricId: "gross-margin",
    displayName: "Gross margin",
    definitionId: "gross-profit-over-revenue",
    statement: "derived",
    periodType: "duration",
    acceptedUnits: ["ratio"],
    standardConcepts: [],
    commonLabels: ["Gross margin"],
    applicability: nonFinancial("gross-margin"),
    validationRules: RATIO_RULES,
    derivation: { formulaId: "divide", formula: "gross_profit / revenue", requiredInputs: ["gross-profit", "revenue"] },
  },
];

export const UNIVERSAL_METRIC_DEFINITION_VERSION = "2.0";

export function universalMetricDefinition(
  metricId: string,
  definitionId?: string,
) {
  return UNIVERSAL_METRIC_DEFINITIONS.find(
    (definition) =>
      definition.metricId === metricId &&
      (!definitionId || definition.definitionId === definitionId),
  );
}
