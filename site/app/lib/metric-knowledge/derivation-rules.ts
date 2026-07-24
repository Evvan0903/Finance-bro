export type UniversalDerivationRule = {
  metricId: string;
  definitionId: string;
  formulaId: "add" | "subtract" | "divide" | "growth-rate" | "average";
  formula: string;
  requiredInputs: string[];
  guard?: string;
};

export const UNIVERSAL_DERIVATION_RULES: UniversalDerivationRule[] = [
  { metricId: "gross-profit", definitionId: "revenue-less-cost-of-revenue", formulaId: "subtract", formula: "revenue - cost_of_revenue", requiredInputs: ["revenue", "cost-of-revenue"], guard: "cost/revenue between 1% and 150%" },
  { metricId: "gross-margin", definitionId: "gross-profit-over-revenue", formulaId: "divide", formula: "gross_profit / revenue", requiredInputs: ["gross-profit", "revenue"], guard: "revenue != 0" },
  { metricId: "operating-margin", definitionId: "operating-income-over-revenue", formulaId: "divide", formula: "operating_income / revenue", requiredInputs: ["operating-income", "revenue"], guard: "revenue != 0" },
  { metricId: "fcf", definitionId: "ocf-less-cash-capex", formulaId: "subtract", formula: "operating_cash_flow - cash_capex", requiredInputs: ["operating-cash-flow", "cash-capex"] },
  { metricId: "fcf-margin", definitionId: "free-cash-flow-over-revenue", formulaId: "divide", formula: "free_cash_flow / revenue", requiredInputs: ["fcf", "revenue"], guard: "revenue != 0" },
  { metricId: "cash-conversion", definitionId: "free-cash-flow-over-net-income", formulaId: "divide", formula: "free_cash_flow / net_income", requiredInputs: ["fcf", "net-income"], guard: "net income > 0" },
  { metricId: "total-debt", definitionId: "current-plus-noncurrent-debt", formulaId: "add", formula: "current_debt + noncurrent_debt", requiredInputs: ["current-debt", "noncurrent-debt"] },
  { metricId: "net-debt", definitionId: "normalized-debt-less-cash", formulaId: "subtract", formula: "total_debt - cash_and_equivalents", requiredInputs: ["total-debt", "cash"] },
  { metricId: "working-capital", definitionId: "current-assets-less-current-liabilities", formulaId: "subtract", formula: "current_assets - current_liabilities", requiredInputs: ["current-assets", "current-liabilities"] },
  { metricId: "current-ratio", definitionId: "current-assets-over-current-liabilities", formulaId: "divide", formula: "current_assets / current_liabilities", requiredInputs: ["current-assets", "current-liabilities"], guard: "current liabilities > 0" },
  { metricId: "effective-tax-rate", definitionId: "income-tax-expense-over-pretax-income", formulaId: "divide", formula: "income_tax_expense / pretax_income", requiredInputs: ["income-tax-expense", "pretax-income"], guard: "pretax income > 0" },
  { metricId: "capex-intensity", definitionId: "cash-capex-over-revenue", formulaId: "divide", formula: "cash_capex / revenue", requiredInputs: ["cash-capex", "revenue"], guard: "revenue > 0" },
  { metricId: "rd-intensity", definitionId: "research-and-development-over-revenue", formulaId: "divide", formula: "research_and_development / revenue", requiredInputs: ["research-and-development", "revenue"], guard: "revenue > 0" },
  { metricId: "share-count-growth", definitionId: "year-over-year-share-count-growth", formulaId: "growth-rate", formula: "current_shares / prior_shares - 1", requiredInputs: ["shares-outstanding"] },
  { metricId: "average-assets", definitionId: "average-current-and-prior-assets", formulaId: "average", formula: "(current_assets + prior_assets) / 2", requiredInputs: ["assets"] },
  { metricId: "roa-proxy", definitionId: "net-income-over-average-assets", formulaId: "divide", formula: "net_income / average_assets", requiredInputs: ["net-income", "average-assets"], guard: "average assets > 0" },
  { metricId: "average-equity", definitionId: "average-current-and-prior-equity", formulaId: "average", formula: "(current_equity + prior_equity) / 2", requiredInputs: ["equity"] },
  { metricId: "roe-proxy", definitionId: "net-income-over-average-equity", formulaId: "divide", formula: "net_income / average_equity", requiredInputs: ["net-income", "average-equity"], guard: "average equity > 0" },
];

export const UNIVERSAL_DERIVATION_VERSION = "1.0";
