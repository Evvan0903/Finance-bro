import { ResearchBudget } from "./research/budget";
import { researchAdaptively } from "./research/adaptive";
import { getClaraTool } from "./tools/registry";
import { executeClaraTool } from "./state/executeClaraTool";
import type { ClaraToolContext } from "./tools/types";
import type { WebResearchToolOutput } from "./tools/webResearchTool";
import type { HiringActivityResult } from "./hiring/types";
import { discoverLegalEntities } from "./entity-resolution/legalEntityDiscovery";
import { createSearchSession } from "./search/sharedSearch";
import { researchFunding, integrateFollowupFunding } from "./funding/research";
import { FundingBudget } from "./funding/budget";
import { buildInformationGaps, buildDiligenceQuestions, buildRiskFindings } from "./analysis/riskAndGapEngine";
import { assertClaimsHaveEvidence, buildClaimRegistry } from "./evidence/claimRegistry";
import { reconcileClaims } from "./evidence/claimReconciler";
import { normalizeEvidenceRegistry } from "./evidence/evidenceRegistry";
import { buildPrivateDiligenceProviderPlan } from "./planning/researchPlanner";
import { buildQuickCompanyIntelligencePlan } from "./planning/quickResearchPlanner";
import { createPrivateProviderRegistry, type PrivateProviderRegistryOptions } from "./providers/providerRegistry";
import { executePrivateProvider } from "./providers/providerTypes";
import { buildPrivateDiligenceReport } from "./reports/reportBuilder";
import { buildQuickCompanyIntelligenceReport } from "./reports/quickReportBuilder";
import { hiringEvidenceFromResult } from "./evidence/hiringEvidence";
import { researchHiringActivity } from "./hiring";
import type { EntityIdentityGraph, PrivateCompanyInput } from "./types";

export class PrivateDiligenceEngineError extends Error {
  constructor(readonly code: "ENTITY_NOT_RESOLVED" | "INSUFFICIENT_PUBLIC_INFORMATION", message: string) {
    super(message);
    this.name = "PrivateDiligenceEngineError";
  }
}

