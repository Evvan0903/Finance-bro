import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { readMarketProviderConfiguration } from "../app/lib/market-analysis/config/marketEnv.ts";
import { loadProjectEnvironment } from "./lib/load-project-env.mjs";

const TIMEOUT_MS = 15_000;

const ISSUE_TEXT = {
  success: "Known-good request returned usable data",
  partial: "Request returned only part of the expected data",
  noData: "Known-good request returned no usable records",
  invalidConfiguration: "Required server configuration is missing or empty",
  authenticationFailed: "Configured credential was rejected",
  invalidRequest: "Known-good request was rejected",
  rateLimited: "Official service rate limit was reached",
  timeout: "Official service did not respond before the timeout",
  upstreamUnavailable: "Official service returned a server-side failure",
  parseFailed: "Official response could not be parsed safely",
  notRelevant: "Provider was not relevant to this validation",
};

function actionFor(status, envName) {
  if (status === "success") return "None";
  if (status === "invalidConfiguration") return `Add \`${envName}\` to the server environment`;
  if (status === "authenticationFailed") return `Verify or replace \`${envName}\``;
  if (status === "rateLimited") return "Wait for the rate limit to reset";
  if (status === "timeout" || status === "upstreamUnavailable") {
    return "Retry after the official service recovers";
  }
  if (status === "noData") return "Review the requested dataset, series, or period";
  return "Review the known-good request contract";
}

function credentialRejected(text) {
  return /(?:invalid|missing|unregistered|rejected|not\s+valid|incorrect).{0,40}(?:api[ _-]?key|key|user\s?id)|(?:api[ _-]?key|user\s?id).{0,40}(?:invalid|missing|unregistered|rejected|not\s+valid|incorrect)/i.test(text);
}

function baseHttpStatus(response, text) {
  if (response.status === 401 || response.status === 403) return "authenticationFailed";
  if (response.status === 429) return "rateLimited";
  if (response.status >= 500) return "upstreamUnavailable";
  if (!response.ok) return credentialRejected(text) ? "authenticationFailed" : "invalidRequest";
  return null;
}

async function requestJson({
  provider,
  envName,
  configured,
  requiresCredential = true,
  request,
  fetchImpl,
  classifyPayload,
  usableRecords,
  availablePeriod,
  timeoutMs = TIMEOUT_MS,
}) {
  if (requiresCredential && !configured) {
    const status = "invalidConfiguration";
    return {
      provider,
      configured: false,
      requestAttempted: false,
      status,
      mainIssue: ISSUE_TEXT[status],
      actionNeeded: actionFor(status, envName),
      usableRecordsReturned: 0,
      availablePeriod: null,
      lastSuccessfulRetrievalTime: null,
    };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let status = "upstreamUnavailable";
  let payload;
  let recordCount = 0;
  try {
    const { url, init } = request();
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const text = await response.text();
    const httpStatus = baseHttpStatus(response, text);
    if (httpStatus) {
      status = httpStatus;
    } else {
      try {
        payload = JSON.parse(text);
        status = classifyPayload(payload, text);
        recordCount = status === "success" || status === "partial" ? usableRecords(payload) : 0;
      } catch {
        status = credentialRejected(text) ? "authenticationFailed" : "parseFailed";
      }
    }
  } catch (error) {
    status = error instanceof Error && error.name === "AbortError"
      ? "timeout"
      : "upstreamUnavailable";
  } finally {
    clearTimeout(timeout);
  }
  const succeeded = status === "success" || status === "partial";
  return {
    provider,
    configured,
    requestAttempted: true,
    status,
    mainIssue: ISSUE_TEXT[status],
    actionNeeded: actionFor(status, envName),
    usableRecordsReturned: recordCount,
    availablePeriod: succeeded ? availablePeriod(payload) : null,
    lastSuccessfulRetrievalTime: succeeded ? new Date().toISOString() : null,
  };
}

function fredValidation(configuration, fetchImpl) {
  return requestJson({
    provider: "FRED",
    envName: "FRED_API_KEY",
    configured: configuration.fred.configured,
    fetchImpl,
    request: () => {
      const url = new URL("https://api.stlouisfed.org/fred/series/observations");
      url.searchParams.set("series_id", "FEDFUNDS");
      url.searchParams.set("file_type", "json");
      url.searchParams.set("limit", "1");
      url.searchParams.set("sort_order", "desc");
      url.searchParams.set("api_key", configuration.fred.key ?? "");
      return { url };
    },
    classifyPayload: (payload, text) => {
      if (payload?.error_code || payload?.error_message) {
        return credentialRejected(text) ? "authenticationFailed" : "invalidRequest";
      }
      if (!Array.isArray(payload?.observations)) return "parseFailed";
      return payload.observations.length ? "success" : "noData";
    },
    usableRecords: (payload) => payload.observations.length,
    availablePeriod: (payload) => payload.observations[0]?.date ?? null,
  });
}

function beaValidation(configuration, fetchImpl) {
  return requestJson({
    provider: "BEA",
    envName: "BEA_API_KEY",
    configured: configuration.bea.configured,
    fetchImpl,
    request: () => {
      const url = new URL("https://apps.bea.gov/api/data/");
      url.searchParams.set("UserID", configuration.bea.userId ?? "");
      url.searchParams.set("method", "GETDATASETLIST");
      url.searchParams.set("ResultFormat", "JSON");
      return { url };
    },
    classifyPayload: (payload) => {
      const error = payload?.BEAAPI?.Results?.Error;
      if (error) return credentialRejected(JSON.stringify(error)) ? "authenticationFailed" : "invalidRequest";
      const datasets = payload?.BEAAPI?.Results?.Dataset;
      if (!Array.isArray(datasets)) return datasets ? "success" : "parseFailed";
      return datasets.length ? "success" : "noData";
    },
    usableRecords: (payload) => {
      const datasets = payload?.BEAAPI?.Results?.Dataset;
      return Array.isArray(datasets) ? datasets.length : datasets ? 1 : 0;
    },
    availablePeriod: () => "Current dataset metadata",
  });
}

function censusValidation(configuration, fetchImpl) {
  return requestJson({
    provider: "Census",
    envName: "CENSUS_API_KEY",
    configured: configuration.census.configured,
    requiresCredential: false,
    fetchImpl,
    request: () => {
      const url = new URL("https://api.census.gov/data/2023/cbp");
      url.searchParams.set("get", "NAME,ESTAB");
      url.searchParams.set("for", "us:*");
      url.searchParams.set("NAICS2017", "334413");
      if (configuration.census.key) url.searchParams.set("key", configuration.census.key);
      return { url };
    },
    classifyPayload: (payload, text) => {
      if (credentialRejected(text)) return "authenticationFailed";
      if (!Array.isArray(payload)) return payload?.error ? "invalidRequest" : "parseFailed";
      if (!Array.isArray(payload[0])) return "parseFailed";
      return payload.length > 1 ? "success" : "noData";
    },
    usableRecords: (payload) => Math.max(0, payload.length - 1),
    availablePeriod: () => "2023",
  });
}

function blsValidation(fetchImpl) {
  return requestJson({
    provider: "BLS",
    envName: "None",
    configured: true,
    requiresCredential: false,
    fetchImpl,
    request: () => ({
      url: new URL("https://api.bls.gov/publicAPI/v2/timeseries/data/"),
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesid: ["CES0000000001"], startyear: "2025", endyear: "2026" }),
      },
    }),
    classifyPayload: (payload) => {
      if (payload?.status !== "REQUEST_SUCCEEDED") return "invalidRequest";
      const data = payload?.Results?.series?.[0]?.data;
      if (!Array.isArray(data)) return "parseFailed";
      return data.length ? "success" : "noData";
    },
    usableRecords: (payload) => payload.Results.series[0].data.length,
    availablePeriod: (payload) => payload.Results.series[0].data[0]?.year ?? null,
  });
}

