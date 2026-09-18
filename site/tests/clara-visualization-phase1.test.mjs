import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const root = new URL('../app/', import.meta.url);
const importOptions = {parentURL:import.meta.url,tsconfig:new URL('../tsconfig.json',import.meta.url).pathname};
const adapters = await tsImport(new URL('lib/private-diligence/reports/claraVisualization.ts', root).href, importOptions);
const { ClaraQuickReportVisuals } = await tsImport(new URL('ClaraQuickReportVisuals.tsx', root).href, importOptions);
const { ClaraFundingResearch } = await tsImport(new URL('ClaraFundingResearch.tsx', root).href, importOptions);
const { quickReportParagraphs } = await tsImport(new URL('lib/private-diligence/reports/quickReportPresentation.ts', root).href, importOptions);
const day = '2026-09-18T00:00:00Z';
const page = (id = 'e') => ({ evidenceId: id, entityId: 'acme', sourceUrl: `https://acme.example/${id}`, sourceTitle: `Original ${id}`, publicationDate: '2025-01-10', retrievedAt: day, companyReported: true, independentlyPublished: false, officialRecord: false, verificationEligibility: 'supportingEvidence', normalizedFields: {}, limitations: [] });
const field = value => ({ value, evidenceId: 'e', sourceUrl: 'https://acme.example/e', excerpt: `Explicit original value: ${value}`, locator: 'text:0', publicationDate: '2025-01-10', retrievedAt: day });
const event = (id, fields = {}, extra = {}) => ({ eventId: id, entityId: 'acme', sourceKind: 'announcement', fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, field(v)])), limitations: [], ...extra });
const claim = (claimType, extra = {}) => ({ claimId: 'c-' + claimType, entityId: 'acme', claimType, status: 'CompanyReported', evidenceIds: ['e'], conflictingEvidenceIds: [], normalizedValue: 'Supported original statement', limitations: [], ...extra });
function report(events = []) {
 return { entity: { entityId: 'acme', canonicalName: 'Acme', confirmedDisplayName: 'Acme', targetSelectionStatus: 'userSelected', identityVerificationStatus: 'partiallyVerified', identityLimitations: [] }, evidence: [page()], claims: [], conflicts: [], informationGaps: [],
  sections: [{sectionId:'overview',title:{en:'Company Overview',zh:'公司概览'},paragraphs:['Original detailed report remains'],claimIds:[],evidenceIds:['e']}],
  fundingResearch: { events, announcementStatus: events.length ? 'supported' : 'not_performed', secStatus: 'not_performed', gaps: [], limitations: [], actions: [], requests: {search:0,fetch:0,model:0,sec:0} } };
}
function hiring(status = 'success_with_jobs', jobs = []) {
 return { companyId:'acme',status,jobs,sourceCandidates:[],selectedSource:null,adapter:'GreenhouseAdapter',summary:{totalOpenRoles:jobs.length,sources:[{sourceUrl:'https://boards.greenhouse.io/acme',retrievedAt:day}],limitations:[]},limitations:[],failures:[] };
}
function job(id, extra = {}) { return { id, companyId:'acme', title:'Engineer', function:'Engineering', sourceUrl:`https://boards.greenhouse.io/acme/jobs/${id}`,retrievedAt:day,...extra }; }

