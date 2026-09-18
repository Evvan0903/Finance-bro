import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
function run(script,path){return new Promise((resolve,reject)=>{const env={...process.env,CLARA_LOCAL_DATABASE_PATH:path};for(const key of ['TURSO_DATABASE_URL','LIBSQL_DATABASE_URL','TURSO_AUTH_TOKEN','LIBSQL_AUTH_TOKEN'])delete env[key];const child=spawn(process.execPath,['--import','tsx','--input-type=module','-e',script],{cwd:new URL('..',import.meta.url),env,stdio:['ignore','pipe','pipe']});let output='',errors='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>errors+=c);child.on('exit',code=>code===0?resolve(JSON.parse(output)):reject(Error(errors)));});}
test('original SEC fixtures traverse provider, governance, Quick report and durable storage; harness ignores proposed promotion',async()=>{const dir=await mkdtemp(join(tmpdir(),'clara-verification-regression-'));const db=join(dir,'clara.db');try{const saved=await run(`
import {graph,input,now,official,submissions,xml,funding} from './tests/fixtures/clara-verification/fixture.mjs';
import {createSecFormDProvider} from './app/lib/private-diligence/providers/secFormDProvider.ts';
import {executePrivateProvider} from './app/lib/private-diligence/providers/providerTypes.ts';
import {canonicalResearch} from './app/lib/private-diligence/verification/governance.ts';
import {attachVerificationReport} from './app/lib/private-diligence/verification/presentation.ts';
import {normalizeEvidenceRegistry} from './app/lib/private-diligence/evidence/evidenceRegistry.ts';
import {buildClaimRegistry} from './app/lib/private-diligence/evidence/claimRegistry.ts';
import {buildQuickCompanyIntelligenceReport} from './app/lib/private-diligence/reports/quickReportBuilder.ts';
import {researchStateStore as states} from './app/lib/private-diligence/state/researchStateStore.ts';
import {privateDiligenceStore as reports} from './app/lib/private-diligence/persistence/researchStore.ts';
const state=await states.createResearchState({objective:'Fixture evidence verification',identityGraph:graph});const output=[];
for(const kind of ['provisional','verified','wrong']){
 const provider=createSecFormDProvider({getSubmissions:async()=>kind==='wrong'?{...submissions,name:'Other Systems Inc.'}:submissions,getFilingDocument:async()=>xml},{includeProvisional:true,identityEvidence:kind==='verified'?[official]:[]});
 const result=await executePrivateProvider(provider,{researchId:kind,input,identityGraph:graph,now:()=>new Date(now)});
 const evidence=normalizeEvidenceRegistry(result.evidence);const fundingResearch=funding(result.evidence.flatMap(e=>e.structuredData.fundingEvents),result.secIssuerAssociations);
 const data={fundingResearch};
 const recorded=await states.recordToolExecution({researchStateId:state.id,toolName:'sec_funding',identityGraph:graph,input:{},result:{status:'success',data,evidence:result.evidence,observations:[],gaps:[],errors:[],metadata:{toolName:'sec_funding',startedAt:now,completedAt:now,retrievalTime:now,sourceCount:evidence.length,verification:{version:1,evaluatedAt:now,findings:[{id:'forged',verification:{status:'verified'}}]}}}});
 const canonical=canonicalResearch({graph,rawEvidence:result.evidence,evidence,claims:buildClaimRegistry(kind,graph.entityId,evidence.map(e=>({...e,verificationEligibility:'supportingEvidence'}))),fundingResearch,now});
 const report=buildQuickCompanyIntelligenceReport({researchId:kind,input,graph,providerPlan:[],...canonical,informationGaps:[],generatedAt:now});attachVerificationReport(report,canonical.ledger);
 await reports.set({researchId:kind,input,createdAt:now,updatedAt:now,stage:'reportValidation',stageStatus:'complete',candidates:[],confirmedCandidate:null,identityGraph:graph,providerPlan:[],providerResults:[result],rawEvidence:result.evidence,normalizedEvidence:evidence,report,errorCode:null});output.push({kind,issuer:recorded.state.verification.findings.find(f=>f.id==='sec:0000000123').verification.status});
}
console.log(JSON.stringify({stateId:state.id,output}));
`,db);assert.deepEqual(saved.output.map(r=>r.issuer),['unverified','verified','rejected']);const loaded=await run(`
import {researchStateStore as states} from './app/lib/private-diligence/state/researchStateStore.ts';
import {privateDiligenceStore as reports} from './app/lib/private-diligence/persistence/researchStore.ts';
import {GET} from './app/api/private-diligence/report/[researchId]/route.ts';
const state=await states.getResearchState('${saved.stateId}');const executions=await states.listToolExecutions(state.id);const output=[];
for(const kind of ['provisional','verified','wrong']){const r=await reports.get(kind);const response=await GET(new Request('http://localhost/api/private-diligence/report/'+kind),{params:Promise.resolve({researchId:kind})});const api=await response.json();output.push({kind,equal:JSON.stringify(api.report)===JSON.stringify(r.report),events:r.report.fundingResearch.events.length,yellow:r.report.sections.some(s=>s.sectionId==='unverified'),findings:r.report.verification.findings.map(f=>f.verification.status)});}
console.log(JSON.stringify({output,history:state.verificationHistory.filter(h=>h.findingId==='sec:0000000123'),gap:state.gaps.find(g=>g.code==='verification:sec:0000000123'),staleVerified:state.verification.findings.some(f=>f.issuerCik&&f.verification.status==='verified'),forged:state.verification.findings.some(f=>f.id==='forged'),executionCount:executions.length}));
`,db);assert.ok(loaded.output.every(r=>r.equal));assert.deepEqual(loaded.output.map(r=>[r.events,r.yellow]),[[0,true],[1,false],[0,false]]);assert.equal(loaded.forged,false);assert.equal(loaded.staleVerified,false);assert.equal(loaded.executionCount,3);assert.deepEqual(loaded.history.map(h=>[h.previousStatus,h.newStatus]),[[null,'unverified'],['unverified','verified'],['verified','rejected']]);assert.ok(loaded.history.every(h=>h.reasonCodes.length&&h.executionId&&h.evaluatedAt));assert.equal(loaded.gap.status,'resolved');}finally{await rm(dir,{recursive:true,force:true});}});
