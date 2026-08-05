import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildInternalProviderDiagnostics } from "../app/lib/ethan-industry/providerDiagnostics.ts";

function reportFixture() {
  const mapping = (providerId, kind, code) => ({ providerId, kind, code });
  return {
    scope: { startYear: 2024, endYear: 2026, tickers: [] },
    marketDefinition: {
      officialClassificationMappings: [
        mapping("fred", "fredSeries", "IPG3344S"),
        mapping("bea", "beaIndustry", "3344"),
      ],
    },
    providerPlan: {
      items: [
        { providerId: "fred", providerName: "FRED", selected: true, configurationStatus: "configured", expectedEvidence: ["industrial production"] },
        { providerId: "bea", providerName: "BEA", selected: true, configurationStatus: "configured", expectedEvidence: ["value added"] },
        { providerId: "census", providerName: "Census", selected: true, configurationStatus: "missing", expectedEvidence: ["establishments"] },
      ],
    },
    providerResults: [
      {
        providerId: "fred",
        status: "used",
        configurationStatus: "configured",
        evidence: [
          { observationPeriod: "2025-01" },
          { observationPeriod: "2025-02" },
        ],
        limitations: [],
        errorCode: null,
        retrievedAt: "2026-08-04T12:00:00.000Z",
      },
      {
        providerId: "bea",
        status: "unavailable",
        configurationStatus: "temporarilyUnavailable",
        evidence: [],
        limitations: ["Request timed out at /tmp/provider with token=SECRET_VALUE"],
        errorCode: "temporarilyUnavailable",
        retrievedAt: null,
      },
      {
        providerId: "census",
        status: "missingConfiguration",
        configurationStatus: "missing",
        evidence: [],
        limitations: ["api_key=SECRET_VALUE"],
        errorCode: "providerFailure",
        retrievedAt: null,
      },
    ],
  };
}

test("retains useful internal provider detail without copying raw errors or secrets", () => {
  const diagnostics = buildInternalProviderDiagnostics(reportFixture());
  assert.deepEqual(diagnostics.map((item) => item.status), ["success", "timeout", "invalidConfiguration"]);
  assert.equal(diagnostics[0].usableRecordsReturned, 2);
  assert.equal(diagnostics[0].availablePeriod, "2025-01–2025-02");
  assert.deepEqual(diagnostics[0].requestedDatasetOrSeries, ["fredSeries:IPG3344S"]);
  assert.equal(diagnostics[1].requestAttempted, true);
  assert.equal(diagnostics[2].requestAttempted, false);
  assert.equal(diagnostics[0].mainIssue, "Usable official records returned");
  assert.equal(diagnostics[2].actionNeeded, "Review the requested dataset, series, and period");
  const serialized = JSON.stringify(diagnostics);
  assert.doesNotMatch(serialized, /SECRET_VALUE|\/tmp\/|api_key|stack|token=/i);
});

test("records partial provider failure without discarding successful-provider evidence", () => {
  const diagnostics = buildInternalProviderDiagnostics(reportFixture());
  assert.equal(diagnostics.find((item) => item.provider === "FRED")?.status, "success");
  assert.equal(diagnostics.find((item) => item.provider === "BEA")?.status, "timeout");
  assert.equal(diagnostics.find((item) => item.provider === "FRED")?.usableRecordsReturned, 2);
});

test("developer diagnostic report contains controlled results and no secret material", async () => {
  const report = await readFile(new URL("../../MARKET_DATA_DIAGNOSTIC_REPORT.md", import.meta.url), "utf8");
  assert.match(report, /\| FRED \| success \|/);
  assert.match(report, /\| BEA \| authenticationFailed \|/);
  assert.match(report, /\| Census \| authenticationFailed \|/);
  assert.doesNotMatch(report, /(?:gho_|sk-)[A-Za-z0-9_-]+|[?&](?:api_?key|token)=|\/Users\/|\/tmp\/|stack trace/i);
});
