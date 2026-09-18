import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {writeFile} from 'node:fs/promises';
const path=process.argv[2];
if(!path?.includes('clara-funding-live-'))throw new Error('An isolated diagnostic database is required');
const client=createClient({url:`file:${path}`});
const summaries=[];
for(const company of ['Cohere','Abaka AI']){
  const rows=await client.execute({sql:'SELECT record_json FROM research_requests WHERE original_company_name=? AND status=? ORDER BY created_at DESC LIMIT 1',args:[company,'complete']});
  // status column can retain a workflow stage; read completed records from their JSON when needed.
  const fallback=rows.rows.length?rows:await client.execute({sql:'SELECT record_json FROM research_requests WHERE original_company_name=? ORDER BY created_at DESC',args:[company]});
  const record=fallback.rows.map(row=>JSON.parse(row.record_json)).find(r=>r.stageStatus==='complete');
  assert.ok(record,`${company} has a completed browser request`);
  const report=record.report, funding=report.fundingResearch;
  const ids=new Set(report.evidence.map(e=>e.evidenceId));
  for(const event of funding.events)for(const field of Object.values(event.fields))assert.ok(ids.has(field.evidenceId),'field evidence link persists');
  const before=await client.execute({sql:'SELECT COUNT(*) AS count FROM clara_tool_executions WHERE research_state_id=?',args:[funding.researchStateId]});
  const response=await fetch('http://127.0.0.1:3012/api/private-diligence/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({researchId:record.researchId})});
  const cached=await response.json();
  assert.equal(response.status,200);assert.equal(cached.alreadyComplete,true);
  assert.deepEqual(cached.report.fundingResearch,funding);
  const after=await client.execute({sql:'SELECT COUNT(*) AS count FROM clara_tool_executions WHERE research_state_id=?',args:[funding.researchStateId]});
  assert.equal(before.rows[0].count,after.rows[0].count);
  const executions=await client.execute({sql:'SELECT tool_name,status,input_json FROM clara_tool_executions WHERE research_state_id=? ORDER BY started_at',args:[funding.researchStateId]});
  const summary={company,researchId:record.researchId,stageStatus:record.stageStatus,legalNames:record.identityGraph.legalNames,claimTypes:[...new Set(report.claims.map(c=>c.claimType))],funding,executions:executions.rows,checks:{freshDatabaseConnection:true,allFieldEvidenceLinksPresent:true,completedReportCache:true,noNewExecutionOnReload:true}};
  summaries.push(summary);
  console.log(JSON.stringify({company,researchId:record.researchId,events:funding.events.length,modelRuns:funding.modelRuns,executionCount:executions.rows.length,checks:summary.checks}));
}
await writeFile('docs/diagnostics/clara-funding-live-validation.json',JSON.stringify(summaries,null,2)+'\n');
client.close();
