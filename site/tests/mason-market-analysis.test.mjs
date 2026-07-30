import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function moduleUrl(path, replacements = {}) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(from, to);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}

async function foundationalModules() {
  const configUrl = await moduleUrl("../app/lib/market-analysis/config/marketEnv.ts");
  const securityUrl = await moduleUrl("../app/lib/market-analysis/security.ts");
  const sharedUrl = await moduleUrl("../app/lib/market-analysis/providers/shared.ts", {
    '"../security"': JSON.stringify(securityUrl),
  });
  const dataCenterUrl = await moduleUrl("../app/lib/market-analysis/industries/dataCenterPack.ts");
  const catalogUrl = await moduleUrl("../app/lib/market-analysis/industries/industryCatalog.ts", {
    '"./dataCenterPack"': JSON.stringify(dataCenterUrl),
  });
  const mappingUrl = await moduleUrl("../app/lib/market-analysis/industries/industryMapping.ts");
  const calculationsUrl = await moduleUrl("../app/lib/market-analysis/analysis/calculationEngine.ts");
  const geographyUrl = await moduleUrl("../app/lib/market-analysis/analysis/geographyNormalizer.ts");
  const reportBuildersUrl = await moduleUrl("../app/lib/market-analysis/reports/reportBuilders.ts");
  const referencesUrl = await moduleUrl("../app/lib/market-analysis/reports/reportReferences.ts");
  const copyUrl = await moduleUrl("../app/lib/market-analysis/copy.ts");
  const nonce = () => `#${Date.now()}-${Math.random()}`;
  return {
    configUrl,
    securityUrl,
    sharedUrl,
    geographyUrl,
    copy: await import(copyUrl + nonce()),
    security: await import(securityUrl + nonce()),
    catalog: await import(catalogUrl + nonce()),
    mapping: await import(mappingUrl + nonce()),
    calculations: await import(calculationsUrl + nonce()),
    geography: await import(geographyUrl + nonce()),
    builders: await import(reportBuildersUrl + nonce()),
    references: await import(referencesUrl + nonce()),
  };
}

function scope(overrides = {}) {
  return {
    mode: "analyze",
    market: "U.S. Data Center Infrastructure",
    geography: "United States",
    startYear: 2019,
    endYear: 2023,
    analysisYear: 2023,
    researchQuestion: "",
    focusAreas: [
      "industryFootprint",
      "economicContribution",
      "regionalConcentration",
      "macroEnvironment",
      "publicCompanyEvidence",
      "risks",
    ],
    comparisonCriteria: [
      "industryOutput",
      "valueAdded",
      "establishments",
      "employment",
      "growth",
      "risks",
    ],
    leadingIndicators: [],
    tickers: ["EQIX", "DLR", "VRT"],
    locale: "en",
    reportDepth: "standard",
    outputFormat: "web",
    ...overrides,
  };
}

function evidence(overrides = {}) {
  return {
    evidenceId: "census-estab-2023-us",
    providerId: "census",
    dataset: "County Business Patterns",
    seriesOrTableId: "2023 CBP · 518210 · ESTAB",
    sourceTitle: "Computing Infrastructure Providers",
    officialSourceUrl: "https://api.census.gov/data/2023/cbp.html",
    retrievedAt: "2026-07-30T00:00:00.000Z",
    publicationDate: null,
    observationPeriod: "2023",
    geography: "United States",
    industryCode: "518210",
    marketScope: "Employer-establishment footprint",
    metricLabel: "Establishment count",
    value: 100,
    unit: "Establishments",
    currency: null,
    frequency: "annual",
    seasonalAdjustment: null,
    isReported: true,
    isCalculated: false,
    isProxy: false,
    isForecast: false,
    calculationMethod: null,
    confidence: "high",
    notes: [],
    ...overrides,
  };
}

