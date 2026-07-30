import { NextResponse } from "next/server";
import { classificationCandidates } from "../../../lib/market-analysis/industries/industryCatalog";
import { parseMarketScope } from "../../../lib/market-analysis/schemas/marketScope";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const scope = parseMarketScope(body?.scope ?? body);
    const result = classificationCandidates(scope);
    return NextResponse.json({
      scope,
      ...result,
      requiresUserConfirmation: true,
    });
  } catch (error) {
    return NextResponse.json({
      code: "INVALID_MARKET_SCOPE",
      message: error instanceof Error ? error.message : "Invalid market scope",
    }, { status: 400 });
  }
}
