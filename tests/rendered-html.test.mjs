import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const projectRoot = new URL("../", import.meta.url);

async function worker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: builtWorker } = await import(workerUrl.href);
  return builtWorker;
}

async function canonicalMetricsModule() {
  const url = await transpiledModuleUrl("../app/lib/canonical-metrics.ts");
  return import(`${url}#${Date.now()}-${Math.random()}`);
}

async function transpiledModuleUrl(path, replacements = {}) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements)) {
    source = source.replaceAll(from, to);
  }
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
}

async function consistencyAuditorModule() {
  const canonicalUrl = await transpiledModuleUrl("../app/lib/canonical-metrics.ts");
  const auditorUrl = await transpiledModuleUrl(
    "../app/lib/metric-consistency-auditor.ts",
    { '"./canonical-metrics"': JSON.stringify(canonicalUrl) },
  );
  return import(`${auditorUrl}#${Date.now()}-${Math.random()}`);
}

async function cacheModule() {
  const url = await transpiledModuleUrl("../app/lib/cache.ts");
  return import(`${url}#${Date.now()}-${Math.random()}`);
}

const environment = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
};

const context = {
  waitUntil() {},
  passThroughOnException() {},
};

test("server-renders the bilingual sector-aware research request", async () => {
  const builtWorker = await worker();
  const response = await builtWorker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    environment,
    context,
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /ScopeLine/);
  assert.match(html, /一键生成公开信息尽调/);
  assert.match(html, /id="company"/);
  assert.match(html, /生成行业感知研究/);
  assert.match(html, /综合石油与天然气/);
  assert.match(html, /半导体/);
  assert.match(html, /工业机械/);
  assert.match(html, /CAT/);
  assert.match(html, /即将推出/);
  assert.match(html, />中文</);
  assert.match(html, />EN</);
  assert.doesNotMatch(html, /输入一家公司|生成尽调报告|codex-preview|react-loading-skeleton/i);
});

test("rejects invalid research requests in Chinese before external data access", async () => {
  const builtWorker = await worker();
  const response = await builtWorker.fetch(
    new Request("http://localhost/api/research", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ company: "x" }),
    }),
    environment,
    context,
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "请输入 2-100 个字符的公司名或交易代码。",
  });
});

test("rejects invalid research requests in English before external data access", async () => {
  const builtWorker = await worker();
  const response = await builtWorker.fetch(
    new Request("http://localhost/api/research", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ company: "x", locale: "en" }),
    }),
    environment,
    context,
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Enter a company name or ticker between 2 and 100 characters.",
  });
});

test("rejects unsupported sector combinations before SEC access", async () => {
  const builtWorker = await worker();
  const response = await builtWorker.fetch(
    new Request("http://localhost/api/research", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        company: "NVDA",
        locale: "en",
        market: "US",
        sector: "technology",
        subindustry: "integrated-oil-gas",
      }),
    }),
    environment,
    context,
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Select a currently supported market, sector, and subindustry combination.",
  });
});

