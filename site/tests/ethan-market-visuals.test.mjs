import assert from "node:assert/strict";
import test from "node:test";

async function worker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("ethan-visual-test", `${Date.now()}-${Math.random()}`);
  const { default: builtWorker } = await import(workerUrl.href);
  return builtWorker;
}

const environment = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};
const context = {
  waitUntil() {},
  passThroughOnException() {},
};

async function research(builtWorker, options = {}) {
  const response = await builtWorker.fetch(
    new Request("http://localhost/api/research", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        company: "NVDA",
        locale: "en",
        fixture: true,
        options,
      }),
    }),
    environment,
    context,
  );
  const payload = await response.json();
  assert.equal(response.status, 200, JSON.stringify(payload));
  return payload;
}

test("builds the reviewed NVDA industry profile and stable visual registry", async () => {
  const builtWorker = await worker();
  const payload = await research(builtWorker, {
    includeIndustryMarketAnalysis: true,
  });
  const report = payload.report;

  assert.equal(report.company.ticker, "NVDA");
  assert.equal(report.industryAnalysis.included, true);
  assert.equal(report.industryAnalysis.profile.sicCode, "3674");
  assert.deepEqual(report.industryAnalysis.profile.naicsCodes, ["334413", "334"]);
  assert.ok(report.industryAnalysis.profile.preferredFredSeries.includes("IPG3344S"));
  assert.ok(report.visualAssets.length >= 7);
  assert.equal(new Set(report.visualAssets.map((asset) => asset.assetId)).size, report.visualAssets.length);
  assert.ok(report.visualAssets.every((asset) => asset.assetId.startsWith(`${report.reportId}--`)));
  assert.ok(report.visualAssets.some((asset) => asset.dataset.id === "historical-financial-trend"));
  assert.ok(report.visualAssets.some((asset) => asset.dataset.id === "historical-financial-table"));
  assert.ok(report.visualAssets.some((asset) => asset.dataset.id === "research-dashboard"));
  assert.ok(report.visualAssets.some((asset) => asset.dataset.id === "company-sector-driver-exposure"));
  assert.ok(report.visualAssets.some((asset) => asset.dataset.id === "cash-capital-allocation"));
  assert.ok(report.visualAssets.some((asset) => asset.dataset.id === "sector-kpi-data-sheet"));
  const hasUsablePeerData = report.peerComparison.some(
    (peer) => peer.periodEnd && peer.metrics.some((metric) => metric.value !== null),
  );
  assert.equal(
    report.visualAssets.some((asset) => asset.dataset.id === "peer-comparison"),
    hasUsablePeerData,
    "Peer export should exist only when the visible report has supported peer values",
  );
  assert.ok(report.visualAssets.some((asset) => asset.dataset.id === "valuation-scenarios"));
  assert.ok(report.visualAssets.some((asset) => asset.dataset.id === "market-definition"));

  const financialTable = report.visualAssets.find(
    (asset) => asset.dataset.id === "historical-financial-table",
  );
  assert.deepEqual(
    financialTable.dataset.columns.map((column) => column.key),
    ["period", "revenue", "grossMargin", "netIncome", "operatingCashFlow", "cashCapex", "freeCashFlow", "netMargin"],
  );
  const scenarios = report.visualAssets.find(
    (asset) => asset.dataset.id === "valuation-scenarios",
  );
  assert.deepEqual(
    scenarios.dataset.columns.map((column) => column.key),
    [
      "scenario", "method", "multiple", "revenueGrowth", "netMargin", "capexFactor",
      "projectedFreeCashFlow", "valuationMetric", "valuationStartingPoint",
      "enterpriseValue", "netDebtAdjustment", "equityValue", "dilutedShares",
      "pricePerShare", "impliedPe", "impliedDividendYield", "rotceSpread",
    ],
  );
  const marketDefinition = report.visualAssets.find(
    (asset) => asset.dataset.id === "market-definition",
  );
  assert.deepEqual(
    marketDefinition.dataset.columns.map((column) => column.key),
    [
      "type", "code", "officialLabel", "analyticalRole", "directOrProxy",
      "includedScope", "knownExclusions", "source", "confidence",
    ],
  );

  const listResponse = await builtWorker.fetch(
    new Request(`http://localhost/api/research/reports/${report.reportId}/visual-assets`),
    environment,
    context,
  );
  assert.equal(listResponse.status, 200);
  const listing = await listResponse.json();
  assert.equal(listing.assets.length, report.visualAssets.length);
});

test("exports real standalone CSV, XLSX, SVG, and PNG files", async () => {
  const builtWorker = await worker();
  const { report } = await research(builtWorker, {
    includeIndustryMarketAnalysis: true,
  });
  const chart = report.visualAssets.find(
    (asset) => asset.dataset.id === "historical-financial-trend",
  );
  assert.ok(chart);

  const signatures = {
    csv: (bytes) => assert.equal(bytes[0], 0xef),
    xlsx: (bytes) => assert.equal(Buffer.from(bytes.slice(0, 2)).toString("ascii"), "PK"),
    svg: (bytes) => assert.match(Buffer.from(bytes).toString("utf8"), /^<svg\b/),
    png: (bytes) => {
      assert.equal(Buffer.from(bytes.slice(0, 8)).toString("hex"), "89504e470d0a1a0a");
      assert.equal(Buffer.from(bytes.slice(16, 20)).readUInt32BE(), 1600);
      assert.equal(Buffer.from(bytes.slice(20, 24)).readUInt32BE(), 900);
      assert.ok(bytes.byteLength < 1_000_000, `PNG should be compressed, received ${bytes.byteLength} bytes`);
    },
  };
  const expectedMime = {
    csv: "text/csv; charset=utf-8",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    svg: "image/svg+xml; charset=utf-8",
    png: "image/png",
  };
  for (const format of ["csv", "xlsx", "svg", "png"]) {
    const response = await builtWorker.fetch(
      new Request(
        `http://localhost/api/research/reports/${report.reportId}/visual-assets/${chart.assetId}/download?format=${format}`,
      ),
      environment,
      context,
    );
    assert.equal(response.status, 200, `${format} export failed`);
    assert.equal(response.headers.get("content-type"), expectedMime[format]);
    assert.match(response.headers.get("content-disposition") ?? "", /^attachment;/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.ok(bytes.byteLength > 20);
    signatures[format](bytes);
  }
});

test("keeps the company report and company visuals available when the market toggle is off", async () => {
  const builtWorker = await worker();
  const { report } = await research(builtWorker, {
    includeIndustryMarketAnalysis: false,
  });
  assert.equal(report.industryAnalysis.included, false);
  assert.equal(report.industryAnalysis.coverage.status, "disabled");
  assert.ok(report.periods.length >= 3);
  assert.ok(report.visualAssets.length >= 6);
  assert.equal(report.visualAssets.some((asset) => asset.category === "market"), false);
  assert.ok(report.visualAssets.some((asset) => asset.dataset.id === "research-dashboard"));
  assert.ok(report.visualAssets.some((asset) => asset.dataset.id === "historical-financial-table"));
});
