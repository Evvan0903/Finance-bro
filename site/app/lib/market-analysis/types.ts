export type MarketLocale = "en" | "zh";
export type MarketMode = "analyze" | "trend" | "compare";
export type ReportDepth = "compact" | "standard";
export type MarketOutputFormat = "web" | "pdf" | "markdown";

export type ProviderId =
  | "fred"
  | "bea"
  | "census"
  | "sec"
  | "bls"
  | "worldBank"
  | "congressGov"
  | "govInfo";

export type ProviderType =
  | "macroeconomic"
  | "industryEconomic"
  | "businessDemographic"
  | "companyDisclosure"
  | "labor"
  | "international"
  | "policy";

export type ProviderConfigurationStatus =
  | "configured"
  | "missing"
  | "invalid"
  | "rateLimited"
  | "temporarilyUnavailable";

export type ProviderExecutionStatus =
  | "used"
  | "unavailable"
  | "notRelevant"
  | "missingConfiguration"
  | "incomplete";

export type PipelineStageStatus =
  | "pending"
  | "running"
  | "complete"
  | "partial"
  | "failed"
  | "requiresReview";

export type MarketResearchStage =
  | "inputValidation"
  | "classificationSearch"
  | "scopeConfirmation"
  | "providerPlanning"
  | "dataRetrieval"
  | "sourceNormalization"
  | "evidenceRegistry"
  | "metricCalculation"
  | "compatibilityReview"
  | "analysis"
  | "reportGeneration"
  | "citationValidation"
  | "reportQa";

export type FocusArea =
  | "industryFootprint"
  | "economicContribution"
  | "establishments"
  | "employment"
  | "payrollLaborCost"
  | "regionalConcentration"
  | "demandIndicators"
  | "supplyIndicators"
  | "macroEnvironment"
  | "publicCompanyEvidence"
  | "policyEnvironment"
  | "risks"
  | "scenarioOutlook";

export type ComparisonCriterion =
  | "industryOutput"
  | "valueAdded"
  | "establishments"
  | "employment"
  | "payroll"
  | "payrollPerEmployee"
  | "growth"
  | "regionalConcentration"
  | "laborCost"
  | "macroEnvironment"
  | "capitalIntensity"
  | "policyContext"
  | "risks";

export type MarketScopeInput = {
  mode: MarketMode;
  market: string;
  subjectB?: string;
  geography: string;
  geographyB?: string;
  startYear: number;
  endYear: number;
  analysisYear: number;
  researchQuestion: string;
  focusAreas: FocusArea[];
  comparisonCriteria: ComparisonCriterion[];
  leadingIndicators: string[];
  tickers: string[];
  locale: MarketLocale;
  reportDepth: ReportDepth;
  outputFormat: MarketOutputFormat;
};

export type MappingKind =
  | "naics"
  | "beaIndustry"
  | "fredSeries"
  | "censusDataset"
  | "blsSeries"
  | "worldBankIndicator"
  | "publicCompany";

export type ClassificationCandidate = {
  mappingId: string;
  kind: MappingKind;
  code: string;
  officialLabel: string;
  description: string;
  providerId: ProviderId;
  includedScope: string;
  knownExclusions: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  selected: boolean;
  isProxy: boolean;
};

export type OfficialClassificationMapping = ClassificationCandidate & {
  userConfirmed: true;
};

export type MarketDefinition = {
  marketName: string;
  commercialDefinition: string;
  officialClassificationMappings: OfficialClassificationMapping[];
  includedActivities: string[];
  excludedActivities: string[];
  adjacentActivities: string[];
  geography: string;
  customerGroups: string[];
  revenueBoundary: string;
  valueChainBoundary: string;
  selectedProxies: string[];
  definitionLimitations: string[];
  userConfirmed: true;
};

export type ProviderPlanItem = {
  providerId: ProviderId;
  providerName: string;
  selected: boolean;
  reason: string;
  configurationStatus: ProviderConfigurationStatus;
  expectedEvidence: string[];
};

export type ProviderPlan = {
  generatedAt: string;
  mode: MarketMode;
  items: ProviderPlanItem[];
};

export type MarketSourceReference = {
  providerId: ProviderId;
  providerName: string;
  dataset: string;
  seriesOrTableId: string;
  officialTitle: string;
  officialSourceUrl: string;
  geography: string;
  observationPeriod: string;
  units: string;
  retrievedAt: string;
  relevance: string;
};

