import type { EntityIdentityGraph, PrivateCompanyInput, ProviderPlanItem } from "../types";

/** Fast public-source plan. Optional official sources remain selective and non-blocking. */
export function buildQuickCompanyIntelligencePlan(input: PrivateCompanyInput, graph: EntityIdentityGraph): ProviderPlanItem[] {
  const targetConfirmed = graph.targetSelectionStatus === "userSelected" || graph.targetSelectionStatus === "autoSelected";
  return [
    { providerId: "companyWebsite", providerName: "Company website", sourceTier: 2, providerCategory: "companyDirect", selected: Boolean(input.website || graph.domains.length), reason: "Company identity, products, leadership, locations, business contacts, and careers links" },
    { providerId: "serpApiWebSearch", providerName: "SerpApi original-source web research", sourceTier: 3, providerCategory: "independentVerification", selected: targetConfirmed, reason: "Bounded general web discovery followed by original-page retrieval for overview, products, leadership, relationships, hiring, recent activity, and relevant transactions" },
    { providerId: "usaSpending", providerName: "USAspending.gov", sourceTier: 1, providerCategory: "governmentContract", selected: /united states|usa|u\.s\./i.test(input.country ?? "United States"), reason: "Selective official check for government-contract activity" },
    { providerId: "secFormD", providerName: "SEC EDGAR Form D", sourceTier: 1, providerCategory: "financing", selected: graph.cikCandidates.length > 0, reason: "Selective official startup-financing evidence when a verified CIK exists" },
  ];
}
