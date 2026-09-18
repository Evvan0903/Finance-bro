import type { ResearchEvidenceReference, ResearchStateGap } from "../state/types";

export type CoverageProfile = "general_company_research" | "hiring_research";
export type ResearchTopic = "company_identity" | "company_web_presence" | "hiring_activity";
export type TopicCoverageStatus = "covered" | "partial" | "missing" | "not_applicable";

export type TopicCoverage = {
  topic: ResearchTopic;
  status: TopicCoverageStatus;
  required: boolean;
  evidenceRefs: ResearchEvidenceReference[];
  supportingToolNames: string[];
  supportingExecutionIds: string[];
  activeGapKeys: string[];
  reasonCodes: string[];
};

export type CoverageBlocker = {
  code: "research_state_not_found" | "company_not_confirmed" | "required_topic_missing" | "required_topic_incomplete" | "high_severity_gap_open" | "required_tool_never_succeeded" | "evidence_unavailable";
  topic: ResearchTopic | null;
  message: string;
  retryable: boolean;
};

export type CoverageWarning = {
  code: "web_research_partial" | "hiring_research_partial" | "optional_topic_missing" | "only_company_reported_evidence" | "previous_tool_failures" | "active_research_gap" | "hiring_snapshot_persistence_partial";
  topic: ResearchTopic | null;
  message: string;
};

export type CoverageAssessment = {
  researchStateId: string;
  profile: CoverageProfile;
  overallStatus: "insufficient" | "partial" | "sufficient";
  readyToComplete: boolean;
  topics: TopicCoverage[];
  activeGaps: ResearchStateGap[];
  blockers: CoverageBlocker[];
  warnings: CoverageWarning[];
  summary: {
    coveredTopicCount: number;
    partialTopicCount: number;
    missingTopicCount: number;
    evidenceCount: number;
    successfulToolCount: number;
    failedToolCount: number;
  };
  evaluatedAt: string;
};
