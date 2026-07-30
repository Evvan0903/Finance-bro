import { NextResponse } from "next/server";
import { buildProviderPlan } from "../../../lib/market-analysis/analysis/researchPlan";
import { buildMarketDefinition } from "../../../lib/market-analysis/industries/industryMapping";
import {
  parseCandidates,
  parseMarketScope,
} from "../../../lib/market-analysis/schemas/marketScope";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const scope = parseMarketScope(body?.scope);
    const candidates = parseCandidates(body?.candidates);
    const definition = buildMarketDefinition(scope, candidates, Array.isArray(body?.limitations) ? body.limitations : []);
    return NextResponse.json({
      marketDefinition: definition,
      providerPlan: buildProviderPlan(scope, definition),
    });
  } catch (error) {
    return NextResponse.json({
      code: "INVALID_CONFIRMED_SCOPE",
      message: error instanceof Error ? error.message : "Invalid confirmed scope",
    }, { status: 400 });
  }
}
