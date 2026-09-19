import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const options = {parentURL:import.meta.url,tsconfig:new URL('../tsconfig.json',import.meta.url).pathname};
const composer = await tsImport(new URL('../app/lib/private-diligence/reports/adaptiveReportComposer.ts',import.meta.url).href,options);
const {ClaraQuickReportVisuals,ClaraResearchFooter} = await tsImport(new URL('../app/ClaraQuickReportVisuals.tsx',import.meta.url).href,options);
const {ClaraUnverifiedInformation} = await tsImport(new URL('../app/ClaraUnverifiedInformation.tsx',import.meta.url).href,options);
const {privateDiligenceReportToMarkdown} = await tsImport(new URL('../app/lib/private-diligence/reports/markdown.ts',import.meta.url).href,options);
const at = '2026-09-18T00:00:00Z';
const verification = status => ({status,reasonCodes:['fixture_rule'],supportingEvidenceIds:['e'],conflictingEvidenceIds:[],missingRequirements:[],evaluatedAt:at});
function page(id='e') {return {evidenceId:id,entityId:'brand',sourceUrl:`https://brand.example/${id}`,sourceTitle:'Company original',sourceTier:2,publicationDate:'2026-01-01',retrievedAt:at,companyReported:true,verificationEligibility:'supportingEvidence',verification:verification('verified'),normalizedFields:{},limitations:[]};}
function field(value){return {value,evidenceId:'e',sourceUrl:'https://brand.example/e',excerpt:`Original supports ${value}`,publicationDate:'2026-01-01',retrievedAt:at,locator:'text:0',verification:verification('verified')};}
function event(id,fields={}){return {eventId:id,entityId:'brand',sourceKind:'announcement',verification:verification('verified'),fields:Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,field(v)])),limitations:[]};}
function claim(id,type,value,status='verified'){return {claimId:id,entityId:'brand',claimType:type,statement:value,normalizedValue:value,evidenceIds:['e'],conflictingEvidenceIds:[],status:'CompanyReported',verification:verification(status),limitations:[]};}
function report(){return {reportVersion:'clara-quick-v1',generatedAt:at,locale:'en',input:{companyName:'Original input'},entity:{entityId:'brand',confirmedDisplayName:'Confirmed Brand',canonicalName:'Legal Company Holdings LLC',legalNames:['Legal Company Holdings LLC'],targetSelectionStatus:'userSelected',identityVerificationStatus:'partiallyVerified',identityLimitations:[]},claims:[],evidence:[page()],references:[],conflicts:[],informationGaps:[],sections:[],methodologyLimitations:[],verification:{version:1,evaluatedAt:at,findings:[]},fundingResearch:{events:[],announcementStatus:'not_performed',secStatus:'not_performed',gaps:[],limitations:[],actions:[],requests:{}},disclosure:'Source-grounded research'};}
function jobs(titles){return titles.map((title,index)=>({id:`job-${index}`,companyId:'brand',title,function:index%2?'Engineering':'Finance',location:index%2?'New York':'San Francisco',sourceUrl:`https://jobs.lever.co/brand/${index}`,sourceType:'lever',sourceJobId:String(index),retrievedAt:at}));}
function hiring(postings,status='success_with_jobs'){return {companyId:'brand',status,verification:verification('verified'),sourceCandidates:[],selectedSource:{url:'https://jobs.lever.co/brand',sourceType:'lever',discoveryMethod:'linked_from_website'},jobs:postings,summary:{totalOpenRoles:postings.length,sources:[{sourceUrl:'https://jobs.lever.co/brand',retrievedAt:at}],limitations:[]},limitations:[],failures:[]};}
const moduleOf = (r,id)=>composer.composeAdaptiveReport(r).modules.find(m=>m.id===id);
test('three distinct dated financing observations choose timeline; one is compact; dates are not fabricated',()=>{
 const r=report();r.fundingResearch.events=[event('a',{roundLabel:'Series A',eventDate:'2023-01-01'}),event('b',{roundLabel:'Series B',eventDate:'2024-01-01'}),event('c',{roundLabel:'Series C',eventDate:'2025-01-01'})];
 assert.equal(moduleOf(r,'funding').mode,'visualization');r.fundingResearch.events=r.fundingResearch.events.slice(0,1);assert.equal(moduleOf(r,'funding').mode,'compact');
 r.fundingResearch.events=[event('a',{roundLabel:'Series A'}),event('b',{roundLabel:'Series B'}),event('c',{roundLabel:'Series C'})];assert.notEqual(moduleOf(r,'funding').mode,'visualization');
 r.fundingResearch.events=[event('a',{roundLabel:'Series A',eventDate:'2023-01-01'}),event('b',{roundLabel:'Series A',eventDate:'2023-01-01'}),event('c',{roundLabel:'Series A',eventDate:'2023-01-01'})];assert.notEqual(moduleOf(r,'funding').mode,'visualization');
});
test('no data produces no main cards; failed attempt belongs only in footer',()=>{
 const r=report();assert.ok(composer.composeAdaptiveReport(r).modules.every(m=>m.mode==='hidden'));assert.equal(renderToStaticMarkup(createElement(ClaraQuickReportVisuals,{report:r,locale:'en'})),'');
 r.fundingResearch.secStatus='inaccessible';assert.equal(moduleOf(r,'funding').mode,'status_only');assert.equal(renderToStaticMarkup(createElement(ClaraQuickReportVisuals,{report:r,locale:'en'})),'');
 const footer=renderToStaticMarkup(createElement(ClaraResearchFooter,{report:r,locale:'en'}));assert.match(footer,/Source Unavailable/);assert.doesNotMatch(footer,/No information available/);
});
test('many structured jobs produce charts and explainable important roles, few jobs use compact list',()=>{
 const r=report();r.hiringIntelligence=hiring(jobs(['Support Specialist','CFO','Machine Learning Engineer','VP Engineering','AI Engineer','Controller','Security Engineer','Data Scientist','Engineer']));
 const composed=composer.composeAdaptiveReport(r);assert.equal(moduleOf(r,'hiring').mode,'visualization');assert.equal(composed.data.hiring.functions.reduce((sum,row)=>sum+row.count,0),9);
 assert.equal(composed.data.hiring.notableJobs[0].title,'CFO');assert.ok(composed.keyFindings.some(f=>f.text.includes('finance leadership')));assert.ok(composed.keyFindings.some(f=>f.text.includes('AI / ML')));
 const html=renderToStaticMarkup(createElement(ClaraQuickReportVisuals,{report:r,locale:'en'}));assert.match(html,/Observed function distribution/);assert.match(html,/Original posting/);assert.match(html,/jobs.lever.co\/brand\/1/);assert.doesNotMatch(html,/growing rapidly|preparing for IPO|has no CFO|expanding headcount/);
 r.hiringIntelligence=hiring(jobs(['CFO','AI Engineer']));assert.equal(moduleOf(r,'hiring').mode,'compact');assert.doesNotMatch(renderToStaticMarkup(createElement(ClaraQuickReportVisuals,{report:r,locale:'en'})),/Observed function distribution/);
});
test('careers source alone is a compact source card, never a fabricated job count',()=>{
 const r=report();r.hiringIntelligence=hiring([],'retrieval_failed');r.hiringIntelligence.verification=verification('unverified');assert.equal(moduleOf(r,'hiring').mode,'compact');
 const html=renderToStaticMarkup(createElement(ClaraQuickReportVisuals,{report:r,locale:'en'}));assert.match(html,/Company careers source identified/);assert.doesNotMatch(html,/0 public openings|class="clara-count-chart"/);
 r.hiringIntelligence.verification=verification('rejected');assert.equal(moduleOf(r,'hiring').mode,'status_only');
});
test('title is the confirmed brand; legal entity secondary preserves status and rejected is absent',()=>{
 const r=report();r.claims=[claim('legal','legalName','Legal Company Holdings LLC')];assert.equal(composer.confirmedCompanyTitle(r),'Confirmed Brand');assert.equal(composer.supportedLegalEntities(r)[0].name,'Legal Company Holdings LLC');
 r.verification.findings=[{id:'candidate',entityId:'brand',domain:'identity',label:'Legal entity relationship: unknown',value:'Plausible Operator Inc.',sources:[{evidenceId:'e',sourceUrl:'https://brand.example/legal',title:'Legal',excerpt:'Plausible operator mention',retrievedAt:at}],verification:verification('unverified')},{id:'wrong',entityId:'brand',domain:'identity',label:'Legal entity relationship: unknown',value:'Wrong Lending LLC',sources:[{evidenceId:'e',sourceUrl:'https://wrong.example',excerpt:'wrong'}],verification:verification('rejected')}];
 assert.equal(composer.supportedLegalEntities(r).find(e=>e.name==='Plausible Operator Inc.').status,'unverified');assert.ok(!composer.supportedLegalEntities(r).some(e=>e.name==='Wrong Lending LLC'));r.presentation=composer.composeAdaptiveReport(r);
 const markdown=privateDiligenceReportToMarkdown(r);assert.match(markdown,/^# Confirmed Brand/);assert.match(markdown,/Legal entity: Legal Company Holdings LLC/);assert.doesNotMatch(markdown,/Wrong Lending/);
});
test('provisional values remain yellow and rejected facts never enter normal modules or findings',()=>{
 const r=report();r.fundingResearch.events=[event('pending',{roundLabel:'Series A',amount:9000000})];r.fundingResearch.events[0].verification=verification('unverified');r.claims=[claim('wrong','research.people','Wrong Company CEO','rejected'),claim('candidate','research.products','Unverified service','unverified')];
 r.verification.findings=[{id:'pending',entityId:'brand',domain:'funding',label:'Amount',value:9000000,field:'amount',sources:[{evidenceId:'e',sourceUrl:'https://brand.example/e',title:'Original',excerpt:'Issuer raised 9000000',retrievedAt:at}],verification:verification('unverified')},{id:'wrong',entityId:'brand',domain:'leadership',label:'Wrong Company CEO',value:'Wrong Company CEO',sources:[{evidenceId:'e',excerpt:'Wrong Company CEO'}],verification:verification('rejected')}];
 const c=composer.composeAdaptiveReport(r);assert.equal(c.data.funding.financings.length,0);assert.equal(c.keyFindings.length,0);assert.ok(c.modules.every(m=>['hidden','status_only'].includes(m.mode)));
 const yellow=renderToStaticMarkup(createElement(ClaraUnverifiedInformation,{report:r,locale:'en'}));assert.match(yellow,/Unverified Information/);assert.match(yellow,/9000000/);assert.doesNotMatch(yellow,/Wrong Company CEO/);
});
test('findings are bounded and deduplicated, with no minimum quota and evidence retained',()=>{
 const r=report();r.claims=[claim('one','description','Confirmed Brand builds secure databases for research teams.'),claim('same','product','Confirmed Brand builds secure databases for research teams.')];
 const c=composer.composeAdaptiveReport(r);assert.equal(c.keyFindings.length,1);assert.ok(c.keyFindings[0].sources[0].url);assert.equal(c.keyFindings[0].sources[0].evidenceId,'e');
 for(let i=0;i<10;i++)r.claims.push(claim('extra'+i,'research.recent',`Confirmed Brand acquired business ${i}.`));assert.ok(composer.composeAdaptiveReport(r).keyFindings.length<=6);
});
test('structured supported people/products/relationships have compact typed projections and source excerpts',()=>{
 const r=report();r.claims=[claim('product','research.products','Database service')];r.structuredRecords=[{recordId:'p',kind:'product',entityId:'brand',statement:'Database service',claimIds:['product'],verification:verification('verified'),sources:[{evidenceId:'e',sourceUrl:'https://brand.example/e',title:'Product',excerpt:'Our Database service',retrievedAt:at,publicationDate:null}]}];
 const c=composer.composeAdaptiveReport(r);assert.equal(c.items.products[0].id,'p');assert.equal(c.items.products[0].sources[0].excerpt,'Our Database service');assert.equal(moduleOf(r,'products').mode,'compact');
});

test('historical people remain explicitly qualified and cannot become current-looking key findings',()=>{
 const r=report();r.claims=[claim('past','formerExecutiveRole','Alex Morgan — CEO')];const c=composer.composeAdaptiveReport(r);assert.equal(c.items.people[0].historical,true);assert.equal(c.keyFindings.length,0);
 const html=renderToStaticMarkup(createElement(ClaraQuickReportVisuals,{report:r,locale:'en'}));assert.match(html,/Historical role/);assert.doesNotMatch(html,/clara-key-findings/);
});

test('funding highlights select complete observations rather than a bare round label',()=>{
 const r=report();r.fundingResearch.events=[event('sparse',{roundLabel:'Series C'}),event('round',{roundLabel:'Series D',amount:200000000,currency:'USD',valuation:5200000000,valuationCurrency:'USD',eventDate:'2026-01-01'})];
 let finding=composer.composeAdaptiveReport(r).keyFindings.find(item=>item.domain==='funding');assert.equal(finding.id,'funding:round');assert.match(finding.text,/200,000,000/);assert.match(finding.text,/reported valuation USD 5,200,000,000/);assert.match(finding.sources[0].excerpt,/Original supports 200000000/);
 r.fundingResearch.events=[event('sparse',{roundLabel:'Series C'}),{...event('sec',{amountSold:199999824,firstSaleDate:'2026-05-08',filingDate:'2026-05-20'}),sourceKind:'formD'}];finding=composer.composeAdaptiveReport(r).keyFindings.find(item=>item.domain==='funding');assert.equal(finding.id,'funding:sec');assert.match(finding.text,/Form D amount sold/);assert.match(finding.text,/first sale 2026-05-08/);assert.doesNotMatch(finding.text,/Series C|closed/);
 r.fundingResearch.events=[event('sparse',{roundLabel:'Series C'})];assert.ok(!composer.composeAdaptiveReport(r).keyFindings.some(item=>item.domain==='funding'));assert.equal(moduleOf(r,'funding').mode,'compact');
});
test('overview prioritizes factual description and suppresses CTA/question copy without deleting approved claims',()=>{
 const r=report();r.claims=[claim('cta','description','Everything you do with money. All in one place. Apply in 10 minutes.'),claim('good','description','Confirmed Brand was founded in 2018. It provides business banking software.'),claim('partner','description','Build customer loyalty, get new clients. Join 500+ partners.'),claim('faq','description','What does it cost to use Confirmed Brand?'),claim('learn','description','Learn how to use our software.')];
 const snapshot=JSON.stringify(r);const c=composer.composeAdaptiveReport(r);assert.deepEqual(c.items.overview.map(item=>item.id),['good']);assert.equal(JSON.stringify(r),snapshot);assert.ok(!c.keyFindings.some(item=>/Apply|Join|What does/.test(item.text)));
});
test('approved source excerpts are reused from verification or typed records, never fabricated',()=>{
 const r=report();r.claims=[claim('founder','founder','Alex Morgan'),claim('overview','description','Confirmed Brand is a software company.')];
 r.verification.findings=[{id:'audit-founder',claimId:'founder',entityId:'brand',domain:'leadership',sources:[{evidenceId:'e',sourceUrl:'https://brand.example/e',excerpt:'Confirmed Brand was founded by Alex Morgan.'}],verification:verification('verified')}];
 r.structuredRecords=[{recordId:'overview-record',kind:'product',entityId:'brand',claimIds:['overview'],statement:'Confirmed Brand is a software company.',sources:[{evidenceId:'e',sourceUrl:'https://brand.example/e',title:'Company',excerpt:'Confirmed Brand is a software company.'}],verification:verification('verified')}];
 assert.equal(composer.supportedReportItems(r,['founder'])[0].sources[0].excerpt,'Confirmed Brand was founded by Alex Morgan.');assert.equal(composer.supportedReportItems(r,['description'])[0].sources[0].excerpt,'Confirmed Brand is a software company.');
 r.verification.findings=[];r.structuredRecords=[];assert.equal(composer.supportedReportItems(r,['founder'])[0].sources[0].excerpt,null);
 assert.equal(composer.legalRelationshipLabel('primaryOperatingEntity','en'),'Primary operating company');assert.equal(composer.legalRelationshipLabel('primaryOperatingEntity','zh'),'主要经营主体');
});
test('author-prefixed source copy remains available in module but is not a key finding',()=>{
 const r=report();r.claims=[claim('story','research.customers','By Alex Smith Customer Stories How Acme works Acme uses Confirmed Brand to organize its workflows.')];const c=composer.composeAdaptiveReport(r);assert.equal(c.items.relationships.length,1);assert.equal(c.keyFindings.length,0);
});

test('funding key finding keeps original filing and submissions metadata URLs separate for one evidence ID',()=>{
 const r=report(),xmlUrl='https://www.sec.gov/Archives/edgar/data/123/123456/primary_doc.xml',metadataUrl='https://data.sec.gov/submissions/CIK0000000123.json';
 const filing={...event('filing',{amountSold:1500000,firstSaleDate:'2026-05-08',filingDate:'2026-05-20',cik:'0000000123'}),sourceKind:'formD'};
 filing.fields.amountSold={...filing.fields.amountSold,sourceUrl:xmlUrl,excerpt:'<totalAmountSold>1500000</totalAmountSold>'};
 filing.fields.firstSaleDate={...filing.fields.firstSaleDate,sourceUrl:xmlUrl,excerpt:'<dateOfFirstSale>2026-05-08</dateOfFirstSale>'};
 filing.fields.filingDate={...filing.fields.filingDate,sourceUrl:metadataUrl,excerpt:'filingDate: 2026-05-20'};
 filing.fields.cik={...filing.fields.cik,sourceUrl:metadataUrl,excerpt:'cik: 0000000123'};
 r.fundingResearch.events=[filing];
 const finding=composer.composeAdaptiveReport(r).keyFindings.find(item=>item.domain==='funding');assert.equal(finding.sources.length,2);assert.equal(finding.sources[0].url,xmlUrl);assert.match(finding.sources[0].excerpt,/<totalAmountSold>/);assert.doesNotMatch(finding.sources[0].excerpt,/filingDate:|cik:/);
 assert.equal(finding.sources[1].url,metadataUrl);assert.match(finding.sources[1].excerpt,/filingDate: 2026-05-20/);assert.doesNotMatch(finding.sources[1].excerpt,/<totalAmountSold>|<dateOfFirstSale>/);
 assert.equal(finding.sources[0].evidenceId,finding.sources[1].evidenceId);
 const html=renderToStaticMarkup(createElement(ClaraQuickReportVisuals,{report:r,locale:'en'}));assert.ok(html.includes(xmlUrl));assert.ok(html.includes(metadataUrl));
});

test('a supported bare person name remains in the people module without consuming a key finding',()=>{
 const r=report();r.claims=[claim('person','founder','Alex Morgan')];let c=composer.composeAdaptiveReport(r);assert.equal(c.items.people.length,1);assert.equal(c.keyFindings.length,0);
 r.claims=[claim('person','executiveRole','Alex Morgan — Chief Executive Officer')];c=composer.composeAdaptiveReport(r);assert.equal(c.keyFindings.length,1);assert.match(c.keyFindings[0].text,/Chief Executive Officer/);
});

test('hiring totals and category findings retain every supporting job, not a representative sample',()=>{
 const r=report();r.hiringIntelligence=hiring(jobs(['CFO','ML Engineer','AI Engineer','Machine Learning Engineer','Support Specialist']));
 r.evidence.push(...r.hiringIntelligence.jobs.slice(0,4).map(job=>({...page('e-'+job.id),sourceUrl:job.sourceUrl,normalizedFields:{jobId:job.id}})));
 const c=composer.composeAdaptiveReport(r),total=c.keyFindings.find(item=>item.id==='hiring:count'),ai=c.keyFindings.find(item=>item.id==='hiring:aiMl');
 assert.equal(total.sources.length,5);assert.deepEqual(total.supportingJobIds,r.hiringIntelligence.jobs.map(job=>job.id));assert.equal(total.supportingEvidenceIds.length,4);
 assert.equal(total.sources[4].recordId,'job-4');assert.equal(total.sources[4].evidenceId,'');assert.doesNotMatch(JSON.stringify(total),/hiring-source|hiring:job-/);
 assert.deepEqual(ai.supportingJobIds,['job-1','job-2','job-3']);assert.equal(ai.sources.length,3);assert.ok(ai.sources.every(source=>/ML|AI|Machine Learning/.test(source.title)));assert.ok(ai.sources.every(source=>source.url.endsWith(source.recordId.replace('job-',''))));
 const html=renderToStaticMarkup(createElement(ClaraQuickReportVisuals,{report:r,locale:'en'}));assert.match(html,/All supporting records/);assert.match(html,/Job record: job-4/);assert.doesNotMatch(html,/>https:\/\/jobs.lever.co/);
});
test('a key role category retains all jobs even when higher-ranked roles fill the notable list',()=>{
 const r=report();r.hiringIntelligence=hiring(jobs([...Array.from({length:9},()=> 'CFO'),...Array.from({length:3},()=> 'ML Engineer')]));
 const c=composer.composeAdaptiveReport(r);assert.ok(c.data.hiring.notableJobs.every(job=>job.title==='CFO'));const ai=c.keyFindings.find(item=>item.id==='hiring:aiMl');assert.equal(ai.sources.length,3);assert.equal(ai.supportingJobIds.length,3);
});
test('overview omits recruitment mission and accelerate CTA while retaining supported description',()=>{
 const r=report();r.claims=[claim('description','description','Confirmed Brand is an enterprise search software company.'),claim('cta','description','Accelerate Enterprise AI Transformation with Confirmed Brand Partner Network'),claim('mission','description','We’re on a mission to bring people knowledge. And we’re always looking for curious people to make it happen.')];
 assert.deepEqual(composer.composeAdaptiveReport(r).items.overview.map(item=>item.id),['description']);assert.equal(r.claims.length,3);
});
test('Chinese adaptive exported coverage contains readable labels rather than undefined',()=>{
 const r=report();r.coverageStatus='Limited public-source coverage';r.presentation=composer.composeAdaptiveReport(r);const text=privateDiligenceReportToMarkdown(r,'zh');assert.match(text,/身份：部分支持/);assert.match(text,/产品：未研究/);assert.doesNotMatch(text,/undefined/);
});