test("returns distinct screened outlooks without regenerating company data", async () => {
  const builtWorker = await worker();
  const requests = [
    { market: "Europe", subindustry: "integrated-oil-gas", locale: "en", refresh: true },
    { market: "US", subindustry: "semiconductors", locale: "en", refresh: true },
    { market: "US", subindustry: "banks", locale: "en", refresh: true },
    { market: "US", subindustry: "biopharma", locale: "en", refresh: true },
    { market: "US", subindustry: "industrial-machinery", locale: "en", refresh: true },
  ];
  const [energyResponse, semiResponse, bankResponse, biopharmaResponse, industrialResponse] = await Promise.all(
    requests.map((body) =>
      builtWorker.fetch(
        new Request("http://localhost/api/sector-outlook", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        environment,
        context,
      ),
    ),
  );
  assert.equal(energyResponse.status, 200);
  assert.equal(semiResponse.status, 200);
  assert.equal(bankResponse.status, 200);
  assert.equal(biopharmaResponse.status, 200);
  assert.equal(industrialResponse.status, 200);
  const energy = (await energyResponse.json()).outlook;
  const semis = (await semiResponse.json()).outlook;
  const banks = (await bankResponse.json()).outlook;
  const biopharma = (await biopharmaResponse.json()).outlook;
  const industrials = (await industrialResponse.json()).outlook;
  assert.equal(energy.subindustry, "integrated-oil-gas");
  assert.equal(semis.subindustry, "semiconductors");
  assert.equal(banks.subindustry, "banks");
  assert.equal(biopharma.subindustry, "biopharma");
  assert.equal(industrials.subindustry, "industrial-machinery");
  assert.ok(energy.claims.length >= 2);
  assert.ok(semis.claims.length >= 2);
  assert.ok(banks.claims.length >= 2);
  assert.ok(biopharma.claims.length >= 2);
  assert.ok(industrials.claims.length >= 2);
  assert.ok(energy.claims.every((claim) =>
    claim.publicationDate >= "2025-01-01" && claim.publisher && claim.title && claim.url
  ));
  assert.ok(semis.claims.every((claim) =>
    claim.publicationDate >= "2025-01-01" && claim.publisher && claim.title && claim.url
  ));
  assert.ok(banks.claims.every((claim) =>
    claim.publicationDate >= "2025-01-01" && claim.publisher && claim.title && claim.url
  ));
  assert.ok(biopharma.claims.every((claim) =>
    claim.publicationDate >= "2025-01-01" && claim.publisher && claim.title && claim.url
  ));
  assert.ok(industrials.claims.every((claim) =>
    claim.publicationDate >= "2025-01-01" && claim.publisher && claim.title && claim.url
  ));
  assert.ok(energy.learningAudit.acceptedSources >= 2);
  assert.ok(semis.learningAudit.acceptedSources >= 2);
  assert.ok(banks.learningAudit.acceptedSources >= 2);
  assert.ok(biopharma.learningAudit.acceptedSources >= 2);
  assert.ok(industrials.learningAudit.acceptedSources >= 2);
  assert.equal(energy.learningAudit.publicationWindowStart, "2025-01-01");
  assert.equal(semis.learningAudit.publicationWindowStart, "2025-01-01");
  assert.equal(banks.learningAudit.publicationWindowStart, "2025-01-01");
  assert.equal(biopharma.learningAudit.publicationWindowStart, "2025-01-01");
  assert.equal(industrials.learningAudit.publicationWindowStart, "2025-01-01");
  assert.notDeepEqual(
    energy.claims.map((claim) => claim.publisher),
    semis.claims.map((claim) => claim.publisher),
  );
});

test("keeps the full client-to-API sector and locale contract explicit", async () => {
  const [client, route, types, outlookRoute] = await Promise.all([
    readFile(new URL("../app/ResearchApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/research/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/research-types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/sector-outlook/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(client, /JSON\.stringify\(requestBody\(query,\s*requestedLocale\)\)/);
  assert.match(client, /company:\s*query/);
  assert.match(client, /\bmarket,\s*\n\s*sector,\s*\n\s*subindustry,\s*\n\s*options,/);
  assert.match(route, /type ResearchPayload/);
  assert.match(route, /selectionFromPayload/);
  assert.match(types, /selection:\s*ResearchSelection/);
  assert.match(client, /scopeline-locale/);
  assert.match(client, /document\.documentElement\.lang/);
  assert.match(outlookRoute, /getSectorOutlook/);
  assert.match(client, /refreshSectorOutlook/);
});

test("enforces strict FCF and sector-specific analyst packs", async () => {
  const [route, financialMetrics, packs, evidence, retrieval, learning, sectorTypes] = await Promise.all([
    readFile(new URL("../app/api/research/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/financial-metrics.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/sector-packs.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/sector-evidence.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/sector-retrieval.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/sector-learning-pipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/sector-types.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /Free cash flow = operating cash flow - cash capital expenditure/);
  assert.match(financialMetrics, /formula:\s*"operating_cash_flow - cash_capex"/);
  assert.match(financialMetrics, /formulaId:\s*"subtract"/);
  assert.doesNotMatch(route + financialMetrics, /operatingCashFlow(?:Value)?\s*\+\s*investingCashFlow/);
  assert.match(route, /Unable to calculate free cash flow from available filings\./);
  assert.match(route, /SUPPORTED_TICKER_RECORDS/);
  assert.match(route, /if \(supportedRecord\) return supportedRecord/);

  for (const required of [
    "Production",
    "Realized prices",
    "LNG volumes",
    "Refining margins",
    "Commodity sensitivity",
    "Major projects",
    "End-market revenue",
    "AI / data-center exposure",
    "Gross margin",
    "Customer concentration",
    "Market share",
    "Net interest income",
    "Net interest margin",
    "Deposits",
    "Loan growth",
    "Credit-loss provision",
    "Allowance coverage",
    "CET1 ratio",
    "Efficiency ratio",
    "Tangible book value",
    "Capital returns",
    "Largest-product revenue",
    "Pipeline stage",
    "Clinical milestones",
    "Regulatory dates",
    "R&D expense",
    "Cash runway",
    "compound-patent expiry",
    "Risk-adjusted pipeline value",
    "New orders",
    "Firm order backlog",
    "Organic growth",
    "Price / manufacturing-cost profit impact",
    "Power & Energy segment profit margin",
    "Working capital",
    "FCF conversion",
    "Capacity utilization",
    "Backlog expected within one year",
  ]) assert.match(packs, new RegExp(required.replace("/", "\\/"), "i"));
  assert.match(packs, /EV \/ FCF/);
  assert.match(packs, /EV \/ Revenue/);
  assert.match(packs, /P \/ TBV/);
  assert.match(packs, /no unverified rNPV is included/);
  assert.match(packs, /Do not apply industrial-company revenue, capex, or FCF templates to banks/);
  assert.match(packs, /Do not calculate risk-adjusted pipeline value from insufficient public inputs/);
  assert.match(packs, /XOM/);
  assert.match(packs, /AMD/);

  assert.match(learning, /SECTOR_RESEARCH_START_DATE = "2025-01-01"/);
  assert.match(learning, /source\.publicationDate < SECTOR_RESEARCH_START_DATE/);
  assert.match(learning, /source\.retrievalDate < source\.publicationDate/);
  assert.match(learning, /seenUrls/);
  assert.match(learning, /source\.accessible/);
  assert.match(learning, /non-concise-learning-content/);
  for (const field of [
    "title",
    "publisher",
    "publicationDate",
    "retrievalDate",
    "sector",
    "subindustry",
    "geography",
    "topic",
    "url",
    "sourceType",
    "currentEvidence",
    "generalizedMethods",
  ]) assert.match(sectorTypes, new RegExp(`${field}:`));
  assert.match(evidence, /SECTOR_LEARNING_CORPUS/);
  assert.doesNotMatch(evidence + sectorTypes, /fullText:|documentBody:|reportContent:/);
  assert.match(retrieval, /filteredSources/);
  assert.match(retrieval, /embed\(/);
  assert.match(retrieval, /source\.generalizedMethods/);
  assert.match(retrieval, /source\.currentEvidence/);
  assert.match(retrieval, /full reports are never loaded/);
});

test("locates all 11 Shell metrics with ordered, auditable source selection", async () => {
  const builtWorker = await worker();
  const response = await builtWorker.fetch(
    new Request("http://localhost/api/metric-locator", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ company: "SHEL", fixture: true }),
    }),
    environment,
    context,
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.sourceMode, "verified-snapshot");
  assert.equal(payload.audit.extractedCount, 11);
  assert.equal(payload.audit.requestedCount, 11);
  assert.equal(payload.audit.extractionSuccessRate, 1);
  assert.deepEqual(payload.unresolved, []);
  assert.deepEqual(payload.audit.searchedSources, [
    "standard-sec-xbrl",
    "filing-custom-xbrl",
    "filing-html-table",
    "filing-text",
    "earnings-release-exhibit",
    "investor-presentation",
  ]);

  const results = Object.fromEntries(
    payload.audit.results.map((result) => [result.metricId, result]),
  );
  assert.equal(results.production.displayValue, "2,800 kboe/d");
  assert.equal(results["realized-prices"].row, "Europe — Shell subsidiaries — crude oil and natural gas liquids");
  assert.equal(results.lng.displayValue, "72.9 million tonnes");
  assert.equal(results["refining-margin"].displayValue, "USD 10.14/bbl");
  assert.equal(results["segment-earnings"].sourceTier, "filing-custom-xbrl");
  assert.equal(results["cash-capex"].displayValue, "USD 20.915bn");
  assert.equal(results.fcf.status, "Derived");
  assert.equal(results.fcf.selectedValue, 21_948_000_000);
  assert.match(results.fcf.formula, /Operating cash flow - cash capital expenditure/);
  assert.ok(
    results.fcf.rejectedCandidates.some((candidate) =>
      candidate.rejectionReasons.includes("Accounting-definition mismatch")),
  );
  assert.equal(results["net-debt"].displayValue, "USD 45.687bn");
  assert.equal(results.dividends.sourceTier, "standard-sec-xbrl");
  assert.equal(results["share-buybacks"].displayValue, "USD 13.879bn");
  assert.equal(results["major-projects"].displayValue, "21 projects");

  const registry = payload.metricRegistry;
  assert.equal(registry.schema_version, "1.0");
  assert.equal(registry.metrics.length, 12);
  assert.equal(
    new Set(registry.metrics.map((metric) => metric.canonical_key)).size,
    registry.metrics.length,
  );
  assert.ok(registry.metrics.every((metric) => !("displayValue" in metric)));
  const canonicalFcf = registry.metrics.find((metric) => metric.metric_id === "fcf");
  assert.equal(canonicalFcf.value, 21_948_000_000);
  assert.equal(canonicalFcf.definition_id, "ocf-less-cash-capex");
  assert.equal(canonicalFcf.formula_id, "subtract");
  assert.equal(canonicalFcf.input_metric_keys.length, 2);
});

test("enforces canonical schema, key uniqueness, definitions, and dependencies", async () => {
  const {
    CanonicalMetricError,
    MetricRegistry,
    calculateFromCanonicalInputs,
    createCanonicalMetric,
  } = await canonicalMetricsModule();
  const reported = (overrides = {}) =>
    createCanonicalMetric({
      metric_id: "net-debt",
      company_id: "SHEL",
      sector: "integrated-oil-gas",
      period: "FY2025",
      period_start: null,
      period_end: "2025-12-31",
      value: 45_687_000_000,
      unit: "USD",
      currency: "USD",
      status: "Reported",
      definition_id: "issuer-reported-net-debt",
      formula_id: null,
      formula: null,
      input_metric_keys: [],
      source_document: "Shell FY2025 Form 20-F",
      source_url: "https://www.sec.gov/",
      source_type: "filing",
      source_date: "2026-03-12",
      filing_date: "2026-03-12",
      section: "Liquidity",
      table: "Net debt",
      row_label: "Net debt",
      raw_value: "45,687",
      extraction_method: "filing-table",
      confidence: 0.98,
      retrieved_at: "2026-07-17T00:00:00.000Z",
      data_version: "fixture-v1",
      calculation_version: "1.0",
      ...overrides,
    });

  const registry = new MetricRegistry("fixture-v1", "1.0");
  const issuerNetDebt = reported();
  registry.register(issuerNetDebt);
  assert.throws(
    () => registry.register(issuerNetDebt),
    (error) =>
      error instanceof CanonicalMetricError &&
      error.code === "DUPLICATE_CANONICAL_KEY",
  );
  registry.register(reported({
    value: 43_000_000_000,
    definition_id: "normalized-debt-less-cash",
  }));
  assert.throws(
    () => registry.getMetric({
      company_id: "SHEL",
      metric_id: "net-debt",
      period: "FY2025",
    }),
    (error) =>
      error instanceof CanonicalMetricError &&
      error.code === "DEFINITION_CONFLICT",
  );

  const ocf = reported({
    metric_id: "operating-cash-flow",
    value: 42_863_000_000,
    definition_id: "reported-operating-cash-flow",
  });
  const capex = reported({
    metric_id: "cash-capex",
    value: 20_915_000_000,
    definition_id: "shell-cash-capex",
  });
  assert.equal(calculateFromCanonicalInputs("subtract", [ocf, capex]), 21_948_000_000);
  assert.throws(
    () => reported({ value: null }),
    (error) =>
      error instanceof CanonicalMetricError &&
      error.code === "INVALID_METRIC",
  );
  assert.throws(
    () => calculateFromCanonicalInputs("subtract", [
      ocf,
      reported({
        metric_id: "cash-capex",
        period: "FY2024",
        period_end: "2024-12-31",
        value: 21_085_000_000,
      }),
    ]),
    (error) =>
      error instanceof CanonicalMetricError &&
      error.code === "PERIOD_MISMATCH",
  );
});

test("rejects mixed units and currencies while preserving full calculation precision", async () => {
  const {
    CanonicalMetricError,
    calculateFromCanonicalInputs,
    createCanonicalMetric,
  } = await canonicalMetricsModule();
  const metric = (overrides = {}) =>
    createCanonicalMetric({
      metric_id: "revenue",
      company_id: "CAT",
      sector: "industrial-machinery",
      period: "FY2025",
      period_start: "2025-01-01",
      period_end: "2025-12-31",
      value: 67_589_000_000,
      unit: "USD",
      currency: "USD",
      status: "Reported",
      definition_id: "reported-revenue",
      formula_id: null,
      formula: null,
      input_metric_keys: [],
      source_document: "Caterpillar 2025 Form 10-K",
      source_url: "https://www.sec.gov/",
      source_type: "filing",
      source_date: "2026-02-13",
      filing_date: "2026-02-13",
      section: "Statements of Results",
      table: "Results",
      row_label: "Sales and revenues",
      raw_value: "67589",
      extraction_method: "deterministic-sec-xbrl",
      confidence: 0.99,
      retrieved_at: "2026-07-17T00:00:00.000Z",
      data_version: "cat-fixture-v1",
      calculation_version: "1.0",
      ...overrides,
    });
  const usd = metric();
  const eur = metric({
    metric_id: "cash-capex",
    value: 2_821_000_000,
    currency: "EUR",
    unit: "EUR",
    definition_id: "cash-purchases-property-plant-equipment",
  });
  assert.throws(
    () => calculateFromCanonicalInputs("subtract", [usd, eur]),
    (error) =>
      error instanceof CanonicalMetricError &&
      error.code === "UNIT_MISMATCH",
  );
  const usdTonnes = metric({
    metric_id: "production",
    value: 1.23456789,
    currency: null,
    unit: "million tonnes",
    definition_id: "reported-production",
  });
  assert.throws(
    () => calculateFromCanonicalInputs("add", [usd, usdTonnes]),
    (error) =>
      error instanceof CanonicalMetricError &&
      error.code === "UNIT_MISMATCH",
  );
  const eurCurrencyOnly = metric({
    metric_id: "cash-capex",
    value: 2_821_000_000,
    currency: "EUR",
    unit: "USD",
    definition_id: "cash-purchases-property-plant-equipment",
  });
  assert.throws(
    () => calculateFromCanonicalInputs("subtract", [usd, eurCurrencyOnly]),
    (error) =>
      error instanceof CanonicalMetricError &&
      error.code === "CURRENCY_MISMATCH",
  );
  const numerator = metric({ value: 19_300_000_000 });
  const denominator = metric({
    metric_id: "backlog",
    value: 51_200_000_000,
    definition_id: "issuer-reported-firm-order-backlog",
  });
  assert.equal(
    calculateFromCanonicalInputs("divide", [numerator, denominator]),
    19_300_000_000 / 51_200_000_000,
  );
});

test("invalidates expired, deleted, failed, and explicitly refreshed cache entries", async () => {
  const { MemoryCache } = await cacheModule();
  let loads = 0;
  const cache = new MemoryCache(25);
  const loader = async () => {
    loads += 1;
    return { generation: loads };
  };
  assert.deepEqual(await cache.getOrLoad("CAT|FY2025|v1", loader), { generation: 1 });
  assert.deepEqual(await cache.getOrLoad("CAT|FY2025|v1", loader), { generation: 1 });
  cache.delete("CAT|FY2025|v1");
  assert.deepEqual(await cache.getOrLoad("CAT|FY2025|v1", loader), { generation: 2 });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(await cache.getOrLoad("CAT|FY2025|v1", loader), { generation: 3 });
  await assert.rejects(
    cache.getOrLoad("failure", async () => {
      throw new Error("temporary");
    }),
    /temporary/,
  );
  assert.deepEqual(await cache.getOrLoad("failure", loader), { generation: 4 });
  cache.clear();
  assert.deepEqual(await cache.getOrLoad("CAT|FY2025|v1", loader), { generation: 5 });
});

test("keeps metric definitions and non-disclosure controls explicit", async () => {
  const [definitions, locator, types] = await Promise.all([
    readFile(new URL("../app/lib/metric-definitions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/metric-locator.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/metric-locator-types.ts", import.meta.url), "utf8"),
  ]);
  for (const field of [
    "id:",
    "displayName:",
    "aliases:",
    "acceptedUnits:",
    "periodRule:",
    "preferredSources",
    "derivationFormula:",
    "requiredInputs:",
    "validationRules:",
  ]) assert.match(definitions, new RegExp(field));
  for (const status of [
    "Reported",
    "Derived",
    "Not yet extracted",
    "Not disclosed by issuer",
    "Unable to calculate",
    "Definition mismatch",
    "Extraction failed",
  ]) assert.match(types, new RegExp(status));
  assert.match(locator, /METRIC_SOURCE_ORDER\.every/);
  assert.match(locator, /allSourcesSearched[\s\S]*Not disclosed by issuer/);
  assert.match(locator, /Lower-priority valid candidate/);
  assert.match(locator, /Dimensional fact is not the consolidated total/);
  assert.match(locator, /Deterministic arithmetic using two validated inputs/);
});

test("hides unusable cards and moves missing detail into Data Coverage", async () => {
  const [client, route, types] = await Promise.all([
    readFile(new URL("../app/ResearchApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/research/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/research-types.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /item\.usable/);
  assert.match(client, /\.filter\(\(item\) => item\.value !== null\)/);
  assert.match(client, /Limited data coverage/);
  assert.match(client, /Data Coverage/);
  assert.match(client, /metric\.rejectedCandidates/);
  assert.match(client, /metric\.extractionMethod/);
  assert.match(client, /scenario\.projectedFreeCashFlow !== null/);
  assert.match(client, /scenario\.valuationMetric !== null/);
  assert.match(client, /scenario\.modelImpliedEnterpriseValue !== null/);
  assert.doesNotMatch(client, /latestPeriod\.currentRatio === null \? copy\.unavailable/);
  assert.match(route, /\.filter\(\(result\) => result\.usable && result\.canonicalKey\)/);
  assert.match(route, /criticalMetricIds/);
  assert.match(route, /shellMetricAudit/);
  assert.match(route, /if \(!consistencyAudit\.passed\)/);
  assert.match(route, /potentially inconsistent financial results were not published/);
  assert.match(types, /dataCoverage:\s*DataCoverage/);
});

test("routes every quantitative report module through the canonical registry", async () => {
  const [route, registry, financials, scenarios, types] = await Promise.all([
    readFile(new URL("../app/api/research/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/canonical-metrics.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/financial-metrics.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/canonical-scenarios.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/research-types.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /buildFinancialMetricRegistry/);
  assert.match(route, /financialPeriodsFromRegistry/);
  assert.match(route, /buildCanonicalScenarios/);
  assert.match(route, /buildMetricUsage/);
  assert.match(route, /metricRegistry:\s*metricRegistry\.snapshot\(\)/);
  assert.match(route, /module:\s*"dashboard"/);
  assert.match(route, /module:\s*"earnings-quality"/);
  assert.match(route, /module:\s*"driver-exposure"/);
  assert.match(route, /module:\s*"sector-kpis"/);
  assert.match(route, /module:\s*"investment-debates"/);
  assert.match(route, /module:\s*"scenarios"/);
  assert.match(route, /module:\s*"valuation"/);
  assert.match(route, /module:\s*"peer-comparison"/);
  assert.doesNotMatch(route, /function (safeDivide|safeAdd|safeSubtract|cagr|buildScenarios)\b/);

  assert.match(financials, /ensureCoreDerivedMetrics/);
  assert.match(financials, /issuer-reported-net-debt/);
  assert.match(financials, /ocf-less-cash-capex/);
  assert.match(scenarios, /registerAssumption/);
  assert.match(scenarios, /calculate\(\{/);
  assert.match(scenarios, /projected_operating_cash_flow - projected_cash_capex/);
  assert.match(registry, /registerOrVerify/);
  assert.match(registry, /input_metric_keys/);
  assert.match(types, /metricUsage:\s*MetricUsage\[\]/);
  assert.match(types, /metricReferences:/);
});

test("keeps five official-source regression snapshots and a disclosed runtime fallback", async () => {
  const [route, shell, nvda, jpm, lly, cat] = await Promise.all([
    readFile(new URL("../app/api/research/route.ts", import.meta.url), "utf8"),
    readFile(new URL("fixtures/shel-source-snapshot.json", import.meta.url), "utf8"),
    readFile(new URL("fixtures/nvda-source-snapshot.json", import.meta.url), "utf8"),
    readFile(new URL("fixtures/jpm-source-snapshot.json", import.meta.url), "utf8"),
    readFile(new URL("fixtures/lly-source-snapshot.json", import.meta.url), "utf8"),
    readFile(new URL("fixtures/cat-source-snapshot.json", import.meta.url), "utf8"),
  ]);
  for (const [ticker, source] of Object.entries({ SHEL: shell, NVDA: nvda, JPM: jpm, LLY: lly, CAT: cat })) {
    const fixture = JSON.parse(source);
    assert.ok(fixture.companyFacts?.facts, `${ticker} fixture lacks Company Facts`);
    assert.ok(fixture.submissions?.filings?.recent, `${ticker} fixture lacks Submissions`);
  }
  assert.match(route, /VERIFIED_SOURCE_SNAPSHOTS/);
  assert.match(route, /isTemporaryPublicDataFailure/);
  assert.match(route, /verified-runtime-fallback/);
  assert.match(route, /live SEC endpoint was temporarily unavailable/i);
  assert.match(route, /if \(\s*sourceSnapshot \|\|\s*!verifiedFallback \|\|\s*!isTemporaryPublicDataFailure\(error\)/);
  assert.doesNotMatch(route, /verifiedFallback\s*\?\?\s*shellSourceSnapshot/);
});

test("audits exact canonical values, shared Web/PDF surfaces, and reproducibility", async () => {
  const [
    { createCanonicalMetric, MetricRegistry },
    { auditResearchReport, compareResearchReports },
  ] = await Promise.all([
    canonicalMetricsModule(),
    consistencyAuditorModule(),
  ]);
  const registry = new MetricRegistry("audit-fixture-v1");
  const revenue = createCanonicalMetric({
    metric_id: "revenue",
    company_id: "SHEL",
    sector: "integrated-oil-gas",
    period: "FY2025",
    period_start: "2025-01-01",
    period_end: "2025-12-31",
    value: 288_305_000_000,
    unit: "USD",
    currency: "USD",
    status: "Reported",
    definition_id: "reported-revenue",
    formula_id: null,
    formula: null,
    input_metric_keys: [],
    source_document: "Shell FY2025 Form 20-F",
    source_url: "https://www.sec.gov/",
    source_type: "filing",
    source_date: "2026-03-12",
    filing_date: "2026-03-12",
    section: "Statements of income",
    table: "Consolidated statement of income",
    row_label: "Revenue",
    raw_value: "288305",
    extraction_method: "deterministic-sec-xbrl",
    confidence: 0.99,
    retrieved_at: "2026-07-17T00:00:00.000Z",
    data_version: "audit-fixture-v1",
    calculation_version: "1.0",
  });
  registry.register(revenue);
  const emptyPeriod = Object.fromEntries([
    "grossProfit",
    "operatingIncome",
    "netIncome",
    "netInterestIncome",
    "deposits",
    "loans",
    "loanGrowth",
    "creditLossProvision",
    "creditLossAllowance",
    "allowanceCoverage",
    "efficiencyRatio",
    "roeProxy",
    "tangibleBookValue",
    "capitalReturns",
    "operatingCashFlow",
    "investingCashFlow",
    "cashCapex",
    "freeCashFlowProxy",
    "assets",
    "liabilities",
    "equity",
    "cash",
    "inventory",
    "currentAssets",
    "currentLiabilities",
    "workingCapital",
    "totalDebt",
    "netDebt",
    "revenueGrowth",
    "revenueCagr",
    "netMargin",
    "netMarginChange",
    "grossMargin",
    "operatingMargin",
    "operatingCashFlowMargin",
    "freeCashFlowMargin",
    "cashConversion",
    "currentRatio",
    "liabilitiesAssets",
  ].map((field) => [field, null]));
  const surfaceModules = [
    "historical-table:2025-12-31",
    "trend-chart:2025-12-31",
    "dashboard",
    "json-research-object",
    "web-report",
    "pdf-data-model",
  ];
  const report = {
    cutoff: "2026-07-17T01:00:00.000Z",
    metricRegistry: registry.snapshot(),
    metricUsage: surfaceModules.map((module) => ({
      module,
      canonicalKey: revenue.canonical_key,
      canonicalValue: revenue.value,
      displayedValue: "USD 288.305bn",
    })),
    renderingModel: {
      json: "canonical-research-object-v1",
      web: "shared-research-report-dom-v1",
      pdf: "shared-research-report-dom-v1",
      tables: "canonical-financial-period-adapter-v1",
      charts: "canonical-financial-period-adapter-v1",
    },
    periods: [{
      periodEnd: "2025-12-31",
      revenue: revenue.value,
      ...emptyPeriod,
      metricKeys: { revenue: revenue.canonical_key },
    }],
    dashboard: [{
      metricKey: revenue.canonical_key,
      label: "Revenue",
      value: "USD 288.3bn",
      detail: "FY2025",
      classification: "Reported fact",
      tone: "neutral",
    }],
    driverExposure: [],
    thesis: [],
    investmentDebates: [],
    risks: [],
    filingWatchlist: [],
    catalysts: { operating: [], financial: [], regulatory: [] },
    sectorKpis: [],
    peerComparison: [],
    scenarios: [],
    sources: [{
      title: "Shell FY2025 Form 20-F",
      url: "https://www.sec.gov/",
      retrievedAt: "2026-07-17T00:00:00.000Z",
    }],
  };

  const audit = auditResearchReport(report);
  assert.equal(audit.passed, true);
  assert.equal(audit.totalCanonicalMetrics, 1);
  assert.equal(audit.checks.webPdf, true);
  const broken = structuredClone(report);
  broken.periods[0].revenue = 288_304_000_000;
  const brokenAudit = auditResearchReport(broken);
  assert.equal(brokenAudit.passed, false);
  assert.ok(
    brokenAudit.issues.some((issue) => issue.code === "SURFACE_VALUE_MISMATCH"),
  );

  const rerun = structuredClone(report);
  rerun.cutoff = "2026-07-17T01:05:00.000Z";
  rerun.metricRegistry.metrics[0].retrieved_at = "2026-07-17T01:05:00.000Z";
  rerun.sources[0].retrievedAt = "2026-07-17T01:05:00.000Z";
  assert.equal(compareResearchReports(report, rerun).passed, true);
  rerun.metricRegistry.metrics[0].value = 288_304_000_000;
  const comparison = compareResearchReports(report, rerun);
  assert.equal(comparison.passed, false);
  assert.equal(comparison.mismatchedObjects.length, 1);
});

test("passes the full Shell canonical consistency and double-run acceptance gate", async () => {
  const builtWorker = await worker();
  const requestBody = {
    company: "SHEL",
    locale: "en",
    market: "Europe",
    sector: "energy",
    subindustry: "integrated-oil-gas",
    fixture: true,
    options: {
      sectorOutlook: true,
      peerComparison: false,
      valuation: true,
      dueDiligence: true,
      pdfExport: true,
    },
  };
  const run = async () => {
    const response = await builtWorker.fetch(
      new Request("http://localhost/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
      environment,
      context,
    );
    assert.equal(response.status, 200);
    return response.json();
  };
  const [first, second] = await Promise.all([run(), run()]);
  assert.equal(first.consistencyAudit.passed, true);
  assert.equal(first.consistencyAudit.issues.length, 0);
  assert.deepEqual(first.consistencyAudit.checks, {
    registry: true,
    formulas: true,
    lineage: true,
    cache: true,
    json: true,
    tables: true,
    charts: true,
    narrative: true,
    scenarios: true,
    valuation: true,
    webPdf: true,
  });

  const report = first.report;
  const latest = report.periods.at(-1);
  const registry = new Map(
    report.metricRegistry.metrics.map((metric) => [metric.canonical_key, metric]),
  );
  const latestMetrics = new Map(
    report.metricRegistry.metrics
      .filter((metric) => metric.company_id === "SHEL" && metric.period_end === "2025-12-31")
      .map((metric) => [metric.metric_id, metric]),
  );
  for (const metricId of [
    "revenue",
    "net-income",
    "operating-cash-flow",
    "production",
    "realized-prices",
    "lng",
    "refining-margin",
    "segment-earnings",
    "cash-capex",
    "fcf",
    "net-debt",
    "dividends",
    "share-buybacks",
    "major-projects",
  ]) {
    assert.ok(latestMetrics.get(metricId), `missing Shell acceptance metric: ${metricId}`);
  }

  const ocf = registry.get(latest.metricKeys.operatingCashFlow);
  const capex = registry.get(latest.metricKeys.cashCapex);
  const fcf = registry.get(latest.metricKeys.freeCashFlowProxy);
  assert.equal(fcf.definition_id, "ocf-less-cash-capex");
  assert.equal(fcf.value, ocf.value - capex.value);
  assert.equal(fcf.value, 21_948_000_000);
  const dashboardFcf = report.dashboard.find(
    (item) => registry.get(item.metricKey)?.metric_id === "fcf",
  );
  const kpiFcf = report.sectorKpis.find((item) => item.id === "fcf");
  assert.equal(dashboardFcf.metricKey, fcf.canonical_key);
  assert.equal(kpiFcf.canonicalKey, fcf.canonical_key);
  assert.ok(
    report.scenarios.every(
      (scenario) =>
        scenario.valuationStartingPoint === fcf.value &&
        scenario.metricReferences.valuationStartingPoint === fcf.canonical_key,
    ),
  );

  const netDebt = registry.get(latest.metricKeys.netDebt);
  assert.equal(netDebt.definition_id, "issuer-reported-net-debt");
  const capitalExposure = report.driverExposure.find((item) =>
    /Capital discipline/i.test(item.driver)
  );
  const capitalIds = new Set(
    capitalExposure.metricReferences.map((key) => registry.get(key).metric_id),
  );
  for (const id of ["fcf", "dividends", "share-buybacks", "net-debt"]) {
    assert.ok(capitalIds.has(id), `capital allocation missing ${id}`);
  }
  assert.doesNotMatch(capitalExposure.companyExposure, /Data unavailable/i);

  const debateMetricIds = new Set(
    report.investmentDebates
      .flatMap((debate) => debate.metricReferences)
      .map((key) => registry.get(key).metric_id),
  );
  for (const id of [
    "production",
    "realized-prices",
    "lng",
    "refining-margin",
    "fcf",
    "dividends",
    "share-buybacks",
  ]) {
    assert.ok(debateMetricIds.has(id), `investment debates missing ${id}`);
  }

  const { compareResearchReports } = await consistencyAuditorModule();
  const comparison = compareResearchReports(first.report, second.report);
  assert.equal(comparison.passed, true);
  assert.equal(comparison.mismatchedObjects.length, 0);
  assert.equal(comparison.missingObjects.length, 0);
  assert.equal(comparison.changedDefinitions.length, 0);
  assert.equal(comparison.changedFormulas.length, 0);
  assert.equal(comparison.changedSources.length, 0);
  assert.equal(comparison.changedOutputs.length, 0);
  assert.equal(
    comparison.matchedObjects.length,
    report.metricRegistry.metrics.length,
  );
});

test("passes the Semiconductors and NVDA canonical acceptance gate before unlocking", async () => {
  const builtWorker = await worker();
  const requestBody = {
    company: "NVDA",
    locale: "en",
    market: "US",
    sector: "technology",
    subindustry: "semiconductors",
    fixture: true,
    options: {
      sectorOutlook: true,
      peerComparison: false,
      valuation: true,
      dueDiligence: true,
      pdfExport: true,
    },
  };
  const run = async () => {
    const response = await builtWorker.fetch(
      new Request("http://localhost/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
      environment,
      context,
    );
    assert.equal(response.status, 200);
    return response.json();
  };
  const [first, second] = await Promise.all([run(), run()]);
  const report = first.report;
  const latest = report.periods.at(-1);
  const registry = new Map(
    report.metricRegistry.metrics.map((metric) => [metric.canonical_key, metric]),
  );
  assert.equal(first.consistencyAudit.passed, true);
  assert.equal(first.consistencyAudit.issues.length, 0);
  assert.equal(latest.periodEnd, "2026-01-25");
  assert.equal(latest.revenue, 215_938_000_000);
  assert.equal(latest.grossProfit, 153_463_000_000);
  assert.equal(latest.operatingIncome, 130_387_000_000);
  assert.equal(latest.inventory, 21_403_000_000);
  assert.equal(latest.cashCapex, 6_042_000_000);
  assert.equal(latest.freeCashFlowProxy, 96_676_000_000);
  assert.equal(latest.grossMargin, latest.grossProfit / latest.revenue);
  assert.equal(latest.operatingMargin, latest.operatingIncome / latest.revenue);
  assert.equal(
    latest.freeCashFlowProxy,
    latest.operatingCashFlow - latest.cashCapex,
  );

  const kpis = new Map(report.sectorKpis.map((item) => [item.id, item]));
  for (const id of [
    "gross-margin",
    "operating-margin",
    "inventory",
    "cash-capex",
    "fcf",
  ]) {
    assert.ok(kpis.get(id)?.canonicalKey, `missing NVDA canonical KPI: ${id}`);
  }
  assert.equal(
    kpis.get("gross-margin").canonicalKey,
    latest.metricKeys.grossMargin,
  );
  assert.equal(
    kpis.get("operating-margin").canonicalKey,
    latest.metricKeys.operatingMargin,
  );
  assert.equal(kpis.get("inventory").canonicalKey, latest.metricKeys.inventory);
  assert.equal(kpis.get("fcf").canonicalKey, latest.metricKeys.freeCashFlowProxy);
  assert.ok(
    report.scenarios.every(
      (scenario) =>
        scenario.valuationStartingPoint === latest.revenue &&
        scenario.metricReferences.valuationStartingPoint === latest.metricKeys.revenue,
    ),
  );
  const referencedIds = new Set(
    [
      ...report.driverExposure.flatMap((item) => item.metricReferences),
      ...report.investmentDebates.flatMap((item) => item.metricReferences),
      ...report.risks.flatMap((item) => item.metricReferences),
    ].map((key) => registry.get(key)?.metric_id),
  );
  for (const id of [
    "revenue-growth",
    "gross-margin",
    "operating-margin",
    "inventory",
    "fcf",
  ]) assert.ok(referencedIds.has(id), `NVDA cross-report references missing ${id}`);

  const { compareResearchReports } = await consistencyAuditorModule();
  const comparison = compareResearchReports(first.report, second.report);
  assert.equal(comparison.passed, true);
  assert.equal(comparison.mismatchedObjects.length, 0);
  assert.equal(comparison.missingObjects.length, 0);
  assert.equal(
    comparison.matchedObjects.length,
    report.metricRegistry.metrics.length,
  );
});

test("passes the Banks and JPM acceptance gate without an industrial FCF template", async () => {
  const builtWorker = await worker();
  const requestBody = {
    company: "JPM",
    locale: "en",
    market: "US",
    sector: "financials",
    subindustry: "banks",
    fixture: true,
    options: {
      sectorOutlook: true,
      peerComparison: false,
      valuation: true,
      dueDiligence: true,
      pdfExport: true,
    },
  };
  const run = async () => {
    const response = await builtWorker.fetch(
      new Request("http://localhost/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
      environment,
      context,
    );
    assert.equal(response.status, 200);
    return response.json();
  };
  const [first, second] = await Promise.all([run(), run()]);
  const report = first.report;
  const latest = report.periods.at(-1);
  const registry = new Map(
    report.metricRegistry.metrics.map((metric) => [metric.canonical_key, metric]),
  );
  assert.equal(first.consistencyAudit.passed, true);
  assert.equal(first.consistencyAudit.issues.length, 0);
  assert.equal(latest.periodEnd, "2025-12-31");
  assert.equal(latest.revenue, 182_447_000_000);
  assert.equal(latest.netInterestIncome, 95_443_000_000);
  assert.equal(latest.deposits, 2_559_320_000_000);
  assert.equal(latest.loans, 1_467_664_000_000);
  assert.equal(latest.creditLossProvision, 14_212_000_000);
  assert.equal(latest.creditLossAllowance, 25_765_000_000);
  assert.equal(latest.efficiencyRatio, 95_640_000_000 / 182_447_000_000);
  assert.equal(latest.allowanceCoverage, 25_765_000_000 / 1_467_664_000_000);
  assert.equal(latest.tangibleBookValue, 362_438_000_000 - 52_731_000_000 - 1_300_000_000);
  assert.equal(latest.capitalReturns, 16_625_000_000 + 31_591_000_000);
  assert.ok(report.periods.every((period) => period.freeCashFlowProxy === null));
  assert.ok(
    report.metricRegistry.metrics.every((metric) => metric.metric_id !== "fcf"),
  );

  const kpis = new Map(report.sectorKpis.map((item) => [item.id, item]));
  for (const id of [
    "net-interest-income",
    "net-interest-margin",
    "deposits",
    "loan-growth",
    "credit-losses",
    "allowance-coverage",
    "cet1",
    "liquidity",
    "efficiency-ratio",
    "roe",
    "tangible-book-value",
    "capital-returns",
  ]) assert.ok(kpis.get(id)?.canonicalKey, `missing JPM canonical KPI: ${id}`);
  const metricById = (metricId) =>
    report.metricRegistry.metrics.find(
      (metric) => metric.metric_id === metricId && metric.period_end === "2025-12-31",
    );
  assert.equal(metricById("net-interest-margin").value, 0.025);
  assert.equal(metricById("net-interest-margin").raw_value, "2.50%");
  assert.equal(
    metricById("net-interest-margin").definition_id,
    "firmwide-net-yield-on-average-interest-earning-assets-managed-basis",
  );
  assert.equal(metricById("cet1-ratio").value, 0.146);
  assert.equal(metricById("liquidity-coverage-ratio").value, 1.11);
  assert.equal(metricById("return-on-common-equity").value, 0.17);
  assert.match(metricById("cet1-ratio").source_url, /sec\.gov\/Archives/);
  assert.match(report.cashFlowProxyFormula, /no industrial-company FCF/i);
  assert.match(report.valuationFormula, /tangible book value.*P\/TBV/i);
  assert.ok(
    report.scenarios.every(
      (scenario) =>
        scenario.projectedFreeCashFlow === null &&
        scenario.capexFactor === null &&
        scenario.valuationStartingPoint === latest.tangibleBookValue &&
        scenario.metricReferences.valuationStartingPoint === latest.metricKeys.tangibleBookValue &&
        /equity value/i.test(scenario.impliedValueLabel),
    ),
  );
  const referencedIds = new Set(
    [
      ...report.driverExposure.flatMap((item) => item.metricReferences),
      ...report.investmentDebates.flatMap((item) => item.metricReferences),
      ...report.risks.flatMap((item) => item.metricReferences),
    ].map((key) => registry.get(key)?.metric_id),
  );
  for (const id of [
    "net-interest-income",
    "net-interest-margin",
    "deposits",
    "loan-growth",
    "credit-loss-provision",
    "allowance-coverage",
    "cet1-ratio",
    "liquidity-coverage-ratio",
    "efficiency-ratio",
    "return-on-common-equity",
    "tangible-book-value",
    "capital-returns",
  ]) assert.ok(referencedIds.has(id), `JPM cross-report references missing ${id}`);
  assert.ok(
    report.sectorOutlook.claims.every(
      (claim) => claim.publisher && claim.publicationDate >= "2025-01-01",
    ),
  );

  const { compareResearchReports } = await consistencyAuditorModule();
  const comparison = compareResearchReports(first.report, second.report);
  assert.equal(comparison.passed, true);
  assert.equal(comparison.mismatchedObjects.length, 0);
  assert.equal(comparison.missingObjects.length, 0);
  assert.equal(
    comparison.matchedObjects.length,
    report.metricRegistry.metrics.length,
  );
});

test("passes the Biopharma and LLY acceptance gate without fabricated pipeline precision", async () => {
  const builtWorker = await worker();
  const requestBody = {
    company: "LLY",
    locale: "en",
    market: "US",
    sector: "healthcare",
    subindustry: "biopharma",
    fixture: true,
    options: {
      sectorOutlook: true,
      peerComparison: false,
      valuation: true,
      dueDiligence: true,
      pdfExport: true,
    },
  };
  const run = async () => {
    const response = await builtWorker.fetch(
      new Request("http://localhost/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
      environment,
      context,
    );
    assert.equal(response.status, 200);
    return response.json();
  };
  const [first, second] = await Promise.all([run(), run()]);
  const report = first.report;
  const latest = report.periods.at(-1);
  const registry = new Map(
    report.metricRegistry.metrics.map((metric) => [metric.canonical_key, metric]),
  );
  const metricByDefinition = (metricId, definitionId) =>
    report.metricRegistry.metrics.find(
      (metric) =>
        metric.metric_id === metricId &&
        metric.definition_id === definitionId &&
        metric.period_end === "2025-12-31",
    );

  assert.equal(first.consistencyAudit.passed, true);
  assert.equal(first.consistencyAudit.issues.length, 0);
  assert.equal(latest.periodEnd, "2025-12-31");
  assert.equal(latest.revenue, 65_179_000_000);
  assert.equal(latest.grossProfit, 65_179_000_000 - 11_052_000_000);
  assert.equal(latest.researchAndDevelopment, 13_337_000_000);
  assert.equal(latest.grossMargin, latest.grossProfit / latest.revenue);
  assert.equal(latest.cashCapex, null);
  assert.equal(latest.freeCashFlowProxy, null);

  const mounjaro = metricByDefinition(
    "product-revenue",
    "issuer-reported-mounjaro-total-revenue",
  );
  const zepbound = metricByDefinition(
    "product-revenue",
    "issuer-reported-zepbound-total-revenue",
  );
  const concentration = metricByDefinition(
    "product-concentration",
    "issuer-reported-mounjaro-zepbound-share-of-total-revenue",
  );
  const patentExpiry = metricByDefinition(
    "patent-expiry-year",
    "issuer-estimated-us-compound-patent-expiry-mounjaro-zepbound",
  );
  assert.equal(mounjaro.value, 22_965_000_000);
  assert.equal(zepbound.value, 13_542_000_000);
  assert.equal(concentration.value, 0.56);
  assert.equal(concentration.raw_value, "56 percent");
  assert.equal(patentExpiry.value, 2036);
  assert.equal(patentExpiry.unit, "year");
  for (const metric of [mounjaro, zepbound, concentration, patentExpiry]) {
    assert.equal(metric.status, "Reported");
    assert.match(metric.source_url, /sec\.gov\/Archives/);
  }

  const kpis = new Map(report.sectorKpis.map((item) => [item.id, item]));
  for (const id of [
    "product-revenue",
    "product-concentration",
    "research-and-development",
    "gross-margin",
    "patent-expiry",
  ]) assert.ok(kpis.get(id)?.canonicalKey, `missing LLY canonical KPI: ${id}`);
  for (const id of [
    "pipeline-stage",
    "clinical-milestones",
    "regulatory-dates",
    "cash-runway",
    "risk-adjusted-pipeline-value",
  ]) assert.equal(kpis.has(id), false, `LLY must hide unresolved KPI: ${id}`);

  assert.equal(report.dataCoverage.limited, false);
  assert.deepEqual(report.dataCoverage.criticalMetricIds, []);
  assert.match(report.dataCoverage.notes.join(" "), /no risk-adjusted pipeline value/i);
  assert.match(report.valuationFormula, /no unverified rNPV is included/i);
  assert.match(report.valuationAssessment, /exclude unverified risk-adjusted pipeline value/i);
  assert.ok(
    report.metricRegistry.metrics.every(
      (metric) => metric.metric_id !== "risk-adjusted-pipeline-value",
    ),
  );
  assert.ok(
    report.scenarios.every(
      (scenario) =>
        scenario.projectedFreeCashFlow === null &&
        scenario.valuationStartingPoint === latest.revenue &&
        scenario.metricReferences.valuationStartingPoint === latest.metricKeys.revenue &&
        scenario.valuationMetric === scenario.projectedRevenue &&
        scenario.modelImpliedEnterpriseValue ===
          scenario.valuationMetric * scenario.enterpriseValueMultiple,
    ),
  );
  assert.deepEqual(
    report.scenarios.map((scenario) => scenario.enterpriseValueMultiple),
    [4, 7, 10],
  );

  const referencedIds = new Set(
    [
      ...report.driverExposure.flatMap((item) => item.metricReferences),
      ...report.investmentDebates.flatMap((item) => item.metricReferences),
      ...report.risks.flatMap((item) => item.metricReferences),
    ].map((key) => registry.get(key)?.metric_id),
  );
  for (const id of [
    "product-revenue",
    "product-concentration",
    "research-and-development",
    "gross-margin",
    "patent-expiry-year",
  ]) assert.ok(referencedIds.has(id), `LLY cross-report references missing ${id}`);
  assert.ok(
    report.sectorOutlook.claims.every(
      (claim) => claim.publisher && claim.publicationDate >= "2025-01-01",
    ),
  );
  assert.equal(report.sectorPack.researchQuestions.length, 5);
  assert.equal(report.sectorPack.reportGuidance.length, 3);

  const { compareResearchReports } = await consistencyAuditorModule();
  const comparison = compareResearchReports(first.report, second.report);
  assert.equal(comparison.passed, true);
  assert.equal(comparison.mismatchedObjects.length, 0);
  assert.equal(comparison.missingObjects.length, 0);
  assert.equal(comparison.changedDefinitions.length, 0);
  assert.equal(comparison.changedFormulas.length, 0);
  assert.equal(comparison.changedSources.length, 0);
  assert.equal(comparison.changedOutputs.length, 0);
  assert.equal(
    comparison.matchedObjects.length,
    report.metricRegistry.metrics.length,
  );
});

test("passes the Industrials and CAT acceptance gate with backlog, price-cost, and cash conversion", async () => {
  const builtWorker = await worker();
  const requestBody = {
    company: "CAT",
    locale: "en",
    market: "US",
    sector: "industrials",
    subindustry: "industrial-machinery",
    fixture: true,
    options: {
      sectorOutlook: true,
      peerComparison: false,
      valuation: true,
      dueDiligence: true,
      pdfExport: true,
    },
  };
  const run = async () => {
    const response = await builtWorker.fetch(
      new Request("http://localhost/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
      environment,
      context,
    );
    assert.equal(response.status, 200);
    return response.json();
  };
  const [first, second] = await Promise.all([run(), run()]);
  const report = first.report;
  const latest = report.periods.at(-1);
  const registry = new Map(
    report.metricRegistry.metrics.map((metric) => [metric.canonical_key, metric]),
  );
  const metricById = (metricId) =>
    report.metricRegistry.metrics.find(
      (metric) =>
        metric.metric_id === metricId &&
        metric.period_end === "2025-12-31",
    );

  assert.equal(first.consistencyAudit.passed, true);
  assert.equal(first.consistencyAudit.issues.length, 0);
  assert.equal(latest.periodEnd, "2025-12-31");
  assert.equal(latest.revenue, 67_589_000_000);
  assert.equal(latest.grossProfit, null);
  assert.equal(latest.grossMargin, null);
  assert.equal(latest.operatingIncome, 11_151_000_000);
  assert.equal(latest.netIncome, 8_882_000_000);
  assert.equal(latest.operatingCashFlow, 11_739_000_000);
  assert.equal(latest.cashCapex, 2_821_000_000);
  assert.equal(latest.freeCashFlowProxy, 8_918_000_000);
  assert.equal(latest.freeCashFlowProxy, latest.operatingCashFlow - latest.cashCapex);
  assert.equal(latest.cashConversion, latest.freeCashFlowProxy / latest.netIncome);
  assert.equal(latest.currentAssets, 52_485_000_000);
  assert.equal(latest.currentLiabilities, 36_558_000_000);
  assert.equal(latest.workingCapital, 15_927_000_000);
  assert.equal(latest.workingCapital, latest.currentAssets - latest.currentLiabilities);
  assert.equal(latest.inventory, 18_135_000_000);

  const backlog = metricById("backlog");
  const nearTermBacklog = metricById("near-term-backlog");
  const price = metricById("price-realization-impact");
  const manufacturingCost = metricById("manufacturing-cost-impact");
  const priceCost = metricById("price-cost-impact");
  const segmentMargin = metricById("segment-margin");
  const nearTermShare = metricById("near-term-backlog-share");
  assert.equal(backlog.value, 51_200_000_000);
  assert.equal(nearTermBacklog.value, 19_300_000_000);
  assert.equal(price.value, -817_000_000);
  assert.equal(manufacturingCost.value, -2_148_000_000);
  assert.equal(segmentMargin.value, 0.199);
  assert.equal(priceCost.value, -2_965_000_000);
  assert.equal(priceCost.value, price.value + manufacturingCost.value);
  assert.equal(priceCost.formula, "price_realization_impact + manufacturing_cost_impact");
  assert.deepEqual(
    priceCost.input_metric_keys,
    [price.canonical_key, manufacturingCost.canonical_key],
  );
  assert.equal(nearTermShare.value, 19_300_000_000 / 51_200_000_000);
  assert.equal(nearTermShare.formula, "near_term_backlog / total_firm_backlog");
  for (const metric of [backlog, nearTermBacklog, price, manufacturingCost, segmentMargin]) {
    assert.equal(metric.status, "Reported");
    assert.equal(metric.source_date, "2026-02-13");
    assert.match(metric.source_url, /sec\.gov\/Archives/);
  }

  const kpis = new Map(report.sectorKpis.map((item) => [item.id, item]));
  for (const id of [
    "backlog",
    "price-cost",
    "segment-margin",
    "cash-capex",
    "working-capital",
    "fcf-conversion",
    "project-execution",
  ]) assert.ok(kpis.get(id)?.canonicalKey, `missing CAT canonical KPI: ${id}`);
  for (const id of ["orders", "organic-growth", "utilization"]) {
    assert.equal(kpis.has(id), false, `CAT must hide unresolved KPI: ${id}`);
  }
  assert.equal(report.dataCoverage.limited, false);
  assert.deepEqual(report.dataCoverage.criticalMetricIds, []);
  assert.match(report.dataCoverage.notes.join(" "), /delivery obligation, not a project completion rate/i);
  assert.ok(
    report.metricRegistry.metrics.every(
      (metric) => !["orders", "organic-growth", "capacity-utilization"].includes(metric.metric_id),
    ),
  );

  assert.deepEqual(
    report.scenarios.map((scenario) => scenario.enterpriseValueMultiple),
    [10, 14, 18],
  );
  assert.ok(
    report.scenarios.every(
      (scenario) =>
        scenario.valuationStartingPoint === latest.freeCashFlowProxy &&
        scenario.metricReferences.valuationStartingPoint === latest.metricKeys.freeCashFlowProxy &&
        scenario.valuationMetric === scenario.projectedFreeCashFlow &&
        scenario.modelImpliedEnterpriseValue ===
          scenario.valuationMetric * scenario.enterpriseValueMultiple,
    ),
  );

  const referencedIds = new Set(
    [
      ...report.driverExposure.flatMap((item) => item.metricReferences),
      ...report.investmentDebates.flatMap((item) => item.metricReferences),
      ...report.risks.flatMap((item) => item.metricReferences),
      ...report.filingWatchlist.flatMap((item) => item.metricReferences),
      ...Object.values(report.catalysts).flatMap((items) =>
        items.flatMap((item) => item.metricReferences)
      ),
    ].map((key) => registry.get(key)?.metric_id),
  );
  for (const id of [
    "backlog",
    "price-cost-impact",
    "segment-margin",
    "cash-capex",
    "working-capital",
    "cash-conversion",
    "near-term-backlog-share",
    "fcf",
  ]) assert.ok(referencedIds.has(id), `CAT cross-report references missing ${id}`);
  assert.ok(
    report.sectorOutlook.claims.every(
      (claim) => claim.publisher && claim.publicationDate >= "2025-01-01",
    ),
  );
  assert.equal(report.sectorPack.researchQuestions.length, 5);
  assert.equal(report.sectorPack.reportGuidance.length, 3);

  const { compareResearchReports } = await consistencyAuditorModule();
  const comparison = compareResearchReports(first.report, second.report);
  assert.equal(comparison.passed, true);
  assert.equal(comparison.mismatchedObjects.length, 0);
  assert.equal(comparison.missingObjects.length, 0);
  assert.equal(comparison.changedDefinitions.length, 0);
  assert.equal(comparison.changedFormulas.length, 0);
  assert.equal(comparison.changedSources.length, 0);
  assert.equal(comparison.changedOutputs.length, 0);
  assert.equal(
    comparison.matchedObjects.length,
    report.metricRegistry.metrics.length,
  );
});

test("owns PDF pagination and footer instead of browser print metadata", async () => {
  const [client, pdf, css] = await Promise.all([
    readFile(new URL("../app/ResearchApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/pdf-export.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /exportReportPdf/);
  assert.match(client, /data-pdf-block/);
  assert.doesNotMatch(client, /window\.print\(\)/);
  assert.match(pdf, /ScopeLine Research \| \$\{meta\.ticker\} \| \$\{meta\.researchDate\} \| Page \$\{pageNumber\}/);
  assert.match(pdf, /table \{ min-width: 0 !important/);
  assert.match(css, /\.scenario-grid \{ break-inside: avoid/);
  assert.match(css, /\.source-columns small \{ color: #526878;.*font-size: 10px/s);
});

test("publishes a complete machine-readable Phase 9 consistency artifact", async () => {
  const artifact = JSON.parse(
    await readFile(
      new URL("../artifacts/metric_consistency_report.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(artifact.schema_version, "1.0");
  assert.equal(artifact.generated_for_phase, 9);
  assert.deepEqual(artifact.test_suite, { passed: 24, failed: 0 });
  assert.equal(
    artifact.total_canonical_metrics,
    Object.values(artifact.sector_acceptance).reduce(
      (sum, sector) => sum + sector.canonical_metrics,
      0,
    ),
  );
  assert.equal(
    artifact.total_surface_references,
    Object.values(artifact.sector_acceptance).reduce(
      (sum, sector) => sum + sector.surface_references,
      0,
    ),
  );
  for (const field of [
    "duplicate_keys",
    "conflicting_values",
    "formula_mismatches",
    "cross_section_mismatches",
    "reproducibility_mismatches",
  ]) assert.equal(artifact[field], 0);
  assert.ok(
    Object.values(artifact.sector_acceptance).every(
      (sector) =>
        sector.status === "passed" &&
        sector.consistency_issues === 0 &&
        sector.double_run_reproducible === true,
    ),
  );
  assert.deepEqual(artifact.industries_in_preview, ["consumer"]);
});

test("removes disposable starter assets and keeps private Sites metadata", async () => {
  const [page, layout, packageJson, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /<ResearchApp \/>/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(layout, /ScopeLine/);
  assert.match(hosting, /appgprj_6a585b81f7708191b13b1c34903345a9/);
  assert.doesNotMatch(page + layout + packageJson, /_sites-preview|codex-preview|react-loading-skeleton/);

  await Promise.all([
    assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", projectRoot))),
    access(new URL("public/og.png", projectRoot)),
    access(new URL("public/favicon.png", projectRoot)),
  ]);
});
