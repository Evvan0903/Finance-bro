import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { readMarketProviderConfiguration } from "../app/lib/market-analysis/config/marketEnv.ts";
import { loadProjectEnvironment, parseEnvironmentFile, resolveSiteDirectory } from "../scripts/lib/load-project-env.mjs";
import { runProviderValidation } from "../scripts/validate-market-providers.mjs";

const ENVIRONMENT = {
  FRED_API_KEY: "fred-test-value",
  BEA_API_KEY: "bea-test-value",
  CENSUS_API_KEY: "census-test-value",
  DATA_GOV_API_KEY: "data-gov-test-value",
  SEC_USER_AGENT: "FinBro tests@example.com",
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function successfulFetch(overrides = {}) {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    const provider = url.hostname === "api.stlouisfed.org" ? "fred"
      : url.hostname === "apps.bea.gov" ? "bea"
        : url.hostname === "api.census.gov" ? "census"
          : url.hostname === "api.bls.gov" ? "bls"
            : url.hostname === "api.congress.gov" ? "dataGov"
              : "sec";
    if (overrides[provider]) return overrides[provider](url, init);
    if (provider === "fred") return json({ observations: [{ date: "2026-06-01", value: "4.33" }] });
    if (provider === "bea") return json({ BEAAPI: { Results: { Dataset: [{ DatasetName: "GDPbyIndustry" }] } } });
    if (provider === "census") return json([["NAME", "ESTAB", "us"], ["United States", "100", "1"]]);
    if (provider === "bls") return json({ status: "REQUEST_SUCCEEDED", Results: { series: [{ data: [{ year: "2026" }] }] } });
    if (provider === "dataGov") return json({ bills: [{ updateDate: "2026-08-05T00:00:00Z" }] });
    return json({ cik: "0001045810", filings: { recent: { filingDate: ["2026-07-20"] } } });
  };
  return { fetchImpl, calls };
}

test("loads Next-style env precedence from site or repository root without overwriting shell values", async () => {
  const root = await mkdtemp(join(tmpdir(), "finbro-env-"));
  const site = join(root, "site");
  await mkdir(join(site, "app"), { recursive: true });
  await writeFile(join(site, "package.json"), "{}\n");
  await writeFile(join(site, ".env"), "FRED_API_KEY=env-low\nBEA_API_KEY=bea-low\n");
  await writeFile(join(site, ".env.development"), "BEA_API_KEY=bea-development\n");
  await writeFile(join(site, ".env.local"), "FRED_API_KEY=env-local\nBEA_API_KEY='bea-local'\nCENSUS_API_KEY=local-census\n");
  await writeFile(join(site, ".env.development.local"), "BEA_API_KEY=bea-development-local\n");
  const rootEnvironment = { NODE_ENV: "development", FRED_API_KEY: "shell-wins" };
  const fromRoot = await loadProjectEnvironment({ environment: rootEnvironment, startDirectory: root });
  assert.equal(fromRoot.siteDirectory, site);
  assert.equal(rootEnvironment.FRED_API_KEY, "shell-wins");
  assert.equal(rootEnvironment.BEA_API_KEY, "bea-development-local");
  assert.equal(rootEnvironment.CENSUS_API_KEY, "local-census");
  const siteEnvironment = { NODE_ENV: "development" };
  const fromSite = await loadProjectEnvironment({ environment: siteEnvironment, startDirectory: site });
  assert.equal(fromSite.siteDirectory, site);
  assert.equal(siteEnvironment.FRED_API_KEY, "env-local");
  assert.equal(resolveSiteDirectory(root), site);
});

test("missing env files are harmless and dotenv parsing accepts only exact supported names", async () => {
  const root = await mkdtemp(join(tmpdir(), "finbro-empty-env-"));
  const site = join(root, "site");
  await mkdir(join(site, "app"), { recursive: true });
  await writeFile(join(site, "package.json"), "{}\n");
  const environment = { NODE_ENV: "development" };
  const loaded = await loadProjectEnvironment({ environment, startDirectory: root });
  assert.deepEqual(loaded.loadedFiles, []);
  const parsed = parseEnvironmentFile([
    "FRED_API_KEY='quoted-value'",
    "BEA_API_KEY=  spaced-value  ",
    "fred_api_key=mixed-case-must-be-ignored",
    "UNRELATED_SECRET=ignored",
  ].join("\n"));
  assert.equal(parsed.get("FRED_API_KEY"), "quoted-value");
  assert.equal(parsed.get("BEA_API_KEY"), "spaced-value");
  assert.equal(parsed.has("fred_api_key"), false);
  assert.equal(parsed.has("UNRELATED_SECRET"), false);
});

test("shared configuration detects missing, empty, whitespace, and surrounding quotes without aliases", () => {
  const configuration = readMarketProviderConfiguration({
    FRED_API_KEY: "  fred-value  ",
    BEA_API_KEY: '"bea-value"',
    CENSUS_API_KEY: "   ",
    data_gov_api_key: "wrong-case",
  });
  assert.equal(configuration.fred.key, "fred-value");
  assert.equal(configuration.fred.diagnostic.whitespaceDetected, true);
  assert.equal(configuration.bea.userId, "bea-value");
  assert.equal(configuration.bea.diagnostic.surroundingQuotesDetected, true);
  assert.equal(configuration.census.diagnostic.state, "empty");
  assert.equal(configuration.dataGov.diagnostic.state, "missing");
});

