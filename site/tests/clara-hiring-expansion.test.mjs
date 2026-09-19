import assert from 'node:assert/strict';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';

const core = await tsImport(new URL('../app/lib/private-diligence/hiring/core.ts', import.meta.url).href, import.meta.url);
const { normalizeSupportedAtsReference, supportedAtsReferences, discoverCareerSources } = await tsImport(new URL('../app/lib/private-diligence/hiring/discovery.ts', import.meta.url).href, import.meta.url);
const { GenericCareersAdapter, GreenhouseAdapter, AshbyAdapter } = await tsImport(new URL('../app/lib/private-diligence/hiring/adapters.ts', import.meta.url).href, import.meta.url);
const { researchHiringActivity } = await tsImport(new URL('../app/lib/private-diligence/hiring/index.ts', import.meta.url).href, import.meta.url);
const now = '2026-09-18T10:00:00.000Z';
const resolveHost = async () => [{ address: '8.8.8.8', family: 4 }];
const posting = (title, id, extra = {}) => ({ id, companyId: 'confirmed-brand', title, location: 'New York, NY', sourceUrl: `https://jobs.ashbyhq.com/acme/${id}`, sourceType: 'ashby', sourceJobId: id, retrievedAt: now, ...extra });
const htmlResponse = text => new Response(text, { headers: { 'content-type': 'text/html' } });
const genericInput = html => ({ companyId: 'confirmed-brand', sourceUrl: 'https://acme.example/careers', officialHostname: 'acme.example', retrievedAt: now, resolveHost, fetchImpl: async () => htmlResponse(html) });

test('title normalization preserves original titles and recognizes variant strategic roles', () => {
  const cases = [
    ['Chief Financial Officer (m/f/d)', 'finance_leadership', 'Executive'],
    ['V.P., Finance', 'finance_leadership', 'VP'],
    ['Vice-President of Finance', 'finance_leadership', 'VP'],
    ['Head of Engineering', 'technical_leadership', 'Director'],
    ['Chief Architect', 'technical_leadership', 'Executive'],
    ['Sr. Machine-Learning Engineer', 'ai_ml', 'Senior'],
    ['Staff AI/ML Infrastructure Engineer', 'ai_ml', 'Lead'],
    ['Applied Scientist', 'ai_ml', 'Unknown'],
    ['Analytics Engineer', 'data', 'Unknown'],
    ['Head of Data', 'data', 'Director'],
    ['Director, AML / KYC', 'security_compliance', 'Director'],
    ['CISO', 'security_compliance', 'Executive'],
    ['VP Sales', 'commercial_leadership', 'VP'],
    ['Head of Partnerships', 'commercial_leadership', 'Director'],
  ];
  for (const [title, category, seniority] of cases) {
    assert.ok(core.classifyKeyRoleTitle(title).includes(category), title);
    assert.equal(core.classifyJobSeniority(title), seniority, title);
    const result = core.analyzeHiringRoles([posting(title, 'one')]);
    assert.equal(result.notableRoles[0].title, title);
    assert.equal(result.notableRoles[0].sourceUrl, posting(title, 'one').sourceUrl);
    assert.ok(result.notableRoles[0].normalizedTitle);
  }
  assert.deepEqual(core.classifyKeyRoleTitle('Executive Assistant to the CFO'), []);
  assert.equal(core.classifyJobSeniority('Executive Assistant to the CFO'), 'Unknown');
  assert.deepEqual(core.classifyKeyRoleTitle('Marketing Manager'), []);
});

test('specific title functions take precedence over broad department labels', () => {
  assert.equal(core.classifyJobFunction('CFO', 'Executive'), 'Finance');
  assert.equal(core.classifyJobFunction('ML Engineer', 'Engineering'), 'Data / AI');
  assert.equal(core.classifyJobFunction('VP Finance', 'Engineering'), 'Finance');
  assert.equal(core.classifyJobFunction('Director of Compliance', 'Operations'), 'Legal / Compliance');
  assert.equal(core.classifyJobFunction('CTO'), 'Engineering');
  assert.equal(core.classifyJobFunction('Unspecified role', 'Finance'), 'Finance');
});

