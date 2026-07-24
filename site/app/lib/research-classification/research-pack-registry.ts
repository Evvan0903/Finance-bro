import type { SupportedSector, SupportedSubindustry } from "../sector-types";

export type ResearchPackRegistration = {
  id: SupportedSubindustry;
  name: string;
  sector: SupportedSector;
  validated: boolean;
};

export const RESEARCH_PACK_REGISTRY: Record<SupportedSubindustry, ResearchPackRegistration> = {
  "technology-hardware-general": { id: "technology-hardware-general", name: "Technology Hardware General", sector: "technology", validated: false },
  semiconductors: { id: "semiconductors", name: "Semiconductor General", sector: "technology", validated: true },
  "software-saas-general": { id: "software-saas-general", name: "Software & SaaS General", sector: "technology", validated: false },
  "internet-platform-general": { id: "internet-platform-general", name: "Internet & Platform General", sector: "technology", validated: false },
  banks: { id: "banks", name: "Commercial Banking General", sector: "financials", validated: true },
  "diversified-financials-general": { id: "diversified-financials-general", name: "Diversified Financials General", sector: "financials", validated: false },
  biopharma: { id: "biopharma", name: "Biopharma General", sector: "healthcare", validated: true },
  "integrated-oil-gas": { id: "integrated-oil-gas", name: "Oil & Gas General", sector: "energy", validated: true },
  "industrial-machinery": { id: "industrial-machinery", name: "Industrial Machinery General", sector: "industrials", validated: true },
  "consumer-products-general": { id: "consumer-products-general", name: "Consumer Products General", sector: "consumer", validated: false },
  "sector-general": { id: "sector-general", name: "Sector General", sector: "general", validated: false },
  "general-corporate": { id: "general-corporate", name: "General Corporate", sector: "general", validated: false },
};

export function getResearchPackRegistration(id: SupportedSubindustry) {
  return RESEARCH_PACK_REGISTRY[id];
}
