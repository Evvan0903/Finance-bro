import { ResearchBudget } from "../../../lib/private-diligence/research/budget";
import { NextResponse } from "next/server";
import { discoverEntityCandidates } from "../../../lib/private-diligence/entity-resolution/candidateDiscovery";
import { getEntityConfirmationEligibility } from "../../../lib/private-diligence/entity-resolution/entityMatcher";
import { privateDiligenceStore, PRIVATE_DILIGENCE_PERSISTENCE_NOTICE } from "../../../lib/private-diligence/persistence/researchStore";
import { parsePrivateCompanyInput } from "../../../lib/private-diligence/schema";
import type { PrivateDiligenceResearchRecord } from "../../../lib/private-diligence/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const researchId = crypto.randomUUID();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID_PRIVATE_COMPANY_INPUT", message: "Clara could not read the company search request" }, { status: 400 });
  }
  let input;
  try {
    const payload = body as { input?: unknown } | null;
    input = parsePrivateCompanyInput(payload?.input ?? body);
  } catch {
    return NextResponse.json({ code: "INVALID_PRIVATE_COMPANY_INPUT", message: "Clara could not validate the company identifiers provided" }, { status: 400 });
  }
  try {
    const budget = new ResearchBudget(Date.now() + 24_000);
    const discovery = await discoverEntityCandidates(researchId, input, {fetchImpl:budget.fetch(),timeoutMs:4000,maxPages:6});
    const candidates = discovery.candidates;
    const plausible = candidates.filter((candidate) => getEntityConfirmationEligibility(candidate, true).canConfirm);
    const now = new Date().toISOString();
    const record: PrivateDiligenceResearchRecord = {
      researchId, createdAt: now, updatedAt: now,
      stage: "entityResolution",
      stageStatus: "requiresConfirmation",
      input, candidates,
      confirmedCandidate: null,
      identityGraph: null,
      providerPlan: [], providerResults: [], rawEvidence: discovery.websiteEvidence, normalizedEvidence: [], hiringIntelligence: null, report: null, errorCode: null,
    };
    await privateDiligenceStore.set(record);
    if (process.env.NODE_ENV !== "production") console.info(JSON.stringify({ event: "clara_candidate_discovery_diagnostic", researchRequestId: researchId, candidatesLength: plausible.length, candidateId: plausible[0]?.candidateId ?? null, candidateResearchRequestId: plausible[0]?.researchRequestId ?? null, initialSelectedCandidateId: plausible.length === 1 ? plausible[0].candidateId : null }));
    const message = plausible.length ? null : "Clara could not confidently identify the company from the information provided";
    return NextResponse.json({
      researchRequestId: researchId,
      discoveryUsage: budget.snapshot(),
      candidates: plausible,
      autoConfirmedCandidateId: null,
      requiresUserConfirmation: plausible.length > 0,
      needsMoreInformation: plausible.length === 0,
      message,
      persistenceNotice: PRIVATE_DILIGENCE_PERSISTENCE_NOTICE,
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "clara_candidate_discovery_failed", researchRequestId: researchId, error: error instanceof Error ? error.name : "UnknownError" }));
    return NextResponse.json({
      code: "CANDIDATE_DISCOVERY_FAILED",
      message: "Clara could not complete company discovery from the available public sources",
    }, { status: 502 });
  }
}