test('notable selection ranks strategy-relevant jobs, is order independent, and retains original records', () => {
  const jobs = [posting('Office Coordinator', '1'), posting('Customer Support Associate', '2'), posting('CFO', '3'), posting('VP Engineering', '4'), posting('ML Engineer', '5'), posting('Director of Compliance', '6')];
  const first = core.analyzeHiringRoles(jobs, 5);
  assert.equal(first.notableRoles.length, 5);
  assert.equal(first.notableRoles[0].title, 'CFO');
  assert.ok(first.notableRoles.some(j => j.title === 'ML Engineer'));
  assert.deepEqual(first.notableRoles.map(j => j.id), core.analyzeHiringRoles([...jobs].reverse(), 5).notableRoles.map(j => j.id));
  assert.deepEqual(first.metrics, { leadership: 3, aiMl: 1, financeLeadership: 1, securityCompliance: 1 });
  for (const role of first.notableRoles) {
    const original = jobs.find(j => j.id === role.id);
    assert.equal(role.sourceUrl, original.sourceUrl);
    assert.equal(role.sourceJobId, original.sourceJobId);
    assert.equal(role.retrievedAt, now);
    assert.ok(role.selectionReasons.length);
  }
  assert.equal(jobs[0].normalizedTitle, undefined);
  assert.equal(core.analyzeHiringRoles(Array.from({ length: 15 }, (_, i) => posting(`ML Engineer ${i}`, String(i))), 99).notableRoles.length, 10);
});

test('hiring descriptions are observed-title counts, never inference from company boilerplate or inferred growth', () => {
  const jobs = [posting('Software Engineer', '1', { description: 'We build AI and machine learning products.' }), posting('Software Engineer', '2', { location: 'San Francisco, CA' }), posting('CFO', '3')];
  const summary = core.summarizeHiring('confirmed-brand', jobs, { adapter: 'AshbyAdapter', sourceUrl: 'https://jobs.ashbyhq.com/acme', retrievedAt: now });
  assert.equal(summary.roleAnalysis.metrics.aiMl, 0);
  assert.equal(summary.roleAnalysis.metrics.financeLeadership, 1);
  assert.equal(summary.signals.some(s => s.type === 'ai_ml_hiring'), false);
  assert.ok(summary.roleAnalysis.descriptiveSignals.find(s => s.type === 'largest_function')?.text.includes('Engineering'));
  assert.ok(summary.roleAnalysis.descriptiveSignals.find(s => s.type === 'observed_locations')?.text.includes('San Francisco'));
  assert.doesNotMatch(summary.roleAnalysis.descriptiveSignals.map(s => s.text).join(' '), /growing|growth|headcount|healthy|IPO|lacks|no CFO|expan/i);
  assert.equal(summary.signals.some(s => s.type === 'international_hiring'), false);
  for (const signal of summary.roleAnalysis.descriptiveSignals) assert.equal(signal.evidenceCount, signal.supportingJobIds.length);
});

test('supported ATS references canonicalize explicit board tokens without inventing one', () => {
  assert.equal(normalizeSupportedAtsReference('https://boards.greenhouse.io/embed/job_board?for=acme&amp;b=x'), 'https://boards.greenhouse.io/acme');
  assert.equal(normalizeSupportedAtsReference('https://job-boards.greenhouse.io/acme/jobs/123'), 'https://boards.greenhouse.io/acme');
  assert.equal(normalizeSupportedAtsReference('https://boards-api.greenhouse.io/v1/boards/acme/jobs'), 'https://boards.greenhouse.io/acme');
  assert.equal(normalizeSupportedAtsReference('https://api.lever.co/v0/postings/acme?mode=json'), 'https://jobs.lever.co/acme');
  assert.equal(normalizeSupportedAtsReference('https://api.ashbyhq.com/posting-api/job-board/acme'), 'https://jobs.ashbyhq.com/acme');
  for (const url of ['https://boards.greenhouse.io/embed/job_board', 'https://jobs.lever.co', 'https://jobs.ashbyhq.com.evil.example/acme', 'http://jobs.ashbyhq.com/acme', 'https://user:password@jobs.ashbyhq.com/acme']) assert.equal(normalizeSupportedAtsReference(url), null);
});

