import assert from 'node:assert/strict';
import test from 'node:test';
import {tsImport} from 'tsx/esm/api';
const root=new URL('../app/lib/private-diligence/',import.meta.url);
const {researchTargetRegistry,activeResearchTargets,baselineResearchQueries,searchTopicForResearch}=await tsImport(new URL('research/registry.ts',root).href,import.meta.url);
const {researchAdaptively,permittedResearchQueries,validateSourceFacts,mergeTargetProgress}=await tsImport(new URL('research/adaptive.ts',root).href,import.meta.url);
const {ResearchBudget}=await tsImport(new URL('research/budget.ts',root).href,import.meta.url);
const {claraToolRegistry}=await tsImport(new URL('tools/registry.ts',root).href,import.meta.url);
const graph={entityId:'target',canonicalName:'Acme',domains:['acme.example'],targetSelectionStatus:'userSelected',legalNames:[],founders:[],executives:[],addresses:[],phoneNumbers:[]};
function context(budget=new ResearchBudget()) {return {identityGraph:graph,researchId:'research',input:{workflowMode:'quick',locale:'en'},researchSession:{budget,permittedQueries:[],searched:new Set()}};}
function source(text,topic='about',extra={}) {return {researchId:'research',entityId:'target',evidenceId:`page-${topic}`,sourceUrl:`https://acme.example/${topic}`,publicReferenceUrl:`https://acme.example/${topic}`,retrievedAt:'2026-09-18T00:00:00Z',publicationDate:null,entityMatchConfidence:'High',rawText:text,structuredData:{},companyReported:true,sourceTier:2,providerId:'companyWebsite',sourceTitle:topic,matchedEntitySignals:['confirmed domain'],limitations:[],contentHash:topic,...extra};}
function outcome(evidence=[],status='success',providerResults=[]) {return {status,data:{providerResults},evidence,observations:[],gaps:[],errors:[],metadata:{toolName:'web_research',startedAt:'2026-09-18',completedAt:'2026-09-18',retrievalTime:'2026-09-18',sourceCount:evidence.length}};}
function planner(select) {return async args=>args.schema(args.task==='extract_research_facts'?{facts:[]}:(()=>{const p=select(args.input);return p?{action:'execute_tool',toolName:'web_research',input:{query:p.query},entityId:'target',targetGap:p.gap,reasonCode:'resolve_research_gap'}:{action:'stop',reasonCode:'low_value'};})());}

test('target catalogue is unique, describes real tools and separates active from deferred capabilities',()=>{
 assert.equal(new Set(researchTargetRegistry.map(t=>t.id)).size,researchTargetRegistry.length);
 for(const t of activeResearchTargets()) {
  assert.ok(t.description&&t.decision&&t.resultTypes.length&&t.visualizationModes.length&&t.stopRules.length);
  assert.ok(t.expectedValue>0&&t.expectedCost>=0);
  for(const tool of t.availableTools)assert.ok(claraToolRegistry.has(tool),tool);
 }
 assert.ok(researchTargetRegistry.some(t=>t.classification==='DEFER'));
 assert.ok(researchTargetRegistry.some(t=>t.classification==='DO NOT ADD'));
 assert.ok(!activeResearchTargets().some(t=>['DEFER','DO NOT ADD'].includes(t.classification)));
 assert.equal(searchTopicForResearch('customers'),'customersPartners');
 assert.equal(searchTopicForResearch('partnerships'),'customersPartners');
 const queries=baselineResearchQueries(graph,new Date('2026-09-18'));
 assert.equal(queries.length,2);assert.match(queries[0].query,/leadership.*products/);assert.match(queries[1].query,/announces OR customers OR partners OR news/);assert.ok(!/2026/.test(queries[1].query));
});

test('new optional branches require actual original-page signals and never schedule deferred targets',()=>{
 const c=context();
 const empty=permittedResearchQueries(c,[]);
 assert.ok(!empty.some(p=>['customers','partnerships','pricing','security'].includes(p.topic)));
 const pages=[source('Acme provides secure collaboration software.','pricing',{structuredData:{links:['https://acme.example/customers']}})];
 const promising=permittedResearchQueries(c,[],pages);
 assert.ok(promising.some(p=>p.topic==='pricing'));assert.ok(promising.some(p=>p.topic==='customers'));
 assert.ok(!promising.some(p=>['ip_patents','legal_events','sam_gov'].includes(p.targetId)));
});

