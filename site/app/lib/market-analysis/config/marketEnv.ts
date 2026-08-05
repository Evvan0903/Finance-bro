import type { ProviderConfigurationStatus, ProviderId } from "../types";

export type MarketProviderSecrets = {
  dataGovApiKey: string | null;
  fredApiKey: string | null;
  beaApiKey: string | null;
  censusApiKey: string | null;
};

export type CredentialState = "present" | "missing" | "empty";

export type CredentialDiagnostic = {
  variable: (typeof SERVER_ENVIRONMENT_VARIABLE_NAMES)[number];
  state: CredentialState;
  whitespaceDetected: boolean;
  surroundingQuotesDetected: boolean;
};

export type MarketProviderConfiguration = {
  fred: { configured: boolean; key: string | null; diagnostic: CredentialDiagnostic };
  bea: { configured: boolean; userId: string | null; diagnostic: CredentialDiagnostic };
  census: { configured: boolean; key: string | null; diagnostic: CredentialDiagnostic };
  dataGov: { configured: boolean; key: string | null; diagnostic: CredentialDiagnostic };
};

export const SERVER_ENVIRONMENT_VARIABLE_NAMES = [
  "DATA_GOV_API_KEY",
  "FRED_API_KEY",
  "BEA_API_KEY",
  "CENSUS_API_KEY",
] as const;

function normalizeCredential(
  variable: CredentialDiagnostic["variable"],
  rawValue: string | undefined,
) {
  if (rawValue === undefined) {
    return {
      value: null,
      diagnostic: {
        variable,
        state: "missing",
        whitespaceDetected: false,
        surroundingQuotesDetected: false,
      } satisfies CredentialDiagnostic,
    };
  }
  const whitespaceDetected = rawValue !== rawValue.trim();
  let normalized = rawValue.trim();
  const surroundingQuotesDetected =
    normalized.length >= 2 &&
    ((normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'")));
  if (surroundingQuotesDetected) normalized = normalized.slice(1, -1).trim();
  return {
    value: normalized || null,
    diagnostic: {
      variable,
      state: normalized ? "present" : "empty",
      whitespaceDetected,
      surroundingQuotesDetected,
    } satisfies CredentialDiagnostic,
  };
}

export function readMarketProviderConfiguration(
  environment: Record<string, string | undefined> = process.env,
): MarketProviderConfiguration {
  const fred = normalizeCredential("FRED_API_KEY", environment.FRED_API_KEY);
  const bea = normalizeCredential("BEA_API_KEY", environment.BEA_API_KEY);
  const census = normalizeCredential("CENSUS_API_KEY", environment.CENSUS_API_KEY);
  const dataGov = normalizeCredential("DATA_GOV_API_KEY", environment.DATA_GOV_API_KEY);
  return {
    fred: { configured: Boolean(fred.value), key: fred.value, diagnostic: fred.diagnostic },
    bea: { configured: Boolean(bea.value), userId: bea.value, diagnostic: bea.diagnostic },
    census: { configured: Boolean(census.value), key: census.value, diagnostic: census.diagnostic },
    dataGov: { configured: Boolean(dataGov.value), key: dataGov.value, diagnostic: dataGov.diagnostic },
  };
}

export function readMarketProviderSecrets(
  environment: Record<string, string | undefined> = process.env,
): MarketProviderSecrets {
  const configuration = readMarketProviderConfiguration(environment);
  return {
    dataGovApiKey: configuration.dataGov.key,
    fredApiKey: configuration.fred.key,
    beaApiKey: configuration.bea.userId,
    censusApiKey: configuration.census.key,
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
