import assert from 'node:assert/strict';
import test from 'node:test';
import {tsImport} from 'tsx/esm/api';
const root=new URL('../app/lib/private-diligence/',import.meta.url);
const {validateSourceFacts,validateResearchAction,permittedResearchQueries}=await tsImport(new URL('research/adaptive.ts',root).href,import.meta.url);
const {ResearchBudget}=await tsImport(new URL('research/budget.ts',root).href,import.meta.url);
const {createWebResearchTool}=await tsImport(new URL('tools/webResearchTool.ts',root).href,import.meta.url);
const {normalizeEvidenceRegistry}=await tsImport(new URL('evidence/evidenceRegistry.ts',root).href,import.meta.url);
const {buildClaimRegistry}=await tsImport(new URL('evidence/claimRegistry.ts',root).href,import.meta.url);
const {buildQuickCompanyIntelligenceReport}=await tsImport(new URL('reports/quickReportBuilder.ts',root).href,import.meta.url);
const graph={entityId:'e',canonicalName:'Acme',domains:['acme.example'],targetSelectionStatus:'userSelected',legalNames:[],founders:[],executives:[],addresses:[],phoneNumbers:[],identityVerificationStatus:'unverified'};
const context={identityGraph:graph,researchId:'r',input:{workflowMode:'quick',locale:'en'},researchSession:{budget:new ResearchBudget(),permittedQueries:[],searched:new Set()}};
const page={researchId:'r',entityId:'e',evidenceId:'p',sourceUrl:'https://acme.example/about',publicReferenceUrl:'https://acme.example/about',retrievedAt:'2026-09-18',publicationDate:null,entityMatchConfidence:'High',rawText:'Acme builds tools for secure collaboration.',structuredData:{},companyReported:true,sourceTier:2,providerId:'companyWebsite',sourceTitle:'About',matchedEntitySignals:['confirmed domain'],limitations:[],contentHash:'one'};
const fact={entityId:'e',evidenceId:'p',topic:'overview',value:page.rawText,excerpt:page.rawText};
test('model facts must bind the locked entity, original evidence and verbatim excerpt',()=>{
 assert.equal(validateSourceFacts({facts:[fact]},[page],'e').length,1);
 for(const override of [{entityId:'other'},{evidenceId:'invented'},{value:'Acme has 100 customers'},{excerpt:'A search snippet supports this claim'},{topic:'recent'}])assert.equal(validateSourceFacts({facts:[{...fact,...override}]},[page],'e').length,0);
 assert.equal(validateSourceFacts({facts:[fact]},[{...page,entityMatchConfidence:'Low'}],'e').length,0);
});
test('dated developments require original publication metadata',()=>{
 const quote='Acme launched its collaboration platform with shared project workspaces.';
 assert.equal(validateSourceFacts({facts:[{source:0,topic:'recent',quote}]},[{...page,rawText:quote,publicationDate:'2026-09-01'}],'e').length,1);
});
test('source facts survive normalization, claims, and localized report mapping',()=>{
 const facts=validateSourceFacts({facts:[fact]},[page],'e');
 const evidence=normalizeEvidenceRegistry([{...page,structuredData:{researchFacts:facts}}]);
 const claims=buildClaimRegistry('r','e',evidence);
 const report=buildQuickCompanyIntelligenceReport({researchId:'r',input:context.input,graph,providerPlan:[],evidence,claims,informationGaps:[],generatedAt:'2026-09-18',adaptiveResearch:{facts,coverage:[],actions:[],modelRuns:[],stopReason:'coverage_sufficient'}});
 assert.equal(claims[0].researchFact.excerpt,page.rawText);
 assert.deepEqual(report.sections[0].claimIds,[claims[0].claimId]);
 assert.match(report.sections[0].paragraphsByLocale.en.join(' '),/Acme builds/);
 assert.match(report.sections[0].paragraphsByLocale.zh.join(' '),/Acme builds/);
});
test('planner is restricted to registered tool and exact meaningful unused gap query',()=>{
 const permitted=permittedResearchQueries(context,[]),p=permitted[0];
 const action={action:'execute_tool',toolName:'web_research',input:{query:p.query},entityId:'e',targetGap:p.gap};
 assert.equal(validateResearchAction(action,context,permitted).query,p.query);
 for(const override of [{toolName:'shell'},{entityId:'other'},{input:{query:'invented'}},{input:{query:p.query,url:'http://localhost'}},{targetGap:'invented'}])assert.throws(()=>validateResearchAction({...action,...override},context,permitted));
 context.researchSession.searched.add(p.query.toLowerCase());
 assert.throws(()=>validateResearchAction(action,context,permitted));context.researchSession.searched.clear();
});
test('web tool itself rejects arbitrary queries, target overrides and duplicates without calling provider',async()=>{
 const tool=createWebResearchTool({createRegistry:()=>{throw Error('must not execute')}});
 assert.equal((await tool.execute({query:'arbitrary'},context)).errors[0].code,'invalid_or_duplicate_research_query');
 const p=permittedResearchQueries(context,[])[0];context.researchSession.permittedQueries=[p];context.researchSession.searched.add(p.query.toLowerCase());
 assert.equal((await tool.execute({query:p.query},context)).errors[0].code,'invalid_or_duplicate_research_query');
 context.researchSession.searched.clear();
 assert.equal((await tool.execute({query:p.query,entityId:'other'},context)).status,'failed');
});
test('shared transport counts actual attempts, reuses run-local GETs and enforces deadline/caps',async()=>{
 const budget=new ResearchBudget();let calls=0;
 const f=budget.fetch(async()=>{calls++;return new Response('body');});
 const results=await Promise.all([f('https://acme.example/about'),f('https://acme.example/about')]);
 assert.deepEqual(await Promise.all(results.map(r=>r.text())),['body','body']);assert.equal(calls,1);assert.equal(budget.used.page,1);
 for(let i=0;i<9;i++)await f('https://api.tavily.com/search',{method:'POST'});
 await assert.rejects(()=>f('https://api.tavily.com/search',{method:'POST'}),/RESEARCH_BUDGET_EXHAUSTED/);
 assert.equal(budget.used.search,9);
 await assert.rejects(()=>new ResearchBudget(Date.now()-1).fetch(async()=>new Response('bad'))('https://acme.example'),/RESEARCH_BUDGET_EXHAUSTED/);
 assert.ok(!JSON.stringify(budget.snapshot()).includes('Authorization'));
});
test('navigation fragments and marketing imperatives do not become research facts',()=>{
 for(const [topic,quote] of [['products','Products Datasets Platform Services'],['products','Datasets Acme Forge Platform RL Environment Physical AI'],['people','Acme was founded with the idea of making collaboration better.'],['overview','Scale speech AI with Audio Annotation Services']]){
  assert.equal(validateSourceFacts({facts:[{source:0,topic,quote}]},[{...page,rawText:quote}],'e').length,0);
 }
});
test('an adaptive original announcement reaches funding fields without additional requests',async()=>{
 const {integrateFollowupFunding}=await tsImport(new URL('funding/research.ts',root).href,import.meta.url);
 const text='Today, we’re announcing a $200 million Series D at a $5.2B valuation.';
 const source={...page,sourceTitle:'Announcing Acme’s Series D',rawText:text,structuredData:{fundingText:text}};
 const result={events:[],gaps:['SEC issuer association remains unresolved in this request'],announcementStatus:'no_information'};
 integrateFollowupFunding(result,[source],{...graph,dbaNames:[]});
 assert.ok(result.events.some(e=>e.fields.amount?.value===200000000 && e.fields.valuation?.value===5200000000));
 assert.ok(!result.events[0].fields.currency);assert.ok(result.gaps.some(g=>/SEC/.test(g)));
 for(const extra of [{companyReported:false},{sourceTitle:'Our customer Acme raises Series D'},{publicReferenceUrl:'https://unrelated.example/news'}]) {
  const rejected={events:[],gaps:[]};integrateFollowupFunding(rejected,[{...source,structuredData:{fundingText:text},...extra}],{...graph,dbaNames:[]});assert.equal(rejected.events.length,0);
 }
 const normalized=normalizeEvidenceRegistry([source]);const claims=buildClaimRegistry('r','e',normalized);
 assert.ok(claims.some(c=>c.claimType==='funding.amount' && c.normalizedValue===200000000));
});