test("known-good validation uses exact FRED, BEA UserID, Census key, DATA GOV, BLS, and SEC contracts", async () => {
  const { fetchImpl, calls } = successfulFetch();
  const validation = await runProviderValidation({ environment: { ...ENVIRONMENT }, fetchImpl });
  assert.deepEqual(validation.results.map((item) => item.status), Array(6).fill("success"));
  const fred = calls.find((call) => call.url.hostname === "api.stlouisfed.org");
  assert.equal(fred.url.searchParams.get("series_id"), "FEDFUNDS");
  assert.equal(fred.url.searchParams.get("api_key"), ENVIRONMENT.FRED_API_KEY);
  const bea = calls.find((call) => call.url.hostname === "apps.bea.gov");
  assert.equal(bea.url.searchParams.get("UserID"), ENVIRONMENT.BEA_API_KEY);
  assert.equal(bea.url.searchParams.has("api_key"), false);
  assert.equal(bea.url.searchParams.get("method"), "GETDATASETLIST");
  const census = calls.find((call) => call.url.hostname === "api.census.gov");
  assert.equal(census.url.searchParams.get("key"), ENVIRONMENT.CENSUS_API_KEY);
  assert.equal(census.url.searchParams.get("get"), "NAME,ESTAB");
  assert.equal(census.url.pathname, "/data/2023/cbp");
});

test("validation output never includes credential values, URLs, or correlating hashes", async () => {
  const { fetchImpl } = successfulFetch();
  const output = JSON.stringify(await runProviderValidation({ environment: { ...ENVIRONMENT }, fetchImpl }));
  for (const value of Object.values(ENVIRONMENT).slice(0, 4)) assert.doesNotMatch(output, new RegExp(value));
  assert.doesNotMatch(output, /https?:\/\/|api_key=|UserID=|x-api-key|hash/i);
  assert.equal(JSON.parse(output).environment.FRED_API_KEY.state, "present");
});

test("FRED distinguishes missing, rejected, empty, rate-limited, timeout, and malformed responses", async () => {
  const missing = await runProviderValidation({
    environment: { ...ENVIRONMENT, FRED_API_KEY: undefined },
    fetchImpl: successfulFetch().fetchImpl,
  });
  assert.equal(missing.results[0].status, "invalidConfiguration");
  assert.equal(missing.results[0].requestAttempted, false);
  for (const [response, expected] of [
    [() => json({ error_code: 400, error_message: "The api_key is invalid" }, 400), "authenticationFailed"],
    [() => json({ observations: [] }), "noData"],
    [() => new Response("limited", { status: 429 }), "rateLimited"],
    [() => { const error = new Error("timeout"); error.name = "AbortError"; throw error; }, "timeout"],
    [() => new Response("not-json", { status: 200 }), "parseFailed"],
  ]) {
    const validation = await runProviderValidation({
      environment: { ...ENVIRONMENT },
      fetchImpl: successfulFetch({ fred: response }).fetchImpl,
    });
    assert.equal(validation.results[0].status, expected);
  }
});

test("BEA distinguishes HTTP-200 authentication errors, invalid requests, and timeout", async () => {
  const cases = [
    [() => json({ BEAAPI: { Results: { Error: { APIErrorDescription: "UserID is invalid" } } } }), "authenticationFailed"],
    [() => json({ BEAAPI: { Results: { Error: { APIErrorDescription: "Invalid method parameter" } } } }), "invalidRequest"],
    [() => { const error = new Error("timeout"); error.name = "AbortError"; throw error; }, "timeout"],
  ];
  for (const [response, expected] of cases) {
    const validation = await runProviderValidation({
      environment: { ...ENVIRONMENT },
      fetchImpl: successfulFetch({ bea: response }).fetchImpl,
    });
    assert.equal(validation.results[1].status, expected);
  }
});

test("Census distinguishes rejected keys, unsupported requests, empty data, text errors, and timeout", async () => {
  const cases = [
    [() => new Response("The API key is invalid", { status: 400 }), "authenticationFailed"],
    [() => json({ error: "unknown variable" }, 400), "invalidRequest"],
    [() => json([["NAME", "ESTAB", "us"]]), "noData"],
    [() => new Response("unsupported year", { status: 400 }), "invalidRequest"],
    [() => { const error = new Error("timeout"); error.name = "AbortError"; throw error; }, "timeout"],
  ];
  for (const [response, expected] of cases) {
    const validation = await runProviderValidation({
      environment: { ...ENVIRONMENT },
      fetchImpl: successfulFetch({ census: response }).fetchImpl,
    });
    assert.equal(validation.results[2].status, expected);
  }
});

test("Census can still use its public anonymous quota when the optional key is absent", async () => {
  const { fetchImpl, calls } = successfulFetch();
  const validation = await runProviderValidation({
    environment: { ...ENVIRONMENT, CENSUS_API_KEY: undefined },
    fetchImpl,
  });
  assert.equal(validation.results[2].configured, false);
  assert.equal(validation.results[2].requestAttempted, true);
  assert.equal(validation.results[2].status, "success");
  const census = calls.find((call) => call.url.hostname === "api.census.gov");
  assert.equal(census.url.searchParams.has("key"), false);
  assert.deepEqual(validation.results.slice(3).map((item) => item.status), ["success", "success", "success"]);
});
