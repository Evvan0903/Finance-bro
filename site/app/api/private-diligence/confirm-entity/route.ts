import { NextResponse } from "next/server";
import { buildIdentityGraph } from "../../../lib/private-diligence/entity-resolution/identityGraphBuilder";
import { getEntityConfirmationEligibility } from "../../../lib/private-diligence/entity-resolution/entityMatcher";
import { privateDiligenceStore } from "../../../lib/private-diligence/persistence/researchStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const researchId = typeof body?.researchId === "string" ? body.researchId : "";
    const candidateId = typeof body?.candidateId === "string" ? body.candidateId : "";
    const record = privateDiligenceStore.get(researchId);
    const candidate = record?.candidates.find((item) => item.candidateId === candidateId);
    if (!record || !candidate || !getEntityConfirmationEligibility(candidate, true).canConfirm) {
      return NextResponse.json({ code: "ENTITY_CONFIRMATION_REQUIRED", message: "Additional identifying information is required before this target can be confirmed" }, { status: 409 });
    }
    const confirmed = { ...candidate, resolutionStatus: "userConfirmed" as const };
    const graph = buildIdentityGraph(confirmed, record.input);
    privateDiligenceStore.update(researchId, {
      confirmedCandidate: confirmed,
      identityGraph: graph,
      stage: "providerPlanning",
      stageStatus: "running",
    });
    return NextResponse.json({ researchId, entity: graph });
  } catch {
    return NextResponse.json({ code: "ENTITY_CONFIRMATION_FAILED", message: "Clara could not confirm the selected target" }, { status: 400 });
  }
}