test('expanded source facts preserve exact relationships/pricing/security instead of inferring them',()=>{
 const cases=[['customers','Example uses Acme to manage its collaboration workflows.'],['partnerships','Acme partnered with Example to deliver secure collaboration.'],['pricing','Acme Pro subscription costs USD 20 per user per month.'],['security','Acme supports HIPAA compliance workflows for healthcare customers.']];
 for(const [topic,quote] of cases) {
  const [fact]=validateSourceFacts({facts:[{source:0,topic,quote}]},[source(quote,topic)],'target','Acme');
  assert.equal(fact.value,quote);assert.equal(fact.excerpt,quote);assert.equal(fact.sourceUrl,`https://acme.example/${topic}`);
  assert.ok(fact.targetId);assert.equal(fact.publicationDate,null);
 }
 const unsupported=[['customers','Acme Customers Example Logos Global Business'],['customers','Acme might be used by Example in the future.'],['customers','Example uses OtherVendor and competes with Acme.'],['partnerships','Acme integrations include Example and Vendor logos.'],['partnerships','Example partnered with OtherVendor; Acme is another company.'],['security','Acme is certified for all security requirements.'],['pricing','Acme likely costs about USD 100 per month.']];
 for(const [topic,quote] of unsupported)assert.equal(validateSourceFacts({facts:[{source:0,topic,quote}]},[source(quote,topic)],'target','Acme').length,0,quote);
 const quote=cases[0][1];
 assert.equal(validateSourceFacts({facts:[{source:0,topic:'customers',quote}]},[source(quote,'customers',{structuredData:{searchSnippet:true}})],'target','Acme').length,0);
 assert.equal(validateSourceFacts({facts:[{source:0,topic:'customers',quote:'Example uses Acme worldwide for all finance.'}]},[source(quote,'customers')],'target','Acme').length,0);
});

test('a promising discovery receives bounded original-source follow-up and records its target',async()=>{
 const c=context(),queries=[];
 const result=await researchAdaptively(c,[source('Acme pricing and plans are available.','home')],undefined,planner(input=>input.permitted.find(p=>p.topic==='pricing')),[],{executeTool:async(input)=>{queries.push(input.query);return outcome([source('Acme Pro subscription costs USD 20 per user per month.','pricing')]);}});
 assert.equal(queries.length,1);assert.equal(result.research.facts[0].topic,'pricing');
 const target=result.research.targets.find(t=>t.targetId==='pricing');assert.equal(target.attempts,1);assert.equal(target.stopReason,'useful_evidence_obtained');
 assert.equal(result.research.actions[0].incrementalFacts,1);assert.equal(c.researchSession.budget.used.tools,1);
});

test('two empty attempts close only that target with a concrete stop reason',async()=>{
 const c=context(),queries=[];
 const result=await researchAdaptively(c,[source('Customer case studies are available.','customers')],undefined,planner(input=>input.permitted.find(p=>p.topic==='customers')),[],{executeTool:async(input)=>{queries.push(input.query);return outcome();}});
 const target=result.research.targets.find(t=>t.targetId==='customers');
 assert.equal(queries.length,2);assert.notEqual(queries[0],queries[1]);assert.equal(target.emptyAttempts,2);assert.equal(target.stopReason,'two_empty_attempts');
 assert.equal(result.research.coverage.find(t=>t.topic==='customers').status,'searched-not-found');
});

test('a failed provider is unavailable, not absence, and does not cancel another promising branch',async()=>{
 const c=context();let calls=0;
 const result=await researchAdaptively(c,[source('Customer case studies and pricing plans are available.','home')],undefined,planner(input=>input.permitted.find(p=>p.topic===(calls?'pricing':'customers'))),[],{executeTool:async()=>++calls===1?outcome([],'failed') :outcome([source('Acme Pro subscription costs USD 20 per user per month.','pricing')])});
 assert.equal(calls,2);assert.equal(result.research.coverage.find(t=>t.topic==='customers').status,'source-unavailable');
 assert.equal(result.research.coverage.find(t=>t.topic==='pricing').status,'company-reported');
 assert.equal(result.research.targets.find(t=>t.topic==='customers').stopReason,'provider_unavailable');
});

test('wrong-entity original pages leave target unresolved rather than establish absence',async()=>{
 const c=context();
 const result=await researchAdaptively(c,[source('Customer case studies are available.','customers')],undefined,planner(input=>input.permitted.find(p=>p.topic==='customers')),[],{executeTool:async()=>outcome([source('OtherCompany uses a different Acme product.','other',{entityMatchConfidence:'Low'})])});
 const target=result.research.targets.find(t=>t.topic==='customers');assert.equal(target.status,'entity_unresolved');assert.equal(target.stopReason,'entity_relationship_unresolved');
 assert.equal(result.research.coverage.find(t=>t.topic==='customers').status,'partial');assert.equal(result.research.facts.length,0);
});

test('deadline and exhausted shared request budgets prevent additional adaptive tools',async()=>{
 for(const budget of [new ResearchBudget(Date.now()-1),new ResearchBudget()]) {
  budget.used.search=budget.limits.search;
  let calls=0;const result=await researchAdaptively(context(budget),[],undefined,planner(input=>input.permitted[0]),[],{executeTool:async()=>{calls++;return outcome();}});
  assert.equal(calls,0);assert.equal(result.research.stopReason,'budget_exhausted');assert.ok(result.research.targets.every(t=>t.stopReason==='run_budget_reached'));
 }
});

