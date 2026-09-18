import { runClaraModel } from '../modelRouter';
import { getClaraTool } from '../tools/registry';
import { executeClaraTool } from '../state/executeClaraTool';
import type { ClaraToolContext } from '../tools/types';
import type { RawEvidence, PrivateProviderResult } from '../types';
import type { SourceFact, ResearchTopic, AdaptiveResearch } from './types';
const topics: ResearchTopic[] = ['overview', 'products', 'people', 'recent'];
const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();
const fail = () => { throw new Error('INVALID_RESEARCH_OUTPUT'); };

/** The model selects relevant verbatim statements, never supplies free-form factual prose. */
export function validateSourceFacts(value: unknown, sources: RawEvidence[], entityId: string, confirmedName?: string): SourceFact[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { facts?: unknown }).facts)) return fail();
  const facts: SourceFact[] = [];
  for (const item of (value as { facts: unknown[] }).facts.slice(0, 16)) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const selected = typeof row.source === 'number' && Number.isInteger(row.source) ? sources[row.source] : undefined;
    const f = selected ? {...row,entityId,evidenceId:selected.evidenceId,value:row.quote,excerpt:row.quote} as Record<string,unknown> : row;
    const source = sources.find(s => s.evidenceId === f.evidenceId && s.entityId === entityId && s.entityMatchConfidence !== 'Low');
    if (!source || f.entityId !== entityId || !topics.includes(f.topic as ResearchTopic) || typeof f.value !== 'string' || typeof f.excerpt !== 'string') continue;
    const text = tidy(source.rawText), excerpt = tidy(f.excerpt), statement = tidy(f.value);
    if (excerpt.length < 20 || excerpt.length > 1000 || statement.length < 8 || statement.length > 400 || !text.includes(excerpt) || !excerpt.includes(statement)) continue;
    if (/\b(?:get started|join the modern way|learn more|book a demo|sign up)\b/i.test(statement)) continue;
    if (f.topic === 'overview' && /\/(?:careers|jobs)(?:\/|$)/i.test(new URL(source.sourceUrl).pathname)) continue;
    if (/^(?:(?:products?|services?|datasets?|solutions?|resources?|platform|compliance)\s+){2}/i.test(statement)) continue;
    if (f.topic === 'products' && (statement.match(/\b(?:datasets?|platform|environment|products?|services?|solutions?|resources?)\b/gi)?.length ?? 0) >= 3 && !/\b(?:is|are|provides|offers|builds|enables|supports|helps|collecting|delivers)\b/i.test(statement)) continue;
    if (f.topic === 'people' && !/\b(?:CEO|CFO|COO|CTO|CRO|CMO|CPO|CCO|chief|head of|VP|vice president|president|director|co-founder|founder|founding member)\b/i.test(statement)) continue;
    if (f.topic === 'people' && /\/(?:products?|customers?|case-studies|solutions?)\b/i.test(new URL(source.sourceUrl).pathname)) continue;
    if (f.topic === 'overview' && !/\b(?:is|are|provides|offers|builds|helps|enables|develops|delivers|operates|company|platform)\b/i.test(statement)) continue;
    if (confirmedName) {
      const quotedName = confirmedName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const namesTarget = new RegExp(`\\b${quotedName}\\b`,'i').test(statement);
      const path = new URL(source.sourceUrl).pathname;
      const profile = source.companyReported && (/^\/$|\/(?:about|team|leadership|platform|products?|services?)(?:\/|$)/i.test(path));
      const leadership = source.companyReported && /\/(?:about|team|leadership)(?:\/|$)|introduc.*(?:cfo|cco|ceo|leadership)|appoint/i.test(path);
      // An official site can describe competitors, customers or blog authors.
      // Domain ownership alone cannot establish the subject of an individual fact.
      if (f.topic==='people' && !namesTarget && !leadership) continue;
      if ((f.topic==='overview' || f.topic==='products') && !namesTarget && !profile) continue;
      const subject = statement.match(/^([A-Z][A-Za-z0-9 &.-]{1,40}?)\s+(?:is|are|offers|provides|builds|develops)\b/);
      if (f.topic!=='people' && subject && !new RegExp(`\\b${quotedName}\\b`,'i').test(subject[1]) && !/^(?:we|our company|the company|the platform|it)$/i.test(subject[1])) continue;
    }
    if (source.publicationDate && f.topic==='products' && /\b(?:has acquired|launched|introduced|now supports)\b/i.test(statement)) f.topic='recent';
    if (f.topic==='overview' && /\b(?:helps? us|helped us|one-stop shop|we love|we chose)\b/i.test(statement)) continue;
    if (f.topic==='recent' && statement.length<60) continue;
    if (f.topic==='recent' && !/\b(?:announc(?:e|es|ed|ing)|rais(?:e|es|ed|ing)|acquir(?:e|es|ed)|launch(?:ed|es)?|released|introduced|appointed|received|opened|now supports)\b/i.test(statement)) continue;
    // Current events need a source date, not the date the crawler happened to run.
    if (f.topic === 'recent' && !source.publicationDate) continue;
    if (facts.some(old => old.topic === f.topic && old.value === statement)) continue;
    facts.push({ topic: f.topic as ResearchTopic, value: statement, excerpt, evidenceId: source.evidenceId, sourceUrl: source.publicReferenceUrl, retrievedAt: source.retrievedAt, publicationDate: source.publicationDate });
  }
  return facts;
}

