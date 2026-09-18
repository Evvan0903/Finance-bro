import { analyzeLegalEntities, legalEntitySecGraph, type LegalEntityDiscovery } from "../entity-resolution/legalEntityDiscovery";
import { createSearchSession } from "../search/sharedSearch";
import { SecClient } from "../../sec-client";
import { runClaraModel } from "../modelRouter";
import { createSecFormDProvider } from "../providers/secFormDProvider";
import { createSerpApiWebSearchProvider, type SerpApiSearchLead, type SerpApiWebSearchProviderOptions } from "../providers/serpApiWebSearchProvider";
import { executeClaraTool } from "../state/executeClaraTool";
import { claraToolRegistry, getClaraTool } from "../tools/registry";
import type { ClaraToolContext } from "../tools/types";
import type { PrivateProviderResult, RawEvidence } from "../types";
import { FundingBudget } from "./budget";
import { deterministicFundingCandidates, fundingNames, reconcileFunding, validateFundingCandidates } from "./extraction";
import type { FundingEvent, FundingResearch } from "./types";

function safeModelFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /^(?:CLARA_[A-Z0-9_]+|INVALID_FUNDING_PLAN|INVALID_FUNDING_EXTRACTION|FUNDING_BUDGET_EXHAUSTED)$/.test(message)
    ? message : error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name) ? "MODEL_TIMEOUT" : "MODEL_OUTPUT_OR_REQUEST_FAILED";
}

export function fundingQueries(context: ClaraToolContext) {
  const graph = context.identityGraph!;
  const name = graph.canonicalName.replace(/["\\]/g, " ");
  const domain = graph.domains[0];
  const identityKey = (value: string) => value.toLowerCase().replace(/\b(?:inc|incorporated|ltd|limited|llc|corp|corporation)\b/g, "").replace(/[^a-z0-9]/g, "");
  const aliases = fundingNames(graph).filter((alias) => identityKey(alias) !== identityKey(name)).slice(0, 2).map((alias) => `"${alias.replace(/["\\]/g, " ")}"`);
  const target = aliases.length ? `("${name}" OR ${aliases.join(" OR ")})` : `"${name}"`;
  return [
    ...(domain ? [`site:${domain} "${name}" funding financing announcement`] : []),
    `${target} "${domain}" funding financing investment announcement`,
    `"${name}" "${domain}" financing extension second close investor announcement`,
    `"${name}" "${domain}" funding round total funding currency valuation investors`,
  ];
}
export function validateFundingPlan(value: unknown, context: ClaraToolContext, gaps: string[]) {
  if (!value || typeof value !== "object") throw new Error("INVALID_FUNDING_PLAN");
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => !["action", "toolName", "input", "entityId", "targetGap", "reasonCode"].includes(key))) throw new Error("INVALID_FUNDING_PLAN");
  if (row.action === "stop" && row.reasonCode === "sufficient_or_unavailable") return null;
  const session = context.fundingSession!;
  const input = row.input as { query?: unknown } | undefined;
  if (row.action !== "execute_tool" || row.toolName !== "funding_search" || !claraToolRegistry.has(String(row.toolName)) || row.entityId !== context.identityGraph?.entityId || row.reasonCode !== "resolve_funding_gap" || typeof row.targetGap !== "string" || !gaps.includes(row.targetGap) || !input || Object.keys(input).some((key) => key !== "query") || typeof input.query !== "string" || !session.permittedQueries.includes(input.query) || session.searched.has(input.query) || Date.now() >= session.budget.deadline || session.budget.used.search >= session.budget.limits.search || session.budget.used.fetch >= session.budget.limits.fetch) throw new Error("INVALID_FUNDING_PLAN");
  if (/currency/i.test(row.targetGap) && !/currency/i.test(input.query)) throw new Error("INVALID_FUNDING_PLAN");
  if (/cumulative|conflicting/i.test(row.targetGap) && !/total funding/i.test(input.query)) throw new Error("INVALID_FUNDING_PLAN");
  if (/second close|extension/i.test(row.targetGap) && !/second close|extension/i.test(input.query)) throw new Error("INVALID_FUNDING_PLAN");
  return { query: input.query, targetGap: row.targetGap, reasonCode: "resolve_funding_gap" };
}
function fundingGaps(events: FundingEvent[]) {
  if (!events.length) return ["No source-grounded financing event found in the recorded scope"];
  const gaps = new Set<string>();
  for (const event of events.filter((event) => event.sourceKind === "announcement")) {
    if (!event.fields.amount) gaps.add("Announced financing lacks a supported amount");
    if (event.fields.amount && (!event.fields.currency || event.fields.currency.value === "unknown")) gaps.add("Financing currency is unspecified");
    if (event.fields.amountMeaning?.value === "cumulative") gaps.add("Cumulative funding needs separation from the current round");
    if (Object.values(event.fields).some((f) => /extension|second close/i.test(f.excerpt))) gaps.add("An extension or second close needs clarification");
  }
  // Matching round labels alone are not enough to merge events; preserve competing statements for review.
  for (const event of events) for (const other of events) {
    if (event.eventId >= other.eventId || event.entityId !== other.entityId) continue;
    if (event.fields.roundLabel?.value && event.fields.roundLabel.value === other.fields.roundLabel?.value && event.fields.amount && other.fields.amount && event.fields.amount.value !== other.fields.amount.value && event.fields.amountMeaning?.value === other.fields.amountMeaning?.value) gaps.add("Potentially conflicting round amounts; event association remains uncertain");
  }
  return [...gaps];
}

