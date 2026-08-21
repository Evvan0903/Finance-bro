import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function moduleUrl(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}

function candidate(candidateId, researchRequestId = "research-1") {
  return { candidateId, researchRequestId };
}

test("one candidate is selected automatically and produces an ID-only confirmation payload", async () => {
  const selection = await import((await moduleUrl("../app/lib/private-diligence/entity-resolution/candidateSelection.ts")) + `#${Date.now()}`);
  const candidates = [candidate("candidate-1")];
  const selectedCandidateId = selection.initialSelectedCandidateId(candidates);
  assert.equal(selectedCandidateId, "candidate-1");
  assert.deepEqual(selection.buildConfirmationPayload("research-1", selectedCandidateId), {
    researchId: "research-1",
    candidateId: "candidate-1",
    explicitUserConfirmation: true,
  });
  assert.equal(selection.candidateBelongsToResearch(candidates[0], "research-1"), true);
});

test("multiple candidates start unselected and preserve the user's exact second selection", async () => {
  const selection = await import((await moduleUrl("../app/lib/private-diligence/entity-resolution/candidateSelection.ts")) + `#${Date.now()}`);
  const candidates = [candidate("candidate-1"), candidate("candidate-2"), candidate("candidate-3")];
  assert.equal(selection.initialSelectedCandidateId(candidates), null);
  const selectedCandidateId = selection.selectCandidateId(candidates, "candidate-2");
  assert.equal(selectedCandidateId, "candidate-2");
  assert.equal(selection.buildConfirmationPayload("research-1", selectedCandidateId).candidateId, "candidate-2");
});

test("no selection cannot create a malformed confirmation request", async () => {
  const selection = await import((await moduleUrl("../app/lib/private-diligence/entity-resolution/candidateSelection.ts")) + `#${Date.now()}`);
  assert.equal(selection.buildConfirmationPayload("research-1", null), null);
  assert.equal(selection.buildConfirmationPayload("", "candidate-1"), null);
});

test("confirmation uses selectedCandidateId rather than a stale candidate object", async () => {
  const selection = await import((await moduleUrl("../app/lib/private-diligence/entity-resolution/candidateSelection.ts")) + `#${Date.now()}`);
  const staleCandidate = candidate("candidate-1");
  const selectedCandidateId = "candidate-2";
  const payload = selection.buildConfirmationPayload("research-1", selectedCandidateId);
  assert.notEqual(payload.candidateId, staleCandidate.candidateId);
  assert.equal(payload.candidateId, selectedCandidateId);
});

test("cross-request and malformed candidates remain invalid", async () => {
  const selection = await import((await moduleUrl("../app/lib/private-diligence/entity-resolution/candidateSelection.ts")) + `#${Date.now()}`);
  const candidates = [candidate("candidate-1", "research-other")];
  assert.equal(selection.candidateBelongsToResearch(candidates[0], "research-1"), false);
  assert.equal(selection.selectCandidateId(candidates, "candidate-missing"), null);
  assert.equal(selection.initialSelectedCandidateId([candidate("")]), null);
});

test("UI and confirmation route enforce explicit selection and ownership invariants", async () => {
  const [workflow, route] = await Promise.all([
    readFile(new URL("../app/ClaraPrivateDiligenceWorkflow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/private-diligence/confirm-entity/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(workflow, /const \[selectedCandidateId, setSelectedCandidateId\]/);
  assert.match(workflow, /disabled=\{!selectedCandidateId \|\| state === "researching"\}/);
  assert.match(workflow, /buildConfirmationPayload\(researchId, selectedCandidateId\)/);
  assert.doesNotMatch(workflow, /confirm\(candidate\)/);
  assert.match(route, /explicitUserConfirmation = body\?\.explicitUserConfirmation === true/);
  assert.match(route, /candidateBelongsToResearch\(candidate, researchId\)/);
});