test("reads only named server provider configuration and treats keyless providers as configured", async () => {
  const { configUrl } = await foundationalModules();
  const previous = {
    fred: process.env.FRED_API_KEY,
    bea: process.env.BEA_API_KEY,
    census: process.env.CENSUS_API_KEY,
    dataGov: process.env.DATA_GOV_API_KEY,
  };
  process.env.FRED_API_KEY = "fred-secret";
  delete process.env.BEA_API_KEY;
  delete process.env.CENSUS_API_KEY;
  process.env.DATA_GOV_API_KEY = "data-secret";
  const config = await import(`${configUrl}#env-${Date.now()}`);
  assert.equal(config.providerConfigurationStatus("fred"), "configured");
  assert.equal(config.providerConfigurationStatus("bea"), "missing");
  assert.equal(config.providerConfigurationStatus("census"), "configured");
  assert.equal(config.providerConfigurationStatus("bls"), "configured");
  assert.equal(config.providerConfigurationStatus("worldBank"), "configured");
  assert.equal(config.providerConfigurationStatus("congressGov"), "configured");
  for (const [key, value] of Object.entries(previous)) {
    const name = { fred: "FRED_API_KEY", bea: "BEA_API_KEY", census: "CENSUS_API_KEY", dataGov: "DATA_GOV_API_KEY" }[key];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("redacts secret query fields, secret values, headers, and rejects non-official hosts", async () => {
  const { security } = await foundationalModules();
  const secret = "never-print-this";
  const sanitized = security.sanitizeSecrets({
    url: `https://api.stlouisfed.org/fred/series?api_key=${secret}&series_id=FEDFUNDS`,
    UserID: secret,
    headers: { "X-Api-Key": secret },
    error: `request contained ${secret}`,
  }, [secret]);
  const serialized = JSON.stringify(sanitized);
  assert.doesNotMatch(serialized, new RegExp(secret));
  assert.match(serialized, /REDACTED/);
  assert.throws(
    () => security.assertOfficialUrl("https://example.com/user-supplied"),
    /allowlist/,
  );
  assert.doesNotMatch(
    security.stableRequestSignature("fred", { series: "FEDFUNDS", api_key: secret }),
    new RegExp(secret),
  );
});

test("classifies invalid configuration, rate limits, timeouts, and malformed provider responses safely", async () => {
  const { security } = await foundationalModules();
  await assert.rejects(
    security.fetchOfficialJson(
      "https://api.stlouisfed.org/fred/series?series_id=BAD-403",
      { cacheTtlMs: 0 },
      async () => new Response("forbidden", { status: 403 }),
    ),
    (error) => error.code === "invalidConfiguration" && error.httpStatus === 403,
  );
  await assert.rejects(
    security.fetchOfficialJson(
      "https://api.stlouisfed.org/fred/series?series_id=BAD-429",
      { cacheTtlMs: 0 },
      async () => new Response("limited", { status: 429 }),
    ),
    (error) => error.code === "rateLimited",
  );
  await assert.rejects(
    security.fetchOfficialJson(
      "https://api.stlouisfed.org/fred/series?series_id=MALFORMED",
      { cacheTtlMs: 0 },
      async () => new Response("{not-json", { status: 200 }),
    ),
    (error) => error.code === "malformedResponse",
  );
  await assert.rejects(
    security.fetchOfficialJson(
      "https://api.stlouisfed.org/fred/series?series_id=TIMEOUT",
      { timeoutMs: 1_000, cacheTtlMs: 0 },
      async (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new Error("aborted")));
      }),
    ),
    (error) => error.code === "temporarilyUnavailable",
  );
});

test("proposes a validated data-center pack and never silently confirms an unknown market", async () => {
  const { catalog } = await foundationalModules();
  const direct = catalog.classificationCandidates(scope());
  assert.equal(direct.packId, "data-center-infrastructure");
  assert.equal(direct.packStatus, "validated");
  assert.ok(direct.candidates.some((item) => item.code === "518210" && item.selected));
  assert.ok(direct.candidates.some((item) => item.code === "514" && item.isProxy));
  const unknown = catalog.classificationCandidates(scope({ market: "A Commercial Market With No Pack" }));
  assert.equal(unknown.packStatus, "universal");
  assert.equal(unknown.candidates[0].code, "USER-REVIEW");
  assert.equal(unknown.candidates[0].selected, false);
});

test("requires user-confirmed mappings and rejects meaningless comparisons", async () => {
  const { catalog, mapping } = await foundationalModules();
  const result = catalog.classificationCandidates(scope());
  const definition = mapping.buildMarketDefinition(scope(), result.candidates, result.limitations);
  assert.equal(definition.userConfirmed, true);
  assert.ok(definition.officialClassificationMappings.every((item) => item.userConfirmed));
  assert.ok(definition.selectedProxies.length > 0);
  assert.deepEqual(
    mapping.validateMarketScope(scope({
      mode: "compare",
      subjectB: "U.S. Data Center Infrastructure",
      geographyB: "United States",
    })),
    ["Comparison subjects and geographies are identical"],
  );
});

