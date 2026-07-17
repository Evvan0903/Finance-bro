import type { ResearchLocale } from "./research-types";

export type LocalizedText = {
  zh: string;
  en: string;
};

export type ResearchMarket = "US" | "Europe" | "Global";
export type SupportedSector = "energy" | "technology";
export type SupportedSubindustry = "integrated-oil-gas" | "semiconductors";

export type ResearchOptions = {
  sectorOutlook: boolean;
  peerComparison: boolean;
  valuation: boolean;
  dueDiligence: boolean;
  pdfExport: boolean;
};

export type ResearchSelection = {
  market: ResearchMarket;
  sector: SupportedSector;
  subindustry: SupportedSubindustry;
  options: ResearchOptions;
};

export type SectorKpiDefinition = {
  id: string;
  label: LocalizedText;
  description: LocalizedText;
  availability:
    | "revenue"
    | "grossMargin"
    | "inventory"
    | "cashCapex"
    | "freeCashFlow"
    | "netDebt"
    | "notStandardized";
};

export type SectorDriverDefinition = {
  id: string;
  name: LocalizedText;
  companyExposure: LocalizedText;
  implication: LocalizedText;
  query: string;
};

export type SectorPeerDefinition = {
  ticker: string;
  cik: string;
  name: string;
  rationale: LocalizedText;
};

export type SectorValuationFramework = {
  method: LocalizedText;
  formula: LocalizedText;
  multipleLabel: string;
  multiples: {
    bear: number;
    base: number;
    bull: number;
  };
  metric: "freeCashFlow" | "revenue";
  fallback?: {
    method: LocalizedText;
    formula: LocalizedText;
    multipleLabel: string;
    multiples: {
      bear: number;
      base: number;
      bull: number;
    };
    metric: "operatingCashFlow";
  };
};

export type SectorPack = {
  id: SupportedSubindustry;
  sector: SupportedSector;
  sectorLabel: LocalizedText;
  subindustryLabel: LocalizedText;
  sicCodes: string[];
  coreKpis: SectorKpiDefinition[];
  researchQuestions: LocalizedText[];
  marketDrivers: SectorDriverDefinition[];
  peers: SectorPeerDefinition[];
  valuation: SectorValuationFramework;
  risks: LocalizedText[];
  catalysts: {
    operating: LocalizedText[];
    financial: LocalizedText[];
    regulatory: LocalizedText[];
  };
  reportGuidance: LocalizedText[];
};

export type SectorMethod = {
  id: string;
  sector: SupportedSector;
  subindustry: SupportedSubindustry;
  name: LocalizedText;
  purpose: LocalizedText;
  steps: LocalizedText[];
};

export type EvidenceGeography = ResearchMarket | "North America" | "International";

export type SectorResearchSourceType =
  | "government-outlook"
  | "industry-outlook"
  | "industry-statistics"
  | "regulatory-action";

export type SectorEvidenceSource = {
  id: string;
  title: string;
  publisher: string;
  publicationDate: string;
  retrievalDate: string;
  sourceType: SectorResearchSourceType;
  access: "public";
  sector: SupportedSector;
  subindustry: SupportedSubindustry;
  geography: EvidenceGeography[];
  topic: string;
  url: string;
  currentEvidence: LocalizedText;
  generalizedMethods: LocalizedText[];
  investorImplication: LocalizedText;
};

export type SectorLearningAudit = {
  acceptedSources: number;
  rejectedSources: number;
  extractedMethods: number;
  currentEvidenceItems: number;
  publicationWindowStart: string;
  publicationWindowEnd: string;
  rejectionReasons: Array<{ sourceId: string; reason: string }>;
};

export type EvidenceChunk = {
  id: string;
  source: SectorEvidenceSource;
  kind: "summary" | "method";
  text: string;
  score: number;
};

export type SectorOutlookClaim = {
  claim: string;
  whyItMatters: string;
  publisher: string;
  publicationDate: string;
  title: string;
  url: string;
  topic: string;
};

export type SectorOutlook = {
  sector: SupportedSector;
  subindustry: SupportedSubindustry;
  market: ResearchMarket;
  evidenceCutoff: string;
  lastRefreshedAt: string;
  claims: SectorOutlookClaim[];
  insufficientEvidence: boolean;
  methodology: string;
  learningAudit: Omit<SectorLearningAudit, "rejectionReasons">;
};

export function localize(text: LocalizedText, locale: ResearchLocale) {
  return text[locale];
}
