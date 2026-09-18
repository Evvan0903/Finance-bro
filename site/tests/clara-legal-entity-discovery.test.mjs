import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
const root = new URL('../app/lib/private-diligence/', import.meta.url);
const { analyzeLegalEntities, discoverLegalEntities, legalEntitySecGraph } = await tsImport(new URL('entity-resolution/legalEntityDiscovery.ts', root).href, import.meta.url);
const { resolveSecIssuer } = await tsImport(new URL('entity-resolution/secIssuerResolution.ts', root).href, import.meta.url);
const graph = { entityId: 'acme', canonicalName: 'Acme', confirmedDisplayName: 'Acme', confirmedWebsite: 'https://acme.example', domains: ['acme.example'], legalNames: ['Acme Advisory LLC'], termsPageLegalNames: ['Acme Lending Inc.'], privacyPageLegalNames: [], identityEvidenceIds: [], targetSelectionStatus: 'userSelected', addresses: [], founders: [], executives: [], directors: [], parentCompanies: [], subsidiaries: [], affiliatedEntities: [] };
const time = '2026-09-18T00:00:00Z';
function page(text, path = '/terms', extra = {}) { return { evidenceId: 'page-'+path, researchId: 'legal-test', entityId: graph.entityId, providerId: 'companyWebsite', companyReported: true, sourceUrl: 'https://acme.example'+path, rawText: text, retrievedAt: time, structuredData: {pageType: 'terms', links: []}, ...extra }; }
const analyze = pages => analyzeLegalEntities(graph, pages, time);

test('Terms/Privacy entity is selected with exact source excerpts, timestamps and no graph mutation', () => {
  for (const path of ['/terms', '/privacy']) {
    const before = structuredClone(graph);
    const source = page('These terms are between you and Acme Technologies, Inc. ("Acme", "we", "us"). Acme provides the platform.', path);
    const result = analyze([source]);
    assert.deepEqual(result.secQueryLegalNames, ['Acme Technologies, Inc.']);
    const candidate = result.candidates[0];
    assert.equal(candidate.status, 'accepted'); assert.equal(candidate.relationship, 'primaryOperatingEntity');
    assert.equal(candidate.evidence[0].sourceUrl, source.sourceUrl); assert.equal(candidate.evidence[0].retrievedAt, time);
    assert.ok(source.rawText.includes(candidate.evidence[0].excerpt));
    const scoped = legalEntitySecGraph(graph, result);
    assert.deepEqual(scoped.legalNames, ['Acme Technologies, Inc.']); assert.deepEqual(scoped.termsPageLegalNames, []);
    assert.equal(scoped.canonicalName, 'Acme'); assert.deepEqual(graph, before);
  }
});

test('subsidiary mention cannot become primary even when named similarly and operating a website', () => {
  const result = analyze([page('Our subsidiary Acme Services Inc. ("Acme") operates this website.')]);
  assert.deepEqual(result.secQueryLegalNames, []);
  assert.equal(result.candidates[0].status, 'rejected'); assert.equal(result.candidates[0].relationship, 'subsidiary');
});

test('advisory, lending, fund and SPV names remain retained and rejected for unsupported brand scope', () => {
  const result = analyze([page('Acme Advisory LLC ("we") operates this website. Acme Lending Inc. provides lending services. Acme Fund LLC is an investment fund. Acme SPV LLC is a special purpose vehicle.')]);
  assert.equal(result.candidates.length, 4); assert.deepEqual(result.secQueryLegalNames, []);
  assert.ok(result.candidates.every(c => c.status === 'rejected' && c.evidence.length));
});

test('operating company wins over product advisory entity regardless of first-name order', () => {
  const result = analyze([page('Treasury is offered by Acme Advisory LLC, an investment adviser. Acme Technologies Inc. and its affiliates (collectively, "Acme", "we") operate the platform.')]);
  assert.deepEqual(result.secQueryLegalNames, ['Acme Technologies Inc.']);
  assert.equal(result.candidates.find(c => /Advisory/.test(c.legalName)).status, 'rejected');
});

