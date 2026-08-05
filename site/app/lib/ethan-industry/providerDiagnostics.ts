import type {
  MarketReport,
  ProviderId,
  ProviderResult,
} from "../market-analysis/types";

export type InternalProviderDiagnosticStatus =
  | "success"
  | "partial"
  | "noData"
  | "invalidConfiguration"
  | "authenticationFailed"
  | "invalidRequest"
  | "rateLimited"
  | "timeout"
  | "upstreamUnavailable"
  | "parseFailed"
  | "notRelevant";

export type InternalProviderDiagnostic = {
  provider: string;
  configured: boolean;
  requestAttempted: boolean;
  status: InternalProviderDiagnosticStatus;
  sanitizedErrorCategory: InternalProviderDiagnosticStatus | null;
  mainIssue: string;
  actionNeeded: string;
  requestedDatasetOrSeries: string[];
  requestedPeriod: string;
  availablePeriod: string | null;
  fallbackUsed: boolean;
  usableRecordsReturned: number;
  lastSuccessfulRetrievalTime: string | null;
};

function issueFor(status: InternalProviderDiagnosticStatus) {
  const issues: Record<InternalProviderDiagnosticStatus, string> = {
    success: "Usable official records returned",
    partial: "Only part of the requested evidence returned usable records",
    noData: "No compatible observations were returned",
    invalidConfiguration: "Required server configuration is missing or empty",
    authenticationFailed: "Configured credential was rejected",
    invalidRequest: "Official provider rejected the request contract",
    rateLimited: "Official provider rate limit was reached",
    timeout: "Official provider request timed out",
    upstreamUnavailable: "Official provider returned a server-side failure",
    parseFailed: "Official response could not be parsed safely",
    notRelevant: "Provider was not relevant to this report",
  };
  return issues[status];
}

function actionFor(providerId: ProviderId, status: InternalProviderDiagnosticStatus) {
  if (status === "success" || status === "partial" || status === "notRelevant") return "None";
  if (status === "authenticationFailed") {
    if (providerId === "bea") return "Verify or replace `BEA_API_KEY`";
    if (providerId === "census") return "Verify or replace `CENSUS_API_KEY`";
    if (providerId === "fred") return "Verify or replace `FRED_API_KEY`";
    if (providerId === "congressGov" || providerId === "govInfo") {
      return "Verify or replace `DATA_GOV_API_KEY`";
    }
  }
  if (status === "invalidConfiguration") {
    if (providerId === "fred") return "Add `FRED_API_KEY` to the server environment";
    if (providerId === "bea") return "Add `BEA_API_KEY` to the server environment";
    if (providerId === "congressGov" || providerId === "govInfo") {
      return "Add `DATA_GOV_API_KEY` to the server environment";
    }
  }
  if (status === "rateLimited") return "Wait for the rate limit to reset";
  if (status === "timeout" || status === "upstreamUnavailable") return "Retry later";
  return "Review the requested dataset, series, and period";
}

function resultStatus(result: ProviderResult | undefined): InternalProviderDiagnosticStatus {
  if (!result) return "upstreamUnavailable";
  if (result.status === "notRelevant") return "notRelevant";
  if (result.status === "used") return "success";
  if (result.status === "incomplete") return result.evidence.length ? "partial" : "noData";
  if (result.status === "missingConfiguration") return "invalidConfiguration";
  if (result.errorCode === "rateLimited") return "rateLimited";
  if (result.errorCode === "invalidRequest") return "invalidRequest";
  if (result.errorCode === "malformedResponse") return "parseFailed";
  if (result.errorCode === "invalidConfiguration") {
    return result.configurationStatus === "invalid"
      ? "authenticationFailed"
      : "invalidConfiguration";
  }
  if (
    result.errorCode === "temporarilyUnavailable" &&
    result.limitations.some((item) => /timed out/i.test(item))
  ) return "timeout";
  return "upstreamUnavailable";
}

function requestedSeries(report: MarketReport, providerId: ProviderId) {
  const mapped = report.marketDefinition.officialClassificationMappings
    .filter((item) => item.providerId === providerId)
    .map((item) => `${item.kind}:${item.code}`);
  if (mapped.length) return mapped;
  if (providerId === "sec" && report.scope.tickers.length) return report.scope.tickers;
  return report.providerPlan.items.find((item) => item.providerId === providerId)?.expectedEvidence ?? [];
}

function availablePeriod(result: ProviderResult | undefined) {
  const periods = [...new Set(result?.evidence.map((item) => item.observationPeriod) ?? [])].sort();
  if (!periods.length) return null;
  return periods.length === 1 ? periods[0] : `${periods[0]}–${periods.at(-1)}`;
}

export function buildInternalProviderDiagnostics(
  report: MarketReport,
): InternalProviderDiagnostic[] {
  const results = new Map(report.providerResults.map((result) => [result.providerId, result]));
  return report.providerPlan.items.map((item) => {
    const result = results.get(item.providerId);
    const status = resultStatus(result);
    const configured = item.configurationStatus === "configured";
    const requestAttempted = item.selected && configured && status !== "notRelevant";
    return {
      provider: item.providerName,
      configured,
      requestAttempted,
      status,
      sanitizedErrorCategory: status === "success" || status === "notRelevant" ? null : status,
      mainIssue: issueFor(status),
      actionNeeded: actionFor(item.providerId, status),
      requestedDatasetOrSeries: requestedSeries(report, item.providerId),
      requestedPeriod: `${report.scope.startYear}–${report.scope.endYear}`,
      availablePeriod: availablePeriod(result),
      fallbackUsed: false,
      usableRecordsReturned: result?.evidence.length ?? 0,
      lastSuccessfulRetrievalTime: status === "success" || status === "partial"
        ? result?.retrievedAt ?? null
        : null,
    };
  });
}
