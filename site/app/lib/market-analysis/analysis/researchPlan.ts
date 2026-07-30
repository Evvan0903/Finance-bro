import { providerConfigurationStatus } from "../config/marketEnv";
import { PROVIDER_NAMES } from "../providers/providerRegistry";
import type {
  MarketDefinition,
  MarketScopeInput,
  ProviderId,
  ProviderPlan,
} from "../types";

const EXPECTED_EVIDENCE: Record<ProviderId, string[]> = {
  fred: ["Macroeconomic drivers", "Rates, prices, production, or capacity indicators"],
  bea: ["Industry gross output or value added", "Industry economic contribution"],
  census: ["Establishments", "Employment", "Annual payroll", "Regional concentration"],
  sec: ["Public-company revenue and filing evidence"],
  bls: ["Employment, wage, price, or productivity indicators"],
  worldBank: ["International and cross-country indicators"],
  congressGov: ["Pending and enacted federal legislative context"],
  govInfo: ["Official federal publications and policy documents"],
};

export function buildProviderPlan(
  scope: MarketScopeInput,
  marketDefinition: MarketDefinition,
  generatedAt = new Date().toISOString(),
): ProviderPlan {
  const mappedProviders = new Set(
    marketDefinition.officialClassificationMappings.map((item) => item.providerId),
  );
  const policyRequested = scope.focusAreas.includes("policyEnvironment");
  const international = /international|global|country|china|europe|world/i.test(
    `${scope.geography} ${scope.geographyB ?? ""}`,
  );
  const selected: Record<ProviderId, boolean> = {
    fred: mappedProviders.has("fred"),
    bea: mappedProviders.has("bea"),
    census: mappedProviders.has("census"),
    sec: scope.tickers.length > 0,
    bls: mappedProviders.has("bls"),
    worldBank: international && mappedProviders.has("worldBank"),
    congressGov: policyRequested,
    govInfo: policyRequested,
  };
  const reason: Record<ProviderId, string> = {
    fred: selected.fred ? "Selected macro series match the confirmed market scope" : "No confirmed FRED series",
    bea: selected.bea ? "Confirmed BEA industry mapping supports economic-footprint analysis" : "No confirmed BEA industry mapping",
    census: selected.census ? "Confirmed NAICS mapping supports employer-footprint analysis" : "No confirmed Census industry mapping",
    sec: selected.sec ? "User supplied public-company tickers" : "No public-company tickers supplied",
    bls: selected.bls ? "Confirmed BLS series supports labor or price analysis" : "No confirmed BLS series",
    worldBank: selected.worldBank ? "International geography and indicator mapping selected" : "Not relevant to the selected geography",
    congressGov: selected.congressGov ? "Policy environment is a selected focus area" : "Policy context not requested",
    govInfo: selected.govInfo ? "Policy environment is a selected focus area" : "Policy context not requested",
  };
  return {
    generatedAt,
    mode: scope.mode,
    items: (Object.keys(selected) as ProviderId[]).map((providerId) => ({
      providerId,
      providerName: PROVIDER_NAMES[providerId],
      selected: selected[providerId],
      reason: reason[providerId],
      configurationStatus: providerConfigurationStatus(providerId),
      expectedEvidence: EXPECTED_EVIDENCE[providerId],
    })),
  };
}
