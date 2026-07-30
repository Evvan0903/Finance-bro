import type { MarketDataProvider, ProviderId } from "../types";
import { createBeaProvider } from "./beaProvider";
import { createBlsProvider } from "./blsProvider";
import { createCensusProvider } from "./censusProvider";
import { createCongressGovProvider } from "./congressGovProvider";
import { createFredProvider } from "./fredProvider";
import { createGovInfoProvider } from "./govInfoProvider";
import { createSecProvider } from "./secProvider";
import { createWorldBankProvider } from "./worldBankProvider";
import type { ProviderFactoryOptions } from "./providerTypes";

export function createProviderRegistry(
  options: ProviderFactoryOptions = {},
): Map<ProviderId, MarketDataProvider> {
  const providers = [
    createFredProvider(options),
    createBeaProvider(options),
    createCensusProvider(options),
    createSecProvider(),
    createBlsProvider(options),
    createWorldBankProvider(options),
    createCongressGovProvider(options),
    createGovInfoProvider(options),
  ];
  return new Map(providers.map((provider) => [provider.providerId, provider]));
}

export const PROVIDER_NAMES: Record<ProviderId, string> = {
  fred: "Federal Reserve Economic Data",
  bea: "U.S. Bureau of Economic Analysis",
  census: "U.S. Census Bureau",
  sec: "SEC EDGAR",
  bls: "U.S. Bureau of Labor Statistics",
  worldBank: "World Bank Indicators",
  congressGov: "Congress.gov",
  govInfo: "GovInfo",
};
