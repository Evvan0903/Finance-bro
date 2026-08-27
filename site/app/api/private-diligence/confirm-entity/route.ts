import { NextResponse } from "next/server";
import { buildIdentityGraph } from "../../../lib/private-diligence/entity-resolution/identityGraphBuilder";
import { candidateBelongsToResearch } from "../../../lib/private-diligence/entity-resolution/candidateSelection";
import { canSelectTarget, getEntityConfirmationEligibility } from "../../../lib/private-diligence/entity-resolution/entityMatcher";
import { privateDiligenceStore } from "../../../lib/private-diligence/persistence/researchStore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const researchId = typeof body?.researchRequestId === "string" ? body.researchRequestId : "";
    const candidateId = typeof body?.candidateId === "string" ? body.candidateId : "";
    const explicitUserConfirmation = body?.explicitUserConfirmation === true;
    const [record, candidate] = await Promise.all([
      privateDiligenceStore.get(researchId),
      privateDiligenceStore.getCandidate(researchId, candidateId),
    ]);
    if (!record || !candidate || !explicitUserConfirmation) {
      return NextResponse.json({ code: "TARGET_CANDIDATE_NOT_FOUND", message: "The selected candidate does not belong to this research request" }, { status: 404 });
    }
    const ownershipMatches = record.researchId === researchId && candidateBelongsToResearch(candidate, researchId);
    if (!ownershipMatches) {
      if (process.env.NODE_ENV !== "production") console.info(JSON.stringify({ event: "clara_target_ownership_diagnostic", incomingResearchRequestId: researchId, incomingCandidateId: candidateId, loadedResearchRequestId: record.researchId, loadedCandidateId: candidate.candidateId, candidateResearchRequestId: candidate.researchRequestId, ownershipMatches: false }));
      return NextResponse.json({ code: "TARGET_CANDIDATE_OWNERSHIP_MISMATCH", message: "The selected candidate does not belong to this research request" }, { status: 409 });
    }
    const frontendEligibility = getEntityConfirmationEligibility(candidate, true);
    const backendEligibility = canSelectTarget(candidate, true);
    if (!backendEligibility.selectable) {
      if (process.env.NODE_ENV !== "production") console.info(JSON.stringify({ event: "clara_target_selection_diagnostic", researchId, candidateId, candidateStatus: candidate.resolutionStatus, candidateConfidence: candidate.matchConfidence, candidateScore: candidate.matchScore, selectable: false, frontendEligibility: frontendEligibility.canConfirm, backendEligibility: false, targetSelectionResult: "rejected", researchSessionCreated: false }));
      return NextResponse.json({ code: "TARGET_SELECTION_REJECTED", message: "This candidate cannot be selected because its discovery provenance is invalid or it was classified as unrelated" }, { status: 409 });
    }
    const confirmed = { ...candidate, resolutionStatus: "userConfirmed" as const, targetSelectionStatus: "userSelected" as const };
    const graph = buildIdentityGraph(confirmed, record.input);
    await privateDiligenceStore.persistSelection(researchId, confirmed, {
      confirmedCandidate: confirmed,
      identityGraph: graph,
      stage: "providerPlanning",
      stageStatus: "running",
    });
    if (process.env.NODE_ENV !== "production") console.info(JSON.stringify({ event: "clara_target_selection_diagnostic", incomingResearchRequestId: researchId, incomingCandidateId: candidateId, loadedResearchRequestId: record.researchId, loadedCandidateId: candidate.candidateId, candidateResearchRequestId: candidate.researchRequestId, ownershipMatches, explicitUserConfirmation, candidateStatus: candidate.resolutionStatus, candidateConfidence: candidate.matchConfidence, candidateScore: candidate.matchScore, selectable: true, frontendEligibility: frontendEligibility.canConfirm, backendEligibility: true, targetSelectionResult: "userSelected", researchSessionCreated: true, selectionPersisted: true, researchStarted: true }));
    return NextResponse.json({ researchRequestId: researchId, entity: graph, targetSelectionStatus: graph.targetSelectionStatus, identityVerificationStatus: graph.identityVerificationStatus });
  } catch {
    return NextResponse.json({ code: "ENTITY_CONFIRMATION_FAILED", message: "Clara could not confirm the selected target" }, { status: 400 });
  }
}
