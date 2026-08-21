import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function moduleUrl(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}

test("accepts Quick Company Intelligence inputs and preserves the deep workflow boundary", async () => {
  const schema = await import((await moduleUrl("../app/lib/private-diligence/schema.ts")) + `#${Date.now()}`);
  const result = schema.parsePrivateCompanyInput({ companyName: "Acme", workflowMode: "quick", quickResearchPurpose: "Sales Prospect", locale: "zh" });
  assert.equal(result.workflowMode, "quick");
  assert.equal(result.quickResearchPurpose, "Sales Prospect");
  assert.equal(result.locale, "zh");
  const deep = schema.parsePrivateCompanyInput({ website: "example.com", workflowMode: "deep" });
  assert.equal(deep.workflowMode, "deep");
});

test("company-name-only starts discovery before requesting more information", async () => {
  const discoverySource = await readFile(new URL("../app/lib/private-diligence/entity-resolution/candidateDiscovery.ts", import.meta.url), "utf8");
  const candidateRoute = await readFile(new URL("../app/api/private-diligence/candidates/route.ts", import.meta.url), "utf8");
  assert.match(discoverySource, /candidateWebsiteSeeds/);
  assert.match(discoverySource, /discoverEntityCandidates\(researchId, \{ \.\.\.input, website \}/);
  assert.match(candidateRoute, /const discovery = await discoverEntityCandidates/);
  assert.match(candidateRoute, /needsMoreInformation: plausible\.length === 0/);
});

test("confirmation diagnostics prove target-selection parity without public exposure", async () => {
  const route = await readFile(new URL("../app/api/private-diligence/confirm-entity/route.ts", import.meta.url), "utf8");
  assert.match(route, /clara_target_selection_diagnostic/);
  assert.match(route, /frontendEligibility/);
  assert.match(route, /backendEligibility/);
  assert.match(route, /researchSessionCreated: true/);
  assert.doesNotMatch(route, /Additional identifying information is required before this target can be confirmed/);
});

test("automatically selected Quick candidates wait for explicit confirmation before research", async () => {
  const workflow = await readFile(new URL("../app/ClaraPrivateDiligenceWorkflow.tsx", import.meta.url), "utf8");
  assert.match(workflow, /initialSelectedCandidateId\(discoveredCandidates\)/);
  assert.match(workflow, /await jsonRequest\("\/api\/private-diligence\/confirm-entity", confirmationPayload\)/);
  assert.match(workflow, /if \(mode === "quick"\) await runResearch\(\)/);
});

test("exposes a compact bilingual quick workflow and preserves Clara's deep route", async () => {
  const workflow = await readFile(new URL("../app/ClaraPrivateDiligenceWorkflow.tsx", import.meta.url), "utf8");
  const quickRoute = await readFile(new URL("../app/workflows/company-intelligence/page.tsx", import.meta.url), "utf8");
  const deepRoute = await readFile(new URL("../app/workflows/private-company-diligence/page.tsx", import.meta.url), "utf8");
  assert.match(workflow, /Quick Company Intelligence/);
  assert.match(workflow, /Outside-In Due Diligence/);
  assert.match(workflow, /Sales Prospect/);
  assert.match(workflow, /快速企业调查/);
  assert.match(quickRoute, /mode="quick"/);
  assert.match(deepRoute, /mode="deep"/);
});

test("quick report remains evidence-backed and does not make investment claims", async () => {
  const report = await readFile(new URL("../app/lib/private-diligence/reports/quickReportBuilder.ts", import.meta.url), "utf8");
  const provider = await readFile(new URL("../app/lib/private-diligence/planning/quickResearchPlanner.ts", import.meta.url), "utf8");
  assert.match(report, /Company Snapshot/);
  assert.match(report, /Hiring and Growth Signals/);
  assert.match(report, /Sources and Information Gaps/);
  assert.match(report, /not investment recommendations/);
  assert.match(report, /personal emails, mobile numbers, and residential addresses are excluded/);
  assert.match(provider, /companyWebsite/);
  assert.doesNotMatch(provider, /webDiscovery/);
});
