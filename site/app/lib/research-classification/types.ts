import type { SupportedSector, SupportedSubindustry } from "../sector-types";

export type ClassificationFallbackLevel =
  | "exact-sic"
  | "sic-family"
  | "sector-general"
  | "general-corporate";

export type CompanyClassification = {
  sicCode: string | null;
  sicDescription: string | null;
  detectedSector: SupportedSector;
  selectedPackId: SupportedSubindustry;
  selectedPackName: string;
  fallbackLevel: ClassificationFallbackLevel;
  classificationReason: string;
};

export type SicRule = {
  sector: SupportedSector;
  packId: SupportedSubindustry;
};

export type SicFamilyRule = {
  minimum: number;
  maximum: number;
  sector: SupportedSector;
  packId?: SupportedSubindustry;
  reason: string;
};
