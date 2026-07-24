import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

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

async function coverageModules() {
  const aliasesUrl = await transpiledModuleUrl(
    "../app/lib/metric-knowledge/standard-concept-aliases.ts",
  );
  const rulesUrl = await transpiledModuleUrl(
    "../app/lib/metric-knowledge/validation-rules.ts",
  );
  const definitionsUrl = await transpiledModuleUrl(
    "../app/lib/metric-knowledge/universal-metric-definitions.ts",
    {
      '"./standard-concept-aliases"': JSON.stringify(aliasesUrl),
      '"./validation-rules"': JSON.stringify(rulesUrl),
    },
  );
  const expectationsUrl = await transpiledModuleUrl(
    "../app/lib/metric-coverage/coverage-expectations.ts",
  );
  const auditUrl = await transpiledModuleUrl(
    "../app/lib/metric-coverage/extraction-audit.ts",
    {
      '"./coverage-expectations"': JSON.stringify(expectationsUrl),
      '"../metric-knowledge/universal-metric-definitions"': JSON.stringify(definitionsUrl),
    },
  );
  const scoreUrl = await transpiledModuleUrl(
    "../app/lib/metric-coverage/coverage-score.ts",
  );
  const benchmarksUrl = await transpiledModuleUrl(
    "../app/lib/metric-coverage/benchmarks.ts",
    {
      '"./coverage-expectations"': JSON.stringify(expectationsUrl),
    },
  );
  return Promise.all([
    import(`${expectationsUrl}#expectations`),
    import(`${auditUrl}#audit`),
    import(`${scoreUrl}#score`),
    import(`${benchmarksUrl}#benchmarks`),
  ]);
}

function metric(overrides = {}) {
  return {
    canonical_key: "AAPL|revenue|FY2025",
    metric_id: "revenue",
    company_id: "AAPL",
    sector: "technology-hardware-general",
    period: "FY2025",
    period_start: "2024-09-29",
    period_end: "2025-09-27",
    value: 416_161_000_000,
    unit: "USD",
    currency: "USD",
    status: "Reported",
    definition_id: "reported-revenue",
    formula_id: null,
    formula: null,
    input_metric_keys: [],
    source_document: "SEC Company Facts — 10-K",
    source_url: "https://data.sec.gov/",
    source_type: "filing",
    source_date: "2025-10-31",
    filing_date: "2025-10-31",
    section: "Standardized XBRL facts",
    table: "us-gaap",
    row_label: "Revenue",
    raw_value: "416161000000",
    extraction_method: "deterministic-sec-xbrl",
    confidence: 0.99,
    retrieved_at: "2026-07-24T00:00:00.000Z",
    data_version: "fixture",
    calculation_version: "1.0",
    schema_version: "1.0",
    ...overrides,
  };
}

test("defines versioned benchmarks and applicability-aware universal tiers", async () => {
  const [expectations, , , benchmarks] = await coverageModules();
  assert.equal(expectations.TIER_1_METRIC_IDS.length, 24);
  assert.ok(expectations.TIER_2_METRIC_IDS.length >= 20);
  assert.equal(benchmarks.COVERAGE_BENCHMARK_VERSION, "1.0");
  assert.equal(benchmarks.COVERAGE_BENCHMARKS.length, 21);
  assert.ok(benchmarks.COVERAGE_BENCHMARKS.some((item) => item.ticker === "AAPL"));
  const grossMargin = expectations.UNIVERSAL_COVERAGE_EXPECTATIONS.find(
    (item) => item.metricId === "gross-margin",
  );
  assert.equal(expectations.metricIsApplicable({
    expectation: grossMargin,
    companyType: "bank",
    packId: "banks",
  }), false);
  const inventory = expectations.UNIVERSAL_COVERAGE_EXPECTATIONS.find(
    (item) => item.metricId === "inventory",
  );
  assert.equal(expectations.metricIsApplicable({
    expectation: inventory,
    companyType: "non-financial",
    packId: "software-saas-general",
  }), false);
});

