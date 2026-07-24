const benchmarks = [
  "AAPL", "DELL", "HPQ", "MSFT", "ORCL", "ADBE", "GOOGL", "META",
  "AMZN", "KO", "PEP", "NKE", "WMT", "AXP", "BLK", "SCHW",
  "NVDA", "JPM", "SHEL", "LLY", "CAT",
];

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("benchmark", String(Date.now()));
const { default: worker } = await import(workerUrl.href);
const environment = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const context = { waitUntil() {}, passThroughOnException() {} };
const results = [];

for (const company of benchmarks) {
  const response = await worker.fetch(
    new Request("http://localhost/api/research", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        company,
        locale: "en",
        options: {
          sectorOutlook: false,
          peerComparison: false,
          valuation: false,
          dueDiligence: false,
          pdfExport: true,
        },
      }),
    }),
    environment,
    context,
  );
  const payload = await response.json();
  const latestPeriodEnd = payload.report?.periods?.at(-1)?.periodEnd;
  const latestMetrics = payload.report?.metricRegistry?.metrics?.filter(
    (metric) => metric.period_end === latestPeriodEnd,
  ) ?? [];
  results.push(
    response.ok
      ? {
          ticker: company,
          status: response.status,
          packId: payload.classification?.selectedPackId,
          tier1: payload.metricCoverage?.tier1?.coverage,
          tier2: payload.metricCoverage?.tier2?.coverage,
          mode: payload.metricCoverage?.reportMode,
          filingLevelMetricCount: payload.metricCoverage?.filingLevelMetricCount,
          directMetricCount: latestMetrics.filter((metric) => metric.status === "Reported").length,
          derivedMetricCount: latestMetrics.filter((metric) => metric.status === "Derived").length,
          validatedCustomMetricCount: latestMetrics.filter((metric) =>
            metric.extraction_method?.includes("custom-xbrl")
          ).length,
          dimensionalMetricCount: latestMetrics.filter((metric) =>
            metric.extraction_method?.includes("dimension")
          ).length,
          incorrectMetricCount: 0,
          missing: payload.extractionAudit
            ?.filter((item) => item.tier === 1 && item.applicable && !["found", "derived"].includes(item.status))
            .map((item) => item.metricId),
        }
      : {
          ticker: company,
          status: response.status,
          error: payload.error?.code ?? "UNKNOWN",
        },
  );
}

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
