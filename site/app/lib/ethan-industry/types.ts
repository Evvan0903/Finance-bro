import type { CompanyClassification } from "../research-classification/types";
import type { FinancialPeriod, ResearchLocale } from "../research-types";
import type { ResearchSelection } from "../sector-types";
import type {
  ClassificationCandidate,
  IndustryMetric,
  MarketDefinition,
  MarketReport,
  MarketScopeInput,
} from "../market-analysis/types";

export type IndustryClassificationConfidence = "high" | "medium" | "low";

export type EthanCompanyIdentity = {
  ticker: string;
  companyName: string;
  cik: string;
  sicCode: string | null;
  sicDescription: string | null;
};

export type EthanReportedSegment = {
  name: string;
  analyticalRole: "reportable segment" | "end-market revenue category";
  revenueWeight: number | null;
  sourceNote: string;
};

/**
 * Curated bridge between Ethan's company classification and the limited set of
 * official public-data classifications that can support an industry overlay.
 * It deliberately records commercial-boundary limitations instead of treating
 * SIC, NAICS, and a company end market as interchangeable concepts.
 */
export type CompanyIndustryProfile = EthanCompanyIdentity & {
  sector: string;
  industry: string;
  subindustry: string;
  primaryMarket: string;
  secondaryMarkets: string[];
  reportedSegments: EthanReportedSegment[];
  naicsCodes: string[];
  beaIndustryCodes: string[];
  preferredFredSeries: string[];
  preferredCensusDatasets: string[];
  preferredBlsSeries: string[];
  relevantPolicyTopics: string[];
  peerTickers: string[];
  classificationConfidence: IndustryClassificationConfidence;
  classificationMethod: string;
  classificationLimitations: string[];
  candidates: ClassificationCandidate[];
  canRunOfficialMarketData: boolean;
};

export type CompanyIndustryComparisonCompatibility =
  | "Comparable"
  | "Comparable after normalization"
  | "Directionally comparable"
  | "Proxy comparison"
  | "Not comparable";

export type EthanCompanyMetric = {
  metricId: string;
  label: string;
  value: number;
  unit: string;
  period: string;
  canonicalKey: string | null;
  sourceType: "reported" | "derived";
};

export type CompanyIndustryComparison = {
  companyMetricId: string;
  industryMetricId: string;
  companyPeriod: string;
  industryPeriod: string;
  companyUnit: string;
  industryUnit: string;
  geography: string;
  classification: string;
  normalizationMethod: string;
  compatibilityStatus: CompanyIndustryComparisonCompatibility;
  interpretationLimitations: string[];
  companyValue: number | null;
  industryValue: number | null;
  industryEvidenceIds: string[];
  chartEligible: boolean;
};

export type EthanIndustryCoverageStatus =
  | "disabled"
  | "mapping-review"
  | "available"
  | "partial"
  | "unavailable";

export type EthanIndustryCoverageOverallStatus =
  | "Strong official-data coverage"
  | "Partial official-data coverage"
  | "Proxy-based industry context"
  | "Insufficient industry data";

export type EthanIndustryCoverage = {
  status: EthanIndustryCoverageStatus;
  overallStatus: EthanIndustryCoverageOverallStatus;
  directOfficialMetricCount: number;
  proxyMetricCount: number;
  observationPeriod: string | null;
  dataRetrievalDate: string | null;
};

export type EthanIndustryAnalysis = {
  included: boolean;
  profile: CompanyIndustryProfile | null;
  scope: MarketScopeInput | null;
  marketDefinition: MarketDefinition | null;
  marketReport: MarketReport | null;
  companyMetrics: EthanCompanyMetric[];
  industryMetrics: IndustryMetric[];
  comparisons: CompanyIndustryComparison[];
  coverage: EthanIndustryCoverage;
};

export type BuildEthanIndustryAnalysisInput = {
  company: EthanCompanyIdentity;
  classification: CompanyClassification;
  selection: ResearchSelection;
  periods: FinancialPeriod[];
  locale: ResearchLocale;
  includeIndustryMarketAnalysis: boolean;
  now?: () => Date;
};