export async function runPrivateDiligence(
  researchId: string,
  input: PrivateCompanyInput,
  graph: EntityIdentityGraph,
  options: PrivateProviderRegistryOptions & { now?: () => Date; researchStateId?: string; fundingFollowup?: boolean } = {},
) {
  if (graph.targetSelectionStatus !== "userSelected") {
    throw new PrivateDiligenceEngineError("ENTITY_NOT_RESOLVED", "A research target must be selected before research begins");
  }
  const deadline = Date.now() + 50_000;
  const now = options.now ?? (() => new Date());
  const quickMode = input.workflowMode === "quick";
  const providerPlan = quickMode ? buildQuickCompanyIntelligencePlan(input, graph) : buildPrivateDiligenceProviderPlan(input, graph);
  const budget = new ResearchBudget(deadline);
  const sharedFetch = budget.fetch(options.website?.fetchImpl);
  const searchOptions = { ...options.serpApi, searchSession: options.serpApi?.searchSession ?? createSearchSession(), deadline, onQuery:(query:string)=>{if(!budget.queries.includes(query))budget.queries.push(query);},
    ...(quickMode ? { fetchImpl: sharedFetch, searchFetchImpl: budget.fetch(options.serpApi?.searchFetchImpl), maxSearches: 2, maxAttempts: 3, resultsPerSearch: 3, maxFetchedUrls: 6,
      queries: [
        {topic: "leadership" as const, query: `site:${graph.domains[0]} "${graph.canonicalName.replace(/["\\]/g, " ")}" founders leadership team`},
        {topic: "recentActivity" as const, query: `site:${graph.domains[0]} "${graph.canonicalName.replace(/["\\]/g, " ")}" announcements news ${now().getUTCFullYear()}`},
      ] } : {}) };
  const providerOptions = { ...options, ...(quickMode ? {usaSpendingFetch:budget.fetch(options.usaSpendingFetch)} : {}), website: { ...options.website, ...(quickMode ? {fetchImpl: sharedFetch,maxPages:8} : {}) }, serpApi: searchOptions };
  const context: ClaraToolContext = {researchId,input,identityGraph:graph,now,searchSession:searchOptions.searchSession,
    researchSession: {budget,permittedQueries:[],searched:new Set(searchOptions.queries?.map(q=>q.query.trim().replace(/\s+/g," ").toLowerCase()) ?? []),providerOptions},
    hiringOptions: {fetchImpl:sharedFetch, resolveHost:options.website?.resolveHost, browserRenderer:async()=>{throw new Error("Browser fallback unavailable within bounded Quick research");}},
  };
  const providerResults: import("./types").PrivateProviderResult[] = [];
  const runTool = async <T,>(toolName:string, toolInput:unknown) => {
    budget.take("tools");
    return options.researchStateId ? executeClaraTool<T>({researchStateId:options.researchStateId,toolName,input:toolInput,context}) : getClaraTool(toolName)!.execute(toolInput,context) as Promise<import("./tools/types").ClaraToolResult<T>>;
  };
  const registry = createPrivateProviderRegistry(providerOptions);
  if (quickMode) {
    const initial = await runTool<WebResearchToolOutput>("web_research",{});
    providerResults.push(...(initial.data?.providerResults ?? []));
  }
  const selected = providerPlan.filter(item=>item.selected && !(quickMode && ["secFormD","companyWebsite","serpApiWebSearch"].includes(item.providerId)))
    .map(item=>registry.get(item.providerId)).filter(Boolean);
  for (let index=0;index<selected.length;index+=3) {
    providerResults.push(...await Promise.all(selected.slice(index,index+3).map(provider=>executePrivateProvider(provider!,{researchId,input,identityGraph:graph,now}))));
  }
  const rawEvidence = providerResults.flatMap((result) => result.evidence);
  const legal = quickMode ? await discoverLegalEntities(graph, researchId, rawEvidence, {
    fetchImpl: sharedFetch, resolveHost: options.website?.resolveHost, deadline, now,
  }) : null;
  const officialDomain = graph.domains[0];
  // Independent useful branches share the run deadline and outbound counters.
  const [hiringOutcome, funding, adaptive] = await Promise.all([
    quickMode && officialDomain ? runTool<HiringActivityResult>("hiring_intelligence",{}) : null,
    quickMode ? researchFunding(context, rawEvidence, {
      researchStateId: options.researchStateId, followup: options.fundingFollowup ?? process.env.CLARA_FUNDING_FOLLOWUP !== "0",
      budget: new FundingBudget({baseFetch:budget.fetch(),deadline:Math.min(deadline,Date.now()+24_000)}), searchOptions,
      legalEntityDiscovery: legal?.discovery, legalIdentityEvidence: legal?.evidence,
    }) : null,
    quickMode ? researchAdaptively(context,rawEvidence,options.researchStateId,undefined,providerResults) : null,
  ]);
  const hiringIntelligence = quickMode ? hiringOutcome?.data ?? null : officialDomain ? await researchHiringActivity({companyId:graph.entityId,officialUrl:`https://${officialDomain}`,retrievedAt:now().toISOString()}) : null;
  if (adaptive && funding) integrateFollowupFunding(funding.fundingResearch,adaptive.evidence,graph);
  if (adaptive) {rawEvidence.push(...adaptive.evidence);providerResults.push(...adaptive.providerResults);}
  if (legal) rawEvidence.push(...legal.evidence);
  const hiringEvidence = hiringIntelligence ? hiringEvidenceFromResult(researchId, graph, hiringIntelligence) : [];
  if (funding) { rawEvidence.push(...funding.evidence); providerResults.push(...funding.providerResults); }
  const normalizedEvidence = normalizeEvidenceRegistry([...rawEvidence, ...hiringEvidence]);
  const eligibleEvidence = normalizedEvidence.filter((item) =>
    item.verificationEligibility === "finalEvidence" || item.verificationEligibility === "supportingEvidence",
  );
  if (!eligibleEvidence.length && !quickMode) {
    throw new PrivateDiligenceEngineError(
      "INSUFFICIENT_PUBLIC_INFORMATION",
      "Insufficient public information was identified to produce a reliable diligence report",
    );
  }
  const seededClaims = assertClaimsHaveEvidence(buildClaimRegistry(researchId, graph.entityId, eligibleEvidence));
  const reconciled = reconcileClaims(seededClaims, eligibleEvidence);
  const risks = buildRiskFindings(graph, reconciled.claims, reconciled.conflicts);
  const informationGaps = buildInformationGaps(reconciled.claims, eligibleEvidence);
  const questions = buildDiligenceQuestions(informationGaps, reconciled.conflicts);
  const generatedAt = now().toISOString();
  const reportArgs = {
    researchId, input, graph, providerPlan, evidence: eligibleEvidence,
    claims: reconciled.claims, conflicts: reconciled.conflicts, risks,
    informationGaps, questions, generatedAt, hiringIntelligence, fundingResearch: funding?.fundingResearch, adaptiveResearch: adaptive?.research,
  };
  const report = quickMode ? buildQuickCompanyIntelligenceReport(reportArgs) : buildPrivateDiligenceReport(reportArgs);
  if (adaptive) {
    adaptive.research.budget = budget.snapshot();
    report.adaptiveResearch = adaptive.research;
  }
  return { legalEntityDiscovery: legal?.discovery, providerPlan, providerResults, rawEvidence: [...rawEvidence, ...hiringEvidence], normalizedEvidence, hiringIntelligence, report };
}
