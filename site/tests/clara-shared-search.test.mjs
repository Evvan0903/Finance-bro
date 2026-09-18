import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
const { createSharedSearch, createSearchSession } = await tsImport('../app/lib/private-diligence/search/sharedSearch.ts', import.meta.url);
const { FundingBudget } = await tsImport('../app/lib/private-diligence/funding/budget.ts', import.meta.url);
const { createSerpApiWebSearchProvider } = await tsImport('../app/lib/private-diligence/providers/serpApiWebSearchProvider.ts', import.meta.url);
const { executePrivateProvider } = await tsImport('../app/lib/private-diligence/providers/providerTypes.ts', import.meta.url);
const { normalizeEvidenceRegistry } = await tsImport('../app/lib/private-diligence/evidence/evidenceRegistry.ts', import.meta.url);
const { buildClaimRegistry } = await tsImport('../app/lib/private-diligence/evidence/claimRegistry.ts', import.meta.url);
const { buildQuickCompanyIntelligenceReport } = await tsImport('../app/lib/private-diligence/reports/quickReportBuilder.ts', import.meta.url);
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const serp = () => json({ organic_results: [{ title: 'Acme', link: 'https://acme.example/page?source=filing&ref=42', snippet: 'discovery only' }] });
const tavily = () => json({ results: [{ title: 'Acme', url: 'https://acme.example/page?source=filing&ref=42', content: 'discovery only', score: .9, published_date: '2020-01-01' }], usage: { credits: 1 }, request_id: 'req-1' });
const options = { apiKey: 'secret-primary', tavilyApiKey: 'secret-fallback', maxAttempts: 4 };

test('Tavily-only config; explicit conservative contract and normalized provenance', async () => {
  let calls = 0;
  const router = createSharedSearch({ ...options, apiKey: null, fetchImpl: async (url, init) => {
    calls++; assert.equal(new URL(url).hostname, 'api.tavily.com');
    assert.equal(init.headers.Authorization, 'Bearer secret-fallback');
    assert.equal(init.redirect, 'error');
    const body = JSON.parse(init.body);
    assert.deepEqual(body, { query: '"Acme" products', search_depth: 'basic', auto_parameters: false, topic: 'general', max_results: 2, include_answer: false, include_raw_content: false, include_images: false, include_usage: true, language: 'en' });
    return tavily();
  } });
  assert.equal(router.isConfigured(), true);
  const result = await router.search({ query: '"Acme" products', limit: 2 });
  assert.equal(calls, 1); assert.equal(result.reason, 'results');
  assert.equal(result.attempts[0].attempted, false);
  assert.equal(result.leads[0].searchProvider, 'tavily');
  assert.equal(result.leads[0].relevanceScore, .9); assert.equal(result.leads[0].confidence, undefined);
  assert.match(result.leads[0].url, /source=filing&ref=42/);
  assert.equal(result.leads[0].publicationDateHint, '2020-01-01');
  assert.equal(router.session.usage.reportedCredits, 1);
  assert.doesNotMatch(JSON.stringify(result), /secret-/);
});

test('missing both is structured and free of requests', async () => {
  const router = createSharedSearch({ apiKey: null, tavilyApiKey: null, fetchImpl: () => { throw Error('must not call'); } });
  const result = await router.search({ query: 'Acme' });
  assert.equal(result.reason, 'missingConfiguration'); assert.equal(result.attempts.length, 2);
  assert.equal(router.session.usage.outboundAttempts, 0);
});

test('primary success never calls fallback; genuine SerpApi empty with error is successful', async () => {
  for (const response of [serp, () => json({ search_metadata: { status: 'Success' }, error: "Google hasn't returned any results for this query." })]) {
    let calls = 0;
    const router = createSharedSearch({ ...options, fetchImpl: async url => { calls++; assert.equal(new URL(url).hostname, 'serpapi.com'); return response(); } });
    const result = await router.search({ query: 'Acme' });
    assert.equal(calls, 1); assert.ok(['results', 'empty'].includes(result.reason));
    assert.equal(result.attempts[1].reason, 'notNeeded');
  }
});

