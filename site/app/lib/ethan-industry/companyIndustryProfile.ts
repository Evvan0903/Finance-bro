import { buildMarketDefinition } from "../market-analysis/industries/industryMapping";
import type {
  ClassificationCandidate,
  MarketDefinition,
  MarketScopeInput,
} from "../market-analysis/types";
import type { CompanyClassification } from "../research-classification/types";
import type { FinancialPeriod, ResearchLocale } from "../research-types";
import type { ResearchSelection } from "../sector-types";
import type {
  CompanyIndustryProfile,
  EthanCompanyIdentity,
} from "./types";

const NVDA_CANDIDATES: ClassificationCandidate[] = [
  {
    mappingId: "nvda-naics-334413",
    kind: "naics",
    code: "334413",
    officialLabel: "Semiconductor and Related Device Manufacturing",
    description: "U.S. establishments primarily manufacturing semiconductors and related solid-state devices.",
    providerId: "census",
    includedScope: "U.S. semiconductor and related-device manufacturing establishments",
    knownExclusions: "NVIDIA is fabless; design, software, advanced packaging, equipment, materials, and downstream data-center operations can be classified elsewhere.",
    confidence: "high",
    reason: "Closest direct six-digit NAICS manufacturing classification for NVIDIA's SEC SIC 3674 context.",
    selected: true,
    isProxy: false,
  },
  {
    mappingId: "nvda-naics-334",
    kind: "naics",
    code: "334",
    officialLabel: "Computer and Electronic Product Manufacturing",
    description: "Broader North American Industry Classification System manufacturing aggregate.",
    providerId: "census",
    includedScope: "Broader computer and electronic-product manufacturing footprint",
    knownExclusions: "Substantially broader than semiconductors and not a measure of AI accelerated-computing demand.",
    confidence: "medium",
    reason: "Broad context only; retained as a visibly labeled adjacent-industry proxy.",
    selected: true,
    isProxy: true,
  },
  {
    mappingId: "nvda-bea-3344",
    kind: "beaIndustry",
    code: "3344",
    officialLabel: "Semiconductor and other electronic component manufacturing",
    description: "BEA industry aggregation for economic-output and value-added context.",
    providerId: "bea",
    includedScope: "U.S. semiconductor and other electronic-component manufacturing economic footprint",
    knownExclusions: "Broader than semiconductor manufacturing alone and not commercial AI accelerated-computing market revenue.",
    confidence: "medium",
    reason: "Closest reviewed BEA aggregation for the official manufacturing context.",
    selected: true,
    isProxy: true,
  },
  {
    mappingId: "nvda-fred-ipg3344s",
    kind: "fredSeries",
    code: "IPG3344S",
    officialLabel: "Industrial Production: Semiconductor and Other Electronic Component Manufacturing",
    description: "Federal Reserve industrial-production index for the broader semiconductor and electronic-component manufacturing aggregation.",
    providerId: "fred",
    includedScope: "U.S. manufacturing activity trend",
    knownExclusions: "An index of manufacturing activity; it is not company revenue, AI demand, or commercial market size.",
    confidence: "medium",
    reason: "Reviewed official supply and activity proxy for semiconductor manufacturing.",
    selected: true,
    isProxy: true,
  },
  {
    mappingId: "nvda-fred-a679rc1a027nbea",
    kind: "fredSeries",
    code: "A679RC1A027NBEA",
    officialLabel: "Private fixed investment in information processing equipment and software",
    description: "Annual BEA private-fixed-investment series distributed through FRED.",
    providerId: "fred",
    includedScope: "U.S. private information-processing-equipment and software investment",
    knownExclusions: "Broad investment proxy that includes software and is not a direct measure of data-center GPU purchases or NVIDIA revenue.",
    confidence: "medium",
    reason: "Reviewed annual investment proxy suitable only for directionally comparable capital-spending context.",
    selected: true,
    isProxy: true,
  },
  {
    mappingId: "nvda-census-cbp",
    kind: "censusDataset",
    code: "cbp",
    officialLabel: "County Business Patterns",
    description: "Annual establishment, employment, and payroll data used with the selected NAICS classifications.",
    providerId: "census",
    includedScope: "Employer-establishment, employment, and payroll footprint",
    knownExclusions: "Establishments are physical business locations, not companies or market participants.",
    confidence: "high",
    reason: "Official employer-footprint dataset for selected NAICS classifications.",
    selected: true,
    isProxy: false,
  },
  {
    mappingId: "nvda-bls-ceu3133440001",
    kind: "blsSeries",
    code: "CEU3133440001",
    officialLabel: "All Employees: Semiconductor and Other Electronic Component Manufacturing",
    description: "BLS Current Employment Statistics employment series for the broader 3344 manufacturing aggregation.",
    providerId: "bls",
    includedScope: "U.S. semiconductor and electronic-component manufacturing employment trend",
    knownExclusions: "Broader than NAICS 334413 and not a measure of NVIDIA's workforce, manufacturing capacity, or demand.",
    confidence: "medium",
    reason: "Reviewed BLS employment context for the same broader 3344 manufacturing aggregation.",
    selected: true,
    isProxy: true,
  },
];

