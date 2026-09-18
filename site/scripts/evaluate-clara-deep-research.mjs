import {writeFileSync} from 'node:fs';import {createRequire} from 'node:module';
const dir=process.env.EVAL_OUTPUT;
if(!dir || !process.env.EVAL_DATABASE)throw new Error('Set EVAL_OUTPUT (existing directory) and EVAL_DATABASE to the isolated launcher database; never use production.');
const root=new URL('..',import.meta.url).pathname.replace(/\/$/,'');
const require=createRequire(root+'/package.json');const {createClient}=require('@libsql/client');
const database=process.env.EVAL_DATABASE;
const targets=[['Abaka','https://www.abaka.ai'],['Mercury','https://mercury.com'],['Vanta','https://www.vanta.com']];
const results=[];const host=s=>new URL(s).hostname.replace(/^www\./,'');
const save=()=>writeFileSync(dir+'/runs.json',JSON.stringify({database,targets,results},null,2));
async function api(path,body,timeout=90000){const startedAt=new Date().toISOString();const response=await fetch('http://127.0.0.1:3012/api/private-diligence/'+path,{...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(timeout)});return{startedAt,finishedAt:new Date().toISOString(),status:response.status,data:await response.json()};}
for(const [company,website] of targets){
 writeFileSync(dir+'/current.txt',company);const r={company,website,startedAt:new Date().toISOString()};results.push(r);save();
 try{
 r.discovery=await api('candidates',{companyName:company,website,workflowMode:'quick',locale:'en'});r.researchId=r.discovery.data.researchRequestId;save();
 const candidates=(r.discovery.data.candidates??[]).filter(c=>c.domain===host(website)&&c.websiteReachable);
 if(candidates.length!==1){r.stop='identity_ambiguous_or_unavailable';save();console.log(JSON.stringify({company,stop:r.stop,candidateCount:candidates.length}));continue;}
 r.selectedCandidate=candidates[0];r.selectionBasis='Only discovered reachable candidate with the independently checked official domain; no legal name or CIK supplied';
 r.confirmation=await api('confirm-entity',{researchRequestId:r.researchId,candidateId:r.selectedCandidate.candidateId,explicitUserConfirmation:true});save();
 if(r.confirmation.status!==200){r.stop='confirmation_failed';save();continue;}
 console.log(JSON.stringify({company,stage:'confirmed',researchId:r.researchId,domain:r.selectedCandidate.domain,legalName:r.selectedCandidate.legalName}));
 r.run=await api('run',{researchId:r.researchId},150000);save();
 r.reportRead=await api('report/'+r.researchId);save();
 const db=createClient({url:'file:'+database});const stored=await db.execute({sql:'SELECT record_json FROM research_requests WHERE id=?',args:[r.researchId]});r.persistedRecord=stored.rows[0]?JSON.parse(stored.rows[0].record_json):null;
 const stateId=r.persistedRecord?.report?.fundingResearch?.researchStateId;
 if(stateId){const ex=await db.execute({sql:'SELECT tool_name,status,input_json,observations_json,gaps_json,errors_json,evidence_refs_json,started_at,completed_at FROM clara_tool_executions WHERE research_state_id=? ORDER BY started_at',args:[stateId]});r.toolExecutions=ex.rows;}
 const countBefore=await db.execute('SELECT COUNT(*) AS n FROM clara_tool_executions'); r.cachedRun=await api('run',{researchId:r.researchId}); const countAfter=await db.execute('SELECT COUNT(*) AS n FROM clara_tool_executions'); r.executionCounts={before:countBefore.rows[0].n,after:countAfter.rows[0].n}; db.close();r.checks={freshDatabaseRead:true,persistedEqualsReportApi:JSON.stringify(r.persistedRecord?.report)===JSON.stringify(r.reportRead.data.report),confirmedGraphUnchanged:JSON.stringify(r.persistedRecord?.identityGraph)===JSON.stringify(r.confirmation.data.entity)};
 r.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({company,stage:'complete',http:r.run.status,legal:r.persistedRecord?.legalEntityDiscovery?.secQueryLegalNames,legalStatus:r.persistedRecord?.legalEntityDiscovery?.status,sec:r.persistedRecord?.report?.fundingResearch?.secStatus,issuerCandidates:r.persistedRecord?.report?.fundingResearch?.issuerAssociations?.length,events:r.persistedRecord?.report?.fundingResearch?.events?.map(e=>e.sourceKind),checks:r.checks}));
 }catch(e){r.error={name:e.name,message:e.name==='TimeoutError'?'bounded request timed out':'diagnostic request failed'};save();console.log(JSON.stringify({company,error:r.error}));if(e.name==='TimeoutError')break;}
}
writeFileSync(dir+'/current.txt','finished');save();console.log(JSON.stringify({benchmarkComplete:results.length===targets.length,count:results.length}));
