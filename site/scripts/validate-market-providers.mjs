const TIMEOUT_MS = 15_000;

function configured(name, optional = false) {
  return optional || Boolean(process.env[name]?.trim());
}

function controlledIssue(status, provider) {
  const issues = {
    success: "Known-good request returned usable data",
    noData: "Known-good request returned no usable records",
    invalidConfiguration: "Required server configuration is missing",
    authenticationFailed: "Configured credential was rejected",
    invalidRequest: "Known-good request was rejected",
    rateLimited: "Official service rate limit was reached",
    timeout: "Official service did not respond before the timeout",
    upstreamUnavailable: "Official service returned a server-side failure",
    parseFailed: "Official response was not valid JSON",
  };
  return issues[status] ?? `${provider} validation was not completed`;
}

function actionFor(status, envName) {
  if (status === "success") return "None";
  if (status === "invalidConfiguration") return `Add ${envName} to the server environment`;
  if (status === "authenticationFailed") return `Replace or verify ${envName}`;
  if (status === "rateLimited") return "Wait for the rate limit to reset";
  if (status === "timeout" || status === "upstreamUnavailable") return "Retry after the official service recovers";
  if (status === "noData") return "Review the requested dataset, series, or period";
  return "Review the known-good request contract";
}

async function requestJson({
  provider,
  envName,
  isConfigured,
  url,
  init,
  usable,
  availablePeriod,
  payloadStatus,
  nonJsonStatus = "parseFailed",
}) {
  if (!isConfigured) {
    const status = "invalidConfiguration";
    return {
      provider,
      configured: false,
      requestAttempted: false,
      status,
      mainIssue: controlledIssue(status, provider),
      actionNeeded: actionFor(status, envName),
      usableRecordsReturned: 0,
      availablePeriod: null,
      lastSuccessfulRetrievalTime: null,
    };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let status = "upstreamUnavailable";
  let payload;
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (response.redirected && /missing[_-]key/i.test(response.url)) status = "authenticationFailed";
    else if (response.status === 401 || response.status === 403) status = "authenticationFailed";
    else if (response.status === 429) status = "rateLimited";
    else if (response.status >= 500) status = "upstreamUnavailable";
    else if (!response.ok) status = "invalidRequest";
    else {
      const contentType = response.headers.get("content-type") ?? "";
      if (!/json/i.test(contentType)) {
        status = nonJsonStatus;
      } else {
        try {
          payload = await response.json();
          status = payloadStatus?.(payload) ?? (usable(payload) ? "success" : "noData");
        } catch {
          status = "parseFailed";
        }
      }
    }
  } catch (error) {
    status = error instanceof Error && error.name === "AbortError"
      ? "timeout"
      : "upstreamUnavailable";
  } finally {
    clearTimeout(timeout);
  }
  const success = status === "success";
  return {
    provider,
    configured: true,
    requestAttempted: true,
    status,
    mainIssue: controlledIssue(status, provider),
    actionNeeded: actionFor(status, envName),
    usableRecordsReturned: success ? 1 : 0,
    availablePeriod: success ? availablePeriod(payload) : null,
    lastSuccessfulRetrievalTime: success ? new Date().toISOString() : null,
  };
}

const fredKey = process.env.FRED_API_KEY?.trim();
const beaKey = process.env.BEA_API_KEY?.trim();
const censusKey = process.env.CENSUS_API_KEY?.trim();
const dataGovKey = process.env.DATA_GOV_API_KEY?.trim();

const results = [];
results.push(await requestJson({
  provider: "FRED",
  envName: "FRED_API_KEY",
  isConfigured: configured("FRED_API_KEY"),
  url: `https://api.stlouisfed.org/fred/series/observations?series_id=FEDFUNDS&file_type=json&limit=1&sort_order=desc&api_key=${encodeURIComponent(fredKey ?? "")}`,
  usable: (payload) => Array.isArray(payload?.observations) && payload.observations.length > 0,
  availablePeriod: (payload) => payload.observations[0]?.date ?? null,
}));
results.push(await requestJson({
  provider: "BEA",
  envName: "BEA_API_KEY",
  isConfigured: configured("BEA_API_KEY"),
  url: `https://apps.bea.gov/api/data/?UserID=${encodeURIComponent(beaKey ?? "")}&method=GETDATASETLIST&ResultFormat=JSON`,
  usable: (payload) => {
    const datasets = payload?.BEAAPI?.Results?.Dataset;
    return Array.isArray(datasets) ? datasets.length > 0 : Boolean(datasets);
  },
  availablePeriod: () => "Current dataset metadata",
  payloadStatus: (payload) => {
    const error = payload?.BEAAPI?.Results?.Error;
    if (!error) return null;
    return /user|registration|key|auth/i.test(JSON.stringify(error))
      ? "authenticationFailed"
      : "invalidRequest";
  },
}));
results.push(await requestJson({
  provider: "Census",
  envName: "CENSUS_API_KEY",
  isConfigured: configured("CENSUS_API_KEY"),
  url: `https://api.census.gov/data/2023/cbp?get=NAME,ESTAB&for=us:*&NAICS2017=334413${censusKey ? `&key=${encodeURIComponent(censusKey)}` : ""}`,
  usable: (payload) => Array.isArray(payload) && payload.length > 1,
  availablePeriod: () => "2023",
  nonJsonStatus: "authenticationFailed",
}));
results.push(await requestJson({
  provider: "BLS",
  envName: "None",
  isConfigured: true,
  url: "https://api.bls.gov/publicAPI/v2/timeseries/data/",
  init: {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seriesid: ["CES0000000001"], startyear: "2025", endyear: "2026" }),
  },
  usable: (payload) => payload?.status === "REQUEST_SUCCEEDED" && payload?.Results?.series?.[0]?.data?.length > 0,
  availablePeriod: (payload) => payload.Results.series[0].data[0]?.year ?? null,
}));
results.push(await requestJson({
  provider: "DATA GOV",
  envName: "DATA_GOV_API_KEY",
  isConfigured: configured("DATA_GOV_API_KEY"),
  url: "https://api.congress.gov/v3/bill?format=json&limit=1&sort=updateDate+desc",
  init: { headers: { "X-Api-Key": dataGovKey ?? "" } },
  usable: (payload) => Array.isArray(payload?.bills) && payload.bills.length > 0,
  availablePeriod: (payload) => payload.bills[0]?.updateDate?.slice(0, 10) ?? null,
}));
results.push(await requestJson({
  provider: "SEC",
  envName: "SEC_USER_AGENT",
  isConfigured: true,
  url: "https://data.sec.gov/submissions/CIK0001045810.json",
  init: {
    headers: {
      Accept: "application/json",
      "User-Agent": process.env.SEC_USER_AGENT?.trim() || "FinBro research@example.com",
    },
  },
  usable: (payload) => payload?.cik === "0001045810" || payload?.cik === 1045810,
  availablePeriod: (payload) => payload?.filings?.recent?.filingDate?.[0] ?? null,
}));

process.stdout.write(`${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
