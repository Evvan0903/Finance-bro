import { createSerpApiWebSearchProvider } from "../providers/serpApiWebSearchProvider";
import { executePrivateProvider } from "../providers/providerTypes";
import type { PrivateProviderResult } from "../types";
import { toolMetadata, type ClaraTool } from "./types";

export const fundingSearchTool: ClaraTool<{ query: string }, PrivateProviderResult> = {
  name: "funding_search",
  description: "Search a permitted financing question and securely retrieve original announcement pages for the locked target",
  inputSchema: { type: "object", required: ["query"], properties: { query: { type: "string", description: "Exact server-issued permitted funding query" } }, additionalProperties: false },
  async execute(input, context) {
    const startedAt = new Date().toISOString();
    const session = context.fundingSession;
    if (context.identityGraph?.targetSelectionStatus !== "userSelected" || !session || !input || Object.keys(input).some((key) => key !== "query") || !session.permittedQueries.includes(input.query) || session.searched.has(input.query)) {
      return { status: "failed", evidence: [], observations: [], gaps: [], errors: [{ code: "invalid_funding_action", message: "Funding action was not permitted", retryable: false }], metadata: toolMetadata("funding_search", startedAt, context, []) };
    }
    session.searched.add(input.query);
    const provider = createSerpApiWebSearchProvider({ ...session.searchOptions, timeoutMs: Math.min(session.searchOptions?.timeoutMs ?? 6000, 6000), deadline: session.budget.deadline, reserveAttempt: () => session.budget.take("search"), searchFetchImpl: session.searchOptions?.searchFetchImpl ?? session.searchOptions?.fetchImpl ?? fetch, queries: [{ topic: "fundingAcquisitions", query: input.query }], maxSearches: 1, maxFetchedUrls: 2, resultsPerSearch: 2, fetchImpl: session.budget.fetch(session.searchOptions?.fetchImpl) });
    const result = await executePrivateProvider(provider, { researchId: context.researchId, input: context.input, identityGraph: context.identityGraph, now: context.now ?? (() => new Date()) });
    // Per-action ids prevent collisions when multiple searches return separate pages.
    result.evidence.forEach((evidence) => { evidence.evidenceId += `-funding-${session.searched.size}`; });
    return { status: result.status === "success" || result.status === "noData" ? "success" : "partial", data: result, evidence: result.evidence, observations: [{ code: "funding_original_pages", topic: "funding", description: `${result.evidence.length} original pages retrieved`, evidenceIds: result.evidence.map((e) => e.evidenceId) }], gaps: [], errors: result.diagnostic.sanitizedIssue ? [{ code: result.status, message: result.diagnostic.sanitizedIssue, retryable: false }] : [], metadata: toolMetadata("funding_search", startedAt, context, result.evidence) };
  },
};