test("audits every expected metric and preserves deterministic missing reasons", async () => {
  const [expectations, audit] = await coverageModules();
  const registry = {
    schema_version: "1.0",
    data_version: "fixture",
    calculation_version: "1.0",
    metrics: [
      metric(),
      metric({
        canonical_key: "AAPL|revenue-growth|FY2025",
        metric_id: "revenue-growth",
        value: 0.064,
        unit: "ratio",
        currency: null,
        status: "Derived",
        definition_id: "year-over-year-revenue-growth",
        source_type: "calculation",
        formula_id: "growth-rate",
        formula: "current_revenue / prior_revenue - 1",
      }),
    ],
  };
  const results = audit.buildMetricExtractionAudit({
    registry,
    companyId: "AAPL",
    periodEnd: "2025-09-27",
    packId: "technology-hardware-general",
    companyType: "non-financial",
  });
  assert.equal(results.length, expectations.UNIVERSAL_COVERAGE_EXPECTATIONS.length);
  assert.equal(results.find((item) => item.metricId === "revenue").status, "found");
  assert.equal(results.find((item) => item.metricId === "revenue-growth").status, "derived");
  assert.equal(
    results.find((item) => item.metricId === "gross-margin").reason,
    "calculation-input-missing",
  );
  assert.ok(results.every((item) => item.reason && Array.isArray(item.searchedSources)));
});

test("excludes not-applicable and candidate-only metrics from deterministic coverage", async () => {
  const [, , score] = await coverageModules();
  const audits = [
    { tier: 1, applicable: true, status: "found", reason: "standard-concept-match", searchedSources: [] },
    { tier: 1, applicable: true, status: "derived", reason: "derived-from-components", searchedSources: ["derived-metric-engine"] },
    { tier: 1, applicable: true, status: "candidate-only", reason: "custom-tag-not-mapped", searchedSources: ["filing-custom-xbrl"] },
    { tier: 1, applicable: false, status: "not-applicable", reason: "not-applicable", searchedSources: [] },
    { tier: 2, applicable: true, status: "found", reason: "standard-concept-match", searchedSources: [] },
  ].map((item, index) => ({
    metricId: `metric-${index}`,
    definitionId: null,
    searchedConcepts: [],
    candidateConcepts: [],
    ...item,
  }));
  const summary = score.scoreMetricCoverage(audits);
  assert.equal(summary.tier1.applicable, 3);
  assert.equal(summary.tier1.found, 1);
  assert.equal(summary.tier1.derived, 1);
  assert.equal(summary.tier1.missing, 1);
  assert.equal(summary.tier1.coverage, 2 / 3);
  assert.equal(summary.reportMode, "standard");
  assert.equal(summary.missingReasonCounts["custom-tag-not-mapped"], 1);
});

test("assigns Full, Standard, and Limited modes from Tier 1 coverage", async () => {
  const [, , score] = await coverageModules();
  const auditsFor = (covered, total) =>
    Array.from({ length: total }, (_, index) => ({
      metricId: `metric-${index}`,
      definitionId: null,
      tier: 1,
      applicable: true,
      status: index < covered ? "found" : "missing",
      reason: index < covered ? "standard-concept-match" : "standard-tag-not-mapped",
      searchedSources: ["company-facts"],
      searchedConcepts: [],
      candidateConcepts: [],
    }));
  assert.equal(score.scoreMetricCoverage(auditsFor(8, 10)).reportMode, "full");
  assert.equal(score.scoreMetricCoverage(auditsFor(6, 10)).reportMode, "standard");
  assert.equal(score.scoreMetricCoverage(auditsFor(5, 10)).reportMode, "limited");
});

test("records the 21-company live benchmark and meets the initial non-financial target", async () => {
  const artifact = JSON.parse(await readFile(
    new URL("../artifacts/universal_metric_coverage_v1.json", import.meta.url),
    "utf8",
  ));
  assert.equal(artifact.results.length, 21);
  assert.ok(artifact.nonFinancialInitialBenchmarkAverageTier1Coverage >= 0.8);
  assert.equal(artifact.knownMateriallyIncorrectPublishedMetrics, 0);
  for (const result of artifact.results) {
    assert.equal(result.incorrectMetricCount ?? 0, 0);
    if (
      !["banks", "diversified-financials-general"].includes(result.pack) &&
      result.tier1 < 0.65
    ) {
      assert.ok(result.documentedReason, `${result.ticker} requires a documented reason`);
    }
  }
});