test('iframe and static supported ATS references retain the official referring page', () => {
  const candidates = supportedAtsReferences('<iframe src="https://boards.greenhouse.io/embed/job_board?for=acme"></iframe><script>const board="https:\\/\\/jobs.ashbyhq.com\\/acme";</script>', 'https://acme.example/careers');
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].referenceType, 'iframe');
  assert.ok(candidates.every(c => c.sourcePageUrl === 'https://acme.example/careers' && c.discoveryMethod === 'linked_from_website'));
});

test('actual official careers link is followed before guesses and stops after a supported board', async () => {
  const requests = [];
  const candidates = await discoverCareerSources({ officialUrl: 'https://acme.example', resolveHost, fetchImpl: async input => {
    const url = String(input); requests.push(url);
    if (url === 'https://acme.example/') return htmlResponse('<a href="/work-with-us">Careers</a>');
    if (url === 'https://acme.example/work-with-us') return htmlResponse('<iframe src="https://boards.greenhouse.io/embed/job_board?for=acme"></iframe>');
    throw new Error('unexpected discovery request');
  } });
  assert.deepEqual(requests, ['https://acme.example/', 'https://acme.example/work-with-us']);
  assert.equal(candidates[0].url, 'https://boards.greenhouse.io/acme');
});

test('real hiring collection path follows official iframe to structured ATS records', async () => {
  const requests = [];
  const result = await researchHiringActivity({ companyId: 'confirmed-brand', officialUrl: 'https://acme.example', retrievedAt: now, resolveHost, fetchImpl: async input => {
    const url = String(input); requests.push(url);
    if (url === 'https://acme.example/') return htmlResponse('<iframe src="https://boards.greenhouse.io/embed/job_board?for=acme"></iframe>');
    if (url === 'https://boards-api.greenhouse.io/v1/boards/acme/jobs') return Response.json({ jobs: [{ id: 123, title: 'Chief Financial Officer', absolute_url: 'https://boards.greenhouse.io/acme/jobs/123', location: { name: 'Remote — US' }, updated_at: '2026-09-17T12:00:00Z' }] });
    throw new Error('unexpected request');
  } });
  assert.equal(requests.length, 2);
  assert.equal(result.status, 'success_with_jobs');
  assert.equal(result.jobs[0].sourceJobId, '123');
  assert.equal(result.jobs[0].remote, true);
  assert.equal(result.jobs[0].postedAt, undefined, 'updated_at is not a publication date');
  assert.equal(result.jobs[0].updatedAt, '2026-09-17T12:00:00Z');
  assert.equal(result.jobs[0].retrievedAt, now);
  assert.equal(result.summary.roleAnalysis.metrics.financeLeadership, 1);
});

test('company JobPosting markup supplies explicit details and avoids duplicate navigation records', async () => {
  const record = { '@type': 'JobPosting', title: 'Head of Data', url: 'https://acme.example/jobs/head-of-data', identifier: { value: 'data-123' }, description: '<p>Lead our data function.</p>', jobLocationType: 'TELECOMMUTE', datePosted: '2026-09-01', jobLocation: { address: { addressLocality: 'New York', addressRegion: 'NY', addressCountry: 'US' } } };
  const jobs = await GenericCareersAdapter.collect(genericInput(`<script type="application/ld+json">${JSON.stringify({ '@graph': [record] })}</script><a href="/jobs/head-of-data">Head of Data</a><a href="/jobs?page=2">Next</a>`));
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].sourceJobId, 'data-123');
  assert.equal(jobs[0].location, 'New York, NY, US');
  assert.equal(jobs[0].remote, true);
  assert.equal(jobs[0].function, 'Data / AI');
  assert.equal(jobs[0].seniority, 'Director');
  assert.equal(jobs[0].postedAt, '2026-09-01');
});

