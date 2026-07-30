import { DATA_CENTER_PACK } from "./dataCenterPack";
import type { ClassificationCandidate, MarketScopeInput } from "../types";

const SEMICONDUCTOR_CANDIDATES: ClassificationCandidate[] = [
  {
    mappingId: "semi-naics-334413",
    kind: "naics",
    code: "334413",
    officialLabel: "Semiconductor and Related Device Manufacturing",
    description: "Establishments primarily manufacturing semiconductors and related solid-state devices.",
    providerId: "census",
    includedScope: "U.S. semiconductor manufacturing establishments",
    knownExclusions: "Fabless design, semiconductor equipment, materials, and downstream electronics may be classified elsewhere",
    confidence: "high",
    reason: "Direct official NAICS manufacturing classification",
    selected: true,
    isProxy: false,
  },
  {
    mappingId: "semi-bea-3344",
    kind: "beaIndustry",
    code: "3344",
    officialLabel: "Semiconductor and other electronic component manufacturing",
    description: "BEA industry aggregation for economic-output and value-added context.",
    providerId: "bea",
    includedScope: "Broader electronic-component manufacturing footprint",
    knownExclusions: "Broader than semiconductor manufacturing alone",
    confidence: "medium",
    reason: "Closest BEA economic-industry aggregation",
    selected: true,
    isProxy: true,
  },
  {
    mappingId: "semi-fred-ip",
    kind: "fredSeries",
    code: "IPG3344S",
    officialLabel: "Industrial Production: Semiconductor and Other Electronic Component Manufacturing",
    description: "Industrial-production index for the broader manufacturing aggregation.",
    providerId: "fred",
    includedScope: "Manufacturing activity trend",
    knownExclusions: "Index does not measure revenue or commercial market size",
    confidence: "medium",
    reason: "Official activity proxy for the selected manufacturing scope",
    selected: true,
    isProxy: true,
  },
  {
    mappingId: "semi-census-cbp",
    kind: "censusDataset",
    code: "cbp",
    officialLabel: "County Business Patterns",
    description: "Annual establishment, employment, and payroll statistics.",
    providerId: "census",
    includedScope: "Employer establishments classified under the selected NAICS code",
    knownExclusions: "Establishments are not companies",
    confidence: "high",
    reason: "Official source for establishment and labor footprint",
    selected: true,
    isProxy: false,
  },
];

function genericCandidates(market: string): ClassificationCandidate[] {
  return [
    {
      mappingId: "generic-naics-review",
      kind: "naics",
      code: "USER-REVIEW",
      officialLabel: "NAICS mapping requires user review",
      description: `No validated specialized pack currently maps “${market}” to one official industry code.`,
      providerId: "census",
      includedScope: "Only the official code confirmed by the user",
      knownExclusions: "Commercial-market boundaries may differ materially from the selected official classification",
      confidence: "low",
      reason: "Universal mode never silently guesses an industry code",
      selected: false,
      isProxy: true,
    },
  ];
}

export function classificationCandidates(scope: MarketScopeInput) {
  const normalized = `${scope.market} ${scope.subjectB ?? ""}`.toLowerCase();
  if (DATA_CENTER_PACK.keywords.some((keyword) => normalized.includes(keyword))) {
    return {
      packId: DATA_CENTER_PACK.packId,
      packStatus: DATA_CENTER_PACK.status,
      candidates: structuredClone(DATA_CENTER_PACK.candidates),
      limitations: [...DATA_CENTER_PACK.limitations],
    };
  }
  if (/semiconductor|芯片|半导体/.test(normalized)) {
    return {
      packId: "universal-official-data",
      packStatus: "universal" as const,
      candidates: structuredClone(SEMICONDUCTOR_CANDIDATES),
      limitations: [
        "This is a user-confirmed universal mapping, not a verified specialized semiconductor market pack.",
        "Manufacturing classifications exclude parts of the design, equipment, materials, and downstream value chain.",
      ],
    };
  }
  return {
    packId: "universal-official-data",
    packStatus: "universal" as const,
    candidates: genericCandidates(scope.market),
    limitations: [
      "No validated specialized mapping exists for this market.",
      "Analysis can continue only after the user supplies or confirms an official classification or a visibly labeled proxy.",
    ],
  };
}
