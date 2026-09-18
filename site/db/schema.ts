// Clara persistence tables. The active application uses this schema with
// Turso/LibSQL; the retained Cloudflare adapter is not part of Vercel runtime.
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const researchRequests = sqliteTable("research_requests", {
  id: text("id").primaryKey(),
  workflowType: text("workflow_type").notNull(),
  originalCompanyName: text("original_company_name"),
  originalWebsite: text("original_website"),
  status: text("status").notNull(),
  recordJson: text("record_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const entityCandidates = sqliteTable("entity_candidates", {
  id: text("id").primaryKey(),
  researchRequestId: text("research_request_id").notNull().references(() => researchRequests.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  legalName: text("legal_name"),
  website: text("website"),
  location: text("location"),
  industry: text("industry"),
  relationshipType: text("relationship_type").notNull(),
  confidence: text("confidence").notNull(),
  matchReasonsJson: text("match_reasons_json").notNull(),
  provenanceJson: text("provenance_json").notNull(),
  selectable: integer("selectable", { mode: "boolean" }).notNull(),
  candidateJson: text("candidate_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const selectedTargets = sqliteTable("selected_targets", {
  researchRequestId: text("research_request_id").primaryKey().references(() => researchRequests.id, { onDelete: "cascade" }),
  candidateId: text("candidate_id").notNull().references(() => entityCandidates.id),
  selectionStatus: text("selection_status").notNull(),
  selectedAt: text("selected_at").notNull(),
  identityVerificationStatus: text("identity_verification_status").notNull(),
  identityConfidence: text("identity_confidence").notNull(),
});

// Hiring snapshots are append-only by run so future Clara workflows can compare
// observed public roles without conflating retrieval failures with zero openings.
export const hiringResearchRuns = sqliteTable("hiring_research_runs", {
  id: text("id").primaryKey(),
  researchRequestId: text("research_request_id").notNull().references(() => researchRequests.id, { onDelete: "cascade" }),
  companyId: text("company_id").notNull(),
  status: text("status").notNull(),
  sourceUrl: text("source_url"),
  adapter: text("adapter"),
  retrievedAt: text("retrieved_at").notNull(),
  resultJson: text("result_json").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("hiring_research_runs_request_idx").on(table.researchRequestId, table.retrievedAt),
]);

export const hiringJobPostings = sqliteTable("hiring_job_postings", {
  id: text("id").primaryKey(),
  hiringRunId: text("hiring_run_id").notNull().references(() => hiringResearchRuns.id, { onDelete: "cascade" }),
  jobId: text("job_id").notNull(),
  companyId: text("company_id").notNull(),
  title: text("title").notNull(),
  location: text("location"),
  country: text("country"),
  remote: integer("remote", { mode: "boolean" }),
  function: text("function"),
  seniority: text("seniority"),
  sourceUrl: text("source_url").notNull(),
  sourceType: text("source_type").notNull(),
  sourceJobId: text("source_job_id"),
  postedAt: text("posted_at"),
  retrievedAt: text("retrieved_at").notNull(),
  jobJson: text("job_json").notNull(),
}, (table) => [
  index("hiring_job_postings_company_idx").on(table.companyId, table.retrievedAt),
]);

// ResearchState is objective-scoped rather than company-scoped: two objectives
// for the same confirmed entity remain separate, durable research sessions.
export const claraResearchStates = sqliteTable("clara_research_states", {
  id: text("id").primaryKey(),
  researchRequestId: text("research_request_id"),
  companyId: text("company_id"),
  objective: text("objective").notNull(),
  status: text("status").notNull(),
  stateJson: text("state_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("clara_research_states_company_idx").on(table.companyId, table.updatedAt),
  index("clara_research_states_request_idx").on(table.researchRequestId, table.updatedAt),
]);

export const claraToolExecutions = sqliteTable("clara_tool_executions", {
  id: text("id").primaryKey(),
  researchStateId: text("research_state_id").notNull().references(() => claraResearchStates.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  attempt: integer("attempt").notNull(),
  status: text("status").notNull(),
  inputJson: text("input_json").notNull(),
  observationsJson: text("observations_json").notNull(),
  gapsJson: text("gaps_json").notNull(),
  resolvedGapCodesJson: text("resolved_gap_codes_json").notNull(),
  evidenceRefsJson: text("evidence_refs_json").notNull(),
  errorsJson: text("errors_json").notNull(),
  metadataJson: text("metadata_json").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at").notNull(),
}, (table) => [
  index("clara_tool_executions_state_time_idx").on(table.researchStateId, table.startedAt),
  index("clara_tool_executions_state_tool_idx").on(table.researchStateId, table.toolName, table.attempt),
]);
