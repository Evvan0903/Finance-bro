import { readFile, writeFile } from "node:fs/promises";

const [
  factsPath,
  submissionsPath,
  outputPath,
  publicationCutoff,
  issuerMetricsPath,
] = process.argv.slice(2);
if (!factsPath || !submissionsPath || !outputPath) {
  throw new Error(
    "Usage: node scripts/create-company-fixture.mjs <companyfacts.json> <submissions.json> <output.json> [publication-cutoff]",
  );
}

const [companyFacts, submissions] = await Promise.all(
  [factsPath, submissionsPath].map(async (path) =>
    JSON.parse(await readFile(path, "utf8"))
  ),
);
const issuerReportedMetrics = issuerMetricsPath
  ? JSON.parse(await readFile(issuerMetricsPath, "utf8"))
  : [];

const concepts = new Set([
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
  "Revenue",
  "RevenuesNetOfInterestExpense",
  "GrossProfit",
  "CostOfGoodsAndServicesSold",
  "CostOfGoodsSold",
  "OperatingIncomeLoss",
  "ResearchAndDevelopmentExpense",
  "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost",
  "InterestIncomeExpenseNet",
  "NoninterestExpense",
  "ProvisionForLoanLeaseAndOtherLosses",
  "ProvisionForLoanAndLeaseLosses",
  "ProvisionForLoanLossesExpensed",
  "NetIncomeLoss",
  "ProfitLoss",
  "ProfitLossAttributableToOwnersOfParent",
  "NetCashProvidedByUsedInOperatingActivities",
  "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
  "CashFlowsFromUsedInOperatingActivities",
  "NetCashProvidedByUsedInInvestingActivities",
  "CashFlowsFromUsedInInvestingActivities",
  "PaymentsToAcquirePropertyPlantAndEquipment",
  "PaymentsToAcquireProductiveAssets",
  "PurchaseOfPropertyPlantAndEquipment",
  "Assets",
  "Liabilities",
  "StockholdersEquity",
  "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  "Equity",
  "EquityAttributableToOwnersOfParent",
  "CashAndCashEquivalentsAtCarryingValue",
  "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
  "CashAndCashEquivalents",
  "Deposits",
  "LoansAndLeasesReceivableNetReportedAmount",
  "FinancingReceivableExcludingAccruedInterestAfterAllowanceForCreditLoss",
  "LoansReceivableNet",
  "FinancingReceivableAllowanceForCreditLosses",
  "FinancingReceivableAllowanceForCreditLossExcludingAccruedInterest",
  "LoansAndLeasesReceivableAllowance",
  "Goodwill",
  "FiniteLivedIntangibleAssetsNet",
  "OtherIntangibleAssetsNet",
  "InventoryNet",
  "Inventories",
  "AssetsCurrent",
  "CurrentAssets",
  "LiabilitiesCurrent",
  "CurrentLiabilities",
  "LongTermDebtAndFinanceLeaseObligations",
  "LongTermDebtAndCapitalLeaseObligations",
  "Borrowings",
  "LongTermDebtAndFinanceLeaseObligationsCurrent",
  "ShortTermBorrowings",
  "CurrentBorrowings",
  "LongTermDebtAndFinanceLeaseObligationsNoncurrent",
  "LongTermDebtNoncurrent",
  "NoncurrentBorrowings",
  "DividendsPaidToEquityHoldersOfParentClassifiedAsFinancingActivities",
  "DividendsPaidOrdinaryShares",
  "PaymentsToAcquireOrRedeemEntitysShares",
  "PaymentsOfDividends",
  "PaymentsForRepurchaseOfCommonStock",
]);

const annualForms = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"]);
const cutoff = publicationCutoff ?? new Date().toISOString().slice(0, 10);
const compactFacts = {};
for (const [taxonomy, taxonomyFacts] of Object.entries(companyFacts.facts)) {
  for (const [concept, fact] of Object.entries(taxonomyFacts)) {
    if (!concepts.has(concept)) continue;
    const units = {};
    for (const [unit, entries] of Object.entries(fact.units ?? {})) {
      const selected = entries
        .filter((entry) =>
          annualForms.has(entry.form) &&
          entry.end >= "2021-01-01" &&
          entry.end <= cutoff &&
          (entry.filed ?? "") <= cutoff
        )
        .map(({ start, end, val, form, filed, accn }) => ({
          ...(start ? { start } : {}),
          end,
          val,
          form,
          filed,
          accn,
        }));
      if (selected.length) units[unit] = selected;
    }
    if (!Object.keys(units).length) continue;
    compactFacts[taxonomy] ??= {};
    compactFacts[taxonomy][concept] = {
      label: fact.label,
      description: fact.description,
      units,
    };
  }
}

const recent = submissions.filings?.recent ?? {};
const recentEntries = (recent.form ?? []).map((form, index) => ({
  form,
  accessionNumber: recent.accessionNumber?.[index],
  filingDate: recent.filingDate?.[index],
  reportDate: recent.reportDate?.[index],
  primaryDocument: recent.primaryDocument?.[index],
}));
const selectedFilings = [
  recentEntries.find((entry) => annualForms.has(entry.form)),
  recentEntries.find((entry) => ["10-Q", "10-Q/A", "6-K"].includes(entry.form)),
].filter(Boolean);

const fixture = {
  fixtureSchemaVersion: "1.0",
  source: {
    companyFacts:
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(companyFacts.cik).padStart(10, "0")}.json`,
    submissions:
      `https://data.sec.gov/submissions/CIK${String(companyFacts.cik).padStart(10, "0")}.json`,
    originalPublicationCutoff: cutoff,
  },
  ...(issuerReportedMetrics.length ? { issuerReportedMetrics } : {}),
  companyFacts: {
    cik: companyFacts.cik,
    entityName: companyFacts.entityName,
    facts: compactFacts,
  },
  submissions: {
    cik: submissions.cik,
    name: submissions.name,
    sic: submissions.sic,
    sicDescription: submissions.sicDescription,
    fiscalYearEnd: submissions.fiscalYearEnd,
    exchanges: submissions.exchanges,
    tickers: submissions.tickers,
    entityType: submissions.entityType,
    category: submissions.category,
    filings: {
      recent: Object.fromEntries([
        "form",
        "accessionNumber",
        "filingDate",
        "reportDate",
        "primaryDocument",
      ].map((field) => [field, selectedFilings.map((entry) => entry[field])])),
    },
  },
};

await writeFile(outputPath, `${JSON.stringify(fixture, null, 2)}\n`);
