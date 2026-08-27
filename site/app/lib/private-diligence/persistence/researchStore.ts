import { createClient } from "@libsql/client";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { entityCandidates, researchRequests, selectedTargets } from "../../../../db/schema";
import type { EntityCandidate, PrivateDiligenceResearchRecord } from "../types";

const databaseUrl = process.env.TURSO_DATABASE_URL ?? process.env.LIBSQL_DATABASE_URL ??
  (process.env.VERCEL ? null : `file:${process.env.CLARA_LOCAL_DATABASE_PATH ?? "clara.db"}`);

let connection: { client: ReturnType<typeof createClient>; db: ReturnType<typeof drizzle> } | null = null;
let ready: Promise<void> | null = null;

function getConnection() {
  if (!databaseUrl) throw new Error("CLARA_DATABASE_NOT_CONFIGURED: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
  if (!connection) {
    const client = createClient({ url: databaseUrl, authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.LIBSQL_AUTH_TOKEN });
    connection = { client, db: drizzle(client) };
  }
  return connection;
}

function ensureSchema() {
  const { client } = getConnection();
  ready ??= client.batch([
    "PRAGMA foreign_keys = ON",
    `CREATE TABLE IF NOT EXISTS research_requests (id TEXT PRIMARY KEY NOT NULL, workflow_type TEXT NOT NULL, original_company_name TEXT, original_website TEXT, status TEXT NOT NULL, record_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS entity_candidates (id TEXT PRIMARY KEY NOT NULL, research_request_id TEXT NOT NULL REFERENCES research_requests(id) ON DELETE CASCADE, display_name TEXT NOT NULL, legal_name TEXT, website TEXT, location TEXT, industry TEXT, relationship_type TEXT NOT NULL, confidence TEXT NOT NULL, match_reasons_json TEXT NOT NULL, provenance_json TEXT NOT NULL, selectable INTEGER NOT NULL, candidate_json TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS entity_candidates_request_idx ON entity_candidates(research_request_id)`,
    `CREATE TABLE IF NOT EXISTS selected_targets (research_request_id TEXT PRIMARY KEY NOT NULL REFERENCES research_requests(id) ON DELETE CASCADE, candidate_id TEXT NOT NULL REFERENCES entity_candidates(id), selection_status TEXT NOT NULL, selected_at TEXT NOT NULL, identity_verification_status TEXT NOT NULL, identity_confidence TEXT NOT NULL)`,
  ], "write").then(() => undefined);
  return ready;
}

function parseRecord(value: string) {
  return JSON.parse(value) as PrivateDiligenceResearchRecord;
}

function parseCandidate(value: string) {
  return JSON.parse(value) as EntityCandidate;
}

function candidateLocation(candidate: EntityCandidate) {
  return [candidate.city, candidate.state, candidate.country].filter(Boolean).join(", ") || candidate.addresses[0] || null;
}

async function persistCandidate(candidate: EntityCandidate, createdAt: string) {
  const { db } = getConnection();
  await db.insert(entityCandidates).values({
    id: candidate.candidateId,
    researchRequestId: candidate.researchRequestId,
    displayName: candidate.displayName,
    legalName: candidate.legalName,
    website: candidate.website,
    location: candidateLocation(candidate),
    industry: candidate.industry,
    relationshipType: candidate.relationshipType ?? "Unknown relationship",
    confidence: candidate.matchConfidence,
    matchReasonsJson: JSON.stringify(candidate.matchSignals),
    provenanceJson: JSON.stringify({ sourceIds: candidate.sourceIds, websiteReachable: candidate.websiteReachable }),
    selectable: candidate.relationshipType !== "Likely unrelated",
    candidateJson: JSON.stringify(candidate),
    createdAt,
  }).onConflictDoUpdate({ target: entityCandidates.id, set: { candidateJson: JSON.stringify(candidate) } });
}

export const privateDiligenceStore = {
  async get(researchId: string) {
    await ensureSchema();
    const { db } = getConnection();
    const row = await db.select({ recordJson: researchRequests.recordJson }).from(researchRequests).where(eq(researchRequests.id, researchId)).get();
    return row ? parseRecord(row.recordJson) : null;
  },
  async getCandidate(researchId: string, candidateId: string) {
    await ensureSchema();
    const { db } = getConnection();
    const row = await db.select({ candidateJson: entityCandidates.candidateJson }).from(entityCandidates)
      .where(and(eq(entityCandidates.id, candidateId), eq(entityCandidates.researchRequestId, researchId))).get();
    return row ? parseCandidate(row.candidateJson) : null;
  },
  async set(record: PrivateDiligenceResearchRecord) {
    await ensureSchema();
    const { db } = getConnection();
    await db.insert(researchRequests).values({
      id: record.researchId,
      workflowType: record.input.workflowMode ?? "quick",
      originalCompanyName: record.input.companyName,
      originalWebsite: record.input.website,
      status: record.stageStatus,
      recordJson: JSON.stringify(record),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }).onConflictDoUpdate({ target: researchRequests.id, set: { status: record.stageStatus, recordJson: JSON.stringify(record), updatedAt: record.updatedAt } });
    await Promise.all(record.candidates.map((candidate) => persistCandidate(candidate, record.createdAt)));
    return record;
  },
  async update(researchId: string, updates: Partial<PrivateDiligenceResearchRecord>) {
    const existing = await this.get(researchId);
    if (!existing) return null;
    const next = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await this.set(next);
    return next;
  },
  async persistSelection(researchId: string, candidate: EntityCandidate, recordUpdates: Partial<PrivateDiligenceResearchRecord>) {
    const next = await this.update(researchId, recordUpdates);
    if (!next) return null;
    const { db } = getConnection();
    await db.insert(selectedTargets).values({
      researchRequestId: researchId,
      candidateId: candidate.candidateId,
      selectionStatus: candidate.targetSelectionStatus ?? "userSelected",
      selectedAt: new Date().toISOString(),
      identityVerificationStatus: candidate.identityVerificationStatus ?? "unverified",
      identityConfidence: candidate.matchConfidence,
    }).onConflictDoUpdate({ target: selectedTargets.researchRequestId, set: {
      candidateId: candidate.candidateId,
      selectionStatus: candidate.targetSelectionStatus ?? "userSelected",
      selectedAt: new Date().toISOString(),
      identityVerificationStatus: candidate.identityVerificationStatus ?? "unverified",
      identityConfidence: candidate.matchConfidence,
    } });
    return next;
  },
};

export const PRIVATE_DILIGENCE_PERSISTENCE_NOTICE =
  "Clara research requests and candidate ownership are persisted in the configured server-side database.";
