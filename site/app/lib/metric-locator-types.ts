export type MetricStatus =
  | "Reported"
  | "Derived"
  | "Not yet extracted"
  | "Not disclosed by issuer"
  | "Unable to calculate"
  | "Definition mismatch"
  | "Extraction failed";

export type MetricSourceTier =
  | "standard-sec-xbrl"
  | "filing-custom-xbrl"
  | "filing-html-table"
  | "filing-text"
  | "earnings-release-exhibit"
  | "investor-presentation";

export type MetricPeriodRule =
  | "fiscal-year-duration"
  | "fiscal-year-end-instant"
  | "latest-reported-period";

export type MetricValueKind =
  | "currency"
  | "rate"
  | "volume"
  | "count";

export type MetricConcept = {
  taxonomy: string;
  concept: string;
  definitionKey: string;
};

export type MetricTextRule = {
  sourceTier: "filing-html-table" | "filing-text" | "earnings-release-exhibit" | "investor-presentation";
  pattern: RegExp;
  captureGroup?: number;
  scale: number;
  unit: string;
  currency?: string;
  section: string;
  table?: string;
  row: string;
  rawLabel: string;
  accountingDefinition: string;
  definitionKey: string;
  confidence: number;
};

export type MetricDefinition = {
  id: string;
  displayName: { zh: string; en: string };
  aliases: string[];
  acceptedUnits: string[];
  periodRule: MetricPeriodRule;
  preferredSources: MetricSourceTier[];
  standardConcepts: MetricConcept[];
  customConcepts: MetricConcept[];
  textRules: MetricTextRule[];
  derivationFormula?: string;
  requiredInputs: string[];
  validationRules: string[];
  acceptedDefinitionKeys: string[];
  valueKind: MetricValueKind;
  visible: boolean;
  minimum?: number;
  maximum?: number;
};

export type MetricDocument = {
  id: string;
  company: string;
  title: string;
  url: string;
  filingDate: string;
  sourceDate: string;
  reportingPeriod: string;
  form: string;
  html: string;
  extractionMethodSuffix?: string;
};

export type CompanyFactEntry = {
  start?: string;
  end?: string;
  val?: number;
  form?: string;
  filed?: string;
  accn?: string;
};

export type CompanyFactsPayload = {
  cik: number;
  entityName: string;
  facts: Record<
    string,
    Record<
      string,
      {
        label?: string;
        description?: string;
        units?: Record<string, CompanyFactEntry[]>;
      }
    >
  >;
};

export type MetricCandidate = {
  metricId: string;
  company: string;
  periodStart?: string;
  reportingPeriod: string;
  value: number;
  rawValue: string;
  unit: string;
  currency?: string;
  status: "Reported";
  sourceTier: MetricSourceTier;
  sourceDocument: string;
  sourceUrl: string;
  filingDate: string;
  sourceDate: string;
  section: string;
  table?: string;
  row: string;
  rawLabel: string;
  formula?: string;
  confidence: number;
  extractionMethod: string;
  accountingDefinition: string;
  definitionKey: string;
  context: string;
};

export type MetricExtractionBatch = {
  candidates: MetricCandidate[];
  searchedSources: MetricSourceTier[];
  extractionFailures: Partial<Record<MetricSourceTier, string>>;
};

export type RejectedMetricCandidate = {
  sourceTier: MetricSourceTier;
  sourceDocument: string;
  sourceUrl: string;
  reportingPeriod: string;
  rawLabel: string;
  rawValue: string;
  value: number;
  unit: string;
  rejectionReasons: string[];
};

export type MetricLocatorResult = {
  metricId: string;
  displayName: { zh: string; en: string };
  found: boolean;
  selectedValue: number | null;
  displayValue: string | null;
  period: string | null;
  unit: string | null;
  currency: string | null;
  status: MetricStatus;
  sourceTier: MetricSourceTier | null;
  sourceDocument: string | null;
  sourceUrl: string | null;
  filingDate: string | null;
  sourceDate: string | null;
  section: string | null;
  table: string | null;
  row: string | null;
  rawLabel: string | null;
  rawValue: string | null;
  definitionId: string;
  formula: string | null;
  confidence: number;
  extractionMethod: string | null;
  accountingDefinition: string | null;
  reason: string | null;
  rejectedCandidates: RejectedMetricCandidate[];
};

export type MetricLocatorAudit = {
  company: string;
  reportingPeriod: string;
  searchedSources: MetricSourceTier[];
  results: MetricLocatorResult[];
  allResults: MetricLocatorResult[];
  extractionSuccessRate: number;
  extractedCount: number;
  requestedCount: number;
  generatedAt: string;
};
