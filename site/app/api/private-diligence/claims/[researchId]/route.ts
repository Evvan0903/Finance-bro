import { NextResponse } from "next/server";
import { privateDiligenceStore } from "../../../../lib/private-diligence/persistence/researchStore";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ researchId: string }> }) {
  const { researchId } = await context.params;
  const report = (await privateDiligenceStore.get(researchId))?.report;
  if (!report) return NextResponse.json({ code: "REPORT_NOT_FOUND", message: "Claim register was not found" }, { status: 404 });
  return NextResponse.json({ researchId, claims: report.claims });
}
