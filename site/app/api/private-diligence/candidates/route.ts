import { NextResponse } from "next/server";
import { discoverEntityCandidates } from "../../../lib/private-diligence/entity-resolution/candidateDiscovery";
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
    const candidates = await discoverEntityCandidates(researchId, input);
    const now = new Date().toISOString();
    const record: PrivateDiligenceResearchRecord = {
      researchId, createdAt: now, updatedAt: now,
      stage: "entityResolution",
      stageStatus: "requiresConfirmation",
      input, candidates,
      confirmedCandidate: null,
      identityGraph: null,
      providerPlan: [], providerResults: [], rawEvidence: [], normalizedEvidence: [], report: null, errorCode: null,
    };
    privateDiligenceStore.set(record);
    const plausible = candidates.filter((candidate) => candidate.resolutionStatus !== "unresolved");
    return NextResponse.json({
      researchId,
      candidates: plausible,
      requiresUserConfirmation: true,
      needsMoreInformation: plausible.length === 0,
      message: plausible.length ? null : "Provide a website, location, or founder to distinguish the target entity",
      persistenceNotice: PRIVATE_DILIGENCE_PERSISTENCE_NOTICE,
    });
  } catch {
    return NextResponse.json({
      code: "INVALID_PRIVATE_COMPANY_INPUT",
      message: "Clara could not validate the company identifiers provided",
    }, { status: 400 });
  }
}
