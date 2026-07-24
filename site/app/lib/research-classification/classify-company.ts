import { getResearchPackRegistration } from "./research-pack-registry";
import { EXACT_SIC_RULES, normalizeSicCode, SIC_FAMILY_RULES } from "./sic-registry";
import type { CompanyClassification } from "./types";

export function classifyCompany(input: {
  sicCode?: string | number | null;
  sicDescription?: string | null;
}): CompanyClassification {
  const sicCode = normalizeSicCode(input.sicCode);
  const sicDescription = input.sicDescription?.trim() || null;
  if (!sicCode) {
    const pack = getResearchPackRegistration("general-corporate");
    return {
      sicCode: null,
      sicDescription,
      detectedSector: "general",
      selectedPackId: pack.id,
      selectedPackName: pack.name,
      fallbackLevel: "general-corporate",
      classificationReason: "SEC Submissions did not provide a usable SIC code; General Corporate methodology is used.",
    };
  }

  const exact = EXACT_SIC_RULES.get(sicCode);
  if (exact) {
    const pack = getResearchPackRegistration(exact.packId);
    return {
      sicCode,
      sicDescription,
      detectedSector: exact.sector,
      selectedPackId: pack.id,
      selectedPackName: pack.name,
      fallbackLevel: "exact-sic",
      classificationReason: `SEC SIC ${sicCode} maps directly to ${pack.name}.`,
    };
  }

  const numericSic = Number(sicCode);
  const family = SIC_FAMILY_RULES.find(
    (rule) => numericSic >= rule.minimum && numericSic <= rule.maximum,
  );
  if (family?.packId) {
    const pack = getResearchPackRegistration(family.packId);
    return {
      sicCode,
      sicDescription,
      detectedSector: family.sector,
      selectedPackId: pack.id,
      selectedPackName: pack.name,
      fallbackLevel: "sic-family",
      classificationReason: `${family.reason} ${pack.name} is the closest broad methodology.`,
    };
  }
  if (family) {
    const pack = getResearchPackRegistration("sector-general");
    return {
      sicCode,
      sicDescription,
      detectedSector: family.sector,
      selectedPackId: pack.id,
      selectedPackName: `${family.sector[0].toUpperCase()}${family.sector.slice(1)} Sector General`,
      fallbackLevel: "sector-general",
      classificationReason: `${family.reason} No more specific verified pack is available, so Sector General methodology is used.`,
    };
  }

  const pack = getResearchPackRegistration("general-corporate");
  return {
    sicCode,
    sicDescription,
    detectedSector: "general",
    selectedPackId: pack.id,
    selectedPackName: pack.name,
    fallbackLevel: "general-corporate",
    classificationReason: `SEC SIC ${sicCode} is not yet mapped to a supported family; General Corporate methodology is used.`,
  };
}