function dataGovValidation(configuration, fetchImpl) {
  return requestJson({
    provider: "DATA GOV",
    envName: "DATA_GOV_API_KEY",
    configured: configuration.dataGov.configured,
    fetchImpl,
    request: () => ({
      url: new URL("https://api.congress.gov/v3/bill?format=json&limit=1&sort=updateDate+desc"),
      init: { headers: { "X-Api-Key": configuration.dataGov.key ?? "" } },
    }),
    classifyPayload: (payload, text) => {
      if (credentialRejected(text)) return "authenticationFailed";
      if (!Array.isArray(payload?.bills)) return "parseFailed";
      return payload.bills.length ? "success" : "noData";
    },
    usableRecords: (payload) => payload.bills.length,
    availablePeriod: (payload) => payload.bills[0]?.updateDate?.slice(0, 10) ?? null,
  });
}

function secValidation(fetchImpl, environment) {
  return requestJson({
    provider: "SEC",
    envName: "SEC_USER_AGENT",
    configured: true,
    requiresCredential: false,
    fetchImpl,
    request: () => ({
      url: new URL("https://data.sec.gov/submissions/CIK0001045810.json"),
      init: {
        headers: {
          Accept: "application/json",
          "User-Agent": environment.SEC_USER_AGENT?.trim() || "FinBro research@example.com",
        },
      },
    }),
    classifyPayload: (payload) => {
      if (payload?.cik === "0001045810" || payload?.cik === 1045810) return "success";
      return payload?.cik ? "invalidRequest" : "parseFailed";
    },
    usableRecords: () => 1,
    availablePeriod: (payload) => payload?.filings?.recent?.filingDate?.[0] ?? null,
  });
}

export async function runProviderValidation({
  environment = process.env,
  fetchImpl = fetch,
} = {}) {
  const configuration = readMarketProviderConfiguration(environment);
  const results = await Promise.all([
    fredValidation(configuration, fetchImpl),
    beaValidation(configuration, fetchImpl),
    censusValidation(configuration, fetchImpl),
    blsValidation(fetchImpl),
    dataGovValidation(configuration, fetchImpl),
    secValidation(fetchImpl, environment),
  ]);
  const environmentDiagnostics = Object.fromEntries([
    configuration.fred.diagnostic,
    configuration.bea.diagnostic,
    configuration.census.diagnostic,
    configuration.dataGov.diagnostic,
  ].map(({ variable, ...diagnostic }) => [variable, diagnostic]));
  return { generatedAt: new Date().toISOString(), environment: environmentDiagnostics, results };
}

async function main() {
  await loadProjectEnvironment();
  const result = await runProviderValidation();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const executedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (executedPath === import.meta.url) await main();
