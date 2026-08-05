import { createCompanyWebsiteProvider } from "./companyWebsiteProvider";
import { createMarketContextProvider, createSamProvider, createStateRegistryProvider, createUsptoProvider, createWebDiscoveryProvider } from "./manualProviders";
import { createSecFormDProvider } from "./secFormDProvider";
import type { PrivateCompanyProvider } from "./providerTypes";
import { createUsaSpendingProvider } from "./usaSpendingProvider";

export type PrivateProviderRegistryOptions = {
  website?: Parameters<typeof createCompanyWebsiteProvider>[0];
  usaSpendingFetch?: typeof fetch;
  providers?: PrivateCompanyProvider[];
};

export function createPrivateProviderRegistry(options: PrivateProviderRegistryOptions = {}) {
  const providers = options.providers ?? [
    createCompanyWebsiteProvider(options.website),
    createSecFormDProvider(),
    createUsaSpendingProvider(options.usaSpendingFetch),
    createSamProvider(),
    createStateRegistryProvider(),
    createUsptoProvider(),
    createWebDiscoveryProvider(),
    createMarketContextProvider(),
  ];
  return new Map(providers.map((provider) => [provider.providerId, provider]));
}
