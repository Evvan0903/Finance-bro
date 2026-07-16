export type EvidenceKind =
  | "Reported fact"
  | "Derived calculation"
  | "Analyst assumption"
  | "Interpretation"
  | "Management statement";

export type ResearchLocale = "zh" | "en";

export type FilingSource = {
  title: string;
  form: string;
  filed: string;
  reportDate: string;
  url: string;
};

export type FinancialPeriod = {
  periodEnd: string;
  revenue: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  investingCashFlow: number | null;
  cashCapex: number | null;
  freeCashFlowProxy: number | null;
  assets: number | null;
  liabilities: number | null;
  equity: number | null;
  cash: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  totalDebt: number | null;
  netDebt: number | null;
  revenueGrowth: number | null;
  netMargin: number | null;
  cashConversion: number | null;
  currentRatio: number | null;
};

export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  classification: EvidenceKind;
  tone: "positive" | "neutral" | "watch";
};

export type ThesisPoint = {
  title: string;
  view: string;
  counterEvidence: string;
  monitor: string;
};

export type RiskPoint = {
  title: string;
  evidence: string;
  thesisBreaker: string;
};

export type Scenario = {
  name: "Bear" | "Base" | "Bull";
  revenueGrowth: number | null;
  netMargin: number | null;
  operatingCashFlowMargin: number | null;
  capexFactor: number;
  projectedRevenue: number | null;
  projectedNetIncome: number | null;
  projectedFreeCashFlow: number | null;
  enterpriseValueMultiple: number;
  modelImpliedEnterpriseValue: number | null;
};

export type ResearchReport = {
  locale: ResearchLocale;
  company: {
    name: string;
    ticker: string;
    cik: string;
    exchange: string;
    sic: string;
    sicDescription: string;
    fiscalYearEnd: string;
    filingStatus: string;
  };
  researchDate: string;
  cutoff: string;
  currency: string;
  latestAnnual: FilingSource | null;
  latestInterim: FilingSource | null;
  periods: FinancialPeriod[];
  dashboard: DashboardMetric[];
  overview: string;
  segmentAnalysis: string;
  earningsQuality: string[];
  thesis: ThesisPoint[];
  catalysts: Array<{ timing: string; event: string; investorRelevance: string }>;
  risks: RiskPoint[];
  scenarios: Scenario[];
  valuationAssessment: string;
  cashFlowProxyFormula: string;
  valuationFormula: string;
  sources: Array<{ title: string; url: string; retrievedAt: string }>;
  limitations: string[];
};
