export type EvidenceKind =
  | "Reported fact"
  | "Derived calculation"
  | "Market-data value"
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
import type { MetricRegistrySnapshot } from "./canonical-metrics";
import type { CompanyClassification } from "./research-classification/types";
import type {
  MetricCoverageSummary,
  MetricExtractionAudit,
} from "./metric-coverage/types";

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
  researchAndDevelopment: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  dilutedEps: number | null;
  sharesOutstanding: number | null;
  netInterestIncome: number | null;
  deposits: number | null;
  depositCost: number | null;
  loans: number | null;
  loanGrowth: number | null;
  creditLossProvision: number | null;
  netChargeOffs: number | null;
  creditLossAllowance: number | null;
  allowanceCoverage: number | null;
  efficiencyRatio: number | null;
  roeProxy: number | null;
  returnOnCommonEquity: number | null;
  returnOnTangibleCommonEquity: number | null;
  tangibleBookValue: number | null;
  tangibleBookValuePerShare: number | null;
  dividends: number | null;
  shareBuybacks: number | null;
  capitalReturns: number | null;
  investmentBankingFees: number | null;
  tradingRevenue: number | null;
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
  workingCapital: number | null;
  totalDebt: number | null;
  netDebt: number | null;
  revenueGrowth: number | null;
  revenueCagr: number | null;
  netMargin: number | null;
  netMarginChange: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  operatingCashFlowMargin: number | null;
  freeCashFlowMargin: number | null;
  cashConversion: number | null;
  currentRatio: number | null;
  liabilitiesAssets: number | null;
  metricKeys: Record<string, string>;
};

export type DashboardMetric = {
  metricKey: string;
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
  metricReferences: string[];
};

export type RiskPoint = {
  title: string;
  evidence: string;
  thesisBreaker: string;
  metricReferences: string[];
};

export type Scenario = {
  name: "Bear" | "Base" | "Bull";
  revenueGrowth: number | null;
  netMargin: number | null;
  operatingCashFlowMargin: number | null;
  capexFactor: number | null;
  projectedRevenue: number | null;
  projectedNetIncome: number | null;
  projectedFreeCashFlow: number | null;
  enterpriseValueMultiple: number;
  valuationMethod: string;
  valuationStartingPoint: number | null;
  valuationMetric: number | null;
  multipleLabel: string;
  impliedValueLabel: string;
  modelImpliedEnterpriseValue: number | null;
  netDebtAdjustment: number | null;
  modelImpliedEquityValue: number | null;
  dilutedShares: number | null;
  impliedPricePerShare: number | null;
  impliedPriceToEarnings: number | null;
  impliedDividendYield: number | null;
  costOfEquityAssumption: number | null;
  rotceCostOfEquitySpread: number | null;
  metricReferences: Record<string, string>;
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
  canonicalKey: string;
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
  evidenceTitle: string;
  evidencePublisher: string;
  evidenceDate: string;
  evidenceUrl: string;
  investmentImplication: string;
  metricReferences: string[];
};

export type PeerComparisonItem = {
  ticker: string;
  name: string;
  rationale: string;
  revenueGrowth: number | null;
  netMargin: number | null;
  freeCashFlowMargin: number | null;
  periodEnd: string | null;
  metrics: Array<{
    id: string;
    label: string;
    value: number | null;
    canonicalKey: string;
  }>;
  metricReferences: Record<string, string>;
};

export type InvestmentDebate = {
  question: string;
  evidenceFor: string;
  evidenceAgainst: string;
  monitor: string;
  interpretation: string;
  metricReferences: string[];
};

export type ProductMetricObject = {
  product: string;
  therapeuticArea: string;
  period: string;
  periodType: "annual" | "quarterly";
  revenue: number;
  priorRevenue: number | null;
  revenueGrowth: number | null;
  revenueShare: number | null;
  indication: string;
  geography: string;
  volumePrice: string;
  supplyCapacity: string;
  approvalStatus: string;
  patentLifecycle: string;
  commercialRisks: string;
  classification: EvidenceKind;
  sourceTitle: string;
  sourceDate: string;
  sourceUrl: string;
  metricReferences: Record<string, string>;
};

export type PipelineAsset = {
  asset: string;
  indication: string;
  stage: string;
  latestMilestone: string;
  nextMilestone: string;
  successProbability: string;
  launchTiming: string;
  peakSalesAssumption: string;
  valuationTreatment: string;
  classification: EvidenceKind;
  sourceTitle: string;
  sourceDate: string;
  sourceUrl: string;
};

export type MarketValuationSnapshot = {
  asOfDate: string;
  sharePrice: number;
  marketCapitalization: number;
  enterpriseValue: number;
  netDebtAdjustment: number;
  dilutedShares: number;
  currentEvRevenue: number;
  currentPe: number;
  currentEvEbitda: number | null;
  formulas: string[];
  sourceTitle: string;
  sourceUrl: string;
  metricReferences: Record<string, string>;
};

export type CatalystPoint = {
  timing: string;
  event: string;
  investorRelevance: string;
  metricReferences: string[];
};

export type MetricUsage = {
  module: string;
  canonicalKey: string;
  canonicalValue: number | null;
  displayedValue: string | null;
};

export type ReportRenderingModel = {
  json: string;
  web: string;
  pdf: string;
  tables: string;
  charts: string;
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
  classification: CompanyClassification;
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
  metricRegistry: MetricRegistrySnapshot;
  metricUsage: MetricUsage[];
  renderingModel: ReportRenderingModel;
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
  productMetrics: ProductMetricObject[];
  pipelineAssets: PipelineAsset[];
  marketValuation: MarketValuationSnapshot | null;
  metricCoverage: MetricCoverageSummary;
  metricExtractionAudit: MetricExtractionAudit[];
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