test("normalizes California and Texas to official Census geography codes with a national comparison baseline", async () => {
  const { geography } = await foundationalModules();
  assert.deepEqual(
    geography.censusGeographyTargets("California", "Texas"),
    [
      { name: "California", censusFor: "state:06", code: "06", level: "state" },
      { name: "Texas", censusFor: "state:48", code: "48", level: "state" },
      { name: "United States", censusFor: "us:*", code: "US", level: "nation" },
    ],
  );
  assert.throws(() => geography.normalizeCensusGeography("A user-provided URL"), /Unsupported Census geography/);
});

test("calculates percentage change and CAGR deterministically with denominator guards", async () => {
  const { calculations } = await foundationalModules();
  assert.equal(calculations.percentageChange(100, 125), 25);
  assert.equal(Math.round(calculations.compoundAnnualGrowthRate(100, 121, 2) * 100) / 100, 10);
  assert.equal(calculations.safeRatio(50, 10), 5);
  assert.throws(() => calculations.safeRatio(1, 0), /nonzero denominator/);
  assert.throws(() => calculations.compoundAnnualGrowthRate(0, 10, 2), /positive compatible/);
});

test("derives employees per establishment, payroll per employee, and historical CAGR from verified inputs", async () => {
  const { calculations } = await foundationalModules();
  const rows = [
    evidence({ observationPeriod: "2022", value: 100 }),
    evidence({ evidenceId: "emp-2022", observationPeriod: "2022", metricLabel: "Employment", value: 1_000, unit: "Employees" }),
    evidence({ evidenceId: "pay-2022", observationPeriod: "2022", metricLabel: "Annual payroll", value: 90_000, unit: "Thousands of U.S. dollars", currency: "USD" }),
    evidence({ evidenceId: "est-2023", value: 110 }),
    evidence({ evidenceId: "emp-2023", metricLabel: "Employment", value: 1_210, unit: "Employees" }),
    evidence({ evidenceId: "pay-2023", metricLabel: "Annual payroll", value: 121_000, unit: "Thousands of U.S. dollars", currency: "USD" }),
  ];
  const metrics = calculations.calculateIndustryMetrics(rows);
  assert.ok(metrics.some((item) => item.canonicalLabel === "Average employees per establishment"));
  assert.ok(metrics.some((item) => item.canonicalLabel === "Annual payroll per employee"));
  assert.ok(metrics.some((item) => /CAGR/.test(item.canonicalLabel)));
  assert.ok(metrics.filter((item) => item.isCalculated).every((item) => item.evidenceIds.length >= 2));
});

test("builds exact Analyze, Trend, and Compare report structures with References last", async () => {
  const { catalog, mapping, builders } = await foundationalModules();
  for (const [mode, expected] of [["analyze", 16], ["trend", 16], ["compare", 18]]) {
    const selectedScope = scope({
      mode,
      subjectB: mode === "compare" ? "Texas Data Center Ecosystem" : undefined,
      geographyB: mode === "compare" ? "Texas" : undefined,
    });
    const candidates = catalog.classificationCandidates(selectedScope);
    const definition = mapping.buildMarketDefinition(selectedScope, candidates.candidates, candidates.limitations);
    const request = { scope: selectedScope, marketDefinition: definition, plan: { generatedAt: "", mode, items: [] } };
    const coverage = {
      status: "Partial public-data coverage",
      providersConfigured: ["census"],
      providersUsed: ["census"],
      providersUnavailable: [],
      providersNotRelevant: [],
      datasetsUsed: ["County Business Patterns"],
      industryMappings: ["naics: 518210"],
      geographiesCovered: ["United States"],
      timePeriodsCovered: ["2023"],
      metricsWithCompleteEvidence: 1,
      metricsUsingProxies: 0,
      metricsUnavailable: [],
      dataRetrievedAt: "2026-07-30T00:00:00.000Z",
      reportGeneratedAt: "2026-07-30T00:00:00.000Z",
    };
    const sections = builders.buildReportSections(request, [], coverage);
    assert.equal(sections.length, expected);
    assert.match(sections.at(-1).title, /References/);
    assert.ok(sections.every((item, index) => item.number === String(index + 1).padStart(2, "0")));
    if (mode === "trend") {
      assert.match(sections.map((item) => item.paragraphs).flat().join(" "), /not forecasts/);
    }
  }
});

