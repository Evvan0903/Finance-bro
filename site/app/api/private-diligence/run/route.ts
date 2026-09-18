import { researchStateStore } from "../../../lib/private-diligence/state/researchStateStore";
import { NextResponse } from "next/server";
import { PrivateDiligenceEngineError, runPrivateDiligence } from "../../../lib/private-diligence/engine";
import { privateDiligenceStore } from "../../../lib/private-diligence/persistence/researchStore";
import { hasLockedConfirmedTarget } from "../../../lib/private-diligence/entity-resolution/candidateSelection";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const researchId = typeof body?.researchId === "string" ? body.researchId : "";
  const record = await privateDiligenceStore.get(researchId);
  const graph = record?.identityGraph ?? null;
  if (!record || !graph || !hasLockedConfirmedTarget(record)) {
    return NextResponse.json({ code: "ENTITY_CONFIRMATION_REQUIRED", message: "Confirm the target company before generating a report" }, { status: 409 });
  }
  if (record.stageStatus === "complete" && record.report) {
    return NextResponse.json({ researchId, report: record.report, alreadyComplete: true });
  }
  if (record.stage === "sourceRetrieval" && record.stageStatus === "running") {
    return NextResponse.json({ code: "RESEARCH_ALREADY_RUNNING", message: "Research is already running for this confirmed target" }, { status: 409 });
  }
  try {
    await privateDiligenceStore.update(researchId, { stage: "sourceRetrieval", stageStatus: "running" });
    const state = await researchStateStore.createResearchState({ objective: "Resolve the confirmed company’s business, people, funding, hiring and dated developments using bounded public-source research", researchRequestId: researchId, identityGraph: graph });
    const result = await runPrivateDiligence(researchId, record.input, graph, { researchStateId: state.id });
    await privateDiligenceStore.update(researchId, {
      stage: "reportValidation", stageStatus: "complete",
      legalEntityDiscovery: result.legalEntityDiscovery,
      providerPlan: result.providerPlan,
      providerResults: result.providerResults,
      rawEvidence: result.rawEvidence,
      normalizedEvidence: result.normalizedEvidence,
      hiringIntelligence: result.hiringIntelligence,
      report: result.report,
      errorCode: null,
    });
    if (result.hiringIntelligence) {
      await privateDiligenceStore.persistHiringActivity(researchId, result.hiringIntelligence);
    }
    await researchStateStore.updateResearchState(state.id, { status: "completed" });
    console.info(JSON.stringify({
      event: "clara_private_diligence_diagnostics",
      researchId,
      providers: result.providerResults.map((item) => item.diagnostic),
    }));
    return NextResponse.json({ researchId, report: result.report });
  } catch (error) {
    const known = error instanceof PrivateDiligenceEngineError;
    const code = known ? error.code : "PRIVATE_DILIGENCE_FAILED";
    await privateDiligenceStore.update(researchId, { stageStatus: "failed", errorCode: code });
    return NextResponse.json({
      code,
      message: error instanceof PrivateDiligenceEngineError
        ? error.message
        : "Clara could not complete the public-source review",
    }, { status: known ? 422 : 500 });
  }
}
