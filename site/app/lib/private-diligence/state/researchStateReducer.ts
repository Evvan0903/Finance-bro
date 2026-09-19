import type { RawEvidence } from "../types";
import type { ClaraToolResult, ResearchGap, ToolObservation } from "../tools/types";
import type { ResearchEvidenceReference, ResearchObservation, ResearchState, ResearchStateGap, ToolExecutionRecord } from "./types";

const UNSUPPORTED_CONCLUSION = /\b(?:growing rapidly|business is healthy|strong management|attractive investment|investment attractiveness|future performance)\b/i;

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function researchGapKey(toolName: string, gap: Pick<ResearchGap, "code" | "topic">) {
  return `${normalize(toolName)}:${normalize(gap.code)}:${normalize(gap.topic)}`;
}

export function evidenceReference(evidence: RawEvidence, executionId: string): ResearchEvidenceReference {
  return {
    evidenceId: evidence.evidenceId,
    toolExecutionId: executionId,
    entityId: evidence.entityId,
    evidenceType: evidence.sourceType,
    sourceTitle: evidence.sourceTitle,
    sourceUrl: evidence.publicReferenceUrl,
    retrievedAt: evidence.retrievedAt,
    companyReported: evidence.companyReported,
    officialRecord: evidence.officialRecord,
    independentlyPublished: evidence.independentlyPublished,
  };
}

export function groundedObservations(observations: ToolObservation[]) {
  return observations.filter((observation) =>
    Boolean(observation.code.trim() && observation.topic.trim() && observation.description.trim()) &&
    !UNSUPPORTED_CONCLUSION.test(observation.description));
}

export function toolExecutionFromResult(args: {
  id: string;
  researchStateId: string;
  toolName: string;
  attempt: number;
  input: Record<string, unknown>;
  result: ClaraToolResult<unknown>;
}): ToolExecutionRecord {
  const failed = args.result.status === "failed";
  const observations = failed ? [] : groundedObservations(args.result.observations);
  const evidenceRefs = failed ? [] : args.result.evidence.map((item) => evidenceReference(item, args.id));
  return {
    id: args.id,
    researchStateId: args.researchStateId,
    toolName: args.toolName,
    attempt: args.attempt,
    input: args.input,
    status: args.result.status,
    startedAt: args.result.metadata.startedAt,
    completedAt: args.result.metadata.completedAt,
    observations,
    gaps: args.result.gaps,
    resolvedGapCodes: [...new Set(args.result.resolvedGapCodes ?? [])],
    evidenceRefs,
    errors: args.result.errors,
    metadata: args.result.metadata,
  };
}

function mergeObservations(state: ResearchState, execution: ToolExecutionRecord): ResearchObservation[] {
  const output = new Map(state.observations.map((item) => [
    `${item.code}|${item.topic}|${item.description}|${item.evidenceIds.slice().sort().join(",")}`,
    item,
  ]));
  for (const observation of execution.observations) {
    const item: ResearchObservation = { ...observation, toolExecutionId: execution.id, observedAt: execution.completedAt };
    output.set(`${item.code}|${item.topic}|${item.description}|${item.evidenceIds.slice().sort().join(",")}`, item);
  }
  return [...output.values()];
}

function mergeEvidenceReferences(state: ResearchState, execution: ToolExecutionRecord) {
  const output = new Map(state.evidenceRefs.map((item) => [`${item.toolExecutionId}:${item.evidenceId}`, item]));
  for (const reference of execution.evidenceRefs) output.set(`${reference.toolExecutionId}:${reference.evidenceId}`, reference);
  return [...output.values()];
}

function mergeGaps(state: ResearchState, execution: ToolExecutionRecord): ResearchStateGap[] {
  const output = new Map(state.gaps.map((gap) => [gap.key, { ...gap }]));
  const reportedKeys = new Set(execution.gaps.map((gap) => researchGapKey(execution.toolName, gap)));
  const resolvedCodes = new Set(execution.resolvedGapCodes.map(normalize));
  for (const gap of output.values()) {
    if (gap.code.startsWith('verification:')) continue; // Only a new deterministic decision can resolve this gap.
    const resolvedExplicitly = resolvedCodes.has(normalize(gap.code));
    const resolvedBySuccessfulRetry = execution.status === "success" && gap.sourceToolName === execution.toolName && !reportedKeys.has(gap.key);
    if (gap.status === "open" && (resolvedExplicitly || resolvedBySuccessfulRetry)) {
      gap.status = "resolved";
      gap.resolvedAt = execution.completedAt;
      gap.updatedAt = execution.completedAt;
      gap.lastExecutionId = execution.id;
    }
  }
  for (const gap of execution.gaps) {
    const key = researchGapKey(execution.toolName, gap);
    const existing = output.get(key);
    output.set(key, {
      ...gap,
      key,
      sourceToolName: execution.toolName,
      status: "open",
      createdAt: existing?.createdAt ?? execution.completedAt,
      updatedAt: execution.completedAt,
      resolvedAt: null,
      lastExecutionId: execution.id,
    });
  }
  return [...output.values()];
}