export async function researchFunding(context: ClaraToolContext, existing: RawEvidence[], options: {
  followup?: boolean; researchStateId?: string; budget?: FundingBudget;
  legalEntityDiscovery?: LegalEntityDiscovery; legalIdentityEvidence?: RawEvidence[];
  searchOptions?: SerpApiWebSearchProviderOptions; runModel?: typeof runClaraModel;
} = {}) {
  const graph = options.legalEntityDiscovery ? legalEntitySecGraph(context.identityGraph!, options.legalEntityDiscovery) : context.identityGraph!;
  context = { ...context, identityGraph: graph };
  const budget = options.budget ?? new FundingBudget();
  const result: FundingResearch = { events: [], announcementStatus: "not_performed", secStatus: "not_performed", gaps: [], limitations: [], modelRuns: [], actions: [], requests: budget.used, researchStateId: options.researchStateId };
  const evidence: RawEvidence[] = [];
  const providerResults: PrivateProviderResult[] = [];
  const seenPages = new Set<string>();
  const model = options.runModel ?? runClaraModel;
  const searchOptions = { ...options.searchOptions, timeoutMs: Math.min(options.searchOptions?.timeoutMs ?? 6000, 6000), searchSession: options.searchOptions?.searchSession ?? context.searchSession ?? createSearchSession(), deadline: budget.deadline, reserveAttempt: () => budget.take("search"), searchFetchImpl: options.searchOptions?.searchFetchImpl ?? options.searchOptions?.fetchImpl ?? fetch };
  const session = { budget, permittedQueries: fundingQueries(context), searched: new Set<string>(), searchOptions };
  context = { ...context, fundingSession: session };
  const extract = async (pages: RawEvidence[], useModel: boolean) => {
    for (const page of pages) {
      if (/(^|\.)wikipedia.org$/.test(new URL(page.publicReferenceUrl).hostname)) continue;
      const fundingText = typeof page.structuredData.fundingText === "string" ? page.structuredData.fundingText : page.rawText;
      if (seenPages.has(page.publicReferenceUrl) || page.entityMatchConfidence === "Low" || !/funding|financing|raise|raised|raises|investment|series [a-z]|seed round/i.test(fundingText)) continue;

      let events = deterministicFundingCandidates(page, graph);
      if (useModel && /(?:[$£€]|USD|EUR|GBP)\s*\d/.test(fundingText) && budget.used.model < 2 && Date.now() + 2000 < budget.deadline) {
        try {
          const modelEvents = await model({ tier: "medium", task: "extract_funding", input: { entityId: graph.entityId, names: fundingNames(graph), sourceText: fundingText.slice(0, 22000) }, fetchImpl: budget.fetch(), schema: (value) => validateFundingCandidates(value, page, graph) });
          if (modelEvents.length) events = modelEvents;
          result.modelRuns!.push({ task: "extract_funding", status: "validated", acceptedEvents: modelEvents.length });
        } catch (error) {
          const code = safeModelFailure(error);
          result.modelRuns!.push({ task: "extract_funding", status: "failed", code });
          result.limitations.push(`Structured extraction ${code}; retained deterministic supported candidates.`);
        }
      }
      if (useModel || events.length) seenPages.add(page.publicReferenceUrl);
      page.structuredData.fundingEvents = events;
      const reused = existing.find((old) => old.publicReferenceUrl === page.publicReferenceUrl);
      if (reused && reused !== page) {
        for (const event of events) for (const field of Object.values(event.fields)) field.evidenceId = reused.evidenceId;
        reused.structuredData.fundingEvents = events;
      }
      result.events.push(...events);
    }
  };
  const search = async (query: string, targetGap: string, modelSelected = false) => {
    const input = { query };
    context.researchSession?.budget.take("tools");
    const outcome = options.researchStateId
      ? await executeClaraTool<PrivateProviderResult>({ researchStateId: options.researchStateId, toolName: "funding_search", input, context })
      : await getClaraTool("funding_search")!.execute(input, context);
    const provider = outcome.data as PrivateProviderResult | undefined;
    if (provider) providerResults.push(provider);
    evidence.push(...outcome.evidence);
    await extract(outcome.evidence, true);
    result.actions.push({ action: "funding_search", input, targetGap, reasonCode: modelSelected ? "resolve_funding_gap" : "routine_discovery", status: outcome.status });
  };
  await extract(existing.filter((e) => /funding|financing|raised|raises/i.test(String(e.structuredData.fundingText ?? e.rawText))), true);
  // Independent SEC and announcement paths share hard request caps and a deadline.
  const secTask = async () => {
    const identityEvidence = [...existing, ...(options.legalIdentityEvidence ?? [])];
    const legalDiscovery = options.legalEntityDiscovery ?? analyzeLegalEntities(graph, identityEvidence, (context.now ?? (() => new Date()))().toISOString());
    const secGraph = legalEntitySecGraph(graph, legalDiscovery);
    const secContext = { ...context, identityGraph: secGraph };
    const discoveryDiagnostics: NonNullable<PrivateProviderResult["searchDiagnostics"]> = [];
    const provider = createSecFormDProvider(new SecClient({ fetchImpl: budget.fetch(), maxAttempts: 2, timeoutMs: 5000, minimumIntervalMs: 300, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, Math.min(ms, Math.max(0, budget.deadline - Date.now())))) }), {
      requireUserAgent: true,
      identityEvidence,
      discoverCiks: async () => {
        if (graph.cikCandidates.length) return [];
        const legalNames = secGraph.legalNames.slice(0, 2);
        if (!legalNames.length) return [];
        const discovery = createSerpApiWebSearchProvider({ ...searchOptions, fetchImpl: budget.fetch(options.searchOptions?.fetchImpl), queries: legalNames.map(legal => ({ topic: "fundingAcquisitions" as const, query: `site:sec.gov/Archives/edgar/data/ "${legal.replace(/["\\]/g, " ")}" "D"` })), maxSearches: legalNames.length, resultsPerSearch: 2 });
        const leads = await discovery.search({ researchId: context.researchId, input: context.input, identityGraph: graph, now: context.now ?? (() => new Date()) });
        discoveryDiagnostics.push(...discovery.getSearchDiagnostics!());
        if (!["success", "noData", "partial"].includes(leads.status)) throw Object.assign(new Error("SEC_ISSUER_DISCOVERY_UNAVAILABLE"), { code: "SEC_ISSUER_DISCOVERY_UNAVAILABLE" });
        return (leads.records as SerpApiSearchLead[]).flatMap((lead) => {
          const url = new URL(lead.url);
          if (url.hostname !== "www.sec.gov" && url.hostname !== "sec.gov") return [];
          const cik = url.pathname.match(/^\/Archives\/edgar\/data\/(\d{1,10})\//)?.[1];
          return cik ? [cik] : [];
        });
      },
    });
    context.fundingSession!.secProvider = provider;
    context.researchSession?.budget.take("tools");
    const toolResult = options.researchStateId
      ? await executeClaraTool<PrivateProviderResult>({ researchStateId: options.researchStateId, toolName: "sec_funding", input: {}, context: secContext })
      : await getClaraTool("sec_funding")!.execute({}, secContext);
    const outcome = toolResult.data as PrivateProviderResult;
    outcome.searchDiagnostics = discoveryDiagnostics;
    outcome.legalEntityDiscovery = legalDiscovery;
    result.issuerAssociations = outcome.secIssuerAssociations ?? [];
    result.actions.push({ action: "sec_funding", input: {}, targetGap: "sec_issuer_and_form_d", reasonCode: "routine_discovery", status: outcome.status });
    providerResults.push(outcome); evidence.push(...outcome.evidence);
    result.events.push(...outcome.evidence.flatMap((e) => e.structuredData.fundingEvents as FundingEvent[] ?? []));
    result.secStatus = outcome.evidence.length ? "supported" : outcome.diagnostic.sanitizedIssue === "issuer_unresolved" ? "issuer_unresolved" : outcome.status === "noData" ? "no_information" : "inaccessible";
    if (outcome.diagnostic.sanitizedIssue) result.limitations.push(`SEC: ${outcome.diagnostic.sanitizedIssue}`);
  };
  await secTask();
  {
    for (const query of session.permittedQueries.slice(0, 2)) {
      if (Date.now() >= budget.deadline) break;
      await search(query, "initial_financing_discovery");
    }
  }
  for (let cycle = 0; cycle < 2 && options.followup !== false; cycle++) {
    result.events = reconcileFunding(result.events);
    const gaps = fundingGaps(result.events);
    if (!gaps.length || budget.used.search >= budget.limits.search || budget.used.fetch >= budget.limits.fetch || Date.now() + 2000 >= budget.deadline) break;
    try {
      const proposal = await model({ tier: "medium", task: "plan_funding_followup", fetchImpl: budget.fetch(), input: {
        entityId: graph.entityId, confirmedTarget: { name: graph.canonicalName, domain: graph.domains[0] },
        events: result.events, gaps, previousActions: result.actions,
        permittedQueries: session.permittedQueries.filter((q) => !session.searched.has(q)),
        remaining: { limits: budget.limits, used: budget.used, milliseconds: budget.deadline - Date.now() },
        availableTools: [claraToolRegistry.get("funding_search")!].map((tool) => ({ name: tool.name, inputSchema: tool.inputSchema })),
      }, schema: (value) => validateFundingPlan(value, context, gaps) });
      result.modelRuns!.push({ task: "plan_funding_followup", status: proposal ? "validated_action" : "validated_stop" });
      if (!proposal) break;
      await search(proposal.query, proposal.targetGap, true);
    } catch (error) {
      const code = safeModelFailure(error);
      result.modelRuns!.push({ task: "plan_funding_followup", status: "failed", code });
      result.limitations.push(`Follow-up planning ${code}; initial results retained.`); break;
    }
  }
  result.events = reconcileFunding(result.events);
  result.gaps = fundingGaps(result.events);
  const announcementResults = providerResults.filter((r) => r.providerId === "serpApiWebSearch");
  result.announcementStatus = result.events.some((event) => event.sourceKind === "announcement") ? result.gaps.length ? "partial" : "supported" : announcementResults.some((r) => ["success", "noData"].includes(r.status)) ? "no_information" : "inaccessible";
  if (["issuer_unresolved", "inaccessible"].includes(result.secStatus)) result.gaps.push("SEC issuer association remains unresolved in this request");
  if (Date.now() >= budget.deadline || Object.entries(budget.used).some(([key, used]) => used >= budget.limits[key as keyof typeof budget.used])) {
    result.limitations.push("A request cap or research deadline was reached; unresolved questions remain.");
    if (!result.events.some((e) => e.sourceKind === "announcement")) result.announcementStatus = "budget_exhausted";
  }
  result.limitations.push("Bounded public-source review, not complete funding history. No amounts are summed. Separate source statements are not automatically the same event.");
  return { fundingResearch: result, evidence, providerResults };
}

/** Merge newly discovered general-research announcements without another network/model pass. */
export function integrateFollowupFunding(result: FundingResearch, pages: RawEvidence[], graph: import("../types").EntityIdentityGraph) {
  for (const page of pages) {
    if (page.entityMatchConfidence === "Low" || Array.isArray(page.structuredData.fundingEvents) && page.structuredData.fundingEvents.length) continue;
    const events = deterministicFundingCandidates(page, graph);
    if (events.length) { page.structuredData.fundingEvents = events; result.events.push(...events); }
  }
  result.events = reconcileFunding(result.events);
  result.gaps = [...new Set([...fundingGaps(result.events), ...result.gaps.filter(g=>/SEC/.test(g))])];
  if (result.events.some(e=>e.sourceKind==="announcement")) result.announcementStatus=result.gaps.length?"partial":"supported";
}
