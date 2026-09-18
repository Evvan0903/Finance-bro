import type { MatchConfidence, TargetSelectionStatus } from "../types";
import type { ClaraToolResult, ClaraToolStatus, ResearchGap, ToolError, ToolObservation } from "../tools/types";

export type ResearchStateStatus = "initialized" | "researching" | "partial" | "completed" | "failed";

export type ConfirmedCompanyReference = {
  entityId: string;
  canonicalName: string;
  primaryDomain: string | null;
  identityConfidence: MatchConfidence;
  targetSelectionStatus: Extract<TargetSelectionStatus, "userSelected" | "autoSelected">;
};

export type ResearchEvidenceReference = {
  evidenceId: string;
  toolExecutionId: string;
  entityId: string;
  evidenceType: string;
  sourceTitle: string;
  sourceUrl: string;
  retrievedAt: string;
  companyReported: boolean;
  officialRecord: boolean;
  independentlyPublished: boolean;
};

export type ResearchObservation = ToolObservation & {
  toolExecutionId: string;
  observedAt: string;
};

export type ResearchStateGap = ResearchGap & {
  key: string;
  sourceToolName: string;
  status: "open" | "resolved";
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  lastExecutionId: string;
};

export type ResearchState = {
  verification?: import('../verification/types').VerificationLedger;
  verificationHistory?: import('../verification/types').VerificationTransition[];
  id: string;
  researchRequestId: string | null;
  objective: string;
  companyId: string | null;
  confirmedCompany: ConfirmedCompanyReference | null;
  status: ResearchStateStatus;
  observations: ResearchObservation[];
  gaps: ResearchStateGap[];
  evidenceRefs: ResearchEvidenceReference[];
  executionIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ToolExecutionRecord = {
  id: string;
  researchStateId: string;
  toolName: string;
  attempt: number;
  input: Record<string, unknown>;
  status: ClaraToolStatus;
  startedAt: string;
  completedAt: string;
  observations: ToolObservation[];
  gaps: ResearchGap[];
  resolvedGapCodes: string[];
  evidenceRefs: ResearchEvidenceReference[];
  errors: ToolError[];
  metadata: ClaraToolResult<unknown>["metadata"];
};
