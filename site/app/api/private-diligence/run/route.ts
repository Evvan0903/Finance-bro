import { NextResponse } from "next/server";
import { PrivateDiligenceEngineError, runPrivateDiligence } from "../../../lib/private-diligence/engine";
import { privateDiligenceStore } from "../../../lib/private-diligence/persistence/researchStore";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const researchId = typeof body?.researchId === "string" ? body.researchId : "";
  const record = await privateDiligenceStore.get(researchId);
  if (!record?.identityGraph || !record.confirmedCandidate) {
    return NextResponse.json({ code: "ENTITY_CONFIRMATION_REQUIRED", message: "Confirm the target company before generating a report" }, { status: 409 });
  }
  try {
    await privateDiligenceStore.update(researchId, { stage: "sourceRetrieval", stageStatus: "running" });
    const result = await runPrivateDiligence(researchId, record.input, record.identityGraph);
    await privateDiligenceStore.update(researchId, {
      stage: "reportValidation", stageStatus: "complete",
      providerPlan: result.providerPlan,
      providerResults: result.providerResults,
      rawEvidence: result.rawEvidence,
      normalizedEvidence: result.normalizedEvidence,
      report: result.report,
      errorCode: null,
    });
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
