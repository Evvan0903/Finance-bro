import { runClaraModel } from '../modelRouter';
import { getClaraTool } from '../tools/registry';
import { executeClaraTool } from '../state/executeClaraTool';
import type { ClaraToolContext } from '../tools/types';
import type { RawEvidence, PrivateProviderResult } from '../types';
import type { SourceFact, ResearchTopic, AdaptiveResearch, TargetResearchProgress } from './types';
import { activeResearchTargets, researchTargetForTopic } from './registry';
import { supportsExpandedStatement } from './sourceStatements';
const topics = activeResearchTargets().flatMap(t=>t.topic ? [t.topic] : []);
const expandedTopics = new Set<ResearchTopic>(['customers','partnerships','pricing','security']);
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
    if (!source || source.structuredData.searchSnippet === true || f.entityId !== entityId || !topics.includes(f.topic as ResearchTopic) || typeof f.value !== 'string' || typeof f.excerpt !== 'string') continue;
    const text = tidy(source.rawText), excerpt = tidy(f.excerpt), statement = tidy(f.value);
    if (excerpt.length < 20 || excerpt.length > 1000 || statement.length < 8 || statement.length > 400 || !text.includes(excerpt) || !excerpt.includes(statement)) continue;
    if (/\b(?:get started|join the modern way|learn more|book a demo|sign up)\b/i.test(statement)) continue;
    if (f.topic === 'overview' && /\/(?:careers|jobs)(?:\/|$)/i.test(new URL(source.sourceUrl).pathname)) continue;
    if (/^(?:(?:products?|services?|datasets?|solutions?|resources?|platform|compliance)\s+){2}/i.test(statement)) continue;
    if (f.topic === 'products' && (statement.match(/\b(?:datasets?|platform|environment|products?|services?|solutions?|resources?)\b/gi)?.length ?? 0) >= 3 && !/\b(?:is|are|provides|offers|builds|enables|supports|helps|collecting|delivers)\b/i.test(statement)) continue;
    if (f.topic === 'people' && !/\b(?:CEO|CFO|COO|CTO|CRO|CMO|CPO|CCO|chief|head of|VP|vice president|president|director|co-founder|founder|founding member)\b/i.test(statement)) continue;
    if (f.topic === 'people' && /\/(?:products?|customers?|case-studies|solutions?)\b/i.test(new URL(source.sourceUrl).pathname)) continue;
    if (f.topic === 'overview' && !/\b(?:is|are|provides|offers|builds|helps|enables|develops|delivers|operates|company|platform)\b/i.test(statement)) continue;
    if (expandedTopics.has(f.topic as ResearchTopic)) {
      if (!confirmedName || !source.companyReported || !supportsExpandedStatement(f.topic as ResearchTopic, statement, confirmedName)) continue;
    }
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
      if (!expandedTopics.has(f.topic as ResearchTopic) && f.topic!=='people' && subject && !new RegExp(`\\b${quotedName}\\b`,'i').test(subject[1]) && !/^(?:we|our company|the company|the platform|it)$/i.test(subject[1])) continue;
    }
    if (source.publicationDate && f.topic==='products' && /\b(?:has acquired|launched|introduced|now supports)\b/i.test(statement)) f.topic='recent';
    if (f.topic==='overview' && /\b(?:helps? us|helped us|one-stop shop|we love|we chose)\b/i.test(statement)) continue;
    if (f.topic==='recent' && statement.length<60) continue;
    if (f.topic==='recent' && !/\b(?:announc(?:e|es|ed|ing)|rais(?:e|es|ed|ing)|acquir(?:e|es|ed)|launch(?:ed|es)?|released|introduced|appointed|received|opened|now supports)\b/i.test(statement)) continue;
    // Current events need a source date, not the date the crawler happened to run.
    if (f.topic === 'recent' && !source.publicationDate) continue;
    if (facts.some(old => old.topic === f.topic && old.value === statement)) continue;
    facts.push({ topic: f.topic as ResearchTopic, targetId:researchTargetForTopic(f.topic as ResearchTopic).id, value: statement, excerpt, evidenceId: source.evidenceId, sourceUrl: source.publicReferenceUrl, retrievedAt: source.retrievedAt, publicationDate: source.publicationDate });
  }
  return facts;
}

