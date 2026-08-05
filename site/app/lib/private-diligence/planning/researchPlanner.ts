import type { EntityIdentityGraph, PrivateCompanyInput, ProviderPlanItem } from "../types";

export function buildPrivateDiligenceProviderPlan(
  input: PrivateCompanyInput,
  graph: EntityIdentityGraph,
): ProviderPlanItem[] {
  return [
    { providerId: "companyWebsite", providerName: "Company website", sourceTier: 2, providerCategory: "companyDirect", selected: Boolean(input.website || graph.domains.length), reason: "Company-controlled identity, product, leadership, and operating claims" },
    { providerId: "secFormD", providerName: "SEC EDGAR Form D", sourceTier: 1, providerCategory: "financing", selected: graph.cikCandidates.length > 0, reason: "Official exempt-offering notices when a verified CIK is available" },
    { providerId: "usaSpending", providerName: "USAspending.gov", sourceTier: 1, providerCategory: "governmentContract", selected: /united states|usa|u\.s\./i.test(input.country ?? "United States"), reason: "Official federal award and public-funding evidence" },
    { providerId: "samGov", providerName: "SAM.gov Entity Information", sourceTier: 1, providerCategory: "officialRegistration", selected: true, reason: "UEI, CAGE, entity status, address, and exclusion verification when configured" },
    { providerId: "stateRegistry", providerName: "State business registry", sourceTier: 1, providerCategory: "officialRegistration", selected: Boolean(input.state || graph.registrationJurisdictions.length || graph.addresses.length), reason: "Legal formation and status verification with manual fallback" },
    { providerId: "uspto", providerName: "USPTO Patent and Trademark records", sourceTier: 1, providerCategory: "intellectualProperty", selected: graph.patentAssigneeNames.length > 0, reason: "Entity-matched patent and trademark ownership research when configured" },
    { providerId: "webDiscovery", providerName: "Broad web discovery", sourceTier: 4, providerCategory: "discovery", selected: true, reason: "Lead generation for independent corroboration when a provider is configured" },
    { providerId: "marketContext", providerName: "Official market context", sourceTier: 1, providerCategory: "marketContext", selected: graph.industryLabels.length > 0, reason: "Official industry context without private-company revenue or TAM inference" },
  ];
}
