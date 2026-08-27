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
  assert.match(discoverySource, /wikidataWebsiteSeeds/);
  assert.match(discoverySource, /Public entity and official website identified by Wikidata/);
  assert.match(discoverySource, /Special:EntityData/);
  assert.doesNotMatch(discoverySource, /while \(.*candidates\.length < 5/);
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
  assert.match(workflow, /data-quick-minimal/);
  assert.match(workflow, /state === "needsMoreInformation"/);
  assert.doesNotMatch(workflow, /mode === "quick" \? <select/);
  assert.match(workflow, /快速企业调查/);
  assert.match(quickRoute, /mode="quick"/);
  assert.match(deepRoute, /mode="deep"/);
});

test("quick entry exposes only company name and website until discovery returns zero candidates", async () => {
  const [workflow, copy] = await Promise.all([
    readFile(new URL("../app/ClaraPrivateDiligenceWorkflow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/private-diligence/copy.ts", import.meta.url), "utf8"),
  ]);
  assert.match(copy, /Company name · Optional/);
  assert.match(copy, /Company website · Optional/);
  assert.match(copy, /Provide a company name, website, or both/);
  assert.match(copy, /填写公司名称、官网，或两者之一/);
  assert.match(copy, /Help Clara narrow it down/);
  assert.match(workflow, /mode === "quick" && state === "needsMoreInformation"/);
  assert.match(workflow, /copy\.fields\.location/);
  assert.match(workflow, /copy\.fields\.founder/);
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

test("DeepSeek V4 Pro is isolated to structured medium-tier candidate discovery", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-only-key";
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"candidates":[]}' } }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const router = await import((await moduleUrl("../app/lib/private-diligence/modelRouter.ts")) + `#${Date.now()}`);
    const result = await router.runClaraModel({ tier: "medium", task: "discover_company_candidates", input: { groundedPublicResults: [] }, schema: (value) => value });
    assert.deepEqual(result, { candidates: [] });
    assert.equal(requestBody.model, "deepseek-v4-pro");
    assert.deepEqual(requestBody.response_format, { type: "json_object" });
    assert.match(requestBody.messages[0].content, /exclusively from the supplied grounded public results/);
    await assert.rejects(() => router.runClaraModel({ tier: "strong", task: "generate_quick_brief", input: {}, schema: (value) => value }), /TASK_DISABLED/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalKey;
  }
});
