import { NextResponse } from "next/server";
import {
  runShellMetricValidation,
  SHELL_2025_20F_URL,
  SHELL_COMPANY_FACTS_URL,
  SHELL_VERIFIED_COMPANY_FACTS,
  SHELL_VERIFIED_FILING_EXCERPT,
} from "../../lib/shell-metric-validation";
import type { CompanyFactsPayload } from "../../lib/metric-locator-types";
import { registryFromLocatorAudit } from "../../lib/canonical-metrics";

export const runtime = "edge";

const SEC_HEADERS = {
  Accept: "application/json, text/html;q=0.9, */*;q=0.8",
  "User-Agent": "ScopeLine Research contact: research@example.com",
};

async function officialShellInputs() {
  const [factsResponse, filingResponse] = await Promise.all([
    fetch(SHELL_COMPANY_FACTS_URL, { headers: SEC_HEADERS }),
    fetch(SHELL_2025_20F_URL, { headers: SEC_HEADERS }),
  ]);
  if (!factsResponse.ok || !filingResponse.ok) {
    throw new Error(
      `Official source request failed: Company Facts ${factsResponse.status}; 20-F ${filingResponse.status}`,
    );
  }
  return {
    companyFacts: await factsResponse.json() as CompanyFactsPayload,
    filingHtml: await filingResponse.text(),
  };
}

export async function POST(request: Request) {
  let payload: { company?: string; fixture?: boolean };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const company = payload.company?.trim().toLowerCase();
  if (!company || !["shell", "shell plc", "shel"].includes(company)) {
    return NextResponse.json(
      { error: "This validation endpoint currently accepts only Shell plc or SHEL." },
      { status: 400 },
    );
  }

  let sourceMode: "official-live" | "verified-snapshot" =
    payload.fixture ? "verified-snapshot" : "official-live";
  let inputs = {
    companyFacts: SHELL_VERIFIED_COMPANY_FACTS,
    filingHtml: SHELL_VERIFIED_FILING_EXCERPT,
  };
  let sourceWarning: string | null = null;
  if (!payload.fixture) {
    try {
      inputs = await officialShellInputs();
    } catch (error) {
      sourceMode = "verified-snapshot";
      sourceWarning =
        error instanceof Error ? error.message : "Official source request failed.";
    }
  }

  const audit = runShellMetricValidation({
    ...inputs,
    verifiedSnapshot: sourceMode === "verified-snapshot",
  });
  const metricRegistry = registryFromLocatorAudit({
    audit,
    companyId: "SHEL",
    sector: "integrated-oil-gas",
    dataVersion: "shel-fy2025-20f-2026-03-12-v1",
  }).snapshot();
  return NextResponse.json({
    audit,
    metricRegistry,
    found: audit.results.filter((result) => result.found).map((result) => result.metricId),
    unresolved: audit.results.filter((result) => !result.found).map((result) => ({
      metricId: result.metricId,
      status: result.status,
      reason: result.reason,
    })),
    sourceMode,
    sourceWarning,
  });
}
