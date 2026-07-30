import { NextResponse } from "next/server";
import { runMarketAnalysis } from "../../../lib/market-analysis/analysis/marketEngine";
import { buildProviderPlan } from "../../../lib/market-analysis/analysis/researchPlan";
import { MARKET_RESEARCH_PERSISTENCE_LIMITATION, marketResearchStore } from "../../../lib/market-analysis/persistence/researchStore";
import {
  parseMarketDefinition,
  parseMarketScope,
} from "../../../lib/market-analysis/schemas/marketScope";
import { sanitizeSecrets } from "../../../lib/market-analysis/security";
import type { MarketResearchRecord } from "../../../lib/market-analysis/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const researchId = crypto.randomUUID();
  try {
    const body = await request.json();
    const scope = parseMarketScope(body?.scope);
    const marketDefinition = parseMarketDefinition(body?.marketDefinition);
    const now = new Date().toISOString();
    const initial: MarketResearchRecord = {
      researchId,
      createdAt: now,
      updatedAt: now,
      request: scope,
      marketDefinition,
      providerPlan: buildProviderPlan(scope, marketDefinition, now),
      stage: "dataRetrieval",
      stageStatus: "running",
      providerResults: [],
      report: null,
      error: null,
    };
    marketResearchStore.set(initial);
    const report = await runMarketAnalysis(scope, marketDefinition, { researchId });
    marketResearchStore.update(researchId, {
      stage: "reportQa",
      stageStatus: report.qa.status === "failed" ? "failed" : "complete",
      providerResults: report.providerResults,
      report,
    });
    return NextResponse.json(sanitizeSecrets({
      researchId,
      report,
      persistenceNotice: MARKET_RESEARCH_PERSISTENCE_LIMITATION,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market analysis failed";
    marketResearchStore.update(researchId, {
      stageStatus: "failed",
      error: message,
    });
    const status = message === "Current official data unavailable" ? 503 : 400;
    return NextResponse.json(sanitizeSecrets({
      researchId,
      code: status === 503 ? "OFFICIAL_DATA_UNAVAILABLE" : "MARKET_ANALYSIS_FAILED",
      message,
    }), { status });
  }
}
