import type { PrivateDiligenceResearchRecord } from "../types";

declare global {
  var __finbroPrivateDiligenceStore: Map<string, PrivateDiligenceResearchRecord> | undefined;
}

const records = globalThis.__finbroPrivateDiligenceStore ??
  (globalThis.__finbroPrivateDiligenceStore = new Map<string, PrivateDiligenceResearchRecord>());

export const privateDiligenceStore = {
  get(researchId: string) {
    return records.get(researchId) ?? null;
  },
  set(record: PrivateDiligenceResearchRecord) {
    records.set(record.researchId, structuredClone(record));
    return record;
  },
  update(researchId: string, updates: Partial<PrivateDiligenceResearchRecord>) {
    const existing = records.get(researchId);
    if (!existing) return null;
    const next = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    records.set(researchId, structuredClone(next));
    return next;
  },
};

export const PRIVATE_DILIGENCE_PERSISTENCE_NOTICE =
  "Clara V1 uses process-local ephemeral storage because no Vercel-safe database binding is configured. Records may be lost on restart.";
