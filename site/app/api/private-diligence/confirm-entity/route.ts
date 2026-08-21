import { NextResponse } from "next/server";
import { buildIdentityGraph } from "../../../lib/private-diligence/entity-resolution/identityGraphBuilder";
import { canSelectTarget, getEntityConfirmationEligibility, selectTargetCandidate } from "../../../lib/private-diligence/entity-resolution/entityMatcher";
import { privateDiligenceStore } from "../../../lib/private-diligence/persistence/researchStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const researchId = typeof body?.researchId === "string" ? body.researchId : "";
    const candidateId = typeof body?.candidateId === "string" ? body.candidateId : "";
    const record = privateDiligenceStore.get(researchId);
    const selection = record ? selectTargetCandidate(record.candidates, candidateId) : null;
    const candidate = selection?.candidate;
    if (!record || !candidate) {
      return NextResponse.json({ code: "TARGET_CANDIDATE_NOT_FOUND", message: "The selected candidate does not belong to this research request" }, { status: 404 });
    }
    const frontendEligibility = getEntityConfirmationEligibility(candidate, true);
    const backendEligibility = canSelectTarget(candidate, true);
    if (!backendEligibility.selectable) {
      console.info(JSON.stringify({ event: "clara_target_selection_diagnostic", researchId, candidateId, candidateStatus: candidate.resolutionStatus, candidateConfidence: candidate.matchConfidence, candidateScore: candidate.matchScore, selectable: false, frontendEligibility: frontendEligibility.canConfirm, backendEligibility: false, targetSelectionResult: "rejected", researchSessionCreated: false }));
      return NextResponse.json({ code: "TARGET_SELECTION_REJECTED", message: "This candidate cannot be selected because its discovery provenance is invalid or it was classified as unrelated" }, { status: 409 });
    }
    const confirmed = { ...candidate, resolutionStatus: "userConfirmed" as const, targetSelectionStatus: "userSelected" as const };
    const graph = buildIdentityGraph(confirmed, record.input);
    privateDiligenceStore.update(researchId, {
      confirmedCandidate: confirmed,
      identityGraph: graph,
      stage: "providerPlanning",
      stageStatus: "running",
    });
    console.info(JSON.stringify({ event: "clara_target_selection_diagnostic", researchId, candidateId, candidateStatus: candidate.resolutionStatus, candidateConfidence: candidate.matchConfidence, candidateScore: candidate.matchScore, selectable: true, frontendEligibility: frontendEligibility.canConfirm, backendEligibility: true, targetSelectionResult: "userSelected", researchSessionCreated: true }));
    return NextResponse.json({ researchId, entity: graph, targetSelectionStatus: graph.targetSelectionStatus, identityVerificationStatus: graph.identityVerificationStatus });
  } catch {
    return NextResponse.json({ code: "ENTITY_CONFIRMATION_FAILED", message: "Clara could not confirm the selected target" }, { status: 400 });
  }
}
