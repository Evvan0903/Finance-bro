export type CoverageTier = 1 | 2 | 3;

export type CoverageCompanyType =
  | "non-financial"
  | "bank"
  | "diversified-financial"
  | "foreign-private-issuer";

export type MetricExtractionStatus =
  | "found"
  | "derived"
  | "missing"
  | "not-disclosed"
  | "not-applicable"
  | "candidate-only"
  | "rejected";

export type MetricMissingReason =
  | "standard-concept-match"
  | "issuer-specific-concept-match"
  | "derived-from-components"
  | "standard-tag-not-mapped"
  | "custom-tag-not-mapped"
  | "dimensional-fact-not-parsed"
  | "filing-table-not-parsed"
  | "period-mismatch"
  | "duration-mismatch"
  | "unit-mismatch"
  | "currency-mismatch"
  | "duplicate-candidates"
  | "conflicting-candidates"
  | "calculation-input-missing"
  | "source-fetch-failed"
  | "not-disclosed"
  | "not-applicable"
  | "failed-validation";

export type MetricCoverageSource =
  | "company-facts"
  | "filing-inline-xbrl"
  | "filing-custom-xbrl"
  | "filing-dimensions"
  | "filing-html-table"
  | "derived-metric-engine";

export type MetricApplicability = {
  metricId: string;
  applicableTo:
    | "all"
    | "non-financial"
    | "financial"
    | "bank"
    | "foreign-private-issuer"
    | string[];
  excludedPackIds?: string[];
  requiredPackIds?: string[];
};

export type MetricCoverageExpectation = {
  metricId: string;
  definitionIds: string[];
  tier: CoverageTier;
  applicability: MetricApplicability;
  derivationInputMetricIds?: string[];
};

export type MetricExtractionAudit = {
  metricId: string;
  definitionId: string | null;
  tier: CoverageTier;
  applicable: boolean;
  status: MetricExtractionStatus;
  reason: MetricMissingReason;
  searchedSources: MetricCoverageSource[];
  searchedConcepts: string[];
  candidateConcepts: string[];
  selectedCanonicalKey?: string;
  selectedSourceUrl?: string;
  selectedPeriod?: string;
  selectedUnit?: string;
  selectedValue?: number | string;
  selectedSelectionReason?: string;
  rejectionReasons?: string[];
  traceId?: string;
};

export type CoverageTierSummary = {
  applicable: number;
  found: number;
  derived: number;
  missing: number;
  coverage: number;
};

export type PackCoverageSummary = {
  applicable: number;
  found: number;
  missing: number;
  coverage: number;
};

export type MetricCoverageSummary = {
  tier1: CoverageTierSummary;
  tier2: CoverageTierSummary;
  packSpecific: PackCoverageSummary;
  overallCoverage: number;
  reportMode: "full" | "standard" | "limited";
  filingLevelMetricCount: number;
  missingReasonCounts: Record<string, number>;
};

export type CoverageBenchmark = {
  ticker: string;
  cik?: string;
  packId: string;
  companyType: CoverageCompanyType;
  expectedApplicableMetrics: string[];
  requiredMetrics: string[];
  minimumTier1Coverage: number;
  minimumTier2Coverage?: number;
  allowedMissingMetrics?: Array<{ metricId: string; reason: string }>;
};
