import type { EntityCandidate } from "../types";

export type ClaraConfirmationPayload = {
  researchId: string;
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

export function buildConfirmationPayload(
  researchId: string,
  selectedCandidateId: string | null,
): ClaraConfirmationPayload | null {
  if (!researchId.trim() || !selectedCandidateId?.trim()) return null;
  return {
    researchId,
    candidateId: selectedCandidateId,
    explicitUserConfirmation: true,
  };
}
