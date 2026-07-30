import { NextResponse } from "next/server";
import { marketResearchStore } from "../../../../lib/market-analysis/persistence/researchStore";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ researchId: string }> },
) {
  const { researchId } = await context.params;
  const record = marketResearchStore.get(researchId);
  if (!record) return NextResponse.json({ code: "RESEARCH_NOT_FOUND" }, { status: 404 });
  if (!record.report) {
    return NextResponse.json({
      researchId,
      status: record.stageStatus,
      message: record.error ?? "Report is not ready",
    }, { status: 202 });
  }
  return NextResponse.json({ researchId, report: record.report });
}