function nextStatus(state: ResearchState, execution: ToolExecutionRecord, gaps: ResearchStateGap[]) {
  if (state.status === "completed" || state.status === "failed") return state.status;
  const usefulResearch = state.observations.length + state.evidenceRefs.length + execution.observations.length + execution.evidenceRefs.length > 0;
  const importantOpenGap = gaps.some((gap) => gap.status === "open" && gap.severity !== "low");
  if (execution.status === "partial" || (execution.status === "failed" && usefulResearch) || (usefulResearch && importantOpenGap)) return "partial" as const;
  return "researching" as const;
}

export function applyToolExecutionToResearchState(state: ResearchState, execution: ToolExecutionRecord): ResearchState {
  if (execution.researchStateId !== state.id) throw new Error("Tool execution does not belong to this ResearchState");
  const gaps = mergeGaps(state, execution);
  const findings = new Map((state.verification?.findings ?? []).map(f=>[f.id,f]));
  const history = [...(state.verificationHistory ?? [])];
  const incoming = [...(execution.metadata.verification?.findings ?? [])];
  // A disproved issuer invalidates its earlier dependent facts even when no new filing is fetched.
  // Promotions require fresh field evaluation; an issuer decision alone never promotes a field.
  for (const issuer of incoming.filter(f=>f.domain==='sec_identity'&&f.verification.status!=='verified')) {
    const cik=issuer.id.replace(/^sec:/,'').replace(/^0+/,'');
    for (const prior of findings.values()) if(prior.issuerCik?.replace(/^0+/,'')===cik&&!incoming.some(f=>f.id===prior.id)) {
      incoming.push({...prior,verification:{...issuer.verification,reasonCodes:[...issuer.verification.reasonCodes,'dependent_issuer_not_verified']}});
    }
  }
  for (const finding of incoming) {
    const previous = findings.get(finding.id);
    const signature = (value: typeof finding.verification) => JSON.stringify({...value,evaluatedAt:undefined});
    if(!previous || signature(previous.verification)!==signature(finding.verification)) history.push({findingId:finding.id,previousStatus:previous?.verification.status??null,newStatus:finding.verification.status,reasonCodes:finding.verification.reasonCodes,supportingEvidenceIds:finding.verification.supportingEvidenceIds,conflictingEvidenceIds:finding.verification.conflictingEvidenceIds,missingRequirements:finding.verification.missingRequirements,evaluatedAt:finding.verification.evaluatedAt,executionId:execution.id});
    findings.set(finding.id,finding);
    const code=`verification:${finding.id}`,key=researchGapKey('evidence_verification',{code,topic:finding.domain});
    const existing=gaps.find(g=>g.key===key);
    if(finding.verification.status==='unverified') {
      const next: ResearchStateGap={key,code,topic:finding.domain,description:finding.verification.missingRequirements.join('; ')||finding.verification.reasonCodes.join('; '),severity:'medium',retryable:true,sourceToolName:'evidence_verification',status:'open',createdAt:existing?.createdAt??execution.completedAt,updatedAt:execution.completedAt,resolvedAt:null,lastExecutionId:execution.id};
      if(existing)Object.assign(existing,next);else gaps.push(next);
    } else if(existing)Object.assign(existing,{status:'resolved',updatedAt:execution.completedAt,resolvedAt:execution.completedAt,lastExecutionId:execution.id});
  }
  return {
    ...state,
    status: nextStatus(state, execution, gaps),
    observations: mergeObservations(state, execution),
    gaps,
    evidenceRefs: mergeEvidenceReferences(state, execution),
    verification: {version:1,evaluatedAt:execution.completedAt,findings:[...findings.values()]},
    verificationHistory: history,
    researchProgress: execution.toolName === 'evidence_verification' && execution.metadata.research
      ? execution.metadata.research : state.researchProgress,
    executionIds: [...state.executionIds, execution.id],
    updatedAt: execution.completedAt,
  };
}
