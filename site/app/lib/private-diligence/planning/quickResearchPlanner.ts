import type { EntityIdentityGraph, PrivateCompanyInput, ProviderPlanItem } from "../types";

/** Fast public-source plan. Optional official sources remain selective and non-blocking. */
export function buildQuickCompanyIntelligencePlan(input: PrivateCompanyInput, graph: EntityIdentityGraph): ProviderPlanItem[] {
  const targetConfirmed = graph.targetSelectionStatus === "userSelected" || graph.targetSelectionStatus === "autoSelected";
  return [
    { providerId: "companyWebsite", providerName: "Company website", sourceTier: 2, providerCategory: "companyDirect", selected: Boolean(input.website || graph.domains.length), reason: "Company identity, products, leadership, locations, business contacts, and careers links" },
    { providerId: "serpApiWebSearch", providerName: "Original-source web research", sourceTier: 3, providerCategory: "independentVerification", selected: targetConfirmed, reason: "Bounded general web discovery followed by original-page retrieval for overview, products, leadership, relationships, hiring, recent activity, and relevant transactions" },
    { providerId: "usaSpending", providerName: "USAspending.gov", sourceTier: 1, providerCategory: "governmentContract", selected: /government|defen[cs]e|federal|public sector/i.test(input.industry ?? ""), reason: "Official awards only when the supplied industry indicates government relevance; otherwise not researched" },
    { providerId: "secFormD", providerName: "SEC EDGAR Form D", sourceTier: 1, providerCategory: "financing", selected: targetConfirmed, reason: "Bounded SEC issuer resolution followed by original Form D retrieval only after corroboration" },
  ];
}
