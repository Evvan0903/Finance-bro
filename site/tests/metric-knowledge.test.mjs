import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadTsModule(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  Function("exports", "module", "require", compiled)(
    exports,
    { exports },
    (specifier) => {
      if (specifier === "./standard-concept-aliases") {
        return loadTsModule.cache.aliases;
      }
      if (specifier === "./validation-rules") {
        return loadTsModule.cache.rules;
      }
      throw new Error(`Unexpected dependency ${specifier}`);
    },
  );
  return exports;
}
loadTsModule.cache = {};

test("centralizes the required standard concept aliases and validation metadata", async () => {
  loadTsModule.cache.aliases = await loadTsModule("../app/lib/metric-knowledge/standard-concept-aliases.ts");
  loadTsModule.cache.rules = await loadTsModule("../app/lib/metric-knowledge/validation-rules.ts");
  const registry = await loadTsModule("../app/lib/metric-knowledge/universal-metric-definitions.ts");
  const definitions = registry.UNIVERSAL_METRIC_DEFINITIONS;

  assert.equal(registry.UNIVERSAL_METRIC_DEFINITION_VERSION, "2.0");
  assert.ok(definitions.length >= 40);
  for (const metricId of [
    "revenue", "cost-of-revenue", "operating-cash-flow", "cash-capex",
    "short-term-investments", "current-debt", "noncurrent-debt",
    "accounts-receivable", "stock-based-compensation",
    "depreciation-and-amortization", "income-tax-expense",
  ]) {
    const definition = definitions.find((item) => item.metricId === metricId);
    assert.ok(definition, `${metricId} definition missing`);
    assert.ok(definition.standardConcepts.length, `${metricId} aliases missing`);
    assert.ok(definition.acceptedUnits.length, `${metricId} accepted units missing`);
    assert.ok(definition.validationRules.length, `${metricId} validation missing`);
  }
});

test("orders high-confidence standard aliases ahead of fallbacks", async () => {
  const aliases = await loadTsModule("../app/lib/metric-knowledge/standard-concept-aliases.ts");
  assert.equal(
    aliases.STANDARD_CONCEPT_ALIASES.revenue[0].concept,
    "RevenueFromContractWithCustomerExcludingAssessedTax",
  );
  assert.equal(
    aliases.STANDARD_CONCEPT_ALIASES["current-debt"][0].concept,
    "LongTermDebtAndFinanceLeaseObligationsCurrent",
  );
});

test("uses the V2 definition registry as the live Company Facts configuration", async () => {
  const source = await readFile(
    new URL("../app/lib/financial-metrics.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /for \(const config of CENTRAL_FINANCIAL_METRICS\)/);
  assert.match(source, /UNIVERSAL_METRIC_DEFINITIONS/);
  assert.match(source, /acceptedUnit\(unit, config\.acceptedUnits\)/);
});
