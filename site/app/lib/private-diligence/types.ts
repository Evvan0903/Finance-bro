export type DiligenceLocale = "en" | "zh";
export type ReportDepth = "Standard" | "Compact";
export type ResearchObjective =
  | "General diligence"
  | "Investor screening"
  | "Vendor diligence"
  | "Acquisition screening"
  | "Partnership review"
  | "Customer review";

export type PrivateCompanyInput = {
  companyName: string;
  website: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  founderOrExecutive: string | null;
  industry: string | null;
  researchObjective: ResearchObjective;
  locale: DiligenceLocale;
  reportDepth: ReportDepth;
};

export type ResolutionStatus =
  | "autoConfirmed"
  | "requiresUserConfirmation"
  | "rejected"
  | "unresolved";
export type MatchConfidence = "High" | "Medium" | "Low";

export type EntityCandidate = {
  candidateId: string;
  displayName: string;
  legalName: string | null;
  dbaNames: string[];
  formerNames: string[];
  website: string | null;
  domain: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  industry: string | null;
  founders: string[];
  executives: string[];
  registrationJurisdiction: string | null;
  registrationNumbers: string[];
  addresses: string[];
  phoneNumbers: string[];
  emailDomains: string[];
  sourceIds: string[];
  matchSignals: string[];
  matchScore: number;
  matchConfidence: MatchConfidence;
  resolutionStatus: ResolutionStatus;
};

export type EntityIdentityGraph = {
  entityId: string;
  canonicalName: string;
  legalNames: string[];
  dbaNames: string[];
  formerNames: string[];
  domains: string[];
  emailDomains: string[];
  addresses: string[];
  phoneNumbers: string[];
  founders: string[];
  executives: string[];
  directors: string[];
  registrationNumbers: string[];
  registrationJurisdictions: string[];
  cikCandidates: string[];
  ueiCandidates: string[];
  cageCodes: string[];
  samEntityIds: string[];
  usaSpendingRecipientIds: string[];
  patentAssigneeNames: string[];
  trademarkOwnerNames: string[];
  parentCompanies: string[];
  subsidiaries: string[];
  affiliatedEntities: string[];
  socialProfiles: string[];
  industryLabels: string[];
  identityConfidence: MatchConfidence;
  identityLimitations: string[];
};

export type SourceTier = 1 | 2 | 3 | 4;
export type ProviderCategory =
  | "discovery"
  | "companyDirect"
  | "officialRegistration"
  | "financing"
  | "governmentContract"
  | "publicFunding"
  | "intellectualProperty"
  | "licensing"
  | "regulatory"
  | "litigation"
  | "marketContext"
  | "independentVerification";
export type ProviderStatus =
  | "success"
  | "partial"
  | "noData"
  | "notRelevant"
  | "invalidConfiguration"
  | "authenticationFailed"
  | "invalidRequest"
  | "rateLimited"
  | "timeout"
  | "upstreamUnavailable"
  | "parseFailed"
  | "manualVerificationRequired";

export type RawEvidence = {
  evidenceId: string;
  researchId: string;
  entityId: string;
  providerId: string;
  sourceTier: SourceTier;
  sourceType: string;
  sourceTitle: string;
  sourceUrl: string;
  publicReferenceUrl: string;
  publicationDate: string | null;
  retrievedAt: string;
  rawText: string;
  structuredData: Record<string, unknown>;
  matchedEntitySignals: string[];
  entityMatchConfidence: MatchConfidence;
  companyReported: boolean;
  officialRecord: boolean;
  independentlyPublished: boolean;
  contentHash: string;
  limitations: string[];
};

export type VerificationEligibility =
  | "finalEvidence"
  | "supportingEvidence"
  | "leadOnly"
  | "excluded";

export type NormalizedEvidence = {
  evidenceId: string;
  entityId: string;
  providerId: string;
  sourceTier: SourceTier;
  evidenceType: string;
  subjectName: string;
  subjectIdentifiers: string[];
  normalizedFields: Record<string, string | number | boolean | null | string[]>;
  sourceTitle: string;
  sourceUrl: string;
  publicationDate: string | null;
  retrievedAt: string;
  companyReported: boolean;
  officialRecord: boolean;
  independentlyPublished: boolean;
  entityMatchConfidence: MatchConfidence;
  verificationEligibility: VerificationEligibility;
  limitations: string[];
};

export type ClaimStatus =
  | "Verified"
  | "Corroborated"
  | "CompanyReported"
  | "PubliclyReported"
  | "Inferred"
  | "Conflicting"
  | "Outdated"
  | "Unverified";
export type ClaimMateriality = "Critical" | "High" | "Medium" | "Low";

export type PrivateCompanyClaim = {
  claimId: string;
  researchId: string;
  entityId: string;
  category: string;
  claimType: string;
  statement: string;
  normalizedValue: string | number | boolean | null;
  unit: string | null;
  period: string | null;
  geography: string | null;
  evidenceIds: string[];
  companyReported: boolean;
  independentlyVerified: boolean;
  officiallyVerified: boolean;
  conflictingEvidenceIds: string[];
  status: ClaimStatus;
  confidence: MatchConfidence;
  materiality: ClaimMateriality;
  limitations: string[];
};