test('quota/auth/upstream/rate limit route once to fallback with recovered diagnostics', async () => {
  for (const [status, data, expected] of [[429, { error: 'Your account has run out of searches.' }, 'quotaExhausted'], [401, { error: 'secret-primary' }, 'authenticationFailed'], [503, {}, 'upstreamUnavailable'], [429, { error: 'Hourly throughput exceeded' }, 'rateLimited']]) {
    let calls = 0;
    const router = createSharedSearch({ ...options, fetchImpl: async url => { calls++; return new URL(url).hostname === 'serpapi.com' ? json(data, status) : tavily(); } });
    const result = await router.search({ query: 'Acme' });
    assert.equal(calls, 2); assert.equal(result.reason, 'results'); assert.equal(result.attempts[0].reason, expected);
    assert.equal(router.session.usage.outboundAttempts, 2); assert.equal(result.attempts[0].estimatedRequests, 1);
    assert.doesNotMatch(JSON.stringify(result), /secret-/);
  }
});

test('confirmed quota/auth disable only this session; temporary rate limit cools down', async () => {
  for (const status of [401, 429]) {
    let primary = 0; const session = createSearchSession();
    const config = { ...options, session, fetchImpl: async url => new URL(url).hostname === 'serpapi.com' ? (primary++, json({ error: status === 429 ? 'run out of searches' : 'invalid key' }, status)) : tavily() };
    await createSharedSearch(config).search({ query: 'Acme one' });
    const result = await createSharedSearch(config).search({ query: 'Acme two' });
    assert.equal(primary, 1); assert.equal(result.attempts[0].attempted, false);
    assert.equal(createSearchSession().health.size, 0);
  }
  const router = createSharedSearch({ ...options, fetchImpl: async url => new URL(url).hostname === 'serpapi.com' ? json({}, 429) : tavily() });
  await router.search({ query: 'Acme' });
  assert.ok(Number.isFinite(router.session.health.get('serpapi').until));
});

test('Tavily status codes distinguish plan/PAYG limits from invalid input', async () => {
  for (const [status, reason] of [[400, 'invalidRequest'], [422, 'invalidRequest'], [401, 'authenticationFailed'], [429, 'rateLimited'], [432, 'planUsageLimit'], [433, 'payAsYouGoLimit'], [500, 'upstreamUnavailable']]) {
    const router = createSharedSearch({ apiKey: null, tavilyApiKey: 'secret', fetchImpl: async () => json({}, status) });
    assert.equal((await router.search({ query: 'Acme' })).reason, reason);
  }
});

test('empty, filtered and malformed are distinct, never triggering fallback', async () => {
  for (const [payload, reason] of [[{ results: [] }, 'empty'], [{ results: [{ title: 'Bad', url: 'javascript:alert(1)' }] }, 'filteredOut'], [{ results: [{}] }, 'malformedResponse'], [{ results: 'wrong' }, 'malformedResponse']]) {
    let calls = 0;
    const router = createSharedSearch({ ...options, primary: 'tavily', fetchImpl: async () => { calls++; return json(payload); } });
    assert.equal((await router.search({ query: 'Acme' })).reason, reason); assert.equal(calls, 1);
  }
  const router = createSharedSearch({ ...options, fetchImpl: async () => new Response('not JSON') });
  assert.equal((await router.search({ query: 'Acme' })).reason, 'malformedResponse');
});

test('strict site domain and path restrictions cannot silently broaden', async () => {
  const router = createSharedSearch({ ...options, primary: 'tavily', fetchImpl: async (_url, init) => {
    const body = JSON.parse(init.body); assert.deepEqual(body.include_domains, ['sec.gov']);
    assert.equal(body.query, 'site:sec.gov/Archives/edgar/data/ "Acme Inc" "D"');
    return json({ results: [
      { title: 'Allowed', url: 'https://www.sec.gov/Archives/edgar/data/123/filing.xml' },
      { title: 'Wrong path', url: 'https://sec.gov/news' },
      { title: 'Wrong domain', url: 'https://sec.gov.evil.example/Archives/edgar/data/123/' },
      { title: 'Credentials', url: 'https://user:pass@sec.gov/Archives/edgar/data/123/' },
      { title: 'Private', url: 'http://127.0.0.1/test' },
    ] });
  } });
  const result = await router.search({ query: 'site:sec.gov/Archives/edgar/data/ "Acme Inc" "D"' });
  assert.equal(result.leads.length, 1);
});

test('one remaining attempt prevents fallback, missing key consumes zero', async () => {
  const budget = new FundingBudget({ limits: { search: 1 } }); let calls = 0;
  const router = createSharedSearch({ ...options, reserveAttempt: () => budget.take('search'), deadline: budget.deadline, fetchImpl: async () => { calls++; return json({}, 503); } });
  assert.equal((await router.search({ query: 'Acme' })).reason, 'budgetExhausted');
  assert.equal(calls, 1); assert.equal(budget.used.search, 1); assert.equal(router.session.usage.outboundAttempts, 1);
});

