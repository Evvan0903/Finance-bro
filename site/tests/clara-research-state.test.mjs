import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const stateRoot = new URL("../app/lib/private-diligence/state/", import.meta.url);
const { applyToolExecutionToResearchState, toolExecutionFromResult } = await tsImport(new URL("researchStateReducer.ts", stateRoot).href, import.meta.url);
const { sanitizeToolInput } = await tsImport(new URL("sanitizeToolInput.ts", stateRoot).href, import.meta.url);

function state(overrides = {}) {
  return {
    id: "state-1", researchRequestId: "research-1", objective: "General private-company diligence",
    companyId: "entity-acme", confirmedCompany: null, status: "initialized", observations: [], gaps: [],
    evidenceRefs: [], executionIds: [], createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

function evidence(overrides = {}) {
  return {
    evidenceId: "evidence-1", researchId: "research-1", entityId: "entity-acme", providerId: "companyWebsite",
    sourceTier: 2, sourceType: "Company-controlled web page", sourceTitle: "Acme Careers",
    sourceUrl: "https://acme.example/careers", publicReferenceUrl: "https://acme.example/careers",
    publicationDate: null, retrievedAt: "2026-09-01T10:01:00.000Z", rawText: "Careers",
    structuredData: {}, matchedEntitySignals: ["confirmed domain"], entityMatchConfidence: "High",
    companyReported: true, officialRecord: false, independentlyPublished: false, contentHash: "hash-1", limitations: [],
    ...overrides,
  };
}

function result(status, overrides = {}) {
  return {
    status, observations: [], evidence: [], gaps: [], errors: [],
    metadata: { toolName: "hiring_intelligence", startedAt: "2026-09-01T10:01:00.000Z", completedAt: "2026-09-01T10:01:01.000Z", retrievalTime: "2026-09-01T10:01:01.000Z", sourceCount: 0 },
    ...overrides,
  };
}

function execution(id, attempt, toolResult) {
  return toolExecutionFromResult({ id, researchStateId: "state-1", toolName: "hiring_intelligence", attempt, input: {}, result: toolResult });
}

test("deterministically merges duplicate gaps and later marks them resolved without deleting history", () => {
  const gap = { code: "careers_source_unavailable", topic: "hiring activity", description: "Careers source unavailable", severity: "medium", retryable: true };
  const first = execution("execution-1", 1, result("partial", { gaps: [gap, gap], errors: [{ code: "timeout", message: "Timed out", retryable: true }] }));
  const afterFirst = applyToolExecutionToResearchState(state(), first);
  assert.equal(afterFirst.gaps.length, 1);
  assert.equal(afterFirst.gaps[0].status, "open");
  assert.equal(afterFirst.status, "partial");

  const secondResult = result("success", {
    observations: [{ code: "public_jobs_observed", topic: "hiring activity", description: "0 public jobs were observed at retrieval time; this is not a headcount estimate", evidenceIds: [] }],
    metadata: { ...result("success").metadata, startedAt: "2026-09-01T10:02:00.000Z", completedAt: "2026-09-01T10:02:01.000Z", retrievalTime: "2026-09-01T10:02:01.000Z" },
  });
  const afterSecond = applyToolExecutionToResearchState(afterFirst, execution("execution-2", 2, secondResult));
  assert.equal(afterSecond.gaps[0].status, "resolved");
  assert.equal(afterSecond.gaps[0].resolvedAt, "2026-09-01T10:02:01.000Z");
  assert.deepEqual(afterSecond.executionIds, ["execution-1", "execution-2"]);
  assert.equal(afterSecond.status, "researching");
  assert.equal(first.gaps[0].code, "careers_source_unavailable");
});

test("partial results preserve usable evidence while failed results cannot add observations or evidence", () => {
  const partial = execution("execution-1", 1, result("partial", {
    observations: [{ code: "careers_page", topic: "hiring activity", description: "Official careers page discovered", evidenceIds: ["evidence-1"] }],
    evidence: [evidence()], errors: [{ code: "secondary_source_timeout", message: "Timed out", retryable: true }],
  }));
  const useful = applyToolExecutionToResearchState(state(), partial);
  assert.equal(useful.evidenceRefs[0].sourceUrl, "https://acme.example/careers");
  assert.equal(useful.observations[0].toolExecutionId, "execution-1");

  const failed = execution("execution-2", 2, result("failed", {
    observations: [{ code: "invented", topic: "company", description: "The company is growing rapidly", evidenceIds: ["fake"] }],
    evidence: [evidence({ evidenceId: "fake" })], errors: [{ code: "timeout", message: "Timed out", retryable: true }],
    metadata: { ...result("failed").metadata, startedAt: "2026-09-01T10:03:00.000Z", completedAt: "2026-09-01T10:03:01.000Z" },
  }));
  assert.equal(failed.observations.length, 0);
  assert.equal(failed.evidenceRefs.length, 0);
  const preserved = applyToolExecutionToResearchState(useful, failed);
  assert.equal(preserved.evidenceRefs.length, 1);
  assert.equal(preserved.observations.length, 1);
  assert.equal(preserved.status, "partial");

  const failedOnly = applyToolExecutionToResearchState(state(), execution("execution-3", 1, result("failed", {
    errors: [{ code: "timeout", message: "Timed out", retryable: true }],
  })));
  assert.equal(failedOnly.status, "researching");
  assert.notEqual(failedOnly.status, "failed");
});

test("sanitizes secret fields, credentials, local paths, and unnecessary browser payloads", () => {
  const input = sanitizeToolInput({
    Authorization: "Bearer top-secret", apiKey: "api-secret", token: "token-secret", cookie: "session=secret",
    nested: { env: { SERPAPI_API_KEY: "secret" }, cookies: "plural-cookie-secret", environmentVariables: { TOKEN: "environment-secret" }, url: "https://example.com/?api_key=url-secret" },
    rawHtml: "<html>large payload</html>", note: "Basic dXNlcjpwYXNz", localPath: "/Users/private/report.html",
  });
  const serialized = JSON.stringify(input);
  for (const secret of ["top-secret", "api-secret", "token-secret", "session=secret", "plural-cookie-secret", "environment-secret", "url-secret", "dXNlcjpwYXNz", "/Users/private/report.html", "large payload"]) {
    assert.equal(serialized.includes(secret), false);
  }
  assert.match(serialized, /\[REDACTED\]/);
  assert.match(serialized, /\[OMITTED\]/);
});
