import type { EntityCandidate, PrivateDiligenceResearchRecord } from "../types";

export type ClaraConfirmationPayload = {
  researchRequestId: string;
  candidateId: string;
  explicitUserConfirmation: true;
};

export function initialSelectedCandidateId(candidates: EntityCandidate[]) {
  return candidates.length === 1 && candidates[0].candidateId.trim()
    ? candidates[0].candidateId
    : null;
}

export function selectCandidateId(candidates: EntityCandidate[], candidateId: string) {
  return candidates.some((candidate) => candidate.candidateId === candidateId)
    ? candidateId
    : null;
}

export function candidateBelongsToResearch(candidate: EntityCandidate, researchId: string) {
  return Boolean(researchId.trim()) && candidate.researchRequestId === researchId;
}

export function hasLockedConfirmedTarget(record: Pick<PrivateDiligenceResearchRecord, "confirmedCandidate" | "identityGraph">) {
  const candidate = record.confirmedCandidate;
  const graph = record.identityGraph;
  if (!candidate || !graph || graph.targetSelectionStatus !== "userSelected") return false;
  return graph.selectedCandidateId === candidate.candidateId &&
    graph.confirmedDisplayName === candidate.displayName &&
    graph.canonicalName === candidate.displayName &&
    (!candidate.domain || graph.domains.includes(candidate.domain));
}

export function buildConfirmationPayload(
  researchId: string,
  selectedCandidateId: string | null,
): ClaraConfirmationPayload | null {
  if (!researchId.trim() || !selectedCandidateId?.trim()) return null;
  return {
    researchRequestId: researchId,
    candidateId: selectedCandidateId,
    explicitUserConfirmation: true,
  };
}