const signalPatterns: Record<ResearchTopic, RegExp> = {
  overview:/about|company|platform/i, products:/products?|services?|documentation|developer|integrations?/i,
  people:/founder|leadership|team|appoint|chief|executive/i, recent:/news|press|announc|launch|acquir|released/i,
  customers:/customers?|case[- ]stud(?:y|ies)|adopted|deployed/i, partnerships:/partners?|strategic alliance|collaborat/i,
  pricing:/pricing|subscription|free tier|per month|per user/i, security:/security|trust|compliance|SOC 2|ISO 27001|FedRAMP/i,
};
export function researchTargetSignal(topic: ResearchTopic, sources: RawEvidence[]) {
  return sources.filter(s=>s.entityMatchConfidence!=='Low').reduce((score,s)=>{
    const links=Array.isArray(s.structuredData.links)?s.structuredData.links.filter((x):x is string=>typeof x==='string').join(' '):'';
    return score+(signalPatterns[topic].test(s.sourceUrl)?3:0)+(signalPatterns[topic].test(links)?2:0)+(signalPatterns[topic].test(s.rawText)?1:0);
  },0);
}
export function permittedResearchQueries(context: ClaraToolContext, facts: SourceFact[], sources: RawEvidence[] = [], progress: TargetResearchProgress[] = []) {
  const graph=context.identityGraph!,domain=graph.domains[0],name=graph.canonicalName.replace(/["\\]/g,' ');
  if (!domain) return [];
  const terms:Record<ResearchTopic,[string,string]>={
    people:['founders leadership team','executive appointed chief leadership'], products:['products services platform','product capabilities developer integrations'],
    overview:['about company','business platform company overview'],recent:[`announces launch ${new Date().getUTCFullYear()} ${new Date().getUTCFullYear()-1}`,'acquisition product release announcement'],
    customers:['customers case study uses adopted','customer selected deployed case study'],partnerships:['partnership partnered with announcement','strategic alliance collaboration announcement'],
    pricing:['pricing plans subscription','pricing free plan contact sales'],security:['security trust SOC 2 ISO 27001','compliance certification attestation FedRAMP'],
  };
  const gaps:Record<ResearchTopic,string>={people:'Key people and roles need attributable source text',products:'Products or services need attributable source text',overview:'What the company does needs attributable source text',recent:'Dated company developments remain unsupported',customers:'Customer relationships need explicit original statements',partnerships:'Partner relationships need explicit original statements',pricing:'Published pricing needs original commercial terms',security:'Security and compliance need precisely scoped original statements'};
  return topics.flatMap(topic=>{
    const target=researchTargetForTopic(topic),state=progress.find(p=>p.topic===topic),signal=researchTargetSignal(topic,sources);
    if (state?.stopReason || state?.attempts && state.attempts>=2 || facts.filter(f=>f.topic===topic).length>=2) return [];
    // Optional branches deepen only where the original pages/links show relevant signals.
    if (expandedTopics.has(topic) && signal===0) return [];
    const query=terms[topic].map(term=>`site:${domain} "${name}" ${term}`).find(q=>!context.researchSession?.searched.has(tidy(q).toLowerCase()));
    if (!query) return [];
    return [{topic,targetId:target.id,query,gap:gaps[topic],signal,score:target.expectedValue+Math.min(signal,6)-target.expectedCost-(state?.attempts??0)}];
  }).sort((a,b)=>b.score-a.score);
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

export async function researchAdaptively(context: ClaraToolContext, original: RawEvidence[], researchStateId?: string, model = runClaraModel, initialProviderResults: PrivateProviderResult[] = [], dependencies: {
  executeTool?: (input: {query:string}, context: ClaraToolContext) => Promise<import('../tools/types').ClaraToolResult<unknown>>;
} = {}) {
  const session=context.researchSession!;
  const targets:Array<TargetResearchProgress & {topic:ResearchTopic}>=topics.map(topic=>({targetId:researchTargetForTopic(topic).id,topic,phase:'discovery',attempts:0,emptyAttempts:0,status:'not_researched',stopReason:null,evidenceIds:[]}));
  const result:AdaptiveResearch={facts:[],targets,coverage:[],actions:[],modelRuns:[],stopReason:'coverage_sufficient'};
  const evidence:RawEvidence[]=[],providerResults:PrivateProviderResult[]=[];
  const seen=new Set<string>();
  const addFacts=(facts:SourceFact[],sources:RawEvidence[])=>{
    for(const f of facts) if(!result.facts.some(old=>old.topic===f.topic&&old.value===f.value)) {
      result.facts.push(f);
      const source=sources.find(s=>s.evidenceId===f.evidenceId)!;
      source.structuredData.researchFacts=[...(source.structuredData.researchFacts as SourceFact[]??[]),f];
      const target=targets.find(t=>t.topic===f.topic)!;
      target.status='supported';target.stopReason='useful_evidence_obtained';target.evidenceIds=[...new Set([...target.evidenceIds,f.evidenceId])];
    }
  };
  const deterministic=(pages:RawEvidence[])=>{
    for(const source of pages.filter(s=>s.entityMatchConfidence!=='Low')) {
      const candidates=Array.isArray(source.structuredData.factCandidates)?source.structuredData.factCandidates as Array<{factType:string;excerpt:string}>:[];
      const proposals=[
        ...(!/careers|privacy|terms|legal/.test(new URL(source.sourceUrl).pathname)&&typeof source.structuredData.description==='string'?[{topic:'overview',quote:source.structuredData.description}]:[]),
        ...candidates.map(c=>({topic:c.factType==='executiveRole'?'people':'products',quote:c.excerpt})),
        ...source.rawText.split(/(?<=[.!?])\s+|[\r\n]+/).filter(s=>s.length>=20&&s.length<=400).flatMap(quote=>[...expandedTopics].filter(topic=>supportsExpandedStatement(topic,quote,context.identityGraph!.canonicalName)).map(topic=>({topic,quote}))),
      ];
      for(const proposal of proposals) {
        if(result.facts.filter(f=>f.topic===proposal.topic).length>=2) continue;
        addFacts(validateSourceFacts({facts:[{source:0,...proposal}]},[source],context.identityGraph!.entityId,context.identityGraph!.canonicalName),[source]);
      }
    }
  };
  const extract=async(pages:RawEvidence[])=>{
    deterministic(pages);
    const candidates=pages.filter(p=>!seen.has(p.publicReferenceUrl)&&p.entityMatchConfidence!=='Low'&&p.rawText.length>160&&!/privacy|terms|legal|cookie|careers|\/jobs\b/.test(new URL(p.sourceUrl).pathname));
    const score=(p:RawEvidence)=>(/about|team|leadership/.test(p.sourceUrl)?5:0)+(p.publicationDate?4:0)+(/product|service|customer|partner|pricing|security|trust/.test(p.sourceUrl)?3:0)+(p.companyReported?2:0);
    const ranked=candidates.sort((a,b)=>score(b)-score(a));
    const sources:RawEvidence[]=[];
    // Give distinct promising branches an original page before repeating one topic.
    const missing=topics.filter(t=>!result.facts.some(f=>f.topic===t));
    const expanded=missing.filter(t=>expandedTopics.has(t)&&ranked.some(p=>signalPatterns[t].test(p.sourceUrl))).slice(0,2);
    for(const topic of [...expanded,...missing.filter(t=>!expanded.includes(t))]) {
      const source=ranked.find(p=>!sources.includes(p)&&signalPatterns[topic].test(p.sourceUrl));
      if(source&&sources.length<4)sources.push(source);
    }
    for(const source of ranked)if(sources.length<4&&!sources.includes(source))sources.push(source);
    if(!sources.length||Date.now()+1200>=session.budget.deadline||session.budget.used.model>=session.budget.limits.model) return;
    sources.forEach(s=>seen.add(s.publicReferenceUrl));
    try {
      const facts=await model({tier:'medium',task:'extract_research_facts',fetchImpl:session.budget.fetch(),input:{entityId:context.identityGraph!.entityId,confirmedName:context.identityGraph!.canonicalName,domain:context.identityGraph!.domains[0],targets:activeResearchTargets().filter(t=>t.topic),sources:sources.map(s=>({evidenceId:s.evidenceId,url:s.publicReferenceUrl,publicationDate:s.publicationDate,text:s.rawText.slice(0,12000)}))},schema:v=>validateSourceFacts(v,sources,context.identityGraph!.entityId,context.identityGraph!.canonicalName)});
      addFacts(facts,sources);result.modelRuns.push({task:'extract_research_facts',status:'validated',acceptedFacts:facts.length});
    } catch(error) {result.modelRuns.push({task:'extract_research_facts',status:error instanceof Error&&['AbortError','TimeoutError'].includes(error.name)?'timeout':'unavailable_or_invalid'});}
  };
  // Stage A reuses all baseline original pages; inspecting a link is a lead, never a fact.
  for(const target of targets) {
    const initialProvider=initialProviderResults.find(p=>p.providerId==='serpApiWebSearch');
    const configured=session.providerOptions?.serpApi?.queries;
    const index=configured?configured.findIndex(q=>signalPatterns[target.topic].test(q.query)):(target.topic==='people'?0:target.topic==='recent'?1:-1);
    const initial=initialProvider?.searchDiagnostics?.[index]??(index>=0&&initialProvider?.status==='invalidConfiguration'?initialProvider.searchDiagnostics?.[0]:undefined);
    if(initial) {
      target.attempts=initial.attempts?.length?Number(initial.attempts.some(a=>a.attempted)):1;
      const failed=initialProvider?.status&& !['success','partial','noData','notRelevant'].includes(initialProvider.status);
      target.status=!failed&&['results','empty','filteredOut'].includes(initial.reason)?'discovered':'source_unavailable';
      if(!failed&&['empty','filteredOut'].includes(initial.reason)){target.emptyAttempts=1;target.status='searched_not_found';}
      if(target.status==='source_unavailable')target.stopReason='provider_unavailable';
    }
    if(researchTargetSignal(target.topic,original)>0&&target.status==='not_researched')target.status='discovered';
  }
  await extract(original);
  for(let step=0;step<2;step++) {
    if(Date.now()+6500>=session.budget.deadline||session.budget.used.model>=session.budget.limits.model-1||session.budget.used.tools>=session.budget.limits.tools||session.budget.used.search>=session.budget.limits.search||session.budget.used.page>=session.budget.limits.page) {result.stopReason='budget_exhausted';break;}
    const permitted=permittedResearchQueries(context,result.facts,[...original,...evidence],targets);
    if(!permitted.length){result.stopReason='low_marginal_value_or_sources_exhausted';break;}
    session.permittedQueries=permitted;
    try {
      const action=await model({tier:'medium',task:'plan_research_followup',fetchImpl:session.budget.fetch(),input:{objective:'Within the research budget, discover the highest-value supported information available about the confirmed private company.',entityId:context.identityGraph!.entityId,target:{name:context.identityGraph!.canonicalName,domain:context.identityGraph!.domains[0]},facts:result.facts,targets,permitted,priorActions:result.actions,remaining:session.budget.snapshot(),tool:{name:'web_research',inputSchema:getClaraTool('web_research')!.inputSchema}},schema:v=>validateResearchAction(v,context,permitted)});
      result.modelRuns.push({task:'plan_research_followup',status:action?'validated_action':'validated_stop'});
      if(!action){result.stopReason='low_value_or_sources_exhausted';break;}
      const target=targets.find(t=>t.topic===action.topic)!;
      target.phase='deepening';target.attempts++;
      session.budget.take('tools');
      const input={query:action.query};
      const outcome=dependencies.executeTool?await dependencies.executeTool(input,context):researchStateId?await executeClaraTool({researchStateId,toolName:'web_research',input,context}):await getClaraTool('web_research')!.execute(input,context);
      // The real tool does this itself; retain duplicate protection with injected deterministic executors too.
      session.searched.add(tidy(action.query).toLowerCase());
      const providers=(outcome.data as {providerResults?:PrivateProviderResult[]})?.providerResults??[];
      providerResults.push(...providers);evidence.push(...outcome.evidence);
      const before=result.facts.length;
      await extract(outcome.evidence);
      const incremental=result.facts.length-before;
      result.actions.push({targetId:target.targetId,topic:target.topic,toolName:'web_research',query:action.query,gap:action.gap,status:outcome.status,evidenceIds:outcome.evidence.map(e=>e.evidenceId),incrementalFacts:incremental});
      const unavailable=outcome.status==='failed'||providers.some(p=>!['success','partial','noData','notRelevant'].includes(p.status));
      const unmatched=outcome.evidence.length>0&&outcome.evidence.every(e=>e.entityMatchConfidence==='Low');
      if(unmatched){target.status='entity_unresolved';target.stopReason='entity_relationship_unresolved';}
      else if(!incremental&&unavailable){target.status='source_unavailable';target.stopReason='provider_unavailable';}
      else if(incremental){target.status=result.facts.some(f=>f.topic===target.topic)?'supported':'discovered';target.stopReason='useful_evidence_obtained';}
      else {target.emptyAttempts++;target.status='searched_not_found';if(target.emptyAttempts>=2)target.stopReason='two_empty_attempts';else if(target.attempts>=2)target.stopReason='target_attempt_limit';}
      // A fruitless branch does not cancel useful independent branches.
      result.stopReason='step_limit';
    } catch {result.stopReason='planner_unavailable_or_invalid';result.modelRuns.push({task:'plan_research_followup',status:'unavailable_or_invalid'});break;}
  }
  for(const target of targets)if(!target.stopReason)target.stopReason=result.stopReason==='budget_exhausted'?'run_budget_reached':result.stopReason==='step_limit'?'run_step_limit':result.stopReason==='planner_unavailable_or_invalid'?'planner_unavailable':'low_marginal_value';
  result.coverage=targets.map(target=>{
    const facts=result.facts.filter(f=>f.topic===target.topic),ids=[...new Set(facts.map(f=>f.evidenceId))],sources=[...original,...evidence].filter(e=>ids.includes(e.evidenceId));
    return {topic:target.topic,status:facts.length?(sources.every(e=>e.companyReported)?'company-reported':'independently-reported'):target.status==='source_unavailable'?'source-unavailable':target.status==='entity_unresolved'?'partial':target.status==='searched_not_found'?'searched-not-found':'not-researched',evidenceIds:ids};
  });
  return {research:result,evidence,providerResults};
}

/** Merge parallel deterministic branches without starting any additional work. */
export function mergeTargetProgress(research: AdaptiveResearch, branches: TargetResearchProgress[]) {
  const activeIds=new Set(activeResearchTargets().map(t=>t.id));
  const merged=new Map((research.targets??[]).map(t=>[t.targetId,t]));
  for(const branch of branches)if(activeIds.has(branch.targetId))merged.set(branch.targetId,{...branch,evidenceIds:[...new Set(branch.evidenceIds)]});
  research.targets=[...merged.values()];
  return research.targets;
}
