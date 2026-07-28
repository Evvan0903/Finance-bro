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

async function regulatoryModules() {
  const copyUrl = await moduleUrl("../app/lib/regulatory/copy.ts");
  const sourcesUrl = await moduleUrl("../app/lib/regulatory/sources.ts");
  const schemaUrl = await moduleUrl("../app/lib/regulatory/schema.ts");
  const scenarioUrl = await moduleUrl("../app/lib/regulatory/scenario.ts");
  const structuresUrl = await moduleUrl("../app/lib/regulatory/structures.ts");
  const rulesUrl = await moduleUrl("../app/lib/regulatory/rules.ts", {
    '"./sources"': JSON.stringify(sourcesUrl),
  });
  const engineUrl = await moduleUrl("../app/lib/regulatory/engine.ts", {
    '"./copy"': JSON.stringify(copyUrl),
    '"./rules"': JSON.stringify(rulesUrl),
    '"./scenario"': JSON.stringify(scenarioUrl),
    '"./schema"': JSON.stringify(schemaUrl),
    '"./sources"': JSON.stringify(sourcesUrl),
    '"./structures"': JSON.stringify(structuresUrl),
  });
  const markdownUrl = await moduleUrl("../app/lib/regulatory/markdown.ts", {
    '"./copy"': JSON.stringify(copyUrl),
    '"./engine"': JSON.stringify(engineUrl),
  });
  const nonce = () => `#${Date.now()}-${Math.random()}`;
  return {
    copy: await import(copyUrl + nonce()),
    sources: await import(sourcesUrl + nonce()),
    schema: await import(schemaUrl + nonce()),
    scenario: await import(scenarioUrl + nonce()),
    structures: await import(structuresUrl + nonce()),
    rules: await import(rulesUrl + nonce()),
    engine: await import(engineUrl + nonce()),
    markdown: await import(markdownUrl + nonce()),
  };
}

function validScenario(overrides = {}) {
  return {
    industry: "ev-battery-materials",
    role: "chinese-material-manufacturer",
    plan: "license-technology",
    objective: "compare-equity-licensing",
    product: "battery-cell",
    credit: "45X",
    year: 2028,
    answers: [
      { questionId: "sfe-equity", value: "yes" },
      { questionId: "appointment-right", value: "no" },
      { questionId: "sfe-debt", value: "not-sure" },
      { questionId: "pfe-materials", value: "yes" },
      { questionId: "substantial-us-manufacturing", value: "yes" },
      { questionId: "customer-credit-claim", value: "yes" },
      { questionId: "sfe-license", value: "yes" },
      { questionId: "supplier-direction", value: "no" },
      { questionId: "production-direction", value: "no" },
      { questionId: "quantity-timing", value: "no" },
      { questionId: "customer-output-restriction", value: "no" },
      { questionId: "exclusive-equipment-rights", value: "no" },
      { questionId: "royalty-over-ten-years", value: "no" },
      { questionId: "services-over-two-years", value: "no" },
      { questionId: "complete-technical-transfer", value: "yes" },
    ],
    ...overrides,
  };
}

test("validates supported scenarios and blocks planned industries", async () => {
  const { schema } = await regulatoryModules();
  assert.equal(schema.validateRegulatoryScenario(validScenario()).success, true);
  const planned = schema.validateRegulatoryScenario(
    validScenario({ industry: "solar-manufacturing" }),
  );
  assert.equal(planned.success, false);
  assert.ok(planned.errors.includes("Industry is planned but not supported"));
  assert.equal(
    schema.validateRegulatoryScenario(validScenario({ year: 2036 })).success,
    false,
  );
});

test("selects dynamic licensing questions and enforces complete answers", async () => {
  const { scenario, engine } = await regulatoryModules();
  const ids = scenario.dynamicScenarioQuestions(validScenario());
  for (const expected of [
    "sfe-license",
    "supplier-direction",
    "production-direction",
    "royalty-over-ten-years",
    "services-over-two-years",
    "complete-technical-transfer",
  ]) assert.ok(ids.includes(expected), expected);
  assert.equal(engine.scenarioQuestionsAreComplete(validScenario()), true);
  assert.equal(
    engine.scenarioQuestionsAreComplete(validScenario({ answers: [] })),
    false,
  );
});

test("validates every legal source and rule reference", async () => {
  const { sources, rules } = await regulatoryModules();
  assert.deepEqual(sources.validateLegalSourceRegistry(), []);
  assert.deepEqual(rules.validateRuleRegistry(), []);
  assert.ok(sources.LEGAL_SOURCES.every((source) =>
    source.url.startsWith("https://www.") || source.url.startsWith("https://business.")));
  assert.ok(rules.REGULATORY_RULES.every((rule) =>
    rule.sourceIds.length && rule.sourceSections.length));
});

