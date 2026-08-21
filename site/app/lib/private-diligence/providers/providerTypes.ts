import type {
  EntityIdentityGraph,
  PrivateCompanyInput,
  PrivateProviderResult,
  ProviderCategory,
  ProviderStatus,
  RawEvidence,
  SourceTier,
} from "../types";

export type PrivateProviderContext = {
  researchId: string;
  input: PrivateCompanyInput;
  identityGraph: EntityIdentityGraph;
  now: () => Date;
};

export type ProviderSearchResult = {
  status: ProviderStatus;
  records: unknown[];
  rejectedWeakMatches?: number;
  manualVerificationLinks?: string[];
  sanitizedIssue?: string | null;
};

export interface PrivateCompanyProvider {
  providerId: string;
  providerName: string;
  sourceTier: SourceTier;
  providerCategory: ProviderCategory;
  isConfigured(): boolean;
  supports(context: PrivateProviderContext): boolean;
  validateConfiguration(): ProviderStatus;
  search(context: PrivateProviderContext): Promise<ProviderSearchResult>;
  fetchDetails(records: unknown[], context: PrivateProviderContext): Promise<unknown[]>;
  normalize(records: unknown[], context: PrivateProviderContext): Promise<RawEvidence[]>;
  buildPublicReference(evidence: RawEvidence): string;
}

export function emptyProviderResult(
  provider: PrivateCompanyProvider,
  status: ProviderStatus,
  context: PrivateProviderContext,
  issue: string | null = null,
  manualVerificationLinks: string[] = [],
): PrivateProviderResult {
  return {
    providerId: provider.providerId,
    providerName: provider.providerName,
    sourceTier: provider.sourceTier,
    providerCategory: provider.providerCategory,
    status,
    evidence: [],
    manualVerificationLinks,
    diagnostic: {
      provider: provider.providerName,
      configured: provider.isConfigured(),
      requestAttempted: status !== "notRelevant" && status !== "invalidConfiguration",
      status,
      sourceCategory: provider.providerCategory,
      searchQueryType: context.identityGraph.legalNames.length > 1 ? "identity graph aliases" : "selected company name",
      usableRecords: 0,
      entityMatches: 0,
      rejectedWeakMatches: 0,
      rateLimitState: status === "rateLimited" ? "limited" : "clear",
      sanitizedIssue: issue,
      lastSuccessfulRetrievalTime: null,
    },
  };
}

export function classifyPrivateProviderError(error: unknown): ProviderStatus {
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
  if (code === "rateLimited" || code === "SEC_RATE_LIMITED") return "rateLimited";
  if (code === "timeout" || code === "SEC_TIMEOUT") return "timeout";
  if (code === "invalidConfiguration" || code === "SEC_FORBIDDEN") return "authenticationFailed";
  if (code === "malformedResponse" || code === "responseTooLarge" || code === "unsupportedContentType") return "parseFailed";
  if (code === "invalidRequest" || code === "invalidUrl" || code === "blockedAddress" || code === "redirectRejected") return "invalidRequest";
  return "upstreamUnavailable";
}

export async function executePrivateProvider(
  provider: PrivateCompanyProvider,
  context: PrivateProviderContext,
): Promise<PrivateProviderResult> {
  if (!provider.supports(context)) return emptyProviderResult(provider, "notRelevant", context);
  const configuration = provider.validateConfiguration();
  if (configuration === "invalidConfiguration") {
    return emptyProviderResult(provider, configuration, context, "Required server configuration is missing");
  }
  try {
    const search = await provider.search(context);
    if (search.status !== "success" && search.status !== "partial") {
      const result = emptyProviderResult(
        provider, search.status, context, search.sanitizedIssue ?? null, search.manualVerificationLinks ?? [],
      );
      result.diagnostic.rejectedWeakMatches = search.rejectedWeakMatches ?? 0;
      result.diagnostic.requestAttempted = true;
      return result;
    }
    const details = await provider.fetchDetails(search.records, context);
    const evidence = await provider.normalize(details, context);
    const status: ProviderStatus = evidence.length
      ? search.status
      : "noData";
    return {
      providerId: provider.providerId,
      providerName: provider.providerName,
      sourceTier: provider.sourceTier,
      providerCategory: provider.providerCategory,
      status,
      evidence,
      manualVerificationLinks: search.manualVerificationLinks ?? [],
      diagnostic: {
        provider: provider.providerName,
        configured: provider.isConfigured(),
        requestAttempted: true,
        status,
        sourceCategory: provider.providerCategory,
        searchQueryType: context.identityGraph.legalNames.length > 1 ? "identity graph aliases" : "selected company name",
        usableRecords: evidence.length,
        entityMatches: evidence.filter((item) => item.entityMatchConfidence !== "Low").length,
        rejectedWeakMatches: search.rejectedWeakMatches ?? 0,
        rateLimitState: "clear",
        sanitizedIssue: null,
        lastSuccessfulRetrievalTime: evidence.length ? context.now().toISOString() : null,
      },
    };
  } catch (error) {
    const status = classifyPrivateProviderError(error);
    return emptyProviderResult(provider, status, context, "Provider request did not return usable public evidence");
  }
}
