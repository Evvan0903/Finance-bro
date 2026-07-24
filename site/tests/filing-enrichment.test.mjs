import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function parserModule() {
  let source = await readFile(
    new URL("../app/lib/filing-enrichment/inline-xbrl.ts", import.meta.url),
    "utf8",
  );
  const canonical = "data:text/javascript,export class CanonicalMetricError extends Error{};export class MetricRegistry{};export const createCanonicalMetric=x=>x";
  const definitions = "data:text/javascript,export const UNIVERSAL_METRIC_DEFINITIONS=[]";
  source = source
    .replace('"../canonical-metrics"', JSON.stringify(canonical))
    .replace(
      '"../metric-knowledge/universal-metric-definitions"',
      JSON.stringify(definitions),
    );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

test("parses scale, sign, units, periods, and dimensions from Inline XBRL", async () => {
  const { parseInlineXbrlFacts } = await parserModule();
  const html = `
    <xbrli:unit id="usd"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit>
    <xbrli:context id="duration">
      <xbrli:period><xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period>
    </xbrli:context>
    <xbrli:context id="segment">
      <xbrli:period><xbrli:instant>2025-12-31</xbrli:instant></xbrli:period>
      <xbrldi:explicitMember dimension="us-gaap:StatementBusinessSegmentsAxis">acme:CloudMember</xbrldi:explicitMember>
    </xbrli:context>
    <ix:nonFraction name="us-gaap:Revenues" contextRef="duration" unitRef="usd" scale="6" decimals="-6">1,250</ix:nonFraction>
    <ix:nonFraction name="acme:SegmentAssets" contextRef="segment" unitRef="usd" sign="-">25</ix:nonFraction>`;
  const facts = parseInlineXbrlFacts(html);
  assert.equal(facts.length, 2);
  assert.equal(facts[0].value, 1_250_000_000);
  assert.equal(facts[0].unit, "USD");
  assert.equal(facts[0].periodStart, "2025-01-01");
  assert.equal(facts[1].value, -25);
  assert.deepEqual(facts[1].dimensions, [{
    axis: "us-gaap:StatementBusinessSegmentsAxis",
    member: "acme:CloudMember",
  }]);
});

test("keeps custom mappings validation-gated and HTML tables diagnostic-only", async () => {
  const custom = await readFile(
    new URL("../app/lib/filing-enrichment/custom-concept-mappings.ts", import.meta.url),
    "utf8",
  );
  const tables = await readFile(
    new URL("../app/lib/filing-enrichment/html-table-extractor.ts", import.meta.url),
    "utf8",
  );
  assert.match(custom, /mapping\.status === "validated"/);
  assert.match(tables, /status: "candidate-only"/);
  assert.doesNotMatch(tables, /createCanonicalMetric/);
});

test("allows only a later amended filing to supersede a Company Facts value", async () => {
  const { shouldSupersedeCompanyFacts } = await parserModule();
  const existing = {
    source_document: "SEC Company Facts — 10-K",
    filing_date: "2025-02-01",
    period_end: "2024-12-31",
    unit: "USD",
    value: 100,
  };
  const candidate = { periodEnd: "2024-12-31", unit: "USD", value: 102 };
  assert.equal(shouldSupersedeCompanyFacts({
    existing,
    candidate,
    filingForm: "10-K/A",
    filingDate: "2025-03-01",
  }), true);
  assert.equal(shouldSupersedeCompanyFacts({
    existing,
    candidate,
    filingForm: "10-K",
    filingDate: "2025-03-01",
  }), false);
  assert.equal(shouldSupersedeCompanyFacts({
    existing,
    candidate: { ...candidate, unit: "EUR" },
    filingForm: "10-K/A",
    filingDate: "2025-03-01",
  }), false);
});

test("integrates filing enrichment without replacing valid non-amended Company Facts values", async () => {
  const route = await readFile(
    new URL("../app/api/research/route.ts", import.meta.url),
    "utf8",
  );
  const parser = await readFile(
    new URL("../app/lib/filing-enrichment/inline-xbrl.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /enrichRegistryFromInlineXbrl/);
  assert.match(parser, /Company Facts value already selected/);
  assert.match(parser, /superseding-company-facts/);
  assert.match(parser, /candidate\.dimensions\.length/);
});
