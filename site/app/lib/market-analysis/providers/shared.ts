import type {
  MarketDataProvider,
  MarketDataRequest,
  MarketEvidence,
  MarketSourceReference,
  ProviderConfigurationStatus,
  ProviderId,
  ProviderResult,
} from "../types";
import { MarketProviderError } from "../security";

export function numeric(value: unknown) {
  if (value === null || value === undefined || value === "" || value === ".") return null;
  const parsed = Number(String(value).replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function evidenceId(
  providerId: ProviderId,
  series: string,
  period: string,
  geography: string,
) {
  return [providerId, series, period, geography]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-");
}

export function publicReference(
  providerName: string,
  evidence: MarketEvidence,
): MarketSourceReference {
  return {
    providerId: evidence.providerId,
    providerName,
    dataset: evidence.dataset,
    seriesOrTableId: evidence.seriesOrTableId,
    officialTitle: evidence.sourceTitle,
    officialSourceUrl: evidence.officialSourceUrl,
    geography: evidence.geography,
    observationPeriod: evidence.observationPeriod,
    units: evidence.unit,
    retrievedAt: evidence.retrievedAt,
    relevance: evidence.notes[0] ?? evidence.metricLabel,
  };
}

export function failureResult(
  provider: Pick<MarketDataProvider, "providerId" | "providerName">,
  configurationStatus: ProviderConfigurationStatus,
  error: unknown,
): ProviderResult {
  const providerError = error instanceof MarketProviderError ? error : null;
  return {
    providerId: provider.providerId,
    providerName: provider.providerName,
    status:
      configurationStatus === "missing"
        ? "missingConfiguration"
        : "unavailable",
    configurationStatus: providerError?.providerStatus ?? configurationStatus,
    evidence: [],
    references: [],
    limitations: [
      providerError?.message ?? "The official provider did not return usable data.",
    ],
    errorCode: providerError?.code ?? "providerFailure",
    retrievedAt: null,
  };
}

export async function executeProvider(
  provider: MarketDataProvider,
  request: MarketDataRequest,
  now = () => new Date(),
): Promise<ProviderResult> {
  const configurationStatus = provider.validateConfiguration();
  if (!provider.supports(request)) {
    return {
      providerId: provider.providerId,
      providerName: provider.providerName,
      status: "notRelevant",
      configurationStatus,
      evidence: [],
      references: [],
      limitations: [],
      errorCode: null,
      retrievedAt: null,
    };
  }
  if (configurationStatus === "missing") {
    return failureResult(provider, configurationStatus, new Error("Missing optional server configuration"));
  }
  try {
    await provider.fetchMetadata(request);
    const raw = await provider.fetchData(request);
    const retrievedAt = now().toISOString();
    const evidence = provider.normalizeResponse(raw, request, retrievedAt);
    return {
      providerId: provider.providerId,
      providerName: provider.providerName,
      status: evidence.length ? "used" : "incomplete",
      configurationStatus,
      evidence,
      references: evidence.map((item) => provider.buildSourceReference(item)),
      limitations: evidence.length ? [] : ["The provider returned no compatible observations."],
      errorCode: evidence.length ? null : "noCompatibleObservations",
      retrievedAt,
    };
  } catch (error) {
    return failureResult(provider, configurationStatus, error);
  }
}