test("validates sequential public references and catches credential-bearing URLs", async () => {
  const { references } = await foundationalModules();
  const clean = [{
    providerId: "fred",
    providerName: "FRED",
    dataset: "FRED Series",
    seriesOrTableId: "FEDFUNDS",
    officialTitle: "Federal Funds Effective Rate",
    officialSourceUrl: "https://fred.stlouisfed.org/series/FEDFUNDS",
    geography: "United States",
    observationPeriod: "2025",
    units: "Percent",
    retrievedAt: "2026-07-30",
    relevance: "Macro environment",
    number: 1,
  }];
  assert.deepEqual(references.validateReferences(clean), []);
  assert.match(
    references.validateReferences([{ ...clean[0], officialSourceUrl: "https://api.stlouisfed.org/x?api_key=secret" }]).join(" "),
    /credential/,
  );
});

test("compacts repeated observations from the same official series into one dated-range reference", async () => {
  const { references } = await foundationalModules();
  const base = {
    providerId: "fred",
    providerName: "Federal Reserve Economic Data",
    dataset: "FRED Series",
    seriesOrTableId: "FEDFUNDS",
    officialTitle: "Federal Funds Effective Rate",
    officialSourceUrl: "https://fred.stlouisfed.org/series/FEDFUNDS",
    geography: "United States",
    units: "Percent",
    retrievedAt: "2026-07-30T00:00:00.000Z",
    relevance: "Financing environment",
  };
  const compacted = references.buildReportReferences([{
    references: [
      { ...base, observationPeriod: "2025-01-01" },
      { ...base, observationPeriod: "2025-02-01" },
    ],
  }]);
  assert.equal(compacted.length, 1);
  assert.equal(compacted[0].observationPeriod, "2025-01-01–2025-02-01");
});

test("normalizes FRED observations and never places the API key in evidence or references", async () => {
  const modules = await foundationalModules();
  const previous = process.env.FRED_API_KEY;
  process.env.FRED_API_KEY = "fred-test-secret";
  const fredUrl = await moduleUrl("../app/lib/market-analysis/providers/fredProvider.ts", {
    '"../config/marketEnv"': JSON.stringify(modules.configUrl),
    '"../security"': JSON.stringify(modules.securityUrl),
    '"./shared"': JSON.stringify(modules.sharedUrl),
  });
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify(String(url).includes("/observations")
      ? { observations: [{ date: "2023-01-01", value: "5.25" }, { date: "2023-02-01", value: "." }] }
      : { seriess: [{ id: "FEDFUNDS", title: "Federal Funds Effective Rate", units: "Percent", frequency: "Monthly", seasonal_adjustment: "Not Seasonally Adjusted" }] }),
    { status: 200, headers: { "content-type": "application/json" } });
  };
  const { createFredProvider } = await import(`${fredUrl}#${Date.now()}`);
  const provider = createFredProvider({ fetchImpl });
  const request = {
    scope: scope({ tickers: [] }),
    marketDefinition: {
      officialClassificationMappings: [{
        providerId: "fred", kind: "fredSeries", code: "FEDFUNDS",
        officialLabel: "Federal Funds Effective Rate", includedScope: "Macro",
        confidence: "high", reason: "Financing", userConfirmed: true,
      }],
    },
    plan: {},
  };
  const raw = await provider.fetchData(request);
  const normalized = provider.normalizeResponse(raw, request, "2026-07-30T00:00:00.000Z");
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].value, 5.25);
  assert.equal(normalized[0].frequency, "monthly");
  assert.match(normalized[0].officialSourceUrl, /fred\.stlouisfed\.org\/series\/FEDFUNDS/);
  assert.doesNotMatch(JSON.stringify(normalized), /fred-test-secret/);
  assert.ok(calls.every((call) => call.includes("fred-test-secret")));
  if (previous === undefined) delete process.env.FRED_API_KEY;
  else process.env.FRED_API_KEY = previous;
});