test('parallel branch audit merges active targets and rejects deferred target execution metadata',()=>{
 const research={facts:[],coverage:[],actions:[],modelRuns:[],stopReason:'step_limit'};
 const row=targetId=>({targetId,phase:'discovery',attempts:1,emptyAttempts:0,status:'source_unavailable',stopReason:'provider_unavailable',evidenceIds:[]});
 mergeTargetProgress(research,[row('hiring'),row('funding'),row('legal_entity'),row('ip_patents')]);
 assert.deepEqual(research.targets.map(t=>t.targetId),['hiring','funding','legal_entity']);
});

test('live pilot regressions: self-use, FAQ, CTA, anonymous statistics and ROI cannot become named relationships or pricing',async()=>{
 const {supportsExpandedStatement}=await tsImport(new URL('research/sourceStatements.ts',root).href,import.meta.url);
 const rejected=[
  ['customers','Glean','See how we use Glean Grounded AI draws on trusted company context while preserving source permissions.'],
  ['customers','Glean','What changes when teams use Glean'],
  ['customers','Mercury','What does it cost to use Mercury for businesses?'],
  ['customers','Ramp','Our dataset is built by extracting text from billions of aggregated, anonymized transactions from over 30,000 businesses using Ramp Bill Pay and corporate cards.'],
  ['customers','Rippling','Keep the work flowing Use Rippling’s platform capabilities to run reports across your third-party app data or trigger workflows.'],
  ['customers','Rippling','California Bill Pay Customers and Contractors If you are a California Bill Pay customer or a California contractor using Rippling Payments, Inc. services, please contact us.'],
  ['customers','Vanta','IDC’s analysis found that customers see a 526% return on investment in just three years of using Vanta.'],
  ['partnerships','Vanta','View partners Audits you can trust Vanta partners with startup-friendly, AICPA peer-reviewed audit firms and provides a clear, structured audit process.'],
  ['partnerships','Vanta','Vanta partners with startup-friendly audit firms.'],
  ['pricing','Vanta','Vanta customers achieve $535,000 per year in benefits'],
 ];
 for(const [topic,name,quote] of rejected)assert.equal(supportsExpandedStatement(topic,quote,name),false,quote);
 const accepted=[
  ['customers','Mercury','Outlive Homes uses Mercury to keep funds organized, automate manual work, and maintain property-level visibility.'],
  ['customers','Glean','Duolingo selected Glean to help employees find information.'],
  ['customers','Acme','Acme customer Example uses its collaboration tools across the business.'],
  ['customers','Acme','Acme is used by Example Corp. to automate finance.'],
  ['partnerships','Ramp','Ramp announces new partnership with Stifel Venture Banking'],
  ['partnerships','Ramp','Ramp is excited to announce a partnership with Stifel Venture Banking to provide Stifel’s clients with corporate cards.'],
  ['partnerships','Glean','Glean partners with Amazon Bedrock to deliver generative AI and knowledge discovery.'],
  ['pricing','Mercury','Mercury Personal gives you personal banking for one all-inclusive subscription of $240/year.'],
  ['pricing','Mercury','If you want to use our enriched NetSuite accounting automations, you’ll need to upgrade to a paid Mercury plan (starting at $35/month).'],
 ];
 for(const [topic,name,quote] of accepted)assert.equal(supportsExpandedStatement(topic,quote,name),true,quote);
});

test('live final regressions: partnership prepositions and remote comparison-table standards are not counterparties or target security claims',async()=>{
 const {supportsExpandedStatement}=await tsImport(new URL('research/sourceStatements.ts',root).href,import.meta.url);
 const rejected=[
  ['partnerships','Vanta','Through our partnership with Vanta, we’re able to demonstrate our security posture and scale up our compliance program.'],
  ['partnerships','Cribl','In partnership with Cribl, we are enhancing the data integration process.'],
  ['security','Resend','Key differences Postmark is not SOC 2 compliant, while Resend is ( see more ).'],
  ['security','Resend','Name Postmark Resend Authentication Email/Password Email/Password, Google, GitHub Multi-Factor Auth MFA available MFA available GDPR GDPR compliant GDPR compliant SOC 2 - SOC 2 compliant Idempotency Keys Resend supports idempotency keys on the POST /emails and POST /emails/batch endpoints.'],
 ];
 for(const [topic,name,quote] of rejected)assert.equal(supportsExpandedStatement(topic,quote,name),false,quote);
 const accepted=[
  ['partnerships','Cribl','In partnership with Cribl, Elastic is enhancing the OpenTelemetry (OTel) data integration process.'],
  ['security','Vanta','Vanta supports 35+ frameworks , including SOC 2, ISO 27001, HIPAA, and GDPR, among many others, including custom frameworks.'],
  ['security','Resend','Resend is SOC 2 compliant.'],
 ];
 for(const [topic,name,quote] of accepted)assert.equal(supportsExpandedStatement(topic,quote,name),true,quote);
});
