import { NextResponse } from "next/server";
import { privateDiligenceStore } from "../../../lib/private-diligence/persistence/researchStore";
import { buildPrivateDiligenceProviderPlan } from "../../../lib/private-diligence/planning/researchPlanner";
import { buildQuickCompanyIntelligencePlan } from "../../../lib/private-diligence/planning/quickResearchPlanner";
import { hasLockedConfirmedTarget } from "../../../lib/private-diligence/entity-resolution/candidateSelection";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const researchId = typeof body?.researchId === "string" ? body.researchId : "";
  const record = await privateDiligenceStore.get(researchId);
  const graph = record?.identityGraph ?? null;
  if (!record || !graph || !hasLockedConfirmedTarget(record)) {
    return NextResponse.json({ code: "ENTITY_CONFIRMATION_REQUIRED", message: "Confirm the target company before provider planning" }, { status: 409 });
  }
  if (record.stageStatus === "complete" && record.report) {
    return NextResponse.json({ researchId, plan: record.providerPlan, alreadyComplete: true });
  }
  const plan = record.input.workflowMode === "quick"
    ? buildQuickCompanyIntelligencePlan(record.input, graph)
    : buildPrivateDiligenceProviderPlan(record.input, graph);
  await privateDiligenceStore.update(researchId, { providerPlan: plan });
  return NextResponse.json({ researchId, plan });
}