const NVDA_LIMITATIONS = [
  "NVIDIA is a fabless company, while NAICS 334413 and BEA 3344 measure U.S. manufacturing classifications rather than NVIDIA's full design, software, networking, and platform value chain.",
  "NVIDIA Data Center is an end-market revenue category, not an official NAICS category or a substitute for an industry market-size measure.",
  "BEA value added, Census employer statistics, BLS employment, and FRED indicators are official economic or activity measures; none is labeled commercial market size unless its source expressly supports that definition.",
  "The public-data indicators may move with, but do not establish causation for, NVIDIA revenue, margins, or valuation.",
];

function confidenceFor(classification: CompanyClassification) {
  if (classification.fallbackLevel === "exact-sic") return "high" as const;
  if (classification.fallbackLevel === "sic-family") return "medium" as const;
  return "low" as const;
}

function conservativeProfile(
  company: EthanCompanyIdentity,
  classification: CompanyClassification,
): CompanyIndustryProfile {
  const confidence = confidenceFor(classification);
  return {
    ...company,
    sector: classification.detectedSector,
    industry: classification.selectedPackName,
    subindustry: classification.selectedPackId,
    primaryMarket: classification.selectedPackName,
    secondaryMarkets: [],
    reportedSegments: [],
    naicsCodes: [],
    beaIndustryCodes: [],
    preferredFredSeries: [],
    preferredCensusDatasets: [],
    preferredBlsSeries: [],
    relevantPolicyTopics: [],
    peerTickers: [],
    classificationConfidence: confidence,
    classificationMethod: `Existing FinBro ${classification.fallbackLevel} sector routing: ${classification.classificationReason}`,
    classificationLimitations: [
      "The existing sector pack supports company research, but no reviewed issuer-to-official-market mapping has been configured for automatic public-data retrieval.",
      "The industry overlay remains omitted until a curated mapping can state its direct scope, exclusions, and proxy boundaries.",
    ],
    candidates: [],
    canRunOfficialMarketData: false,
  };
}

export function buildCompanyIndustryProfile(input: {
  company: EthanCompanyIdentity;
  classification: CompanyClassification;
  selection: ResearchSelection;
}): CompanyIndustryProfile {
  const ticker = input.company.ticker.trim().toUpperCase();
  const isNvda =
    ticker === "NVDA" &&
    input.classification.sicCode === "3674" &&
    input.classification.selectedPackId === "semiconductors";
  if (!isNvda) return conservativeProfile(input.company, input.classification);

  return {
    ...input.company,
    sector: "technology",
    industry: "Semiconductors and Related Devices",
    subindustry: "semiconductors",
    primaryMarket: "AI Accelerated Computing",
    secondaryMarkets: [
      "Data Center Infrastructure",
      "Semiconductors and Related Devices",
    ],
    reportedSegments: [
      {
        name: "Compute & Networking",
        analyticalRole: "reportable segment",
        revenueWeight: null,
        sourceNote: "NVIDIA reports Compute & Networking as its reportable operating segment; segment weight is not inferred without a period-specific issuer disclosure.",
      },
      {
        name: "Data Center",
        analyticalRole: "end-market revenue category",
        revenueWeight: null,
        sourceNote: "Data Center is treated as a company-reported end-market revenue category, not as an official industry classification or GAAP reportable segment.",
      },
    ],
    naicsCodes: ["334413", "334"],
    beaIndustryCodes: ["3344"],
    preferredFredSeries: ["IPG3344S", "A679RC1A027NBEA"],
    preferredCensusDatasets: ["County Business Patterns"],
    preferredBlsSeries: ["CEU3133440001"],
    relevantPolicyTopics: ["advanced-computing export controls", "semiconductor supply-chain policy"],
    peerTickers: ["AMD", "INTC", "AVGO", "TSM"],
    classificationConfidence: "high",
    classificationMethod: "Existing validated Semiconductor pack + exact SEC SIC 3674 + curated NVIDIA official-data mapping",
    classificationLimitations: [...NVDA_LIMITATIONS],
    candidates: structuredClone(NVDA_CANDIDATES),
    canRunOfficialMarketData: true,
  };
}

