import { NextResponse } from "next/server";
import { discoverEntityCandidates } from "../../../lib/private-diligence/entity-resolution/candidateDiscovery";
import { buildIdentityGraph } from "../../../lib/private-diligence/entity-resolution/identityGraphBuilder";
import { getEntityConfirmationEligibility } from "../../../lib/private-diligence/entity-resolution/entityMatcher";
import { privateDiligenceStore, PRIVATE_DILIGENCE_PERSISTENCE_NOTICE } from "../../../lib/private-diligence/persistence/researchStore";
import { parsePrivateCompanyInput } from "../../../lib/private-diligence/schema";
import type { PrivateDiligenceResearchRecord } from "../../../lib/private-diligence/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const researchId = crypto.randomUUID();
  try {
    const body = await request.json();
    const input = parsePrivateCompanyInput(body?.input ?? body);
    const discovery = await discoverEntityCandidates(researchId, input);
    const candidates = discovery.candidates;
    const plausible = candidates.filter((candidate) => getEntityConfirmationEligibility(candidate, true).canConfirm);
    const autoConfirmed = plausible.length === 1 && getEntityConfirmationEligibility(plausible[0]).autoConfirm
      ? { ...plausible[0], targetSelectionStatus: "autoSelected" as const }
      : null;
    const identityGraph = autoConfirmed ? buildIdentityGraph(autoConfirmed, input) : null;
    const now = new Date().toISOString();
    const record: PrivateDiligenceResearchRecord = {
      researchId, createdAt: now, updatedAt: now,
      stage: autoConfirmed ? "providerPlanning" : "entityResolution",
      stageStatus: autoConfirmed ? "running" : "requiresConfirmation",
      input, candidates,
      confirmedCandidate: autoConfirmed,
      identityGraph,
      providerPlan: [], providerResults: [], rawEvidence: discovery.websiteEvidence, normalizedEvidence: [], report: null, errorCode: null,
    };
    privateDiligenceStore.set(record);
    const message = discovery.websiteStatus === "unreachable"
      ? "Clara could not verify the company website. Add a company name, location, or founder and try again"
      : discovery.websiteStatus === "insufficientIdentity"
        ? "Clara could not identify a company from this website. Add a company name, location, or founder"
        : plausible.length ? null : "Provide a website, location, or founder to distinguish the target entity";
    return NextResponse.json({
      researchId,
      candidates: plausible,
      autoConfirmedCandidateId: autoConfirmed?.candidateId ?? null,
      requiresUserConfirmation: !autoConfirmed && plausible.length > 0,
      needsMoreInformation: plausible.length === 0,
      message,
      persistenceNotice: PRIVATE_DILIGENCE_PERSISTENCE_NOTICE,
    });
  } catch {
    return NextResponse.json({
      code: "INVALID_PRIVATE_COMPANY_INPUT",
      message: "Clara could not validate the company identifiers provided",
    }, { status: 400 });
  }
}
