import { NextResponse } from "next/server";
import {
  runShellMetricValidation,
  SHELL_2025_20F_URL,
  SHELL_VERIFIED_COMPANY_FACTS,
  SHELL_VERIFIED_FILING_EXCERPT,
} from "../../lib/shell-metric-validation";
import type { CompanyFactsPayload } from "../../lib/metric-locator-types";
import { registryFromLocatorAudit } from "../../lib/canonical-metrics";
import { secClient } from "../../lib/sec-client";

export const runtime = "nodejs";

async function officialShellInputs() {
  const [companyFacts, filingHtml] = await Promise.all([
    secClient.getCompanyFacts<CompanyFactsPayload>("0001306965"),
    secClient.getFilingDocument(SHELL_2025_20F_URL),
  ]);
  return {
    companyFacts,
    filingHtml,
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
