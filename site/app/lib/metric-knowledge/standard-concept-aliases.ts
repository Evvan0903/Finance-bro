import type { StandardConceptAlias } from "./types";

const aliases = (
  taxonomy: StandardConceptAlias["taxonomy"],
  concepts: string[],
): StandardConceptAlias[] =>
  concepts.map((concept, priority) => ({ taxonomy, concept, priority }));

export const STANDARD_CONCEPT_ALIASES: Record<string, StandardConceptAlias[]> = {
  revenue: [
    ...aliases("us-gaap", [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "RevenuesNetOfInterestExpense",
      "SalesRevenueNet",
    ]),
    ...aliases("ifrs-full", ["Revenue"]),
  ],
  "cost-of-revenue": [
    ...aliases("us-gaap", ["CostOfGoodsAndServicesSold", "CostOfGoodsSold"]),
    ...aliases("ifrs-full", ["CostOfSales"]),
  ],
  "gross-profit": aliases("us-gaap", ["GrossProfit"]).concat(
    aliases("ifrs-full", ["GrossProfit"]),
  ),
  "operating-income": aliases("us-gaap", ["OperatingIncomeLoss"]).concat(
    aliases("ifrs-full", ["ProfitLossFromOperatingActivities"]),
  ),
  "net-income": [
    ...aliases("us-gaap", ["NetIncomeLoss", "ProfitLoss"]),
    ...aliases("ifrs-full", [
      "ProfitLossAttributableToOwnersOfParent",
      "ProfitLoss",
    ]),
  ],
  "diluted-eps": aliases("us-gaap", ["EarningsPerShareDiluted"]).concat(
    aliases("ifrs-full", ["DilutedEarningsLossPerShare"]),
  ),
  "shares-outstanding": [
    ...aliases("dei", ["EntityCommonStockSharesOutstanding"]),
    ...aliases("us-gaap", ["CommonStockSharesOutstanding"]),
  ],
  "operating-cash-flow": aliases("us-gaap", [
    "NetCashProvidedByUsedInOperatingActivities",
    "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
  ]).concat(aliases("ifrs-full", ["CashFlowsFromUsedInOperatingActivities"])),
  "investing-cash-flow": aliases("us-gaap", [
    "NetCashProvidedByUsedInInvestingActivities",
  ]).concat(aliases("ifrs-full", ["CashFlowsFromUsedInInvestingActivities"])),
  "cash-capex": aliases("us-gaap", [
    "PaymentsToAcquirePropertyPlantAndEquipment",
    "PaymentsToAcquireProductiveAssets",
  ]).concat(aliases("ifrs-full", ["PurchaseOfPropertyPlantAndEquipment"])),
  cash: aliases("us-gaap", [
    "CashAndCashEquivalentsAtCarryingValue",
    "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
  ]).concat(aliases("ifrs-full", ["CashAndCashEquivalents"])),
  "short-term-investments": aliases("us-gaap", [
    "ShortTermInvestments",
    "MarketableSecuritiesCurrent",
  ]),
  assets: aliases("us-gaap", ["Assets"]).concat(aliases("ifrs-full", ["Assets"])),
  liabilities: aliases("us-gaap", ["Liabilities"]).concat(
    aliases("ifrs-full", ["Liabilities"]),
  ),
  equity: aliases("us-gaap", [
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  ]).concat(
    aliases("ifrs-full", ["Equity", "EquityAttributableToOwnersOfParent"]),
  ),
  "current-assets": aliases("us-gaap", ["AssetsCurrent"]).concat(
    aliases("ifrs-full", ["CurrentAssets"]),
  ),
  "current-liabilities": aliases("us-gaap", ["LiabilitiesCurrent"]).concat(
    aliases("ifrs-full", ["CurrentLiabilities"]),
  ),
  "current-debt": aliases("us-gaap", [
    "LongTermDebtAndFinanceLeaseObligationsCurrent",
    "LongTermDebtCurrent",
    "ShortTermBorrowings",
  ]).concat(aliases("ifrs-full", ["CurrentBorrowings"])),
  "noncurrent-debt": aliases("us-gaap", [
    "LongTermDebtAndFinanceLeaseObligationsNoncurrent",
    "LongTermDebtNoncurrent",
  ]).concat(aliases("ifrs-full", ["NoncurrentBorrowings"])),
  "total-debt": aliases("us-gaap", [
    "LongTermDebtAndFinanceLeaseObligations",
    "LongTermDebtAndCapitalLeaseObligations",
  ]).concat(aliases("ifrs-full", ["Borrowings"])),
  dividends: aliases("us-gaap", [
    "PaymentsOfDividends",
    "PaymentsOfDividendsCommonStock",
  ]),
  "share-buybacks": aliases("us-gaap", [
    "PaymentsForRepurchaseOfCommonStock",
    "PaymentsForRepurchaseOfEquity",
  ]),
  inventory: aliases("us-gaap", ["InventoryNet"]).concat(
    aliases("ifrs-full", ["Inventories"]),
  ),
  "accounts-receivable": aliases("us-gaap", [
    "AccountsReceivableNetCurrent",
    "AccountsNotesAndLoansReceivableNetCurrent",
  ]),
  "accounts-payable": aliases("us-gaap", ["AccountsPayableCurrent"]),
  "stock-based-compensation": aliases("us-gaap", [
    "ShareBasedCompensation",
    "AllocatedShareBasedCompensationExpense",
  ]),
  "depreciation-and-amortization": aliases("us-gaap", [
    "DepreciationDepletionAndAmortization",
    "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment",
  ]),
  "research-and-development": aliases("us-gaap", [
    "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost",
    "ResearchAndDevelopmentExpense",
  ]).concat(aliases("ifrs-full", ["ResearchAndDevelopmentExpense"])),
  "selling-general-and-administrative": aliases("us-gaap", [
    "SellingGeneralAndAdministrativeExpense",
  ]),
  "interest-expense": aliases("us-gaap", [
    "InterestExpenseNonOperating",
    "InterestAndDebtExpense",
  ]),
  "income-tax-expense": aliases("us-gaap", ["IncomeTaxExpenseBenefit"]).concat(
    aliases("ifrs-full", ["IncomeTaxExpenseContinuingOperations"]),
  ),
  "pretax-income": aliases("us-gaap", [
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
  ]),
  goodwill: aliases("us-gaap", ["Goodwill"]),
  "intangible-assets": aliases("us-gaap", [
    "FiniteLivedIntangibleAssetsNet",
    "OtherIntangibleAssetsNet",
  ]),
  deposits: aliases("us-gaap", ["Deposits"]),
  loans: aliases("us-gaap", [
    "LoansAndLeasesReceivableNetReportedAmount",
    "FinancingReceivableExcludingAccruedInterestAfterAllowanceForCreditLoss",
    "LoansReceivableNet",
  ]),
  "credit-loss-allowance": aliases("us-gaap", [
    "FinancingReceivableAllowanceForCreditLossExcludingAccruedInterest",
    "FinancingReceivableAllowanceForCreditLosses",
    "LoansAndLeasesReceivableAllowance",
  ]),
  "net-interest-income": aliases("us-gaap", ["InterestIncomeExpenseNet"]),
  "noninterest-expense": aliases("us-gaap", ["NoninterestExpense"]),
  "credit-loss-provision": aliases("us-gaap", [
    "ProvisionForLoanLeaseAndOtherLosses",
    "ProvisionForLoanAndLeaseLosses",
    "ProvisionForLoanLossesExpensed",
  ]),
};