export type MarketEvidence = {
  evidenceId: string;
  providerId: ProviderId;
  dataset: string;
  seriesOrTableId: string;
  sourceTitle: string;
  officialSourceUrl: string;
  retrievedAt: string;
  publicationDate: string | null;
  observationPeriod: string;
  geography: string;
  industryCode: string | null;
  marketScope: string;
  metricLabel: string;
  value: number | string;
  unit: string;
  currency: string | null;
  frequency: "annual" | "quarterly" | "monthly" | "daily" | "pointInTime";
  seasonalAdjustment: string | null;
  isReported: boolean;
  isCalculated: boolean;
  isProxy: boolean;
  isForecast: false;
  calculationMethod: string | null;
  confidence: "high" | "medium" | "low";
  notes: string[];
};

export type IndustryMetricCategory =
  | "economic output"
  | "value added"
  | "establishments"
  | "employment"
  | "payroll"
  | "wages"
  | "population"
  | "demand proxy"
  | "supply proxy"
  | "regional concentration"
  | "macroeconomic"
  | "company evidence"
  | "policy context";

export type IndustryMetric = {
  metricId: string;
  canonicalLabel: string;
  displayLabel: string;
  category: IndustryMetricCategory;
  value: number | string;
  unit: string;
  currency: string | null;
  period: string;
  geography: string;
  industryScope: string;
  definition: string;
  method: string;
  providerIds: ProviderId[];
  evidenceIds: string[];
  confidence: "high" | "medium" | "low";
  isHistorical: boolean;
  isCalculated: boolean;
  isProxy: boolean;
  lowerBound: number | null;
  upperBound: number | null;
  limitations: string[];
};

export type ProviderResult = {
  providerId: ProviderId;
  providerName: string;
  status: ProviderExecutionStatus;
  configurationStatus: ProviderConfigurationStatus;
  evidence: MarketEvidence[];
  references: MarketSourceReference[];
  limitations: string[];
  errorCode: string | null;
  retrievedAt: string | null;
};

export type MarketDataRequest = {
  scope: MarketScopeInput;
  marketDefinition: MarketDefinition;
  plan: ProviderPlan;
};

export type MarketDataProvider = {
  providerId: ProviderId;
  providerName: string;
  providerType: ProviderType;
  isConfigured: () => boolean;
  supports: (request: MarketDataRequest) => boolean;
  validateConfiguration: () => ProviderConfigurationStatus;
  fetchMetadata: (request: MarketDataRequest) => Promise<Record<string, unknown>>;
  fetchData: (request: MarketDataRequest) => Promise<unknown>;
  normalizeResponse: (
    raw: unknown,
    request: MarketDataRequest,
    retrievedAt: string,
  ) => MarketEvidence[];
  buildSourceReference: (
    evidence: MarketEvidence,
  ) => MarketSourceReference;
};

export type ComparisonAssessment =
  | "Higher"
  | "Moderate"
  | "Lower"
  | "Mixed"
  | "Insufficient Evidence"
  | "Not Comparable";

export type ComparisonScore = {
  dimension: string;
  assessment: ComparisonAssessment;
  evidenceIds: string[];
  explanation: string;
};

export type MarketReportSection = {
  number: string;
  title: string;
  paragraphs: string[];
  metricIds: string[];
  evidenceIds: string[];
};

export type DataCoverage = {
  status:
    | "Complete for selected public-data scope"
    | "Partial public-data coverage"
    | "Limited proxy-based coverage"
    | "Insufficient structured data";
  providersConfigured: ProviderId[];
  providersUsed: ProviderId[];
  providersUnavailable: ProviderId[];
  providersNotRelevant: ProviderId[];
  datasetsUsed: string[];
  industryMappings: string[];
  geographiesCovered: string[];
  timePeriodsCovered: string[];
  metricsWithCompleteEvidence: number;
  metricsUsingProxies: number;
  metricsUnavailable: string[];
  dataRetrievedAt: string | null;
  reportGeneratedAt: string;
};

export type MarketReport = {
  researchId: string;
  mode: MarketMode;
  locale: MarketLocale;
  generatedAt: string;
  title: string;
  scope: MarketScopeInput;
  marketDefinition: MarketDefinition;
  providerPlan: ProviderPlan;
  providerResults: ProviderResult[];
  evidence: MarketEvidence[];
  metrics: IndustryMetric[];
  comparisonScorecard: ComparisonScore[];
  sections: MarketReportSection[];
  references: Array<MarketSourceReference & { number: number }>;
  dataCoverage: DataCoverage;
  disclosures: string[];
  methodology: string[];
  qa: {
    status: "passed" | "requiresReview" | "failed";
    findings: string[];
  };
};

export type MarketResearchRecord = {
  researchId: string;
  createdAt: string;
  updatedAt: string;
  request: MarketScopeInput;
  marketDefinition: MarketDefinition;
  providerPlan: ProviderPlan;
  stage: MarketResearchStage;
  stageStatus: PipelineStageStatus;
  providerResults: ProviderResult[];
  report: MarketReport | null;
  error: string | null;
};