test("normalizes Census CBP and visibly distinguishes establishments from companies", async () => {
  const modules = await foundationalModules();
  const censusUrl = await moduleUrl("../app/lib/market-analysis/providers/censusProvider.ts", {
    '"../config/marketEnv"': JSON.stringify(modules.configUrl),
    '"../security"': JSON.stringify(modules.securityUrl),
    '"./shared"': JSON.stringify(modules.sharedUrl),
    '"../analysis/geographyNormalizer"': JSON.stringify(modules.geographyUrl),
  });
  const fetchImpl = async () => new Response(JSON.stringify([
    ["NAME", "NAICS2017_LABEL", "ESTAB", "EMP", "PAYANN", "us"],
    ["United States", "Computing Infrastructure Providers", "100", "1000", "90000", "1"],
  ]), { status: 200 });
  const { createCensusProvider } = await import(`${censusUrl}#${Date.now()}`);
  const provider = createCensusProvider({ fetchImpl });
  const request = {
    scope: scope({ startYear: 2023, endYear: 2023, tickers: [] }),
    marketDefinition: { officialClassificationMappings: [{
      providerId: "census", kind: "naics", code: "518210", userConfirmed: true,
    }] },
    plan: {},
  };
  const raw = await provider.fetchData(request);
  const normalized = provider.normalizeResponse(raw, request, "2026-07-30T00:00:00.000Z");
  assert.deepEqual(normalized.map((item) => item.metricLabel), [
    "Establishment count", "Employment", "Annual payroll",
  ]);
  assert.match(normalized[0].notes.join(" "), /not the same as a company/);
  assert.equal(normalized[2].currency, "USD");
});

test("normalizes BEA multiplier data without retaining an echoed UserID", async () => {
  const modules = await foundationalModules();
  const previous = process.env.BEA_API_KEY;
  process.env.BEA_API_KEY = "bea-test-secret";
  const beaUrl = await moduleUrl("../app/lib/market-analysis/providers/beaProvider.ts", {
    '"../config/marketEnv"': JSON.stringify(modules.configUrl),
    '"../security"': JSON.stringify(modules.securityUrl),
    '"./shared"': JSON.stringify(modules.sharedUrl),
  });
  const fetchImpl = async () => new Response(JSON.stringify({
    BEAAPI: {
      Request: { RequestParam: [{ ParameterName: "UserID", ParameterValue: "bea-test-secret" }] },
      Results: {
        Data: [{
          Industry: "514",
          IndustryDescription: "Data processing and information services",
          Year: "2023",
          DataValue: "123.4",
          UNIT_MULT: "6",
          CL_UNIT: "Millions of U.S. dollars",
        }],
      },
    },
  }), { status: 200 });
  const { createBeaProvider } = await import(`${beaUrl}#${Date.now()}`);
  const provider = createBeaProvider({ fetchImpl });
  const request = {
    scope: scope({ startYear: 2023, endYear: 2023, tickers: [] }),
    marketDefinition: { officialClassificationMappings: [{
      providerId: "bea", kind: "beaIndustry", code: "514", userConfirmed: true,
    }] },
    plan: {},
  };
  const raw = await provider.fetchData(request);
  const normalized = provider.normalizeResponse(raw, request, "2026-07-30T00:00:00.000Z");
  assert.equal(normalized[0].value, 123_400_000);
  assert.equal(normalized[0].isProxy, true);
  assert.doesNotMatch(JSON.stringify({ raw, normalized }), /bea-test-secret/);
  assert.doesNotMatch(normalized[0].officialSourceUrl, /UserID|api_key|key=/i);
  if (previous === undefined) delete process.env.BEA_API_KEY;
  else process.env.BEA_API_KEY = previous;
});