test('one financing event remains one, missing valuation stays missing, and every value retains its source', () => {
 const data=adapters.buildFundingTimelineData(report([event('one',{roundLabel:'Series B',amount:20_000_000,currency:'USD',investor1:'Example Capital'})]));
 assert.equal(data.financings.length,1);assert.equal(data.financings[0].round,'Series B');assert.equal(data.financings[0].fields.some(f=>f.key==='valuation'),false);
 assert.ok(data.financings[0].fields.every(f=>f.source.evidenceId==='e'&&f.source.url==='https://acme.example/e'&&f.source.excerpt));
});
test('multiple financing observations sort by explicit dates, never round labels, and preserve gaps', () => {
 const data=adapters.buildFundingTimelineData(report([event('b',{roundLabel:'Series B',eventDate:'2020-03-01'}),event('seed',{roundLabel:'Seed',eventDate:'2024-03-01',dateMeaning:'announcement'})]));
 assert.deepEqual(data.financings.map(e=>e.round),['Seed','Series B']);assert.equal(data.financings[0].latestDated,true);assert.equal(data.financings[1].latestDated,false);
 assert.equal(data.financings.some(e=>e.round==='Series A'),false);
});
test('cumulative totals, offerings and unspecified observations never become round-level financing', () => {
 const data=adapters.buildFundingTimelineData(report([event('round',{roundLabel:'Series A',amount:10}),event('total',{roundLabel:'Series A',amount:30,amountMeaning:'cumulative'}),event('offering',{offeringAmount:60,amountSold:20,filingDate:'2025-03-01'},{sourceKind:'formD'}),event('unspecified',{amount:8})]));
 assert.equal(data.financings.length,1);assert.equal(data.cumulative.length,1);assert.equal(data.offerings.length,1);assert.equal(data.unclassified.length,1);
 assert.equal(data.offerings[0].fields.find(f=>f.key==='offeringAmount').value,60);assert.equal(data.offerings[0].dateMeaning,'filing');
});
test('conflicting amounts remain separate and visibly flagged from existing conflict records', () => {
 const r=report([event('one',{roundLabel:'Series A',amount:10}),event('two',{roundLabel:'Series A',amount:20})]);
 r.claims=[claim('funding.amount',{fundingEventId:'one',status:'Conflicting'})];
 r.conflicts=[{claimType:'funding.amount',resolutionStatus:'unresolved',evidenceIds:['e']}];
 const rows=adapters.buildFundingTimelineData(r).financings;
 assert.equal(rows.length,2);assert.ok(rows.every(e=>e.conflicting));assert.deepEqual(rows.map(e=>e.fields.find(f=>f.key==='amount').value),[10,20]);
});
test('unknown and invalid dates are not replaced by publication or retrieval dates', () => {
 const rows=adapters.buildFundingTimelineData(report([event('one',{roundLabel:'Seed'}),event('two',{roundLabel:'Series A',eventDate:'2025-02-31'})])).financings;
 assert.ok(rows.every(e=>e.date===null&&!e.latestDated));assert.ok(rows.every(e=>e.publishedAt==='2025-01-10'));
});
test('unlinked fields and other-company events are excluded without fabricating sources', () => {
 const r=report([event('other',{amount:3},{entityId:'other'}),event('missing',{amount:4})]);r.fundingResearch.events[1].fields.amount.evidenceId='missing';
 const data=adapters.buildFundingTimelineData(r);assert.equal(data.unclassified.length,0);assert.equal(data.omittedFields,1);assert.equal(adapters.visualSourceUrl('javascript:alert(1)'),null);
});
test('normal hiring uses normalized jobs, classifications, snapshot dates and source references', () => {
 const r=report();r.hiringIntelligence=hiring('success_with_jobs',[job('1',{location:'Paris',remote:true,seniority:'Senior'}),job('2',{function:'Data / AI',location:'Paris',remote:false}),job('3',{function:'Legal / Compliance'})]);
 r.evidence.push({...page('job-1'),normalizedFields:{jobId:'1'}});
 const d=adapters.buildHiringVisualizationData(r);assert.equal(d.count,3);assert.equal(d.status,'success');assert.deepEqual(d.retrievedDates,['2026-09-18']);
 assert.deepEqual(new Set(d.functions.map(x=>x.label)),new Set(['Engineering','Data / AI','Legal / Compliance']));
 assert.equal(d.locations.find(x=>x.label==='Unknown').count,1);assert.equal(d.remote.find(x=>x.label==='Remote indicated').count,1);assert.equal(d.remote.find(x=>x.label==='Unknown').count,1);
 assert.deepEqual(d.jobs[0].evidenceIds,['job-1']);assert.match(d.jobs[0].url,/jobs\/1/);
});
test('successful zero hiring and unavailable provider are different states', () => {
 const r=report();r.hiringIntelligence=hiring('success_zero_jobs');assert.equal(adapters.buildHiringVisualizationData(r).count,0);assert.equal(adapters.buildHiringVisualizationData(r).status,'zero');
 r.hiringIntelligence=hiring('retrieval_failed');assert.equal(adapters.buildHiringVisualizationData(r).count,null);assert.equal(adapters.buildHiringVisualizationData(r).status,'unavailable');
 r.hiringIntelligence=null;assert.equal(adapters.buildHiringVisualizationData(r).status,'not-researched');
});
test('partial and inconsistent snapshots never advertise a complete opening count', () => {
 const r=report();r.hiringIntelligence=hiring('partial',[job('1')]);assert.equal(adapters.buildHiringVisualizationData(r).count,null);
 r.hiringIntelligence=hiring('success_with_jobs',[job('1')]);r.hiringIntelligence.summary.totalOpenRoles=100;
 assert.equal(adapters.buildHiringVisualizationData(r).status,'partial');assert.equal(adapters.buildHiringVisualizationData(r).count,null);
});
test('supported recent claims appear separately even when sharing one source; page content alone does not', () => {
 const r=report();r.evidence[0].normalizedFields={searchTopics:['recentActivity'],sourceSummary:'A supposed new launch'};
 assert.deepEqual(adapters.buildRecentDevelopmentTimelineData(r),[]);
 r.claims=[claim('research.recent',{claimId:'launch',normalizedValue:'Acme launched its platform.'}),claim('research.recent',{claimId:'acquisition',normalizedValue:'Acme acquired Example.'})];
 const rows=adapters.buildRecentDevelopmentTimelineData(r);assert.equal(rows.length,2);assert.ok(rows.every(e=>e.eventDate===null&&e.publishedAt==='2025-01-10'));assert.deepEqual(rows[0].sources[0].evidenceId,'e');
 r.evidence[0].publicationDate=null;assert.ok(adapters.buildRecentDevelopmentTimelineData(r).every(e=>e.eventDate===null&&e.publishedAt===null));
});
test('unverified and wrong-entity event claims never enter the recent timeline', () => {
 const r=report();r.claims=[claim('businessActivity',{status:'Unverified'}),claim('acquisition',{entityId:'other'})];assert.deepEqual(adapters.buildRecentDevelopmentTimelineData(r),[]);
});
test('coverage exposes supported, partial and conflicting without numerical scores', () => {
 const r=report();r.claims=[claim('product')];let rows=adapters.buildResearchCoverageData(r);assert.equal(rows.find(x=>x.id==='products').status,'supported');assert.equal(rows.find(x=>x.id==='identity').status,'partial');
 r.informationGaps=[{category:'products',affectedClaims:[],missingInformation:'Product scope unclear'}];assert.equal(adapters.buildResearchCoverageData(r).find(x=>x.id==='products').status,'partial');
 r.claims[0].status='Conflicting';assert.equal(adapters.buildResearchCoverageData(r).find(x=>x.id==='products').status,'conflicting');
 assert.ok(rows.every(x=>!('score'in x)&&!('confidence'in x)));
});
test('coverage distinguishes searched-not-found, source-unavailable and not-researched', () => {
 const r=report();r.adaptiveResearch={coverage:[{topic:'products',status:'searched-not-found',evidenceIds:[]},{topic:'recent',status:'source-unavailable',evidenceIds:[]}]};
 const rows=adapters.buildResearchCoverageData(r);assert.equal(rows.find(x=>x.id==='products').status,'searched-not-found');assert.equal(rows.find(x=>x.id==='recent').status,'source-unavailable');assert.equal(rows.find(x=>x.id==='leadership').status,'not-researched');
});
test('evidence counts, planned providers and unverified claims cannot manufacture supported coverage', () => {
 const r=report();r.providerPlan=[{providerId:'companyWebsite',selected:true}];r.evidence=Array.from({length:30},(_,i)=>({...page('e'+i),normalizedFields:{products:['Something']}}));
 assert.equal(adapters.buildResearchCoverageData(r).find(x=>x.id==='products').status,'not-researched');
 r.claims=[claim('product',{status:'Unverified',evidenceIds:['e1']})];assert.equal(adapters.buildResearchCoverageData(r).find(x=>x.id==='products').status,'partial');
});
test('coverage uses successful zero-job snapshots as supported and failures as unavailable', () => {
 const r=report();r.hiringIntelligence=hiring('success_zero_jobs');assert.equal(adapters.buildResearchCoverageData(r).find(x=>x.id==='hiring').status,'supported');
 r.hiringIntelligence.status='browser_fallback_failed';assert.equal(adapters.buildResearchCoverageData(r).find(x=>x.id==='hiring').status,'source-unavailable');
});
test('an empty funding search does not conceal an unavailable or unresolved SEC path', () => {
 const r=report();r.fundingResearch.announcementStatus='no_information';r.fundingResearch.secStatus='inaccessible';
 assert.equal(adapters.buildResearchCoverageData(r).find(x=>x.id==='funding').status,'source-unavailable');
 r.fundingResearch.secStatus='issuer_unresolved';assert.equal(adapters.buildResearchCoverageData(r).find(x=>x.id==='funding').status,'partial');
 r.fundingResearch.secStatus='no_information';assert.equal(adapters.buildResearchCoverageData(r).find(x=>x.id==='funding').status,'searched-not-found');
 r.fundingResearch.events=[event('one',{roundLabel:'Series A',amount:10})];r.fundingResearch.announcementStatus='supported';r.fundingResearch.secStatus='inaccessible';
 assert.equal(adapters.buildResearchCoverageData(r).find(x=>x.id==='funding').status,'partial');
});
test('rendering both locales makes no network calls, preserves identity and detailed content, and exposes sources', () => {
 const r=report([event('one',{roundLabel:'Series B',amount:20})]);r.hiringIntelligence=hiring('success_zero_jobs');const before=JSON.stringify(r);
 const fetchBefore=globalThis.fetch;globalThis.fetch=()=>{throw Error('Rendering must not fetch');};
 try {
  const en=renderToStaticMarkup(createElement(ClaraQuickReportVisuals,{report:r,locale:'en'}));const zh=renderToStaticMarkup(createElement(ClaraQuickReportVisuals,{report:r,locale:'zh'}));
  assert.match(en,/Funding Timeline/);assert.match(zh,/融资时间线/);assert.match(en,/0 public openings observed in the checked sources/);assert.match(en,/No supported recent developments/);assert.match(en,/not employee headcount or company growth/);assert.doesNotMatch(en,/Current funding stage|87%|92%/);assert.match(en,/https:\/\/acme.example\/e/);assert.match(en,/View evidence/);
  assert.match(renderToStaticMarkup(createElement(ClaraFundingResearch,{report:r,locale:'en'})),/Field source/);
  assert.equal(quickReportParagraphs(r,'en')[0].paragraphs[0],'Original detailed report remains');assert.equal(JSON.stringify(r),before);
 } finally {globalThis.fetch=fetchBefore;}
});
