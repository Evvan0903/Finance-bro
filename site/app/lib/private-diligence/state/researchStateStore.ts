import { createClient } from "@libsql/client";
import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { claraResearchStates, claraToolExecutions } from "../../../../db/schema";
import type { EntityIdentityGraph } from "../types";
import type { ClaraToolResult } from "../tools/types";
import { applyToolExecutionToResearchState, toolExecutionFromResult } from "./researchStateReducer";
import { sanitizeToolInput } from "./sanitizeToolInput";
import type { ConfirmedCompanyReference, ResearchState, ResearchStateStatus, ToolExecutionRecord } from "./types";
import { evaluateVerification, type VerificationInput } from '../verification/governance';
import { normalizeEvidenceRegistry } from '../evidence/evidenceRegistry';
import { buildClaimRegistry } from '../evidence/claimRegistry';
import { reconcileClaims } from '../evidence/claimReconciler';

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
    `CREATE TABLE IF NOT EXISTS clara_research_states (id TEXT PRIMARY KEY NOT NULL, research_request_id TEXT, company_id TEXT, objective TEXT NOT NULL, status TEXT NOT NULL, state_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS clara_research_states_company_idx ON clara_research_states(company_id, updated_at)`,
    `CREATE INDEX IF NOT EXISTS clara_research_states_request_idx ON clara_research_states(research_request_id, updated_at)`,
    `CREATE TABLE IF NOT EXISTS clara_tool_executions (id TEXT PRIMARY KEY NOT NULL, research_state_id TEXT NOT NULL REFERENCES clara_research_states(id) ON DELETE CASCADE, tool_name TEXT NOT NULL, attempt INTEGER NOT NULL, status TEXT NOT NULL, input_json TEXT NOT NULL, observations_json TEXT NOT NULL, gaps_json TEXT NOT NULL, resolved_gap_codes_json TEXT NOT NULL, evidence_refs_json TEXT NOT NULL, errors_json TEXT NOT NULL, metadata_json TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS clara_tool_executions_state_time_idx ON clara_tool_executions(research_state_id, started_at)`,
    `CREATE INDEX IF NOT EXISTS clara_tool_executions_state_tool_idx ON clara_tool_executions(research_state_id, tool_name, attempt)`,
  ], "write").then(() => undefined);
  return ready;
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function confirmedCompanyReference(graph: EntityIdentityGraph): ConfirmedCompanyReference | null {
  if (graph.targetSelectionStatus !== "userSelected") return null;
  return {
    entityId: graph.entityId,
    canonicalName: graph.canonicalName,
    primaryDomain: graph.domains[0] ?? null,
    identityConfidence: graph.identityConfidence,
    targetSelectionStatus: graph.targetSelectionStatus,
  };
}

function parseExecution(row: typeof claraToolExecutions.$inferSelect): ToolExecutionRecord {
  return {
    id: row.id,
    researchStateId: row.researchStateId,
    toolName: row.toolName,
    attempt: row.attempt,
    input: parseJson(row.inputJson),
    status: row.status as ToolExecutionRecord["status"],
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    observations: parseJson(row.observationsJson),
    gaps: parseJson(row.gapsJson),
    resolvedGapCodes: parseJson(row.resolvedGapCodesJson),
    evidenceRefs: parseJson(row.evidenceRefsJson),
    errors: parseJson(row.errorsJson),
    metadata: parseJson(row.metadataJson),
  };
}

export type CreateResearchStateInput = {
  objective: string;
  researchRequestId?: string | null;
  identityGraph?: EntityIdentityGraph | null;
  now?: () => Date;
};

