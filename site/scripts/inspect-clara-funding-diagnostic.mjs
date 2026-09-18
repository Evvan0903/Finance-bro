import { createClient } from '@libsql/client';
const path=process.argv[2];
if(!path || !path.includes('clara-funding-live-'))throw new Error('Only isolated funding diagnostic databases are allowed');
const client=createClient({url:`file:${path}`});
const rows=await client.execute('SELECT record_json FROM research_requests ORDER BY created_at DESC');
for(const row of rows.rows){
  const record=JSON.parse(row.record_json);
  console.log(JSON.stringify({researchId:record.researchId,company:record.input.companyName,stage:record.stage,status:record.stageStatus,legalNames:record.identityGraph?.legalNames,claimTypes:[...new Set(record.report?.claims?.map(c=>c.claimType)??[])],funding:record.report?.fundingResearch},null,2));
}
client.close();