test('multiple supported legal entities remain unresolved rather than selecting the first', () => {
  const result = analyze([page('Acme Inc. ("Acme", "we") operates this website.'), page('Acme Europe Ltd. ("Acme", "we") operates this website.', '/privacy')]);
  assert.equal(result.status, 'unresolved'); assert.deepEqual(result.secQueryLegalNames, []);
  assert.equal(result.candidates.filter(c => c.status === 'unresolved').length, 2);
});

test('explicit subsidiary/parent relation is preserved without promoting the parent to issuer', () => {
  const result = analyze([page('Acme Operations Inc. is a wholly-owned subsidiary of Acme Holdings Inc.')]);
  assert.equal(result.candidates.find(c => /Operations/.test(c.legalName)).relationship, 'subsidiary');
  assert.equal(result.candidates.find(c => /Holdings/.test(c.legalName)).relationship, 'parent');
  assert.ok(result.candidates.every(c => c.evidence.some(e => e.relatedLegalName)));
  assert.deepEqual(result.secQueryLegalNames, []);
});

test('no entity is fabricated from brand, products, graph strings or search snippets', () => {
  assert.equal(analyze([page('Acme builds the Acme Cloud product.')]).status, 'no_entity');
  assert.equal(analyze([page('', '/privacy', { structuredData: { legalNames: ['Acme Inc.'], snippet: 'Acme Inc. operates this website.' } })]).candidates.length, 0);
  assert.equal(analyze([page('Acme Inc. ("we") operates this website.', '/terms', {providerId: 'searchSnippet'})]).candidates.length, 0);
  assert.equal(analyze([page('Acme Inc. ("we") operates this website.', '/terms', {sourceUrl:'https://directory.example/acme'})]).candidates.length, 0);
  assert.equal(analyze([page('© 2026 Acme Inc.', '/')]).candidates[0].status, 'candidate');
});

test('dated headers and suffix punctuation are not part of accepted legal names', () => {
  const result = analyze([page('Last Updated September 11, 2026 Acme Technologies, Inc. and its affiliates (collectively, "Acme", "we") welcome you.')]);
  assert.deepEqual(result.secQueryLegalNames, ['Acme Technologies, Inc.']);
});

test('new legal selection does not relax SEC name or corroboration requirements', () => {
  const source = page('Acme Technologies Inc. ("Acme", "we") welcomes you.');
  const scoped = legalEntitySecGraph(graph, analyze([source]));
  assert.equal(resolveSecIssuer({name: 'Acme Technologies Inc.'}, scoped, {cik:'123', now:time, identityEvidence:[source]}).decision, 'unresolved');
  assert.equal(resolveSecIssuer({name: 'Acme Advisory LLC', website:'https://acme.example'}, scoped, {cik:'123', now:time, identityEvidence:[source]}).decision, 'rejected');
});

test('bounded legal crawling follows company-owned legal subdomains, excludes external and product links', async () => {
  const urls = [];
  const source = page('Welcome to Acme.', '/', {structuredData:{links:['/products/privacy-tools', 'https://directory.example/terms', 'https://app.acme.example/legal/user', '/privacy']}});
  const result = await discoverLegalEntities(graph, 'legal-test', [source], {
    maxPages: 2, resolveHost: async () => [{address:'93.184.216.34',family:4}],
    fetchImpl: async (url, init) => { urls.push(String(url)); assert.equal(new Headers(init.headers).has('authorization'), false); return new Response(new URL(url).pathname === '/robots.txt' ? '' : '<title>Terms</title><p>Acme Inc. ("Acme", "we") operates this website.</p>', {headers:{'content-type':'text/html'}}); },
  });
  assert.deepEqual(result.discovery.secQueryLegalNames, ['Acme Inc.']);
  assert.equal(result.evidence.length, 2); assert.equal(result.discovery.requests, 4);
  assert.ok(urls.every(u => !/directory|products/.test(u))); assert.ok(urls.some(u => u.includes('app.acme.example/legal/user')));
});