function fiscalCalendarYear(periodEnd: string) {
  const date = new Date(`${periodEnd}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  // A January fiscal-year end is almost entirely the prior calendar year.
  return date.getUTCMonth() <= 1 ? date.getUTCFullYear() - 1 : date.getUTCFullYear();
}

export function buildEthanMarketScope(input: {
  profile: CompanyIndustryProfile;
  selection: ResearchSelection;
  periods: FinancialPeriod[];
  locale: ResearchLocale;
  now?: () => Date;
}): MarketScopeInput | null {
  if (!input.profile.canRunOfficialMarketData) return null;
  const years = input.periods
    .map((period) => fiscalCalendarYear(period.periodEnd))
    .filter((year): year is number => year !== null);
  const currentCompletedYear = (input.now ?? (() => new Date()))().getUTCFullYear() - 1;
  const latestCompanyYear = years.length ? Math.max(...years) : currentCompletedYear;
  const endYear = Math.min(currentCompletedYear, latestCompanyYear);
  const startYear = Math.max(2019, endYear - 4);
  return {
    mode: "analyze",
    market: "U.S. Semiconductor and Related Device Manufacturing",
    geography: "United States",
    startYear,
    endYear,
    analysisYear: endYear,
    researchQuestion: `${input.profile.companyName} company performance relative to curated official semiconductor manufacturing and investment indicators`,
    focusAreas: [
      "industryFootprint",
      "economicContribution",
      "establishments",
      "employment",
      "payrollLaborCost",
      "demandIndicators",
      "supplyIndicators",
      "macroEnvironment",
      "policyEnvironment",
      "risks",
    ],
    comparisonCriteria: [
      "industryOutput",
      "valueAdded",
      "establishments",
      "employment",
      "growth",
      "capitalIntensity",
      "policyContext",
      "risks",
    ],
    leadingIndicators: [...input.profile.preferredFredSeries],
    // Ethan already owns the SEC facts in the primary research pipeline. Leave
    // this empty so the Mason SEC adapter cannot issue duplicate SEC requests.
    tickers: [],
    locale: input.locale,
    reportDepth: "standard",
    outputFormat: "web",
  };
}

export function buildEthanMarketDefinition(
  profile: CompanyIndustryProfile,
  scope: MarketScopeInput,
): MarketDefinition | null {
  if (!profile.canRunOfficialMarketData || !profile.candidates.length) return null;
  const definition = buildMarketDefinition(
    scope,
    profile.candidates,
    profile.classificationLimitations,
  );
  return {
    ...definition,
    commercialDefinition: "NVIDIA accelerated-computing and semiconductor context, bounded by the listed official classifications and proxies",
    includedActivities: profile.candidates.filter((item) => item.selected).map((item) => item.includedScope),
    excludedActivities: profile.candidates.filter((item) => item.selected).map((item) => item.knownExclusions),
    customerGroups: ["cloud and enterprise infrastructure buyers", "OEM and channel partners"],
    valueChainBoundary: "Official manufacturing, employment, investment, and company-reporting evidence remain separate; the analysis does not infer commercial market share.",
  };
}
