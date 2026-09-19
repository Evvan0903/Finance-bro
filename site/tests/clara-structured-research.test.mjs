import assert from 'node:assert/strict';
import test from 'node:test';
import {tsImport} from 'tsx/esm/api';
import {graph,source,claim,now} from './fixtures/clara-verification/fixture.mjs';
const lib = path => tsImport(new URL('../app/lib/private-diligence/'+path, import.meta.url).href, import.meta.url);
const {buildStructuredResearchRecords}=await lib('structuredRecords.ts');
const {normalizeEvidenceRegistry}=await lib('evidence/evidenceRegistry.ts');
const {buildClaimRegistry}=await lib('evidence/claimRegistry.ts');
const {canonicalResearch,claimVerificationId}=await lib('verification/governance.ts');
const {verifyClaim}=await lib('verification/rules.ts');
const {createCompanyWebsiteProvider,diversifyResearchLinks,selectIdentityLinks}=await lib('providers/companyWebsiteProvider.ts');
const {executePrivateProvider}=await lib('providers/providerTypes.ts');
const {applyToolExecutionToResearchState,toolExecutionFromResult}=await lib('state/researchStateReducer.ts');

test('typed relationship/product/event records preserve canonical source excerpts and original dates',()=>{
 const rows=[['customers','Northstar uses Acme to manage its workflow.'],['partnerships','Acme partnered with Northstar to build a new integration.'],['pricing','Acme offers a free plan and pricing starts at USD 10 per user.'],['security','Acme supports SOC 2 compliance workflows.'],['recent','Acme announced a new product for enterprise customers on 2026-08-01.'],['products','Acme provides workflow software for small teams.']];
 const raw=rows.map(([topic,value],i)=>source(value,{evidenceId:'page-'+i,contentHash:'page-'+i,sourceUrl:'https://acme.test/news/'+i,publicReferenceUrl:'https://acme.test/news/'+i,structuredData:{researchFacts:[{topic,value,excerpt:value,evidenceId:'page-'+i,contentHash:'page-'+i,sourceUrl:'https://acme.test/news/'+i,retrievedAt:now,publicationDate:'2026-08-01'}]}}));
 const evidence=normalizeEvidenceRegistry(raw);const claims=buildClaimRegistry('r',graph.entityId,evidence);
 const canonical=canonicalResearch({graph,rawEvidence:raw,evidence,claims,now});
 const records=buildStructuredResearchRecords(canonical.claims,canonical.evidence);
 assert.equal(records.length,rows.length);
 for(const record of records){assert.equal(record.verification.status,'verified');assert.ok(record.sources[0].excerpt.includes(record.statement));assert.match(record.sources[0].sourceUrl,/acme.test\/news\//);assert.equal(record.sources[0].retrievedAt,now);}
 assert.equal(records.find(r=>r.kind==='company_event').eventDate,null);
 assert.equal(records.find(r=>r.kind==='source_observation'&&r.topic==='security').statement,'Acme supports SOC 2 compliance workflows.');
 assert.equal(records.find(r=>r.kind==='product').name,null);
 const provisional=canonical.claims.map(c=>({...c,verification:{...c.verification,status:'unverified'}}));
 assert.deepEqual(buildStructuredResearchRecords(provisional,canonical.evidence),[]);
});
test('relationship guard excludes logos, hypothetical statements and another company’s certification',()=>{
 for(const [topic,text] of [['customers','Acme Customers Northstar Globex Logos'],['partnerships','Acme might partner with Northstar.'],['security','Northstar is SOC 2 certified.']]){
  const page=source(text);const c=claim('research.'+topic,text,page,{researchFact:{topic,value:text,excerpt:text}});
  assert.notEqual(verifyClaim(c,[page],graph,now).status,'verified',text);
 }
});
test('unverified hiring analysis cannot leak into canonical metrics',()=>{
 const hiring={companyId:graph.entityId,status:'success_with_jobs',selectedSource:{url:'https://jobs.lever.co/acme',discoveryMethod:'known_path'},jobs:[{id:'cfo',companyId:graph.entityId,title:'CFO',sourceUrl:'https://jobs.lever.co/acme/cfo'}],summary:{totalOpenRoles:1,byFunction:{Finance:1},bySeniority:{Executive:1},byLocation:{London:1},remoteRoles:1,signals:[],sources:[],roleAnalysis:{metrics:{leadership:1,aiMl:0,financeLeadership:1,securityCompliance:0},notableRoles:[{title:'CFO'}]}}};
 const canonical=canonicalResearch({graph,rawEvidence:[],evidence:[],claims:[],hiringIntelligence:hiring,now});
 assert.deepEqual(canonical.hiringIntelligence.jobs,[]);assert.equal(canonical.hiringIntelligence.summary.roleAnalysis,undefined);assert.equal(canonical.hiringIntelligence.summary.byFunction.Finance,0);assert.deepEqual(canonical.hiringIntelligence.summary.byLocation,{});assert.equal(canonical.hiringIntelligence.summary.remoteRoles,0);
});
test('company-owned discovery diversifies original pages while remaining same-domain and bounded',async()=>{
 const links=['/products/a','/products/b','/about','/customers/northstar','/careers','/news/launch','/pricing','https://unrelated.test/customers'];
 const selected=selectIdentityLinks(new URL('https://acme.test'),links);
 assert.equal(selected.length,7);
 assert.deepEqual(diversifyResearchLinks(selected).slice(0,6).map(u=>new URL(u).pathname),['/about','/products/a','/customers/northstar','/careers','/news/launch','/pricing']);
 let requests=0;
 const provider=createCompanyWebsiteProvider({maxPages:2,resolveHost:async()=>[{address:'93.184.216.34',family:4}],fetchImpl:async u=>{
  requests++;if(String(u).endsWith('/robots.txt'))return new Response('',{headers:{'content-type':'text/plain'}});
  return new Response('unavailable',{status:503,headers:{'content-type':'text/html'}});
 }});
 const result=await executePrivateProvider(provider,{researchId:'r',input:{website:'https://acme.test'},identityGraph:graph,now:()=>new Date(now)});
 assert.equal(result.status,'upstreamUnavailable');assert.ok(requests<=7);assert.deepEqual(result.evidence,[]);
});
test('bounded target progress and counters survive ResearchState execution folding',()=>{
 const research={targets:[{targetId:'funding',phase:'deepening',attempts:2,emptyAttempts:0,status:'source_unavailable',stopReason:'provider_unavailable',evidenceIds:[]}],budget:{used:{search:2,page:4,official:0,model:1,tools:2}},stopReason:'low_marginal_value'};
 const execution=toolExecutionFromResult({id:'x',researchStateId:'s',toolName:'evidence_verification',attempt:1,input:{},result:{status:'success',observations:[],gaps:[],errors:[],evidence:[],metadata:{completedAt:now,research}}});
 const state=applyToolExecutionToResearchState({id:'s',status:'researching',observations:[],gaps:[],evidenceRefs:[],executionIds:[]},execution);
 assert.deepEqual(JSON.parse(JSON.stringify(state)).researchProgress,research);
});

test('offering extraction does not strip the initial a/an from a product name',async()=>{
 const {extractCompanyPage}=await lib('extraction/htmlExtractor.ts');
 const page=extractCompanyPage('<main><section><h2>Products</h2><p>Acme offers automated expense management and analysis software.</p></section></main>');
 assert.ok(page.products.includes('analysis software'));
 assert.ok(page.services.includes('automated expense management'));
 assert.ok(![...page.products,...page.services].some(v=>/^utomated|^alysis/.test(v)));
});

test('equal claim values cannot borrow verification from a different evidence set',()=>{
 const text='Northstar uses Acme to manage its workflow.';
 const good=source(text,{evidenceId:'good',structuredData:{researchFacts:[{topic:'customers',value:text,excerpt:text}]}});
 const unrelated=source('Acme contact and support.',{evidenceId:'unrelated'});
 const a=claim('research.customers',text,unrelated,{claimId:'unrelated-claim',researchFact:{topic:'customers',value:text,excerpt:text}});
 const b=claim('research.customers',text,good,{claimId:'supported-claim',researchFact:{topic:'customers',value:text,excerpt:text}});
 for(const claims of [[a,b],[b,a]]){
  const result=canonicalResearch({graph,rawEvidence:[good,unrelated],evidence:normalizeEvidenceRegistry([good,unrelated]),claims,now});
  assert.deepEqual(result.claims.map(c=>c.claimId),['supported-claim']);
  assert.ok(result.claims.every(c=>c.verification.supportingEvidenceIds.every(id=>c.evidenceIds.includes(id))));
 }
 assert.notEqual(claimVerificationId(a),claimVerificationId(b));
 assert.equal(claimVerificationId({...b,evidenceIds:['good','second']}),claimVerificationId({...b,claimId:'reordered',evidenceIds:['second','good','good']}));
});

test('verified careers snapshot retains usable evidence despite a preliminary low name-match hint',()=>{
 const page=source('Chief Financial Officer',{evidenceId:'job-evidence',providerId:'hiring:greenhouse',entityMatchConfidence:'Low',sourceUrl:'https://boards.greenhouse.io/acme/jobs/1',publicReferenceUrl:'https://boards.greenhouse.io/acme/jobs/1',structuredData:{jobTitle:'Chief Financial Officer'}});
 const hiring={companyId:graph.entityId,status:'success_with_jobs',selectedSource:{url:'https://boards.greenhouse.io/acme',discoveryMethod:'linked_from_website'},jobs:[{id:'cfo',companyId:graph.entityId,title:'Chief Financial Officer',sourceUrl:page.sourceUrl}],summary:{totalOpenRoles:1,byFunction:{Finance:1},bySeniority:{Executive:1},byLocation:{},remoteRoles:0,signals:[],sources:[]}};
 const evidence=normalizeEvidenceRegistry([page]);assert.equal(evidence[0].verificationEligibility,'leadOnly');
 const output=canonicalResearch({graph,rawEvidence:[page],evidence,claims:[],hiringIntelligence:hiring,now});
 assert.equal(output.hiringIntelligence.verification.status,'verified');
 assert.equal(output.evidence[0].verificationEligibility,'supportingEvidence');
 assert.equal(output.evidence[0].evidenceId,'job-evidence');
});