test('concurrent queries cannot overspend shared Funding budget', async () => {
  const budget = new FundingBudget({ limits: { search: 1 } }); let calls = 0;
  const router = createSharedSearch({ ...options, reserveAttempt: () => budget.take('search'), fetchImpl: async () => { calls++; await new Promise(r => setTimeout(r, 10)); return tavily(); }, primary: 'tavily' });
  const results = await Promise.all(['a', 'b', 'c'].map(query => router.search({ query })));
  assert.equal(calls, 1); assert.equal(budget.used.search, 1); assert.equal(results.filter(r => r.reason === 'budgetExhausted').length, 2);
});

test('run-local cache and in-flight dedup retain time and do not consume requests; failures not cached', async () => {
  let calls = 0;
  const router = createSharedSearch({ ...options, primary: 'tavily', fetchImpl: async () => { calls++; await new Promise(r => setTimeout(r, 5)); return tavily(); } });
  const [first, second] = await Promise.all([router.search({ query: 'Acme' }), router.search({ query: 'Acme' })]);
  const third = await router.search({ query: 'Acme' });
  assert.equal(calls, 1); assert.equal(second.cacheHit, true); assert.equal(third.cacheHit, true);
  assert.equal(first.leads[0].searchRetrievedAt, third.leads[0].searchRetrievedAt);
  await router.search({ query: 'Acme', limit: 1 }); assert.equal(calls, 2);
  const failed = createSharedSearch({ ...options, fetchImpl: async () => json({}, 503) });
  await failed.search({ query: 'Acme' }); assert.equal(failed.session.cache.size, 0);
  const empty = createSharedSearch({ ...options, fetchImpl: async () => json({ organic_results: [] }) });
  await empty.search({ query: 'empty' });
  assert.ok([...empty.session.cache.values()][0].expires <= Date.now() + 30000);
});

test('invalid input, cancellation and exhausted deadline do not dispatch or fallback', async () => {
  let calls = 0;
  const router = createSharedSearch({ ...options, fetchImpl: async () => { calls++; return serp(); } });
  assert.equal((await router.search({ query: '' })).reason, 'invalidRequest');
  assert.equal((await router.search({ query: 'Acme', signal: AbortSignal.abort() })).reason, 'cancelled');
  const expired = createSharedSearch({ ...options, deadline: Date.now() - 1, fetchImpl: async () => { calls++; return serp(); } });
  assert.equal((await expired.search({ query: 'Acme' })).reason, 'deadlineExceeded'); assert.equal(calls, 0);
});

test('provider timeout permits fallback only within remaining run deadline; cancel cannot fallback', async (t) => {
  let calls = 0;
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const router = createSharedSearch({ ...options, timeoutMs: 1000, deadline: now + 1500, fetchImpl: async url => {
    calls++;
    if (new URL(url).hostname === 'serpapi.com') { now += 1000; throw new DOMException('provider timeout', 'TimeoutError'); }
    return tavily();
  } });
  const result = await router.search({ query: 'Acme' });
  assert.equal(result.reason, 'results'); assert.equal(result.attempts[0].reason, 'timeout'); assert.equal(calls, 2);
  calls = 0;
  const expired = createSharedSearch({ ...options, timeoutMs: 1000, deadline: now + 500, fetchImpl: async () => {
    calls++; now += 501; throw new DOMException('run deadline', 'TimeoutError');
  } });
  assert.equal((await expired.search({ query: 'Acme' })).reason, 'deadlineExceeded'); assert.equal(calls, 1);
  calls = 0; const controller = new AbortController();
  const cancelled = createSharedSearch({ ...options, fetchImpl: async (_url, init) => {
    calls++; controller.abort(); assert.equal(init.signal.aborted, true); throw init.signal.reason;
  } });
  assert.equal((await cancelled.search({ query: 'Acme', signal: controller.signal })).reason, 'cancelled'); assert.equal(calls, 1);
});

test('bounded body and secrets in provider errors stay out of diagnostics', async () => {
  const router = createSharedSearch({ ...options, primary: 'tavily', fetchImpl: async () => new Response('x'.repeat(1000001)) });
  assert.equal((await router.search({ query: 'Acme' })).reason, 'responseTooLarge');
  const errors = createSharedSearch({ ...options, fetchImpl: async () => { throw new Error('secret-primary secret-fallback'); } });
  assert.doesNotMatch(JSON.stringify(await errors.search({ query: 'Acme' })), /secret-/);
});

