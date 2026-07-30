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
  assert.ok(report.visualAssets.some((asset) => asset.dataset.id === "peer-comparison"));
  assert.ok(report.visualAssets.some((asset) => asset.dataset.id === "valuation-scenarios"));
  assert.ok(report.visualAssets.some((asset) => asset.dataset.id === "market-definition"));

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
    png: (bytes) => assert.equal(Buffer.from(bytes.slice(0, 8)).toString("hex"), "89504e470d0a1a0a"),
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
});