test('a customer executive on a product page cannot enter company leadership',()=>{
 const quote='George Example Chief Information Security Officer';
 assert.equal(validateSourceFacts({facts:[{source:0,topic:'people',quote}]},[{...page,sourceUrl:'https://acme.example/products/risk',rawText:quote}],'e').length,0);
});
test('company-owned competitor articles and blog authors are not company facts',()=>{
 const source={...page,sourceUrl:'https://acme.example/blog/comparison',companyReported:true};
 for(const [topic,quote] of [['overview','OtherCompany is a leading data labeling and management platform.'],['people','Yuna Example, Marketing Curator'],['recent','February 18, 2026 What is Acme?']]) {
  assert.equal(validateSourceFacts({facts:[{source:0,topic,quote}]},[{...source,rawText:quote,publicationDate:'2026-02-18'}],'e','Acme').length,0);
 }
});

test('people use their own grammatical subject while company descriptions stay target-scoped',()=>{
 const quote='Morgan Chen is the CEO of Acme.';
 assert.equal(validateSourceFacts({facts:[{source:0,topic:'people',quote}]},[{...page,rawText:quote}],'e','Acme').length,1);
});
test('name-only candidate discovery reserves reachable brand options without verifying legal entities',async()=>{
 const {rankCandidateOptions,hasFirstPartyBrandCandidate}=await tsImport(new URL('entity-resolution/candidateDiscovery.ts',root).href,import.meta.url);
 const brand={displayName:'Mercury',domain:'mercury.com',websiteReachable:true,pageTitles:['Mercury | Business banking'],matchScore:45};
 const directory={displayName:'Mercury Records',domain:'mercuryrecords.com',websiteReachable:false,pageTitles:[],matchScore:35};
 assert.equal(rankCandidateOptions([directory,brand],'Mercury')[0],brand);
 assert.ok(hasFirstPartyBrandCandidate(brand,'Mercury'));
 assert.ok(!hasFirstPartyBrandCandidate({...brand,pageTitles:['Unrelated directory']},'Mercury'));
 assert.ok(!hasFirstPartyBrandCandidate({...brand,websiteReachable:false},'Mercury'));
});

