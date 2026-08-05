import { readPrivateDiligenceConfiguration } from "../config/privateDiligenceEnv";
import type { PrivateCompanyProvider, PrivateProviderContext } from "./providerTypes";

const STATE_REGISTRY_LINKS: Record<string, string> = {
  california: "https://bizfileonline.sos.ca.gov/search/business",
  ca: "https://bizfileonline.sos.ca.gov/search/business",
  delaware: "https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx",
  de: "https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx",
  texas: "https://mycpa.cpa.state.tx.us/coa/",
  tx: "https://mycpa.cpa.state.tx.us/coa/",
  "new york": "https://apps.dos.ny.gov/publicInquiry/",
  ny: "https://apps.dos.ny.gov/publicInquiry/",
  washington: "https://ccfs.sos.wa.gov/#/BusinessSearch",
  wa: "https://ccfs.sos.wa.gov/#/BusinessSearch",
};

function manualProvider(
  definition: Pick<PrivateCompanyProvider, "providerId" | "providerName" | "sourceTier" | "providerCategory"> & {
    configured: () => boolean;
    supports: (context: PrivateProviderContext) => boolean;
    links: (context: PrivateProviderContext) => string[];
    missingIsInvalid?: boolean;
  },
): PrivateCompanyProvider {
  return {
    ...definition,
    isConfigured: definition.configured,
    validateConfiguration: () => !definition.configured() && definition.missingIsInvalid
      ? "invalidConfiguration"
      : "success",
    search: async (context) => ({
      status: "manualVerificationRequired",
      records: [],
      manualVerificationLinks: definition.links(context),
      sanitizedIssue: "Official source requires manual verification or a separately validated access contract",
    }),
    fetchDetails: async () => [],
    normalize: async () => [],
    buildPublicReference: (evidence) => evidence.publicReferenceUrl,
  };
}

export function createSamProvider() {
  return manualProvider({
    providerId: "samGov",
    providerName: "SAM.gov Entity Information",
    sourceTier: 1,
    providerCategory: "officialRegistration",
    configured: () => readPrivateDiligenceConfiguration().sam.configured,
    supports: (context) => /united states|usa|u\.s\./i.test(context.input.country ?? "United States"),
    links: () => ["https://sam.gov/search/?index=ei"],
    missingIsInvalid: true,
  });
}

export function createStateRegistryProvider() {
  return manualProvider({
    providerId: "stateRegistry",
    providerName: "State business registry",
    sourceTier: 1,
    providerCategory: "officialRegistration",
    configured: () => true,
    supports: (context) => Boolean(context.input.state),
    links: (context) => {
      const key = context.input.state?.toLowerCase() ?? "";
      return STATE_REGISTRY_LINKS[key] ? [STATE_REGISTRY_LINKS[key]] : [];
    },
  });
}

export function createUsptoProvider() {
  return manualProvider({
    providerId: "uspto",
    providerName: "USPTO Patent and Trademark records",
    sourceTier: 1,
    providerCategory: "intellectualProperty",
    configured: () => readPrivateDiligenceConfiguration().uspto.configured,
    supports: (context) => context.identityGraph.patentAssigneeNames.length > 0,
    links: () => ["https://ppubs.uspto.gov/pubwebapp/", "https://tsdr.uspto.gov/"],
    missingIsInvalid: true,
  });
}

export function createWebDiscoveryProvider() {
  return manualProvider({
    providerId: "webDiscovery",
    providerName: "Broad web discovery",
    sourceTier: 4,
    providerCategory: "discovery",
    configured: () => readPrivateDiligenceConfiguration().webDiscovery.configured,
    supports: () => true,
    links: () => [],
    missingIsInvalid: true,
  });
}

export function createMarketContextProvider() {
  return manualProvider({
    providerId: "marketContext",
    providerName: "Official market context",
    sourceTier: 1,
    providerCategory: "marketContext",
    configured: () => true,
    supports: (context) => context.identityGraph.industryLabels.length > 0,
    links: () => [],
  });
}
