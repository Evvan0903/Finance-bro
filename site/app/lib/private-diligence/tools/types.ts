import type { EntityIdentityGraph, PrivateCompanyInput, RawEvidence } from "../types";

export type ClaraToolStatus = "success" | "partial" | "failed";

export type ToolObservation = {
  code: string;
  topic: string;
  description: string;
  evidenceIds: string[];
};

export type ResearchGap = {
  code: string;
  topic: string;
  description: string;
  severity: "low" | "medium" | "high";
  retryable: boolean;
};

export type ToolError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type ClaraToolContext = {
  researchSession?: {
    budget: import("../research/budget").ResearchBudget;
    permittedQueries: { topic: import("../research/types").ResearchTopic; query: string; gap: string }[];
    searched: Set<string>;
    providerOptions?: import("../providers/providerRegistry").PrivateProviderRegistryOptions;
  };
  hiringOptions?: Pick<Parameters<typeof import("../hiring").researchHiringActivity>[0], "fetchImpl" | "browserRenderer" | "resolveHost">;
  searchSession?: import("../search/sharedSearch").SearchSession;
  fundingSession?: {
    secProvider?: import("../providers/providerTypes").PrivateCompanyProvider;
    budget: import("../funding/budget").FundingBudget;
    permittedQueries: string[];
    searched: Set<string>;
    searchOptions?: import("../providers/serpApiWebSearchProvider").SerpApiWebSearchProviderOptions;
  };
  researchId: string;
  input: PrivateCompanyInput;
  identityGraph?: EntityIdentityGraph | null;
  now?: () => Date;
};

export type ClaraToolInputSchema = {
  type: "object";
  required: readonly string[];
  properties: Readonly<Record<string, {
    type: "string" | "object" | "array" | "boolean";
    description: string;
    enum?: readonly string[];
  }>>;
  additionalProperties: boolean;
};

export type ClaraToolResult<T> = {
  status: ClaraToolStatus;
  data?: T;
  observations: ToolObservation[];
  evidence: RawEvidence[];
  gaps: ResearchGap[];
  resolvedGapCodes?: string[];
  errors: ToolError[];
  metadata: {
    toolName: string;
    startedAt: string;
    completedAt: string;
    retrievalTime: string;
    sourceCount: number;
  };
};

export interface ClaraTool<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: ClaraToolInputSchema;
  execute(input: TInput, context: ClaraToolContext): Promise<ClaraToolResult<TOutput>>;
}

export function isConfirmedToolContext(context: ClaraToolContext) {
  const selection = context.identityGraph?.targetSelectionStatus;
  return selection === "userSelected" || selection === "autoSelected";
}

export function toolMetadata(
  toolName: string,
  startedAt: string,
  context: ClaraToolContext,
  evidence: RawEvidence[],
) {
  const completedAt = (context.now ?? (() => new Date()))().toISOString();
  return {
    toolName,
    startedAt,
    completedAt,
    retrievalTime: completedAt,
    sourceCount: new Set(evidence.map((item) => item.sourceUrl)).size,
  };
}