test("looks up entity, appointment, royalty, service, and licensing-date rules", async () => {
  const { rules } = await regulatoryModules();
  assert.equal(rules.getRule("entity-single-sfe-25").triggerValue, 25);
  assert.equal(rules.getRule("entity-aggregate-sfe-40").triggerValue, 40);
  assert.equal(rules.getRule("entity-sfe-debt-15").triggerValue, 15);
  assert.equal(rules.getRule("entity-covered-officer-appointment").triggerOperator, "any");
  assert.match(String(rules.getRule("control-royalty-ten-years").triggerValue), /tenth/i);
  assert.match(String(rules.getRule("control-services-two-years").triggerValue), /two years/i);
  assert.match(String(rules.getRule("control-license-after-enactment").triggerValue), /July 4, 2025/);
});

test("uses the verified year tables for all four MACR categories", async () => {
  const { rules } = await regulatoryModules();
  assert.equal(rules.getMacrRule("battery-cell", "45X", 2026).triggerValue, 60);
  assert.equal(rules.getMacrRule("battery-cell", "45X", 2029).triggerValue, 80);
  assert.equal(rules.getMacrRule("battery-cell", "45X", 2035).triggerValue, 85);
  assert.equal(rules.getMacrRule("applicable-critical-mineral", "45X", 2029).triggerValue, 0);
  assert.equal(rules.getMacrRule("applicable-critical-mineral", "45X", 2033).triggerValue, 50);
  assert.equal(rules.getMacrRule("battery-module", "45Y", 2027).triggerValue, 45);
  assert.equal(rules.getMacrRule("battery-module", "48E", 2030).triggerValue, 60);
  assert.equal(rules.getMacrRule("energy-storage-technology", "48E", 2026).triggerValue, 55);
  assert.equal(rules.getMacrRule("energy-storage-technology", "48E", 2035).triggerValue, 75);
});

test("generates exactly three deterministic structures with screening labels", async () => {
  const { engine } = await regulatoryModules();
  const report = engine.generateRegulatoryProposal(validScenario(), "en", "2026-07-28");
  assert.equal(report.structures.length, 3);
  assert.deepEqual(
    new Set(report.structures.map((item) => item.structureId)),
    new Set(["minority-jv", "us-controlled", "technology-license"]),
  );
  assert.ok(report.structures.flatMap((item) => item.parameters)
    .some((item) => item.proposedValue.en.includes("Below 25%")));
  assert.ok(report.structures.flatMap((item) => item.parameters)
    .some((item) => item.proposedValue.en.includes("No more than 2 years")));
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /Guaranteed Compliant|Guaranteed Eligible/i);
  assert.doesNotMatch(serialized, /"Compliant"|"Non-compliant"|"Eligible"|"Ineligible"/i);
});

test("numbers official references, preserves direct links, and blocks definitive recommendations for pending dynamic lists", async () => {
  const { engine } = await regulatoryModules();
  const report = engine.generateRegulatoryProposal(validScenario(), "en", "2026-07-28");
  assert.equal(report.references[0].number, 1);
  assert.ok(report.references.every((reference, index) =>
    reference.number === index + 1 && reference.source.url.startsWith("https://")));
  assert.equal(report.sourceCoverage.status, "Current-source verification required");
  assert.ok(report.references.some((reference) => reference.source.status === "Pending Verification"));
  assert.match(report.proposedDirection.join(" "), /Current-source verification is required/i);
});

test("produces formal English and Chinese Markdown with numbered sections and references", async () => {
  const { engine, markdown } = await regulatoryModules();
  for (const locale of ["en", "zh"]) {
    const report = engine.generateRegulatoryProposal(validScenario(), locale, "2026-07-28");
    const output = markdown.regulatoryReportToMarkdown(report);
    assert.match(output, /## 01 /);
    assert.match(output, /## 13 /);
    assert.match(output, /### \[1\]/);
    assert.match(output, /\]\(https:\/\//);
    assert.match(output, /Generated with FinBro|由 FinBro 生成/);
    assert.doesNotMatch(output, /Nora is checking|Nora 正在核对/);
  }
});

test("keeps all known Nora headings and CTAs free of terminal periods", async () => {
  const { copy } = await regulatoryModules();
  const terminal = /[。.]\s*$/u;
  for (const locale of ["en", "zh"]) {
    const headingValues = [
      copy.NORA_COPY[locale].heroTitle,
      copy.NORA_COPY[locale].heroSubheading,
      copy.NORA_COPY[locale].workflowName,
      ...Object.values(copy.NORA_COPY[locale].steps),
      ...Object.values(copy.NORA_COPY[locale].buttons),
      ...copy.RESULT_SECTION_TITLES.map((item) => item[locale]),
      ...copy.INDUSTRY_OPTIONS.map((item) => item.label[locale]),
      ...copy.PLAN_OPTIONS.map((item) => item.label[locale]),
    ];
    assert.deepEqual(headingValues.filter((value) => terminal.test(value)), []);
  }
});