test('an unparsed careers shell is unknown, while an explicit zero-openings statement is zero', async () => {
  await assert.rejects(GenericCareersAdapter.collect(genericInput('<main>Join our team</main>')), /did not contain jobs/);
  assert.deepEqual(await GenericCareersAdapter.collect(genericInput('<main>No open positions at this time.</main>')), []);
  const jobs = await GenericCareersAdapter.collect(genericInput('<a href="/jobs/cfo-123">CFO</a><a href="/careers">Careers</a><a href="/jobs?page=2">Next</a><a href="https://other.example/jobs/123">CFO</a>'));
  assert.deepEqual(jobs.map(j => j.title), ['CFO']);
});

test('ATS API requests cannot silently redirect to another host', async () => {
  let redirect;
  await GreenhouseAdapter.collect({ companyId: 'confirmed-brand', sourceUrl: 'https://boards.greenhouse.io/acme', officialHostname: 'acme.example', retrievedAt: now, resolveHost, fetchImpl: async (_url, options) => { redirect = options.redirect; return Response.json({ jobs: [] }); } });
  assert.equal(redirect, 'error');
});

test('selling to finance executives and executive support roles are not CFO openings', () => {
  for (const title of ['Strategic Account Executive, CFO Platform', 'Senior Account Executive - CTO Office', 'Sales Development Representative - Security', 'Executive Assistant to the CFO']) {
    assert.deepEqual(core.classifyKeyRoleTitle(title), [], title);
    assert.ok(!['Executive', 'VP', 'Director'].includes(core.classifyJobSeniority(title)), title);
  }
  assert.equal(core.classifyJobFunction('Strategic Account Executive, CFO Platform'), 'Sales');
  assert.equal(core.classifyJobFunction('Executive Assistant to the CFO'), 'Operations');
});

test('static editorial and generic homepage mentions cannot establish another company ATS board', () => {
  const html = '<script>const customerJobLink="https://jobs.ashbyhq.com/other-company";</script>';
  assert.deepEqual(supportedAtsReferences(html, 'https://acme.example/'), []);
  assert.deepEqual(supportedAtsReferences(`${html}<iframe src="https://jobs.ashbyhq.com/other-company"></iframe>`, 'https://acme.example/blog/customer-hiring'), []);
});

test('reuses explicit links from inspected official career pages without refetching or accepting editorial leads', async () => {
  let calls = 0;
  const candidates = await discoverCareerSources({ officialUrl: 'https://acme.example', resolveHost, inspectedCompanyPages: [
    { url: 'https://acme.example/customers/job-story', links: ['https://jobs.ashbyhq.com/other-company'] },
    { url: 'https://other.example/careers', links: ['https://jobs.ashbyhq.com/other-company'] },
    { url: 'https://acme.example/jobs', links: ['https://job-boards.greenhouse.io/acme/jobs/123'] },
  ], fetchImpl: async () => { calls++; throw new Error('must reuse inspected source'); } });
  assert.equal(calls, 0);
  assert.deepEqual(candidates.map(c => c.url), ['https://boards.greenhouse.io/acme']);
  assert.equal(candidates[0].sourcePageUrl, 'https://acme.example/jobs');
});

test('foreign or unresolved JSON-LD hiringOrganization is not re-admitted through an ordinary job link', async () => {
  const record = { '@type': 'JobPosting', title: 'CFO', url: 'https://acme.example/jobs/other-company-cfo', hiringOrganization: { name: 'Other Company', url: 'https://other.example' } };
  const html = row => `<script type="application/ld+json">${JSON.stringify(row)}</script><a href="/jobs/other-company-cfo">CFO</a>`;
  await assert.rejects(GenericCareersAdapter.collect(genericInput(html(record))), /did not contain jobs/);
  await assert.rejects(GenericCareersAdapter.collect(genericInput(html({ ...record, hiringOrganization: { name: 'Other Company' } }))), /did not contain jobs/);
  const jobs = await GenericCareersAdapter.collect(genericInput(html({ '@graph': [{ '@type': 'Organization', name: 'Acme', url: 'https://acme.example' }, { ...record, hiringOrganization: { name: 'Acme' } }] })));
  assert.equal(jobs.length, 1);
});

