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
  const source = await readFile(
    new URL("../app/lib/canonical-metrics.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#${Date.now()}-${Math.random()}`);
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
  ];
  const [energyResponse, semiResponse] = await Promise.all(
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
  const energy = (await energyResponse.json()).outlook;
  const semis = (await semiResponse.json()).outlook;
  assert.equal(energy.subindustry, "integrated-oil-gas");
  assert.equal(semis.subindustry, "semiconductors");
  assert.ok(energy.claims.length >= 2);
  assert.ok(semis.claims.length >= 2);
  assert.ok(energy.claims.every((claim) => claim.publicationDate >= "2025-01-01"));
  assert.ok(semis.claims.every((claim) => claim.publicationDate >= "2025-01-01"));
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
  const [route, packs, evidence, retrieval] = await Promise.all([
    readFile(new URL("../app/api/research/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/sector-packs.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/sector-evidence.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/sector-retrieval.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /Free cash flow = operating cash flow - cash capital expenditure/);
  assert.match(route, /safeSubtract\(operatingCashFlow,\s*cashCapex\)/);
  assert.doesNotMatch(route, /safeAdd\(operatingCashFlow(?:Value)?,\s*investingCashFlow/);
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
  ]) assert.match(packs, new RegExp(required.replace("/", "\\/"), "i"));
  assert.match(packs, /EV \/ FCF/);
  assert.match(packs, /EV \/ Revenue/);
  assert.match(packs, /XOM/);
  assert.match(packs, /AMD/);

  assert.match(evidence, /MIN_PUBLICATION_DATE = "2025-01-01"/);
  assert.match(evidence, /source\.publicationDate < MIN_PUBLICATION_DATE/);
  assert.match(evidence, /seenUrls/);
  assert.match(evidence, /source\.accessible/);
  assert.match(retrieval, /filteredSources/);
  assert.match(retrieval, /embed\(/);
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
  assert.equal(canonicalFcf.definition_id, "strict-ocf-minus-cash-capex");
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
  assert.doesNotMatch(client, /latestPeriod\.currentRatio === null \? copy\.unavailable/);
  assert.match(route, /\.filter\(\(result\) => result\.usable\)/);
  assert.match(route, /criticalMetricIds/);
  assert.match(route, /shellMetricAudit/);
  assert.match(types, /dataCoverage:\s*DataCoverage/);
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
