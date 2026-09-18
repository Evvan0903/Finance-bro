export type ResearchTopic = 'overview' | 'products' | 'people' | 'recent';
export type SourceFact = {
  topic: ResearchTopic; value: string; excerpt: string; evidenceId: string;
  sourceUrl: string; retrievedAt: string; publicationDate: string | null;
};
export type AdaptiveResearch = {
  facts: SourceFact[];
  coverage: { topic: string; status: 'company-reported' | 'independently-reported' | 'partial' | 'conflicting' | 'searched-not-found' | 'source-unavailable' | 'not-researched'; evidenceIds: string[] }[];
  actions: { toolName: string; query: string; gap: string; status: string; evidenceIds: string[] }[];
  modelRuns: { task: string; status: string; acceptedFacts?: number }[];
  stopReason: string;
  budget?: ReturnType<import('./budget').ResearchBudget['snapshot']>;
};
