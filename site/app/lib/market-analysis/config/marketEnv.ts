import type { ProviderConfigurationStatus, ProviderId } from "../types";

export type MarketProviderSecrets = {
  dataGovApiKey: string | null;
  fredApiKey: string | null;
  beaApiKey: string | null;
  censusApiKey: string | null;
};

function readSecret(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function readMarketProviderSecrets(): MarketProviderSecrets {
  return {
    dataGovApiKey: readSecret("DATA_GOV_API_KEY"),
    fredApiKey: readSecret("FRED_API_KEY"),
    beaApiKey: readSecret("BEA_API_KEY"),
    censusApiKey: readSecret("CENSUS_API_KEY"),
  };
}

export function providerConfigurationStatus(
  providerId: ProviderId,
  secrets = readMarketProviderSecrets(),
): ProviderConfigurationStatus {
  if (providerId === "fred") return secrets.fredApiKey ? "configured" : "missing";
  if (providerId === "bea") return secrets.beaApiKey ? "configured" : "missing";
  if (providerId === "congressGov" || providerId === "govInfo") {
    return secrets.dataGovApiKey ? "configured" : "missing";
  }
  // Census supports anonymous calls within its public quota. A configured key is
  // still used when present, but absence is not a provider failure.
  return "configured";
}

export const SERVER_ENVIRONMENT_VARIABLE_NAMES = [
  "DATA_GOV_API_KEY",
  "FRED_API_KEY",
  "BEA_API_KEY",
  "CENSUS_API_KEY",
] as const;
