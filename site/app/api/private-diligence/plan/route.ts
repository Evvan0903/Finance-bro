import { NextResponse } from "next/server";
import { privateDiligenceStore } from "../../../lib/private-diligence/persistence/researchStore";
import { buildPrivateDiligenceProviderPlan } from "../../../lib/private-diligence/planning/researchPlanner";
import { buildQuickCompanyIntelligencePlan } from "../../../lib/private-diligence/planning/quickResearchPlanner";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const researchId = typeof body?.researchId === "string" ? body.researchId : "";
  const record = privateDiligenceStore.get(researchId);
  if (!record?.identityGraph) {
    return NextResponse.json({ code: "ENTITY_CONFIRMATION_REQUIRED", message: "Confirm the target company before provider planning" }, { status: 409 });
  }
  const plan = record.input.workflowMode === "quick"
    ? buildQuickCompanyIntelligencePlan(record.input, record.identityGraph)
    : buildPrivateDiligenceProviderPlan(record.input, record.identityGraph);
  privateDiligenceStore.update(researchId, { providerPlan: plan });
  return NextResponse.json({ researchId, plan });
}