export type ConflictRecord = {
  conflictId: string;
  claimType: string;
  subject: string;
  values: string[];
  evidenceIds: string[];
  sourceDates: Array<string | null>;
  sourceTiers: SourceTier[];
  materiality: ClaimMateriality;
  possibleExplanation: string;
  resolutionStatus:
    | "unresolved"
    | "likelyDateDefinitionDifference"
    | "likelyEntityDifference"
    | "supersededByNewerOfficialRecord"
    | "requiresManagementConfirmation";
};

export type RiskFinding = {
  riskId: string;
  category: string;
  title: string;
  description: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Informational";
  evidenceIds: string[];
  claimIds: string[];
  status: "Open" | "Mitigated" | "Requires verification";
  mitigatingEvidence: string[];
  limitations: string[];
};

export type InformationGap = {
  gapId: string;
  category: string;
  missingInformation: string;
  whyItMatters: string;
  affectedClaims: string[];
  affectedSections: string[];
  priority: "Critical" | "High" | "Medium" | "Low";
  recommendedEvidence: string[];
  publicSearchCoverage: string;
};

export type DueDiligenceQuestion = {
  questionId: string;
  category: string;
  question: string;
  reason: string;
  claimBeingVerified: string | null;
  priority: "Critical" | "High" | "Medium" | "Low";
  recommendedEvidence: string[];
  relatedGapIds: string[];
};

export type RelationshipClaim = {
  relationshipId: string;
  relationshipType: "customer" | "partner" | "supplier" | "investor" | "accelerator" | "university" | "government agency";
  counterparty: string;
  status:
    | "Confirmed by both parties"
    | "Confirmed by counterparty"
    | "Company claimed only"
    | "Publicly reported"
    | "Historical"
    | "Potential match"
    | "Unverified";
  evidenceIds: string[];
};

export type BusinessModelProfile = {
  products: string[];
  services: string[];
  customerTypes: string[];
  industryVerticals: string[];
  revenueModel: string | null;
  pricingModel: string | null;
  salesMotion: string | null;
  deliveryModel: string | null;
  recurringRevenueStatus: string | null;
  geographicExposure: string[];
  valueChainPosition: string | null;
  keyPartners: string[];
  keySuppliers: string[];
  capitalIntensity: string | null;
  operatingDependencies: string[];
  businessModelEvidenceIds: string[];
};

export type ProviderDiagnostic = {
  provider: string;
  configured: boolean;
  requestAttempted: boolean;
  status: ProviderStatus;
  sourceCategory: ProviderCategory;
  searchQueryType: string;
  usableRecords: number;
  entityMatches: number;
  rejectedWeakMatches: number;
  rateLimitState: "clear" | "limited" | "unknown";
  sanitizedIssue: string | null;
  lastSuccessfulRetrievalTime: string | null;
};

export type PrivateProviderResult = {
  providerId: string;
  providerName: string;
  sourceTier: SourceTier;
  providerCategory: ProviderCategory;
  status: ProviderStatus;
  evidence: RawEvidence[];
  diagnostic: ProviderDiagnostic;
  manualVerificationLinks: string[];
};

export type ProviderPlanItem = {
  providerId: string;
  providerName: string;
  sourceTier: SourceTier;
  providerCategory: ProviderCategory;
  selected: boolean;
  reason: string;
};

export type ReportSection = {
  sectionId: string;
  number: string;
  title: { en: string; zh: string };
  paragraphs: string[];
  claimIds: string[];
  evidenceIds: string[];
};

export type PrivateDiligenceReport = {
  reportId: string;
  researchId: string;
  reportVersion: "clara-v1";
  generatedAt: string;
  locale: DiligenceLocale;
  input: PrivateCompanyInput;
  entity: EntityIdentityGraph;
  coverageStatus:
    | "Strong public-source coverage"
    | "Moderate public-source coverage"
    | "Limited public-source coverage"
    | "Insufficient entity resolution";
  providerPlan: ProviderPlanItem[];
  evidence: NormalizedEvidence[];
  claims: PrivateCompanyClaim[];
  conflicts: ConflictRecord[];
  risks: RiskFinding[];
  informationGaps: InformationGap[];
  questions: DueDiligenceQuestion[];
  relationships: RelationshipClaim[];
  businessModel: BusinessModelProfile;
  sections: ReportSection[];
  references: Array<{
    number: number;
    evidenceId: string;
    sourceTitle: string;
    sourceUrl: string;
    publicationDate: string | null;
    retrievedAt: string;
    sourceTier: SourceTier;
  }>;
  disclosure: string;
  methodologyLimitations: string[];
};

export type PrivateDiligenceResearchRecord = {
  researchId: string;
  createdAt: string;
  updatedAt: string;
  stage: string;
  stageStatus: "running" | "requiresConfirmation" | "complete" | "failed";
  input: PrivateCompanyInput;
  candidates: EntityCandidate[];
  confirmedCandidate: EntityCandidate | null;
  identityGraph: EntityIdentityGraph | null;
  providerPlan: ProviderPlanItem[];
  providerResults: PrivateProviderResult[];
  rawEvidence: RawEvidence[];
  normalizedEvidence: NormalizedEvidence[];
  report: PrivateDiligenceReport | null;
  errorCode: string | null;
};
