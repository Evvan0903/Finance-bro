import assert from 'node:assert/strict';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';
const root = new URL('../app/lib/private-diligence/', import.meta.url);
const imp = p => tsImport(new URL(p, root).href, import.meta.url);
const { resolveSecIssuer } = await imp('entity-resolution/secIssuerResolution.ts');
const { createSecFormDProvider } = await imp('providers/secFormDProvider.ts');
const { executePrivateProvider } = await imp('providers/providerTypes.ts');
const { normalizeEvidenceRegistry } = await imp('evidence/evidenceRegistry.ts');
const { buildClaimRegistry } = await imp('evidence/claimRegistry.ts');
const { buildQuickCompanyIntelligenceReport } = await imp('reports/quickReportBuilder.ts');
const graph = {entityId:'target',canonicalName:'Acme',confirmedDisplayName:'Acme',confirmedWebsite:'https://acme.test',identityEvidenceIds:['official-identity'],confirmedAt:'2026-09-01T00:00:00Z',legalNames:['Acme Inc.'],termsPageLegalNames:[],privacyPageLegalNames:[],domains:['acme.test'],emailDomains:['acme.test'],addresses:[],founders:[],executives:[],directors:[],parentCompanies:[],subsidiaries:[],affiliatedEntities:[],cikCandidates:['123'],dbaNames:[],formerNames:[],phoneNumbers:[],targetSelectionStatus:'userSelected',identityVerificationStatus:'partiallyVerified',identityConfidence:'High'};
const now = '2026-09-17T00:00:00Z', payload = {name:'Acme Inc.'};
const address = {street1:'123 Main Street',city:'Boston',stateOrCountry:'MA',zipCode:'02110'}, graphAddress = '123 Main St., Boston MA 02110';
function source(text, extra={}) {return {evidenceId:'official-identity',researchId:'resolution-test',entityId:graph.entityId,providerId:'companyWebsite',sourceTier:2,sourceType:'Company-controlled web page',sourceTitle:'Privacy',sourceUrl:'https://acme.test/privacy',publicReferenceUrl:'https://acme.test/privacy',publicationDate:null,retrievedAt:now,rawText:text,structuredData:{pageType:'privacy'},matchedEntitySignals:[],entityMatchConfidence:'High',companyReported:true,officialRecord:false,independentlyPublished:false,contentHash:'fixture',limitations:[],...extra};}
const official = source('Acme Inc. (“Acme”) operates this website. This privacy policy describes how we process personal information.');
function filing(inner, date='2026-08-01', id='1') {return source(`<edgarSubmission><primaryIssuer><entityName>Acme Inc.</entityName>${inner}</primaryIssuer></edgarSubmission>`,{evidenceId:`sec-${id}`,providerId:'secFormD',sourceTier:1,sourceUrl:`https://www.sec.gov/Archives/edgar/data/123/${id}/primary_doc.xml`,publicationDate:date,officialRecord:true,structuredData:{cik:'123'}});}
const person = (first,last) => `<relatedPersonInfo><firstName>${first}</firstName><lastName>${last}</lastName></relatedPersonInfo>`;
const decide = (p=payload,g=graph,identityEvidence=[]) => resolveSecIssuer(p,g,{cik:'123',now,identityEvidence});
test('exact legal name and normalized complete business address verifies',()=>{
 const d=decide({...payload,addresses:{business:address}},{...graph,addresses:[graphAddress]});
 assert.equal(d.decision,'verified');assert.ok(d.reasonCodes.includes('business_address_match'));
});
test('legal name and official website or issuer-scoped email domain verifies',()=>{
 assert.equal(decide({...payload,website:'https://www.acme.test'}).decision,'verified');
 const d=decide(payload,graph,[filing('<issuerEmail>contact@acme.test</issuerEmail>')]);
 assert.equal(d.decision,'verified');assert.ok(d.reasonCodes.includes('official_domain_match'));
 assert.equal(decide(payload,graph,[filing('<issuerEmail>contact@acme.test.evil.test</issuerEmail>')]).decision,'rejected');
});
test('two distinct supported full related-person names corroborate; one common name does not',()=>{
 const g={...graph,founders:['Avery Chen','Morgan Patel']};
 assert.equal(decide(payload,g,[filing(person('Avery','Chen')+person('Morgan','Patel'))]).decision,'verified');
 assert.equal(decide(payload,{...graph,executives:['John Smith']},[filing(person('John','Smith'))]).decision,'unresolved');
 assert.equal(decide(payload,g,[filing(person('Avery','Chen')+person('Avery','Chen'))]).decision,'unresolved');
});
test('name only, city/postal only, similar name and brand do not verify',()=>{
 assert.equal(decide().decision,'unresolved');
 assert.equal(decide({...payload,addresses:{business:{city:'Boston',zipCode:'02110'}}},{...graph,addresses:[graphAddress]}).decision,'unresolved');
 assert.equal(decide({name:'Acme',website:'https://acme.test'}).decision,'rejected');
 assert.equal(decide({name:'Acme Holdings Inc.',website:'https://acme.test'}).decision,'rejected');
});
test('domain/address contradictions override positive signals and retain provenance',()=>{
 const d=decide({...payload,website:'https://different.test',addresses:{business:address}},{...graph,addresses:[graphAddress]},[official]);
 assert.equal(d.decision,'rejected');assert.ok(d.reasonCodes.includes('identity_conflict'));
 assert.ok(d.conflictingSignals.every(s=>s.references.length));
 assert.equal(decide({...payload,website:'https://acme.test',addresses:{business:{...address,street1:'999 Other Road'}}},{...graph,addresses:[graphAddress]}).decision,'unresolved');
});
test('parent/subsidiary ambiguity stays unresolved',()=>{
 assert.equal(decide(payload,{...graph,parentCompanies:['Acme Inc.']},[official]).decision,'unresolved');
 assert.equal(decide(payload,graph,[source('Our subsidiary Acme Inc. (“Acme”) operates this website.')]).decision,'unresolved');
});
test('dated historical address matches accumulate; a newer conflict blocks verification',()=>{
 const g={...graph,addresses:[graphAddress]};
 const old=filing('<street1>123 Main Street</street1><zipCode>02110</zipCode>','2020-01-01','old');
 const other=filing('<street1>123 Main St.</street1><zipCode>02110</zipCode>','2021-01-01','other');
 const recent=filing('<street1>999 Different Road</street1><zipCode>90210</zipCode>','2026-01-01','new');
 assert.equal(decide(payload,g,[old]).decision,'unresolved');
 const d=decide(payload,g,[old,other]);assert.equal(d.decision,'verified');
 assert.equal(d.matchedSignals.find(s=>s.code==='historical_identity_consistent').references[0].publicationDate,'2020-01-01');
 assert.equal(decide(payload,g,[old,other,recent]).decision,'unresolved');
 assert.equal(decide({...payload,addresses:{business:{street1:'999 Different Road',zipCode:'90210'}}},g,[old,other]).decision,'unresolved');
});
test('official legal statement resolves previous candidate without mutating confirmed identity',()=>{
 const before=structuredClone(graph);assert.equal(decide().decision,'unresolved');
 const d=decide(payload,graph,[official]);assert.equal(d.decision,'verified');
 assert.ok(d.reasonCodes.includes('official_legal_entity_statement'));
 assert.equal(d.matchedSignals.find(s=>s.code==='official_legal_entity_statement').references[0].evidenceId,'official-identity');
 assert.equal(d.evaluatedAt,now);assert.deepEqual(graph,before);
});
test('unbound mentions, third parties, other entities and filing-agent contacts cannot corroborate',()=>{
 for(const e of [source('Our customers include Acme Inc.'),source(official.rawText,{sourceUrl:'https://other.test/privacy'}),source(official.rawText,{entityId:'other'}),source(official.rawText,{providerId:'serpapi'})])assert.equal(decide(payload,graph,[e]).decision,'unresolved');
 const agent=filing('');agent.rawText=agent.rawText.replace('</edgarSubmission>','<filingAgent><emailAddress>agent@acme.test</emailAddress></filingAgent></edgarSubmission>');
 assert.equal(decide(payload,graph,[agent]).decision,'unresolved');
 const other=filing('<issuerEmail>contact@acme.test</issuerEmail>');other.structuredData.cik='456';assert.equal(decide(payload,graph,[other]).decision,'unresolved');
});
const submissions={...payload,filings:{recent:{form:['D/A'],accessionNumber:['0000000123-26-000001'],filingDate:['2026-09-01'],primaryDocument:['xslFormDX01/primary_doc.xml']}}};
const xml='<edgarSubmission><primaryIssuer><entityName>Acme Inc.</entityName></primaryIssuer><totalOfferingAmount>1000000</totalOfferingAmount><totalAmountSold>200000</totalAmountSold><previousAccessionNumber>0000000123-25-000001</previousAccessionNumber></edgarSubmission>';
const context={researchId:'resolution-test',input:{companyName:'Acme',website:'https://acme.test',workflowMode:'quick',locale:'en',researchObjective:'General diligence'},identityGraph:graph,now:()=>new Date(now)};
function provider(options={},doc=xml,sub=submissions){const calls={filings:0,submissions:0};const p=createSecFormDProvider({getSubmissions:async()=>{calls.submissions++;return sub;},getFilingDocument:async()=>{calls.filings++;return doc;}},options);return{p,calls};}
test('unresolved issuer makes no original filing request and candidate reasons survive',async()=>{
 const {p,calls}=provider();const out=await executePrivateProvider(p,context);
 assert.equal(calls.filings,0);assert.equal(out.evidence.length,0);assert.equal(out.secIssuerAssociations[0].decision,'unresolved');
});
test('verified issuer reaches existing parser, field evidence and Quick report; graph unchanged',async()=>{
 const before=structuredClone(graph);const {p,calls}=provider({identityEvidence:[official]});const out=await executePrivateProvider(p,context);
 assert.equal(calls.filings,1);assert.equal(out.status,'success');assert.equal(out.secIssuerAssociations[0].downstreamStage,'evidence');
 const evidence=normalizeEvidenceRegistry(out.evidence),events=out.evidence.flatMap(e=>e.structuredData.fundingEvents);
 const fundingResearch={events,issuerAssociations:out.secIssuerAssociations,announcementStatus:'not_performed',secStatus:'supported',gaps:[],limitations:[],actions:[],requests:{search:0,fetch:0,sec:1,model:0}};
 const report=buildQuickCompanyIntelligenceReport({researchId:context.researchId,input:context.input,graph,providerPlan:[],evidence,claims:buildClaimRegistry(context.researchId,graph.entityId,evidence),informationGaps:[],generatedAt:now,fundingResearch});
 assert.equal(report.fundingResearch.events[0].fields.amountSold.value,200000);assert.equal(report.fundingResearch.events[0].fields.offeringAmount.value,1000000);
 assert.equal(report.fundingResearch.issuerAssociations[0].decision,'verified');
 for(const field of Object.values(report.fundingResearch.events[0].fields))assert.ok(report.evidence.some(e=>e.evidenceId===field.evidenceId));
 assert.deepEqual(graph,before);
});
test('wrong issuer and newly retrieved original-document conflicts cannot leak evidence',async()=>{
 for(const doc of [xml.replace('Acme Inc.','Other Inc.'),xml.replace('</primaryIssuer>','<website>https://other.test</website></primaryIssuer>')]){
  const {p}=provider({identityEvidence:[official]},doc);const out=await executePrivateProvider(p,context);
  assert.equal(out.evidence.length,0);assert.ok(out.secIssuerAssociations[0].downstreamError);
 }
});
test('parse/retrieval failure is separate from the verified issuer association',async()=>{
 const {p}=provider({identityEvidence:[official]},'<html>not a filing</html>');const out=await executePrivateProvider(p,context);
 assert.equal(out.status,'parseFailed');assert.equal(out.secIssuerAssociations[0].decision,'verified');assert.equal(out.secIssuerAssociations[0].downstreamError,'form_d_parse_failed');
 const unavailable=createSecFormDProvider({getSubmissions:async()=>submissions,getFilingDocument:async()=>{throw Object.assign(new Error(),{code:'SEC_FORBIDDEN'});}},{identityEvidence:[official]});
 const result=await executePrivateProvider(unavailable,context);assert.equal(result.secIssuerAssociations[0].downstreamStage,'filing_retrieval');assert.equal(result.secIssuerAssociations[0].downstreamError,'SEC_FORBIDDEN');
});
test('Cohere official privacy statement corroborates; Abaka missing legal name/CIK does not fabricate one',async()=>{
 const cohere={...graph,canonicalName:'Cohere',confirmedDisplayName:'Cohere',legalNames:['Cohere Inc'],domains:['cohere.com']};
 assert.equal(decide({name:'Cohere Inc.'},cohere,[source('Cohere Inc. (“ Cohere ”) values and respects your privacy.',{sourceUrl:'https://cohere.com/privacy'})]).decision,'verified');
 const abaka={...graph,canonicalName:'Abaka AI',legalNames:[],domains:['abaka.ai'],cikCandidates:[]};
 assert.equal(decide({name:'Abaka AI'},abaka).decision,'unresolved');
 const {p,calls}=provider({discoverCiks:async()=>[]});const result=await executePrivateProvider(p,{...context,identityGraph:abaka});
 assert.equal(calls.submissions,0);assert.equal(calls.filings,0);assert.equal(result.diagnostic.sanitizedIssue,'issuer_unresolved');
});
test('official labeled address is collected as association evidence and a conflict blocks same-name legal statement',()=>{
 const p={...payload,addresses:{business:{street1:'530 E. McDowell Road #107412',zipCode:'85004'}}};
 const page=source(official.rawText+' Mailing Address: 171 John Street, Suite 200, Toronto, ON Canada M5T 1X3');
 const d=decide(p,graph,[page]);assert.equal(d.decision,'unresolved');assert.ok(d.reasonCodes.includes('business_address_conflict'));
 const reference=d.conflictingSignals.find(s=>s.code==='business_address_conflict').references.find(r=>r.evidenceId==='official-identity');
 assert.ok(reference.excerpt.includes('171 John Street'));assert.equal(graph.addresses.length,0);
 const matched=decide({...payload,addresses:{business:address}},graph,[source('Business Address: 123 Main Street, Boston MA 02110')]);assert.equal(matched.decision,'verified');
});
test('leading-zero variants of the same discovered CIK are retrieved and audited once',async()=>{
 const {p,calls}=provider({identityEvidence:[official],discoverCiks:async()=>['0000000123','123','0000000000']});
 const out=await executePrivateProvider(p,context);assert.equal(calls.submissions,1);assert.equal(calls.filings,1);assert.equal(out.evidence.length,1);assert.equal(out.secIssuerAssociations.length,1);
});
test('city/postal-only graph locations neither corroborate nor contradict complete SEC addresses',()=>{
 const result=decide({...payload,addresses:{business:address}},{...graph,addresses:['San Francisco, CA, 94104, US']});
 assert.equal(result.decision,'unresolved');assert.ok(result.reasonCodes.includes('insufficient_corroboration'));
 assert.ok(!result.reasonCodes.includes('business_address_conflict'));
 assert.ok(!result.reasonCodes.includes('business_address_match'));
});