test("normalizes BLS annual averages and World Bank pagination payloads without converting definitions", async () => {
  const modules = await foundationalModules();
  const blsUrl = await moduleUrl("../app/lib/market-analysis/providers/blsProvider.ts", {
    '"../security"': JSON.stringify(modules.securityUrl),
    '"./shared"': JSON.stringify(modules.sharedUrl),
  });
  const { createBlsProvider } = await import(`${blsUrl}#${Date.now()}`);
  const bls = createBlsProvider({
    fetchImpl: async () => new Response(JSON.stringify({
      status: "REQUEST_SUCCEEDED",
      Results: { series: [{
        seriesID: "CEU5051821001",
        data: [
          { year: "2023", period: "M13", value: "100.0", footnotes: [] },
          { year: "2023", period: "M01", value: "98.0", footnotes: [] },
        ],
      }] },
    }), { status: 200 }),
  });
  const request = {
    scope: scope({ startYear: 2023, endYear: 2023, tickers: [] }),
    marketDefinition: { officialClassificationMappings: [{
      providerId: "bls", kind: "blsSeries", code: "CEU5051821001",
      officialLabel: "All Employees", includedScope: "Labor", confidence: "medium",
      reason: "Labor trend", userConfirmed: true,
    }] },
    plan: {},
  };
  const blsRaw = await bls.fetchData(request);
  const blsEvidence = bls.normalizeResponse(blsRaw, request, "2026-07-30T00:00:00.000Z");
  assert.equal(blsEvidence.find((item) => item.observationPeriod === "2023").frequency, "annual");
  assert.equal(blsEvidence.find((item) => item.observationPeriod === "2023-01").frequency, "monthly");

  const worldBankUrl = await moduleUrl("../app/lib/market-analysis/providers/worldBankProvider.ts", {
    '"../security"': JSON.stringify(modules.securityUrl),
    '"./shared"': JSON.stringify(modules.sharedUrl),
  });
  const { createWorldBankProvider } = await import(`${worldBankUrl}#${Date.now()}`);
  const worldBank = createWorldBankProvider();
  const wbRequest = {
    scope: scope({ geography: "International", tickers: [] }),
    marketDefinition: { officialClassificationMappings: [{
      providerId: "worldBank", kind: "worldBankIndicator", code: "NY.GDP.MKTP.CD",
      userConfirmed: true,
    }] },
    plan: {},
  };
  const wbEvidence = worldBank.normalizeResponse([{
    indicator: { id: "NY.GDP.MKTP.CD", value: "GDP" },
    country: { id: "US", value: "United States" },
    countryiso3code: "USA",
    date: "2023",
    value: 27_000_000_000_000,
    unit: "current US$",
  }, {
    indicator: { id: "NY.GDP.MKTP.CD", value: "GDP" },
    country: { id: "CN", value: "China" },
    countryiso3code: "CHN",
    date: "2023",
    value: null,
  }], wbRequest, "2026-07-30T00:00:00.000Z");
  assert.equal(wbEvidence.length, 1);
  assert.equal(wbEvidence[0].value, 27_000_000_000_000);
  assert.match(wbEvidence[0].officialSourceUrl, /data\.worldbank\.org\/indicator/);
});

test("keeps every known Mason heading and CTA free of terminal periods", async () => {
  const { copy } = await foundationalModules();
  const terminal = /[。.]\s*$/u;
  assert.deepEqual(copy.masonHeadingValues("en").filter((value) => terminal.test(value)), []);
  assert.deepEqual(copy.masonHeadingValues("zh").filter((value) => terminal.test(value)), []);
});

test("keeps provider keys ignored and Mason isolated from Ethan and Nora architecture", async () => {
  const [rootIgnore, siteIgnore, component, masonCopy, secProvider, nora, ethan, genericRoute] = await Promise.all([
    readFile(new URL("../../.gitignore", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
    readFile(new URL("../app/MasonMarketAnalysisWorkflow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/market-analysis/copy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/market-analysis/providers/secProvider.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/NoraRegulatoryWorkflow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ResearchApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/workflows/[workflow]/page.tsx", import.meta.url), "utf8"),
  ]);
  for (const pattern of [".env", ".env.local", ".env*.local"]) {
    assert.match(`${rootIgnore}\n${siteIgnore}`, new RegExp(`^${pattern.replaceAll(".", "\\.").replace("*", "\\*")}$`, "m"));
  }
  assert.match(secProvider, /secClient\.resolveCompany/);
  assert.match(secProvider, /secClient\.getSubmissions/);
  assert.match(secProvider, /secClient\.getCompanyFacts/);
  assert.doesNotMatch(secProvider, /fetch\(["'`]https:\/\/data\.sec\.gov/);
  assert.match(component, /Analyze|analyze/);
  assert.match(component, /Trend|trend/);
  assert.match(component, /Compare|compare/);
  assert.match(masonCopy, /Confirm data scope/);
  assert.match(component, /data-pdf-block/);
  assert.doesNotMatch(genericRoute, /"market-industry"/);
  assert.match(nora, /generateRegulatoryProposal/);
  assert.match(ethan, /exportReportPdf/);
});
