import type { MarketResearchRecord } from "../types";

declare global {
  var __finbroMarketResearchStore: Map<string, MarketResearchRecord> | undefined;
}

const records =
  globalThis.__finbroMarketResearchStore ??
  (globalThis.__finbroMarketResearchStore = new Map<string, MarketResearchRecord>());

export const marketResearchStore = {
  get(researchId: string) {
    return records.get(researchId) ?? null;
  },
  set(record: MarketResearchRecord) {
    records.set(record.researchId, structuredClone(record));
    return record;
  },
  update(researchId: string, updates: Partial<MarketResearchRecord>) {
    const existing = records.get(researchId);
    if (!existing) return null;
    const next = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    records.set(researchId, structuredClone(next));
    return next;
  },
};

export const MARKET_RESEARCH_PERSISTENCE_LIMITATION =
  "Research records use process-local MVP storage because no D1 binding is configured. Records may be lost on serverless restart.";