test('missing remote indication stays unknown and string false never becomes true', async () => {
  const input = { companyId: 'confirmed-brand', sourceUrl: 'https://jobs.ashbyhq.com/acme', officialHostname: 'acme.example', retrievedAt: now, resolveHost,
    fetchImpl: async () => Response.json({ jobs: [
      { id: '1', title: 'ML Engineer', jobUrl: 'https://jobs.ashbyhq.com/acme/1', location: 'London', isRemote: 'false' },
      { id: '2', title: 'CFO', jobUrl: 'https://jobs.ashbyhq.com/acme/2', location: 'New York', isRemote: false },
      { id: '3', title: 'Controller', jobUrl: 'https://jobs.ashbyhq.com/acme/3', location: 'Not remote' },
    ] }) };
  const jobs = await AshbyAdapter.collect(input);
  assert.equal(jobs[0].remote, undefined);
  assert.equal(jobs[1].remote, false);
  assert.equal(jobs[2].remote, false);
  await assert.rejects(AshbyAdapter.collect({ ...input, fetchImpl: async () => Response.json({ jobs: [{ id: 'no-title-or-url' }] }) }), /did not contain jobs/);
});

test('AI/ML title classification handles suffixes and intervening specialisms without classifying nontechnical audiences', () => {
  for (const title of ['Staff Data Scientist - Risk ML', 'Senior Machine Learning Operations Engineer', 'Senior Software Engineer, AI Product', 'Member of Technical Staff, Multimodal AI', 'Sr. AI GTM Engineer']) {
    assert.ok(core.classifyKeyRoleTitle(title).includes('ai_ml'), title);
  }
  for (const title of ['Strategic Partnerships Manager - AI/API', 'Senior Manager - Data & AI Governance', 'Account Executive - AI Platform', 'Staff Product Manager, AI Foundations', 'Software Engineer', 'Executive Assistant to the Chief AI Scientist']) {
    assert.equal(core.classifyKeyRoleTitle(title).includes('ai_ml'), false, title);
  }
});

test('bounded finance modifiers recognize strategic finance without turning financial-crime or support roles into finance leadership', () => {
  for (const title of ['Head of Strategic Finance', 'VP, Global Corporate Finance', 'Director of Financial Planning & Analysis', 'Head of Treasury'])
    assert.ok(core.classifyKeyRoleTitle(title).includes('finance_leadership'), title);
  for (const title of ['Head of Financial Crimes', 'Strategic Finance Analyst', 'Executive Assistant to the Head of Strategic Finance', 'Account Executive, Strategic Finance Platform'])
    assert.equal(core.classifyKeyRoleTitle(title).includes('finance_leadership'), false, title);
});

test('notable selection adds bounded category diversity while preserving CFO and top executives', () => {
  const jobs = [posting('CFO', 'cfo'), posting('VP Sales', 'vp'), ...Array.from({ length: 8 }, (_, i) => posting(`Director of Communications ${i}`, `director-${i}`)), posting('Senior Software Engineer, AI', 'ai'), posting('Head of Strategic Finance', 'finance')];
  const analysis = core.analyzeHiringRoles(jobs);
  assert.equal(analysis.notableRoles.length, 8);
  assert.equal(analysis.notableRoles[0].id, 'cfo');
  assert.ok(analysis.notableRoles.some(j => j.id === 'vp'));
  assert.ok(analysis.notableRoles.some(j => j.id === 'ai'));
  assert.ok(analysis.notableRoles.some(j => j.id === 'finance'));
  assert.ok(analysis.notableRoles.filter(j => j.selectionReasons.includes('strategic category coverage')).length <= 2);
  assert.deepEqual(analysis.notableRoles.map(j => j.id), core.analyzeHiringRoles([...jobs].reverse()).notableRoles.map(j => j.id));
  for (const role of analysis.notableRoles) {
    const original = jobs.find(j => j.id === role.id);
    assert.equal(role.title, original.title);
    assert.equal(role.sourceUrl, original.sourceUrl);
    assert.equal(role.retrievedAt, original.retrievedAt);
  }
});
