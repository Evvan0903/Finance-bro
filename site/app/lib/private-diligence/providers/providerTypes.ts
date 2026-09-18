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
  getSearchDiagnostics?(): Omit<import("../search/sharedSearch").SearchOutcome, "leads">[];
  getIssuerAssociations?(): import("../entity-resolution/secIssuerResolution").SecIssuerAssociation[];
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
  if (code === "SEC_FORBIDDEN") return "upstreamUnavailable";
  if (code === "invalidConfiguration") return "authenticationFailed";
  if (code === "malformedResponse" || code === "responseTooLarge" || code === "unsupportedContentType") return "parseFailed";
  if (code === "invalidRequest" || code === "invalidUrl" || code === "blockedAddress" || code === "redirectRejected") return "invalidRequest";
  return "upstreamUnavailable";
}

export async function executePrivateProvider(
  provider: PrivateCompanyProvider,
  context: PrivateProviderContext,
): Promise<PrivateProviderResult> {
  const result = await executeProvider(provider, context);
  if (provider.getIssuerAssociations) result.secIssuerAssociations = provider.getIssuerAssociations();
  if (provider.getSearchDiagnostics) {
    result.searchDiagnostics = provider.getSearchDiagnostics();
    result.diagnostic.requestAttempted = result.searchDiagnostics.some(query => query.attempts.some(attempt => attempt.attempted));
  }
  return result;
}

async function executeProvider(
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
      : search.records.length && !details.length ? "upstreamUnavailable" : "noData";
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
        sanitizedIssue: status === "upstreamUnavailable" ? "Discovered original sources could not be retrieved" : null,
        lastSuccessfulRetrievalTime: evidence.length ? context.now().toISOString() : null,
      },
    };
  } catch (error) {
    const status = classifyPrivateProviderError(error);
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    const issue = code === "SEC_FORBIDDEN" ? "SEC public-data access rejected with HTTP 403; this is an access restriction, not an SEC API-key failure"
      : code === "SEC_ISSUER_DISCOVERY_UNAVAILABLE" ? "SEC issuer candidate discovery failed before SEC submissions retrieval"
      : "Provider request did not return usable public evidence";
    return emptyProviderResult(provider, status, context, issue);
  }
}
