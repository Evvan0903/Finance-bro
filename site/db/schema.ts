// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