test('robots, failed source access and confirmation are respected without fallback facts', async () => {
  const source = page('', '/', {structuredData:{links:['/privacy']}}); let calls = 0;
  const options = { resolveHost: async () => [{address:'93.184.216.34',family:4}], fetchImpl: async () => { calls++; return new Response('User-agent: *\nDisallow: /privacy', {headers:{'content-type':'text/plain'}}); } };
  const result = await discoverLegalEntities(graph, 'legal-test', [source], options);
  assert.equal(result.discovery.sources.at(-1).status, 'robotsDisallowed'); assert.equal(calls, 1);
  assert.equal(result.discovery.candidates.length, 0);
  await discoverLegalEntities({...graph,targetSelectionStatus:'unselected'}, 'legal-test', [source], options);
  assert.equal(calls, 1);
});

test('joint controllers remain unresolved; reverse parent relation is explicit', () => {
  const joint = analyze([page('Acme Inc. and Acme Europe Ltd. (collectively "Acme", "we") operate the service.')]);
  assert.deepEqual(joint.secQueryLegalNames, []); assert.equal(joint.candidates.filter(c=>c.status==='unresolved').length, 2);
  const reverse = analyze([page('Acme Holdings Inc. is the parent of Acme Operations Inc.')]);
  assert.equal(reverse.candidates.find(c=>/Holdings/.test(c.legalName)).relationship, 'parent');
  assert.equal(reverse.candidates.find(c=>/Operations/.test(c.legalName)).relationship, 'subsidiary');
});

test('real funding entrypoint queries supported legal name, not legacy first advisory name', async (t) => {
  const {researchFunding} = await tsImport(new URL('funding/research.ts',root).href,import.meta.url);
  const oldAgent = process.env.SEC_USER_AGENT;
  process.env.SEC_USER_AGENT = 'MockTransport legal-test@fixture.test';
  t.after(() => { if(oldAgent===undefined) delete process.env.SEC_USER_AGENT; else process.env.SEC_USER_AGENT=oldAgent; });
  const queries=[];let submissions=0;
  t.mock.method(globalThis,'fetch',async input => {
    const url=new URL(String(input));
    if(url.hostname==='data.sec.gov'){submissions++;return Response.json({name:'Acme Technologies Inc.',website:'https://acme.example',filings:{recent:{form:[]}}});}
    throw Error('Unexpected live transport in test');
  });
  const target={...graph,cikCandidates:[],dbaNames:[],formerNames:[],termsPageLegalNames:[],privacyPageLegalNames:[]};
  const before=structuredClone(target);
  const result=await researchFunding({researchId:'legal-test',input:{companyName:'Acme',website:'https://acme.example',workflowMode:'quick',locale:'en'},identityGraph:target,now:()=>new Date(time)},[page('Acme Technologies Inc. ("Acme", "we") welcomes you.')],{
    followup:false,searchOptions:{apiKey:'mock-only',tavilyApiKey:null,fetchImpl:async input=>{
      const url=new URL(String(input));const query=url.searchParams.get('q');queries.push(query);
      return Response.json({organic_results:query.startsWith('site:sec.gov')?[{title:'Original SEC filing',link:'https://www.sec.gov/Archives/edgar/data/123/filing.xml'}]:[]});
    }},
  });
  const secQuery=queries.find(q=>q.startsWith('site:sec.gov'));
  assert.match(secQuery,/"Acme Technologies Inc\."/);assert.doesNotMatch(secQuery,/Advisory|Lending/);
  assert.equal(submissions,1);assert.equal(result.fundingResearch.issuerAssociations[0].decision,'verified');
  assert.equal(result.providerResults.find(p=>p.providerId==='secFormD').legalEntityDiscovery.status,'selected');
  assert.deepEqual(target,before);
});

test('plural/after-name subsidiary disclosures and named customer contracts do not select primary', () => {
  for(const text of ['Our subsidiaries include Acme Services Inc. ("Acme", "we") operates this website.', 'Acme Services Inc., a subsidiary of Acme, ("we") operates this website.', 'These terms are an agreement between Acme and Customer Technologies Inc.']) {
    assert.deepEqual(analyze([page(text)]).secQueryLegalNames, []);
  }
  assert.deepEqual(analyze([page('Acme Inc. ("we") operates this website.','/products/privacy-tools')]).secQueryLegalNames, []);
});
