export type EvidenceKind =
  | "Reported fact"
  | "Derived calculation"
  | "Analyst assumption"
  | "Interpretation"
  | "Management statement";

export type ResearchLocale = "zh" | "en";

import type {
  ResearchSelection,
  SectorOutlook,
  SupportedSubindustry,
} from "./sector-types";
import type {
  MetricLocatorResult,
  MetricSourceTier,
  MetricStatus,
} from "./metric-locator-types";

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
  grossProfit: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  investingCashFlow: number | null;
  cashCapex: number | null;
  freeCashFlowProxy: number | null;
  assets: number | null;
  liabilities: number | null;
  equity: number | null;
  cash: number | null;
  inventory: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  totalDebt: number | null;
  netDebt: number | null;
  revenueGrowth: number | null;
  netMargin: number | null;
  grossMargin: number | null;
  freeCashFlowMargin: number | null;
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
  valuationMethod: string;
  valuationMetric: number | null;
  multipleLabel: string;
  modelImpliedEnterpriseValue: number | null;
};

export type SectorKpiResult = {
  id: string;
  label: string;
  value: string;
  usable: boolean;
  status: MetricStatus;
  period: string | null;
  definition: string;
  classification: EvidenceKind;
  sourceNote: string;
  sourceUrl: string | null;
  confidence: number;
  extractionMethod: string | null;
  whyItMatters: string;
};

export type DataCoverage = {
  limited: boolean;
  criticalMetricIds: string[];
  searchedSources: MetricSourceTier[];
  metrics: MetricLocatorResult[];
  notes: string[];
};

export type SectorDriverExposure = {
  driver: string;
  companyExposure: string;
  evidence: string;
  evidencePublisher: string;
  evidenceDate: string;
  evidenceUrl: string;
  investmentImplication: string;
};

export type PeerComparisonItem = {
  ticker: string;
  name: string;
  rationale: string;
  revenueGrowth: number | null;
  netMargin: number | null;
  freeCashFlowMargin: number | null;
  periodEnd: string | null;
};

export type InvestmentDebate = {
  question: string;
  evidenceFor: string;
  evidenceAgainst: string;
  monitor: string;
};

export type CatalystPoint = {
  timing: string;
  event: string;
  investorRelevance: string;
};

export type ResearchSource = {
  title: string;
  url: string;
  retrievedAt: string;
  publisher?: string;
  publicationDate?: string;
  topic?: string;
};

export type ResearchReport = {
  locale: ResearchLocale;
  selection: ResearchSelection;
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
  evidenceCutoff: string;
  sectorLastRefreshedAt: string;
  companyDataRetrievedAt: string;
  currency: string;
  latestAnnual: FilingSource | null;
  latestInterim: FilingSource | null;
  periods: FinancialPeriod[];
  dashboard: DashboardMetric[];
  sectorPack: {
    id: SupportedSubindustry;
    sectorLabel: string;
    subindustryLabel: string;
    researchQuestions: string[];
    reportGuidance: string[];
    valuationMethod: string;
  };
  sectorOutlook: SectorOutlook;
  driverExposure: SectorDriverExposure[];
  sectorKpis: SectorKpiResult[];
  dataCoverage: DataCoverage;
  overview: string;
  segmentAnalysis: string;
  earningsQuality: string[];
  thesis: ThesisPoint[];
  investmentDebates: InvestmentDebate[];
  filingWatchlist: CatalystPoint[];
  catalysts: {
    operating: CatalystPoint[];
    financial: CatalystPoint[];
    regulatory: CatalystPoint[];
  };
  risks: RiskPoint[];
  scenarios: Scenario[];
  peerComparison: PeerComparisonItem[];
  valuationAssessment: string;
  cashFlowProxyFormula: string;
  valuationFormula: string;
  methodology: Array<{ name: string; purpose: string; steps: string[] }>;
  sources: ResearchSource[];
  limitations: string[];
};