test('candidate cards leave a specialized subsidiary unresolved until a brand operator is supported',async()=>{
 const {discoverEntityCandidates}=await tsImport(new URL('entity-resolution/candidateDiscovery.ts',root).href,import.meta.url);
 const input={companyName:'Acme',website:'https://acme.example',workflowMode:'quick'};
 const html=(legal)=>`<title>Acme | Business tools</title><script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script><p>${legal}</p>`;
 const options=(legal)=>({paths:['/terms'],resolveHost:async()=>[{address:'93.184.216.34',family:4}],fetchImpl:async u=>new Response(String(u).endsWith('/robots.txt')?'':html(legal),{headers:{'content-type':'text/html'}})});
 const subsidiary=await discoverEntityCandidates('card-reject',input,options('Acme Advisory LLC is an investment adviser.'));
 assert.equal(subsidiary.candidates[0].legalName,null);
 assert.deepEqual(subsidiary.candidates[0].termsLegalNames,[]);
 const operator=await discoverEntityCandidates('card-accept',input,options('Acme Technologies Inc. ("Acme", "we") operates this website. Acme Advisory LLC is an investment adviser.'));
 assert.equal(operator.candidates[0].legalName,'Acme Technologies Inc.');
 assert.equal(operator.candidates[0].displayName,'Acme');
});

test('hiring retrieval failure is not a covered zero-role result',async()=>{
 const {buildQuickReportVisualizations}=await tsImport(new URL('reports/quickReportPresentation.ts',root).href,import.meta.url);
 const base={evidence:[],claims:[],hiringIntelligence:{status:'browser_fallback_failed',jobs:[],summary:{totalOpenRoles:0}}};
 assert.equal(buildQuickReportVisualizations(base).coverage.find(x=>x.id==='hiring').covered,false);
 base.hiringIntelligence.status='success_zero_jobs';
 assert.equal(buildQuickReportVisualizations(base).coverage.find(x=>x.id==='hiring').covered,true);
 const quote='96% of employees say that Acme is a great place to work.';
 assert.equal(validateSourceFacts({facts:[{source:0,topic:'overview',quote}]},[{...page,sourceUrl:'https://acme.example/jobs',rawText:quote}],'e','Acme').length,0);
});

test('an inaccessible initial search is not reported as an empty successful search',async()=>{
 const {researchAdaptively}=await tsImport(new URL('research/adaptive.ts',root).href,import.meta.url);
 const isolated={...context,researchSession:{...context.researchSession,budget:new ResearchBudget(),searched:new Set(),permittedQueries:[]}};
 const providers=[{providerId:'serpApiWebSearch',searchDiagnostics:[{reason:'quotaExhausted'},{reason:'budgetExhausted'}]}];
 const result=await researchAdaptively(isolated,[],undefined,async()=>null,providers);
 assert.equal(result.research.coverage.find(c=>c.topic==='recent').status,'source-unavailable');
 assert.equal(result.research.coverage.find(c=>c.topic==='people').status,'source-unavailable');
 assert.equal(result.research.coverage.find(c=>c.topic==='products').status,'not-researched');
});

test('a named fundraising assistance program is not the company raising a round',async()=>{
 const {deterministicFundingCandidates}=await tsImport(new URL('funding/extraction.ts',root).href,import.meta.url);
 const g={...graph,dbaNames:[]};
 const text='If you’re interested in fundraising support as a Series A company, keep an eye out for the next round of Acme Raise Series A.';
 assert.deepEqual(deterministicFundingCandidates({...page,rawText:text},g),[]);
 const real='Acme has raised $150 million in Series C funding at a $2.45 billion valuation.';
 const [event]=deterministicFundingCandidates({...page,rawText:real},g);
 assert.equal(event.fields.amount.value,150000000);assert.equal(event.fields.valuation.value,2450000000);
});
