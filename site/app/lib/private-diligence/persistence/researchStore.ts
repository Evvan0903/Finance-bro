import { createClient } from "@libsql/client";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { entityCandidates, hiringJobPostings, hiringResearchRuns, researchRequests, selectedTargets } from "../../../../db/schema";
import type { EntityCandidate, PrivateDiligenceResearchRecord } from "../types";
import type { HiringActivityResult } from "../hiring/types";

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
    `CREATE TABLE IF NOT EXISTS hiring_research_runs (id TEXT PRIMARY KEY NOT NULL, research_request_id TEXT NOT NULL REFERENCES research_requests(id) ON DELETE CASCADE, company_id TEXT NOT NULL, status TEXT NOT NULL, source_url TEXT, adapter TEXT, retrieved_at TEXT NOT NULL, result_json TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS hiring_research_runs_request_idx ON hiring_research_runs(research_request_id, retrieved_at)`,
    `CREATE TABLE IF NOT EXISTS hiring_job_postings (id TEXT PRIMARY KEY NOT NULL, hiring_run_id TEXT NOT NULL REFERENCES hiring_research_runs(id) ON DELETE CASCADE, job_id TEXT NOT NULL, company_id TEXT NOT NULL, title TEXT NOT NULL, location TEXT, country TEXT, remote INTEGER, function TEXT, seniority TEXT, source_url TEXT NOT NULL, source_type TEXT NOT NULL, source_job_id TEXT, posted_at TEXT, retrieved_at TEXT NOT NULL, job_json TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS hiring_job_postings_company_idx ON hiring_job_postings(company_id, retrieved_at)`,
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
  async persistSelection(researchId: string, candidate: EntityCandidate, selectedAt: string, recordUpdates: Partial<PrivateDiligenceResearchRecord>) {
    const next = await this.update(researchId, recordUpdates);
    if (!next) return null;
    const { db } = getConnection();
    await db.insert(selectedTargets).values({
      researchRequestId: researchId,
      candidateId: candidate.candidateId,
      selectionStatus: candidate.targetSelectionStatus ?? "userSelected",
      selectedAt,
      identityVerificationStatus: candidate.identityVerificationStatus ?? "unverified",
      identityConfidence: candidate.matchConfidence,
    }).onConflictDoUpdate({ target: selectedTargets.researchRequestId, set: {
      candidateId: candidate.candidateId,
      selectionStatus: candidate.targetSelectionStatus ?? "userSelected",
      selectedAt,
      identityVerificationStatus: candidate.identityVerificationStatus ?? "unverified",
      identityConfidence: candidate.matchConfidence,
    } });
    return next;
  },
  async persistHiringActivity(researchId: string, result: HiringActivityResult) {
    await ensureSchema();
    const existing = await this.get(researchId);
    if (!existing) return null;
    const { db } = getConnection();
    const now = new Date().toISOString();
    const runId = crypto.randomUUID();
    const retrievedAt = result.summary.sources[0]?.retrievedAt ?? now;
    await db.insert(hiringResearchRuns).values({
      id: runId,
      researchRequestId: researchId,
      companyId: result.companyId,
      status: result.status,
      sourceUrl: result.selectedSource?.url ?? null,
      adapter: result.adapter,
      retrievedAt,
      resultJson: JSON.stringify(result),
      createdAt: now,
    });
    if (result.jobs.length) {
      await db.insert(hiringJobPostings).values(result.jobs.map((job, index) => ({
        id: `${runId}:${index + 1}`,
        hiringRunId: runId,
        jobId: job.id,
        companyId: job.companyId,
        title: job.title,
        location: job.location ?? null,
        country: job.country ?? null,
        remote: job.remote ?? null,
        function: job.function ?? null,
        seniority: job.seniority ?? null,
        sourceUrl: job.sourceUrl,
        sourceType: job.sourceType,
        sourceJobId: job.sourceJobId ?? null,
        postedAt: job.postedAt ?? null,
        retrievedAt: job.retrievedAt,
        jobJson: JSON.stringify(job),
      })));
    }
    return this.update(researchId, { hiringIntelligence: result });
  },
};

export const PRIVATE_DILIGENCE_PERSISTENCE_NOTICE =
  "Clara research requests and candidate ownership are persisted in the configured server-side database.";