export const researchStateStore = {
  async createResearchState(input: CreateResearchStateInput) {
    await ensureSchema();
    const objective = input.objective.trim().replace(/\s+/g, " ");
    if (!objective || objective.length > 1_000) throw new Error("ResearchState objective is required and must be at most 1,000 characters");
    const now = (input.now ?? (() => new Date()))().toISOString();
    const confirmedCompany = input.identityGraph ? confirmedCompanyReference(input.identityGraph) : null;
    const state: ResearchState = {
      id: crypto.randomUUID(),
      researchRequestId: input.researchRequestId?.trim() || null,
      objective,
      companyId: confirmedCompany?.entityId ?? null,
      confirmedCompany,
      status: "initialized",
      observations: [], gaps: [], evidenceRefs: [], executionIds: [],
      createdAt: now, updatedAt: now,
    };
    const { db } = getConnection();
    await db.insert(claraResearchStates).values({
      id: state.id, researchRequestId: state.researchRequestId, companyId: state.companyId,
      objective: state.objective, status: state.status, stateJson: JSON.stringify(state),
      createdAt: state.createdAt, updatedAt: state.updatedAt,
    });
    return state;
  },

  async getResearchState(id: string) {
    await ensureSchema();
    const { db } = getConnection();
    const row = await db.select({ stateJson: claraResearchStates.stateJson }).from(claraResearchStates)
      .where(eq(claraResearchStates.id, id)).get();
    return row ? parseJson<ResearchState>(row.stateJson) : null;
  },

  async listResearchStates(filters: { companyId?: string; researchRequestId?: string } = {}) {
    await ensureSchema();
    const { db } = getConnection();
    const rows = await db.select({ stateJson: claraResearchStates.stateJson }).from(claraResearchStates)
      .orderBy(desc(claraResearchStates.updatedAt), desc(claraResearchStates.id));
    return rows.map((row) => parseJson<ResearchState>(row.stateJson)).filter((state) =>
      (!filters.companyId || state.companyId === filters.companyId) &&
      (!filters.researchRequestId || state.researchRequestId === filters.researchRequestId));
  },

  async updateResearchState(id: string, updates: { status?: ResearchStateStatus; identityGraph?: EntityIdentityGraph | null; now?: () => Date }) {
    await ensureSchema();
    const existing = await this.getResearchState(id);
    if (!existing) return null;
    const confirmedCompany = updates.identityGraph ? confirmedCompanyReference(updates.identityGraph) : existing.confirmedCompany;
    if (existing.companyId && confirmedCompany && existing.companyId !== confirmedCompany.entityId) {
      throw new Error("A ResearchState cannot be reassigned to a different company");
    }
    const next: ResearchState = {
      ...existing,
      status: updates.status ?? existing.status,
      companyId: confirmedCompany?.entityId ?? existing.companyId,
      confirmedCompany,
      updatedAt: (updates.now ?? (() => new Date()))().toISOString(),
    };
    const { db } = getConnection();
    await db.update(claraResearchStates).set({ companyId: next.companyId, status: next.status, stateJson: JSON.stringify(next), updatedAt: next.updatedAt })
      .where(eq(claraResearchStates.id, id));
    return next;
  },

  async recordToolExecution(args: {
    researchStateId: string;
    toolName: string;
    input: unknown;
    result: ClaraToolResult<unknown>;
    identityGraph?: EntityIdentityGraph | null;
  }) {
    await ensureSchema();
    // Never trust a model/tool's proposed status. The server evaluates original evidence.
    const data = args.result.data as Partial<VerificationInput> & {secIssuerAssociations?: VerificationInput['issuerAssociations']; jobs?: unknown[]; summary?: unknown} | undefined;
    const graph = args.identityGraph;
    const normalized=normalizeEvidenceRegistry(args.result.evidence);
    const verification = graph ? evaluateVerification({graph,rawEvidence:args.result.evidence,
      claims:reconcileClaims(buildClaimRegistry(args.result.evidence[0]?.researchId??graph.entityId,graph.entityId,normalized.map(e=>({...e,verificationEligibility:'supportingEvidence'}))),normalized).claims,
      fundingResearch:data?.fundingResearch, issuerAssociations:data?.secIssuerAssociations??data?.issuerAssociations,
      hiringIntelligence:data?.hiringIntelligence??(Array.isArray(data?.jobs)&&data?.summary?data as unknown as import('../hiring/types').HiringActivityResult:null),now:args.result.metadata.completedAt}) : undefined;
    const evaluatedResult = {...args.result,metadata:{...args.result.metadata,verification}};
    const { db } = getConnection();
    return db.transaction(async (tx) => {
      const stateRow = await tx.select({ stateJson: claraResearchStates.stateJson }).from(claraResearchStates)
        .where(eq(claraResearchStates.id, args.researchStateId)).get();
      if (!stateRow) throw new Error("ResearchState was not found");
      let state = parseJson<ResearchState>(stateRow.stateJson);
      const confirmedCompany = args.identityGraph ? confirmedCompanyReference(args.identityGraph) : null;
      if (state.companyId && confirmedCompany && state.companyId !== confirmedCompany.entityId) {
        throw new Error("Tool context company does not match ResearchState company");
      }
      if (!state.confirmedCompany && confirmedCompany) state = { ...state, companyId: confirmedCompany.entityId, confirmedCompany };
      const latest = await tx.select({ attempt: claraToolExecutions.attempt }).from(claraToolExecutions)
        .where(and(
          eq(claraToolExecutions.researchStateId, args.researchStateId),
          eq(claraToolExecutions.toolName, args.toolName),
        ))
        .orderBy(desc(claraToolExecutions.attempt)).limit(1);
      const execution = toolExecutionFromResult({
        id: crypto.randomUUID(), researchStateId: args.researchStateId, toolName: args.toolName,
        attempt: (latest[0]?.attempt ?? 0) + 1,
        input: sanitizeToolInput(args.input), result: evaluatedResult,
      });
      const next = applyToolExecutionToResearchState(state, execution);
      await tx.insert(claraToolExecutions).values({
        id: execution.id, researchStateId: execution.researchStateId, toolName: execution.toolName,
        attempt: execution.attempt, status: execution.status, inputJson: JSON.stringify(execution.input),
        observationsJson: JSON.stringify(execution.observations), gapsJson: JSON.stringify(execution.gaps),
        resolvedGapCodesJson: JSON.stringify(execution.resolvedGapCodes), evidenceRefsJson: JSON.stringify(execution.evidenceRefs),
        errorsJson: JSON.stringify(execution.errors), metadataJson: JSON.stringify(execution.metadata),
        startedAt: execution.startedAt, completedAt: execution.completedAt,
      });
      await tx.update(claraResearchStates).set({
        companyId: next.companyId, status: next.status, stateJson: JSON.stringify(next), updatedAt: next.updatedAt,
      }).where(eq(claraResearchStates.id, next.id));
      return { state: next, execution };
    });
  },

  async listToolExecutions(researchStateId: string) {
    await ensureSchema();
    const { db } = getConnection();
    const rows = await db.select().from(claraToolExecutions)
      .where(eq(claraToolExecutions.researchStateId, researchStateId))
      .orderBy(asc(claraToolExecutions.startedAt), asc(claraToolExecutions.attempt), asc(claraToolExecutions.id));
    return rows.map(parseExecution);
  },

  async getToolAttemptCount(researchStateId: string, toolName: string) {
    const executions = await this.listToolExecutions(researchStateId);
    return executions.filter((item) => item.toolName === toolName).length;
  },

  async getLatestToolExecution(researchStateId: string, toolName: string) {
    const executions = await this.listToolExecutions(researchStateId);
    return executions.filter((item) => item.toolName === toolName).at(-1) ?? null;
  },

  async hasToolSucceeded(researchStateId: string, toolName: string) {
    const executions = await this.listToolExecutions(researchStateId);
    return executions.some((item) => item.toolName === toolName && item.status === "success");
  },
};
