export type RegulatoryLocale = "en" | "zh";
export type LocalText = { en: string; zh: string };

export type IndustryId =
  | "ev-battery-materials"
  | "battery-cells-modules"
  | "energy-storage"
  | "critical-minerals"
  | "automotive-components"
  | "solar-manufacturing"
  | "advanced-manufacturing";

export type RoleId =
  | "chinese-material-manufacturer"
  | "technology-owner"
  | "us-jv-participant"
  | "battery-supplier"
  | "storage-supplier"
  | "manufacturing-investor";

export type PlanId =
  | "us-factory"
  | "us-jv"
  | "license-technology"
  | "supply-materials"
  | "localize-supply-chain"
  | "compare-structures";

export type ObjectiveId =
  | "reduce-pfe-exposure"
  | "preserve-customer-readiness"
  | "compare-equity-licensing"
  | "increase-localization"
  | "prepare-customer-review"
  | "identify-requirements";

export type ProductId =
  | "cathode-active-material"
  | "anode-active-material"
  | "battery-cell"
  | "battery-module"
  | "energy-storage-technology"
  | "applicable-critical-mineral"
  | "other-battery-component"
  | "not-sure";

export type CreditId = "45X" | "48E" | "45Y" | "downstream" | "not-sure";
export type ScenarioAnswerValue = "yes" | "no" | "not-sure";

export type ScenarioQuestionId =
  | "sfe-equity"
  | "multiple-sfe-equity"
  | "appointment-right"
  | "sfe-debt"
  | "sfe-license"
  | "supplier-direction"
  | "production-direction"
  | "quantity-timing"
  | "customer-output-restriction"
  | "exclusive-equipment-rights"
  | "royalty-over-ten-years"
  | "services-over-two-years"
  | "complete-technical-transfer"
  | "pfe-materials"
  | "substantial-us-manufacturing"
  | "customer-credit-claim";

export type ScenarioAnswer = {
  questionId: ScenarioQuestionId;
  value: ScenarioAnswerValue;
};

export type RegulatoryScenario = {
  industry: IndustryId | null;
  role: RoleId | null;
  plan: PlanId | null;
  objective: ObjectiveId | null;
  product: ProductId | null;
  credit: CreditId | null;
  year: number | null;
  answers: ScenarioAnswer[];
};

export type LegalSourceStatus =
  | "Enacted"
  | "Final Regulation"
  | "Proposed Regulation"
  | "Interim Guidance"
  | "Official Instructions"
  | "Superseded"
  | "Withdrawn"
  | "Pending Verification";

export type LegalSource = {
  sourceId: string;
  title: string;
  issuingAuthority: string;
  sourceType: string;
  publicationDate: string;
  effectiveDate: string | null;
  status: LegalSourceStatus;
  url: string;
  relevantSections: string[];
  summary: LocalText;
  lastVerifiedAt: string;
  supersedes: string[];
  supersededBy: string[];
  applicablePrograms: CreditId[];
  applicableIndustries: IndustryId[];
  notes: LocalText;
};

export type RuleTopic =
  | "single-sfe-ownership"
  | "aggregate-sfe-ownership"
  | "sfe-debt"
  | "covered-officer-appointment"
  | "effective-control"
  | "supplier-direction"
  | "production-direction"
  | "output-restriction"
  | "critical-data-restriction"
  | "exclusive-equipment-rights"
  | "royalty-duration"
  | "service-duration"
  | "technical-data-transfer"
  | "licensing-date"
  | "45x-battery-macr"
  | "45x-mineral-macr"
  | "45y-facility-macr"
  | "48e-facility-macr"
  | "48e-storage-macr";

export type RegulatoryRule = {
  ruleId: string;
  topic: RuleTopic;
  label: LocalText;
  description: LocalText;
  triggerOperator: "at-least" | "more-than" | "any" | "listed-factor";
  triggerValue: number | string;
  unit: "percent" | "years" | "authority" | "factor";
  applicableYear: number | "all" | "2030+" | "2033+";
  applicableEvent: LocalText;
  applicableProduct: ProductId[] | ["all"];
  applicableCredit: CreditId[];
  sourceIds: string[];
  sourceSections: string[];
  ruleStatus: LegalSourceStatus;
  effectiveDate: string;
  lastVerifiedAt: string;
  caveats: LocalText;
};

export type ThresholdTable = {
  tableId: string;
  label: LocalText;
  credit: CreditId[];
  products: ProductId[];
  event: LocalText;
  values: { fromYear: number; toYear: number; percentage: number; ruleId: string }[];
};

export type ProposedParameter = {
  parameter: LocalText;
  proposedValue: LocalText;
  legalTrigger: LocalText;
  whyItMatters: LocalText;
  referenceSourceIds: string[];
};

export type RiskFactor = {
  factorId: string;
  label: LocalText;
  severity: "Lower" | "Medium" | "Higher" | "Further review required";
  sourceIds: string[];
};

export type StructureTemplate = {
  structureId: "minority-jv" | "us-controlled" | "technology-license";
  name: LocalText;
  description: LocalText;
  parameters: ProposedParameter[];
  considerations: LocalText[];
  riskLabel: LocalText;
  sourceIds: string[];
};

export type ProposedStructure = StructureTemplate & {
  rank: number;
  scenarioNotes: LocalText[];
  riskFactors: RiskFactor[];
};

export type ComparisonValue =
  | "Lower"
  | "Medium"
  | "Higher"
  | "Depends on facts"
  | "Not applicable"
  | "Further review required";

export type StructureComparison = {
  dimension: LocalText;
  values: Record<StructureTemplate["structureId"], ComparisonValue>;
};

export type ProfessionalReviewQuestion = {
  audience: LocalText;
  question: LocalText;
  sourceIds: string[];
};

export type ReferenceCitation = {
  number: number;
  source: LegalSource;
};

export type RegulatoryProposalReport = {
  reportId: string;
  generatedAt: string;
  locale: RegulatoryLocale;
  scenario: RegulatoryScenario;
  applicableRules: RegulatoryRule[];
  applicableMacrRule: RegulatoryRule | null;
  structures: ProposedStructure[];
  comparison: StructureComparison[];
  proposedDirection: string[];
  uncertainties: string[];
  informationNeeded: string[];
  professionalQuestions: ProfessionalReviewQuestion[];
  references: ReferenceCitation[];
  sourceCoverage: {
    status: "Current" | "Current-source verification required";
    rulesLastVerified: string;
    officialSourcesReviewed: number;
    interimOrProposedGuidance: string[];
    potentiallySupersedingGuidance: string[];
    unresolvedGaps: string[];
  };
  disclaimer: string[];
};

