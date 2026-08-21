import type { EntityIdentityGraph, PrivateCompanyInput, ProviderPlanItem } from "../types";

/** Fast public-source plan. Optional official sources remain selective and non-blocking. */
export function buildQuickCompanyIntelligencePlan(input: PrivateCompanyInput, graph: EntityIdentityGraph): ProviderPlanItem[] {
  return [
    { providerId: "companyWebsite", providerName: "Company website", sourceTier: 2, providerCategory: "companyDirect", selected: Boolean(input.website || graph.domains.length), reason: "Company identity, products, leadership, locations, business contacts, and careers links" },
    { providerId: "usaSpending", providerName: "USAspending.gov", sourceTier: 1, providerCategory: "governmentContract", selected: /united states|usa|u\.s\./i.test(input.country ?? "United States"), reason: "Selective official check for government-contract activity" },
    { providerId: "secFormD", providerName: "SEC EDGAR Form D", sourceTier: 1, providerCategory: "financing", selected: graph.cikCandidates.length > 0, reason: "Selective official startup-financing evidence when a verified CIK exists" },
  ];
}
