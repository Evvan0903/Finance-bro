import { createSearchSession } from "../search/sharedSearch";
import { normalizeEvidenceRegistry } from "../evidence/evidenceRegistry";
import { createPrivateProviderRegistry } from "../providers/providerRegistry";
import { executePrivateProvider } from "../providers/providerTypes";
import type { PrivateCompanyProvider } from "../providers/providerTypes";
import type { NormalizedEvidence, PrivateProviderResult } from "../types";
import type { ClaraTool, ClaraToolResult } from "./types";
import { isConfirmedToolContext, toolMetadata } from "./types";

const WEB_PROVIDER_IDS = ["companyWebsite", "serpApiWebSearch"] as const;
type WebProviderId = typeof WEB_PROVIDER_IDS[number];

export type WebResearchToolInput = { providerIds?: WebProviderId[]; query?: string };
export type WebResearchToolOutput = {
  providerResults: PrivateProviderResult[];
  normalizedEvidence: NormalizedEvidence[];
};

type ProviderRegistryFactory = () => Map<string, PrivateCompanyProvider>;
const NON_FAILURE_STATUSES = new Set(["success", "partial", "noData", "notRelevant"]);

export function createWebResearchTool(dependencies: { createRegistry?: ProviderRegistryFactory } = {}): ClaraTool<WebResearchToolInput, WebResearchToolOutput> {
  const createRegistry = dependencies.createRegistry;
  const name = "web_research";
  return {
    name,
    description: "Run Clara's secure official-site and original-source web research providers for a confirmed target",
    inputSchema: {
      type: "object", required: [],
      properties: { query: { type: "string", description: "An exact server-permitted gap query; requires a run-scoped research session" }, providerIds: { type: "array", description: "Optional allowlisted Clara web providers", enum: WEB_PROVIDER_IDS } },
      additionalProperties: false,
    },
    async execute(input, context): Promise<ClaraToolResult<WebResearchToolOutput>> {
      const startedAt = (context.now ?? (() => new Date()))().toISOString();
      if (!input || typeof input !== "object" || Object.keys(input).some((key) => !["providerIds", "query"].includes(key))) {
        return { status: "failed", observations: [], evidence: [], gaps: [], errors: [{ code: "invalid_tool_input", message: "Web Research accepts only an optional providerIds list", retryable: false }], metadata: toolMetadata(name, startedAt, context, []) };
      }
      if (!isConfirmedToolContext(context) || !context.identityGraph) {
        return { status: "failed", observations: [], evidence: [], gaps: [], errors: [{ code: "target_not_confirmed", message: "Web research requires an explicitly selected company target", retryable: false }], metadata: toolMetadata(name, startedAt, context, []) };
      }
      const session = context.researchSession;
      const query = input.query;
      const permitted = session?.permittedQueries.find(p => p.query === query);
      const key = typeof query === "string" ? query.trim().replace(/\s+/g, " ").toLowerCase() : "";
      if (query !== undefined && (!permitted || !session || input.providerIds || session.searched.has(key) || Date.now() >= session.budget.deadline)) {
        return {status:"failed", observations:[], evidence:[], gaps:[], errors:[{code:"invalid_or_duplicate_research_query",message:"Query is not an unused permitted action for the locked target",retryable:false}],metadata:toolMetadata(name,startedAt,context,[])};
      }
      if (permitted && session) { session.searched.add(key); if(!session.budget.queries.includes(permitted.query))session.budget.queries.push(permitted.query); }
      const requested = query ? ["serpApiWebSearch" as const] : input?.providerIds ?? [...WEB_PROVIDER_IDS];
      if (!Array.isArray(requested) || requested.length === 0 || requested.some((id) => !WEB_PROVIDER_IDS.includes(id as WebProviderId))) {
        return { status: "failed", observations: [], evidence: [], gaps: [], errors: [{ code: "invalid_provider_selection", message: "Only allowlisted Clara web providers may be selected", retryable: false }], metadata: toolMetadata(name, startedAt, context, []) };
      }
      try {
        const providerIds = [...new Set(requested)];
        const registry = createRegistry ? createRegistry() : createPrivateProviderRegistry({ ...session?.providerOptions, serpApi: { ...session?.providerOptions?.serpApi, searchSession: context.searchSession ??= createSearchSession(), ...(permitted ? {queries:[{topic:permitted.topic === "people" ? "leadership" : permitted.topic === "recent" ? "recentActivity" : "overviewProducts",query:permitted.query}],maxSearches:1,resultsPerSearch:3,maxFetchedUrls:3} : {}) } });
        const providers = providerIds.map((id) => registry.get(id)).filter((provider): provider is PrivateCompanyProvider => Boolean(provider));
        if (providers.length !== providerIds.length) {
          return { status: "failed", observations: [], evidence: [], gaps: [], errors: [{ code: "provider_not_registered", message: "A requested Clara web provider is not registered", retryable: false }], metadata: toolMetadata(name, startedAt, context, []) };
        }
        const providerContext = { researchId: context.researchId, input: context.input, identityGraph: context.identityGraph, now: context.now ?? (() => new Date()) };
        const providerResults = await Promise.all(providers.map((provider) => executePrivateProvider(provider, providerContext)));
        const evidence = providerResults.flatMap((result) => result.evidence);
        if (permitted) for (const item of evidence) item.evidenceId += `-research-${session!.searched.size}`;
        const normalizedEvidence = normalizeEvidenceRegistry(evidence);
        const failures = providerResults.filter((result) => !NON_FAILURE_STATUSES.has(result.status));
        const noData = providerResults.filter((result) => result.status === "noData" || result.status === "notRelevant");
        const reportedPartial = providerResults.some((result) => result.status === "partial");
        const status = failures.length ? (evidence.length ? "partial" : "failed") : reportedPartial ? "partial" : "success";
        return {
          status,
          data: { providerResults, normalizedEvidence },
          observations: evidence.length ? [{ code: "web_evidence_retrieved", topic: "public web research", description: `${evidence.length} original-page evidence record${evidence.length === 1 ? " was" : "s were"} retrieved`, evidenceIds: evidence.map((item) => item.evidenceId) }] : [],
          evidence,
          gaps: [
            ...noData.map((result) => ({ code: `${result.providerId}_no_evidence`, topic: "public web research", description: `${result.providerName} returned no usable original-page evidence`, severity: "medium" as const, retryable: true })),
            ...failures.map((result) => ({ code: `${result.providerId}_unavailable`, topic: "public web research", description: `${result.providerName} did not complete successfully`, severity: "medium" as const, retryable: true })),
          ],
          errors: failures.map((result) => ({ code: `${result.providerId}_${result.status}`, message: result.diagnostic.sanitizedIssue ?? `${result.providerName} failed`, retryable: !["invalidConfiguration", "invalidRequest"].includes(result.status) })),
          metadata: toolMetadata(name, startedAt, context, evidence),
        };
      } catch {
        return { status: "failed", observations: [], evidence: [], gaps: [], errors: [{ code: "web_research_failed", message: "Web research did not complete", retryable: true }], metadata: toolMetadata(name, startedAt, context, []) };
      }
    },
  };
}

export const webResearchTool = createWebResearchTool();
