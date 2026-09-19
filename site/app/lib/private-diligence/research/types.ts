export type ResearchTopic = 'overview' | 'products' | 'people' | 'recent' | 'customers' | 'partnerships' | 'pricing' | 'security';
export type TargetResearchProgress = {
  targetId: string; topic?: ResearchTopic; phase: 'discovery' | 'deepening'; attempts: number; emptyAttempts: number;
  status: 'not_researched' | 'discovered' | 'supported' | 'searched_not_found' | 'source_unavailable' | 'entity_unresolved' | 'stopped';
  stopReason: string | null; evidenceIds: string[];
};
export type SourceFact = {
  topic: ResearchTopic; targetId?: string; value: string; excerpt: string; evidenceId: string;
  sourceUrl: string; retrievedAt: string; publicationDate: string | null;
};
export type AdaptiveResearch = {
  facts: SourceFact[];
  targets?: TargetResearchProgress[];
  coverage: { topic: string; status: 'company-reported' | 'independently-reported' | 'partial' | 'conflicting' | 'searched-not-found' | 'source-unavailable' | 'not-researched'; evidenceIds: string[] }[];
  actions: { targetId?: string; topic?: ResearchTopic; incrementalFacts?: number; toolName: string; query: string; gap: string; status: string; evidenceIds: string[] }[];
  modelRuns: { task: string; status: string; acceptedFacts?: number }[];
  stopReason: string;
  budget?: ReturnType<import('./budget').ResearchBudget['snapshot']>;
};