const context = { researchId: 'search-evidence', input: { companyName: 'Acme', website: 'https://acme.example', workflowMode: 'quick', locale: 'en' }, identityGraph: { entityId: 'acme', canonicalName: 'Acme', aliases: [], legalNames: [], addresses: [], phoneNumbers: [], founders: [], executives: [], identifiers: [], domains: ['acme.example'], targetSelectionStatus: 'userSelected' }, now: () => new Date('2026-01-01T00:00:00Z') };
test('Tavily snippet cannot become evidence; original page → evidence → claim → report preserves publisher', async () => {
  for (const available of [false, true]) {
    const provider = createSerpApiWebSearchProvider({ apiKey: null, tavilyApiKey: 'secret', maxSearches: 1, resolveHost: async () => [{ address: '93.184.216.34', family: 4 }], fetchImpl: async (url, init) => {
      if (new URL(url).hostname === 'api.tavily.com') return json({ results: [{ title: 'Acme', url: 'https://acme.example/about', content: 'FAKE_SNIPPET Acme raised $999 billion.' }], usage: { credits: 1 } });
      assert.equal(new Headers(init?.headers).has('authorization'), false);
      return available ? new Response('<title>Acme products</title><main><h1>Acme</h1><p>Acme provides data services.</p></main>', { headers: { 'content-type': 'text/html' } }) : new Response('unavailable', { status: 503 });
    } });
    const result = await executePrivateProvider(provider, context);
    assert.doesNotMatch(JSON.stringify(result.evidence), /FAKE_SNIPPET|999 billion/);
    if (!available) { assert.equal(result.evidence.length, 0); assert.equal(result.status, 'upstreamUnavailable'); continue; }
    assert.equal(result.evidence[0].structuredData.searchDiscovery.searchProvider, 'tavily');
    assert.equal(result.evidence[0].sourceTitle, 'Acme products');
    const evidence = normalizeEvidenceRegistry(result.evidence);
    const claims = buildClaimRegistry(context.researchId, 'acme', evidence);
    assert.ok(claims.length > 0);
    const report = buildQuickCompanyIntelligenceReport({ researchId: context.researchId, input: context.input, graph: context.identityGraph, providerPlan: [], evidence, claims, informationGaps: [], generatedAt: context.now().toISOString() });
    assert.ok(report.references.some(r => JSON.stringify(r).includes('acme.example/about')));
    const reloaded = JSON.parse(JSON.stringify({ result, report }));
    assert.equal(reloaded.result.evidence[0].structuredData.searchDiscovery.searchProvider, 'tavily');
  }
});

test('transport security rejection and request-construction defects cannot trigger fallback', async () => {
  for (const [error, reason] of [[Object.assign(new Error('private endpoint'), { code: 'blockedAddress' }), 'securityRejected'], [new SyntaxError('bad request'), 'invalidRequest']]) {
    let calls = 0;
    const router = createSharedSearch({ ...options, fetchImpl: async () => { calls++; throw error; } });
    assert.equal((await router.search({ query: 'Acme' })).reason, reason); assert.equal(calls, 1);
  }
});

test('funding fallback consumes two units of its single shared allowance', async () => {
  const budget = new FundingBudget({ limits: { search: 2 } });
  const router = createSharedSearch({ ...options, reserveAttempt: () => budget.take('search'), deadline: budget.deadline, fetchImpl: async url => new URL(url).hostname === 'serpapi.com' ? json({}, 503) : tavily() });
  assert.equal((await router.search({ query: 'Acme funding' })).reason, 'results');
  assert.equal(budget.used.search, 2);
  assert.equal((await router.search({ query: 'Acme funding next' })).reason, 'budgetExhausted');
  assert.equal(budget.used.search, 2);
});

test('a deduplicated waiter obeys its own shorter deadline', async () => {
  const session = createSearchSession(); let calls = 0;
  const config = { ...options, session, primary: 'tavily', fetchImpl: async () => { calls++; await new Promise(r => setTimeout(r, 35)); return tavily(); } };
  const owner = createSharedSearch(config).search({ query: 'same' });
  const waiter = await createSharedSearch({ ...config, deadline: Date.now() + 5 }).search({ query: 'same' });
  assert.equal(waiter.reason, 'deadlineExceeded'); assert.equal((await owner).reason, 'results'); assert.equal(calls, 1);
});
