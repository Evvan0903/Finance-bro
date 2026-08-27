import { NextResponse } from "next/server";
import { privateDiligenceStore } from "../../../../lib/private-diligence/persistence/researchStore";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ researchId: string }> }) {
  const { researchId } = await context.params;
  const record = await privateDiligenceStore.get(researchId);
  if (!record) return NextResponse.json({ code: "RESEARCH_NOT_FOUND", message: "Research record was not found" }, { status: 404 });
  return NextResponse.json({ researchId, stage: record.stage, status: record.stageStatus, hasReport: Boolean(record.report) });
}