export function permittedResearchQueries(context: ClaraToolContext, facts: SourceFact[]) {
  const graph = context.identityGraph!, domain = graph.domains[0], name = graph.canonicalName.replace(/["\\]/g, ' ');
  const queries = [
    { topic: 'people' as const, query: `site:${domain} "${name}" founders leadership team`, gap: 'Key people and roles need attributable source text' },
    { topic: 'products' as const, query: `site:${domain} "${name}" products services platform`, gap: 'Products or services need attributable source text' },
    { topic: 'overview' as const, query: `site:${domain} "${name}" about company`, gap: 'What the company does needs attributable source text' },
    { topic: 'recent' as const, query: `site:${domain} "${name}" announces launch ${new Date().getUTCFullYear()} ${new Date().getUTCFullYear()-1}`, gap: 'Dated company developments remain unsupported' },
  ];
  return queries.filter(q => !facts.some(f => f.topic === q.topic));
}
export function validateResearchAction(value: unknown, context: ClaraToolContext, permitted: ReturnType<typeof permittedResearchQueries>) {
  if (!value || typeof value !== 'object') return fail();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(k => !['action','reasonCode','toolName','input','entityId','targetGap'].includes(k))) return fail();
  if (row.action === 'stop' && ['coverage_sufficient','low_value','sources_exhausted','access_blocked'].includes(String(row.reasonCode))) return null;
  const input = row.input as { query?: unknown } | undefined;
  if (row.action !== 'execute_tool' || row.toolName !== 'web_research' || !getClaraTool('web_research') || row.entityId !== context.identityGraph?.entityId || !input || Object.keys(input).some(k=>k!=='query') || typeof input.query !== 'string') return fail();
  const selected = permitted.find(p => p.query === input.query && p.gap === row.targetGap);
  if (!selected || context.researchSession?.searched.has(tidy(selected.query).toLowerCase())) return fail();
  return selected;
}

export async function researchAdaptively(context: ClaraToolContext, original: RawEvidence[], researchStateId?: string, model = runClaraModel, initialProviderResults: PrivateProviderResult[] = []) {
  const session = context.researchSession!;
  const result: AdaptiveResearch = { facts: [], coverage: [], actions: [], modelRuns: [], stopReason: 'coverage_sufficient' };
  const evidence: RawEvidence[] = [], providerResults: PrivateProviderResult[] = [];
  const seen = new Set<string>();
  const extract = async (pages: RawEvidence[]) => {
    const candidates = pages.filter(p => !seen.has(p.publicReferenceUrl) && p.entityMatchConfidence !== 'Low' && p.rawText.length > 160 && !/privacy|terms|legal|cookie|careers|\/jobs\b/.test(new URL(p.sourceUrl).pathname));
    const score = (p: RawEvidence) => (/about|team|leadership/.test(p.sourceUrl)?5:0) + (p.publicationDate?4:0) + (/product|service/.test(p.sourceUrl)?3:0) + (p.companyReported?2:0);
    const sources = candidates.sort((a,b)=>score(b)-score(a)).slice(0,4);
    if (!sources.length) return;
    sources.forEach(s=>seen.add(s.publicReferenceUrl));
    try {
      const facts = await model({ tier:'medium',task:'extract_research_facts',fetchImpl:session.budget.fetch(), input:{ entityId:context.identityGraph!.entityId, confirmedName:context.identityGraph!.canonicalName, domain:context.identityGraph!.domains[0], sources:sources.map(s=>({evidenceId:s.evidenceId, url:s.publicReferenceUrl, publicationDate:s.publicationDate, text:s.rawText.slice(0,12000)})) }, schema:v=>validateSourceFacts(v,sources,context.identityGraph!.entityId,context.identityGraph!.canonicalName) });
      for (const f of facts) if (!result.facts.some(old=>old.topic===f.topic && old.value===f.value)) {
        result.facts.push(f);
        const source = sources.find(s=>s.evidenceId===f.evidenceId)!;
        source.structuredData.researchFacts = [...(source.structuredData.researchFacts as SourceFact[] ?? []), f];
      }
      result.modelRuns.push({task:'extract_research_facts',status:'validated',acceptedFacts:facts.length});
    } catch (error) { result.modelRuns.push({task:'extract_research_facts',status:error instanceof Error && ['AbortError','TimeoutError'].includes(error.name)?'timeout':'unavailable_or_invalid'}); }
  };
  // Reuse already validated deterministic extraction before spending model/search budget.
  for (const source of original.filter(s=>s.entityMatchConfidence!=="Low")) {
    const candidates = Array.isArray(source.structuredData.factCandidates) ? source.structuredData.factCandidates as Array<{factType:string;excerpt:string}> : [];
    const proposals = [
      ...(!/careers|privacy|terms|legal/.test(new URL(source.sourceUrl).pathname) && typeof source.structuredData.description === 'string' ? [{topic:'overview',quote:source.structuredData.description}] : []),
      ...candidates.map(c=>({topic:c.factType==='executiveRole'?'people':'products',quote:c.excerpt})),
    ];
    for (const proposal of proposals) {
      if (result.facts.filter(f=>f.topic===proposal.topic).length>=2) continue;
      const facts=validateSourceFacts({facts:[{source:0,topic:proposal.topic,quote:proposal.quote}]},[source],context.identityGraph!.entityId,context.identityGraph!.canonicalName);
      for (const fact of facts) if (!result.facts.some(f=>f.value===fact.value)) {
        result.facts.push(fact);source.structuredData.researchFacts=[...(source.structuredData.researchFacts as SourceFact[] ?? []),fact];
      }
    }
  }
  await extract(original);
  for (let step=0;step<2;step++) {
    if (Date.now()+6500 >= session.budget.deadline || session.budget.used.model >= session.budget.limits.model-1) { result.stopReason='budget_exhausted'; break; }
    const permitted = permittedResearchQueries(context,result.facts).filter(p=>!session.searched.has(tidy(p.query).toLowerCase()));
    if (!permitted.length) { result.stopReason=topics.every(topic=>result.facts.some(f=>f.topic===topic))?'coverage_sufficient':'sources_exhausted'; break; }
    session.permittedQueries = permitted;
    try {
      const action = await model({tier:'medium', task:'plan_research_followup',fetchImpl:session.budget.fetch(), input:{entityId:context.identityGraph!.entityId, target:{name:context.identityGraph!.canonicalName,domain:context.identityGraph!.domains[0]}, facts:result.facts, permitted, priorActions:result.actions, remaining:session.budget.snapshot(), tool:{name:'web_research', inputSchema:getClaraTool('web_research')!.inputSchema} },schema:v=>validateResearchAction(v,context,permitted)});
      result.modelRuns.push({task:'plan_research_followup',status:action?'validated_action':'validated_stop'});
      if (!action) { result.stopReason='low_value_or_sources_exhausted'; break; }
      const input = {query:action.query};
      session.budget.take('tools');
      const outcome = researchStateId ? await executeClaraTool({researchStateId,toolName:'web_research',input,context}) : await getClaraTool('web_research')!.execute(input,context);
      const providers = (outcome.data as {providerResults?:PrivateProviderResult[]})?.providerResults ?? [];
      providerResults.push(...providers); evidence.push(...outcome.evidence);
      result.actions.push({toolName:'web_research',query:action.query,gap:action.gap,status:outcome.status,evidenceIds:outcome.evidence.map(e=>e.evidenceId)});
      const before = result.facts.length;
      await extract(outcome.evidence);
      if (result.facts.length===before) { result.stopReason=outcome.status==='failed'?'source_unavailable':'no_incremental_evidence'; break; }
      result.stopReason='step_limit';
    } catch { result.stopReason='planner_unavailable_or_invalid'; result.modelRuns.push({task:'plan_research_followup',status:'unavailable_or_invalid'}); break; }
  }
  result.coverage = topics.map(topic=>{
    const facts=result.facts.filter(f=>f.topic===topic), ids=facts.map(f=>f.evidenceId);
    const sources=[...original,...evidence].filter(e=>ids.includes(e.evidenceId));
    const initialSearch = initialProviderResults.find(p=>p.providerId==='serpApiWebSearch');
    const initialOutcome = initialSearch?.searchDiagnostics?.[topic==='people'?0:topic==='recent'?1:-1];
    const initialQuery = Boolean(initialOutcome && ['results','empty','filteredOut'].includes(initialOutcome.reason));
    const initialUnavailable = Boolean(initialOutcome && !initialQuery);
    const inspected = original.some(e=>e.companyReported && e.rawText.length>160);
    const action = result.actions.find(a=>a.gap===permittedResearchQueries(context,[]).find(q=>q.topic===topic)?.gap);
    return {topic,status:facts.length?(sources.every(e=>e.companyReported)?'company-reported':'independently-reported'):action?.status==='failed' || (!action && initialUnavailable)?'source-unavailable':action || initialQuery || inspected?'searched-not-found':'not-researched',evidenceIds:ids};
  });
  return {research:result,evidence,providerResults};
}
