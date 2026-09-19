import assert from 'node:assert/strict';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';
import { graph, now, source, claim } from './fixtures/clara-verification/fixture.mjs';
const options = { parentURL: import.meta.url, tsconfig: new URL('../tsconfig.json', import.meta.url).pathname };
const load = path => tsImport(new URL('../app/lib/private-diligence/' + path, import.meta.url).href, options);
const { extractCompanyPage } = await load('extraction/htmlExtractor.ts');
const { verifyClaim } = await load('verification/rules.ts');
const { normalizeEvidenceRegistry } = await load('evidence/evidenceRegistry.ts');
const { buildClaimRegistry } = await load('evidence/claimRegistry.ts');
const { canonicalResearch } = await load('verification/governance.ts');

function fixture(name, domain, path, rawText, candidates = []) {
  const target = { ...graph, canonicalName: name, confirmedDisplayName: name, legalNames: [], domains: [domain] };
  const page = source(rawText, { sourceUrl: `https://${domain}${path}`, publicReferenceUrl: `https://${domain}${path}`, structuredData: { factCandidates: candidates } });
  return { target, page };
}
function candidate(personName, role, excerpt, temporalStatus = 'current') {
  return { factType: 'executiveRole', value: `${personName} — ${role}`, personName, role, excerpt, temporalStatus, extractionMethod: 'visibleText', locator: 'source text' };
}

test('Resend testimonial employers survive truncated candidates and block all canonical people claim variants', () => {
  const cases = [
    ['Bradley Greenwood', 'VP of Engineering', 'Bradley Greenwood VP of Engineering at MrBeast " Our partnership with Resend has been a great experience.'],
    ['Sahil Lavingia', 'CEO', 'Sahil Lavingia CEO of Gumroad " Switching over to Resend from SendGrid marked a significant improvement.'],
    ['Dan Farrelly', 'CTO', 'Dan Farrelly CTO and Co-Founder of Inngest " Our team loves Resend.'],
  ];
  for (const [person, role, rawText] of cases) {
    const excerpt = `${person} ${role}`, fact = candidate(person, role, excerpt);
    const { target, page } = fixture('Resend', 'resend.com', '/pricing', rawText, [fact]);
    for (const c of [claim('executive', person, page), claim('executiveRole', fact.value, page), claim('research.people', excerpt, page, { researchFact: { topic: 'people', value: excerpt, excerpt } })]) {
      const decision = verifyClaim(c, [page], target, now);
      assert.equal(decision.status, 'rejected', person + ' / ' + c.claimType);
      assert.ok(decision.reasonCodes.includes('unrelated_person_context'));
    }
    page.structuredData.executives = [person];
    const evidence = normalizeEvidenceRegistry([page]);
    const canonical = canonicalResearch({ graph: target, rawEvidence: [page], evidence, claims: buildClaimRegistry('people-test', target.entityId, evidence), now });
    assert.equal(canonical.claims.length, 0, person);
  }
});

test('Resend about investor and Cribl investor quote cannot borrow the company-owned page association', () => {
  const cases = [
    ['Resend', 'resend.com', '/about', 'Eric Muntz', 'CTO', 'Dylan Field Founder of Figma Elad Gil Investor Eric Muntz Former CTO of Mailchimp Guillermo Rauch Founder of Vercel', 'Eric Muntz Former CTO'],
    ['Cribl', 'cribl.io', '/about-us/', 'Scott Raney', 'Managing Director', 'Customers that Cribl empowers them to have full control and choice over their observability data. " Scott Raney Managing Director at Redpoint Ventures Greylock Partners " The Cribl team has a compelling vision.', 'Scott Raney Managing Director'],
  ];
  for (const [name, domain, path, person, role, rawText, excerpt] of cases) {
    const fact = candidate(person, role, excerpt);
    const { target, page } = fixture(name, domain, path, rawText, [fact]);
    for (const c of [claim('executive', person, page), claim('executiveRole', fact.value, page), claim('research.people', excerpt, page, { researchFact: { topic: 'people', value: excerpt, excerpt } })])
      assert.equal(verifyClaim(c, [page], target, now).status, 'rejected', person + ' / ' + c.claimType);
  }
});

test('Linear flattened cards extract Cristina Cordova without the preceding CTO token', () => {
  const rawText = 'We’re hiring → Karri Saarinen Co-founder, CEO Jori Lallo Co-founder, CPO Tuomas Artman Co-founder, CTO Cristina Cordova COO Tom Moor Head of Engineering Casey Bertenthal Head of Sales Jamie Finnigan Head of Security Conor Muirhead Head of Product Design Tim Qi Matthew Roberts';
  const extracted = extractCompanyPage(`<main><section><h2>Our team</h2><p>${rawText}</p></section></main>`);
  const correct = extracted.factCandidates.find(f => f.personName === 'Cristina Cordova');
  assert.equal(correct?.value, 'Cristina Cordova — COO');
  assert.ok(extracted.factCandidates.every(f => !f.personName?.startsWith('CTO ')));
  const { target, page } = fixture('Linear', 'linear.app', '/about', rawText, extracted.factCandidates);
  assert.equal(verifyClaim(claim('executiveRole', correct.value, page), [page], target, now).status, 'verified');
  for (const type of ['executive', 'executiveRole'])
    assert.notEqual(verifyClaim(claim(type, type === 'executive' ? 'CTO Cristina Cordova' : 'CTO Cristina Cordova — COO', page), [page], target, now).status, 'verified');
  const excerpt = 'CTO Cristina Cordova COO';
  assert.notEqual(verifyClaim(claim('research.people', excerpt, page, { researchFact: { topic: 'people', value: excerpt, excerpt } }), [page], target, now).status, 'verified');
});

test('extraction preserves employers and separates Former from the name', () => {
  const extracted = extractCompanyPage('<main><section><h2>Supporters</h2><p>Eric Muntz Former CTO of Mailchimp</p></section><section><p>Sahil Lavingia CEO of Gumroad</p></section><section><p>Bradley Greenwood VP of Engineering at MrBeast</p></section></main>');
  const former = extracted.factCandidates.find(f => f.personName === 'Eric Muntz');
  assert.equal(former?.temporalStatus, 'historical');
  assert.match(former?.excerpt, /of Mailchimp/);
  assert.ok(!extracted.executives.some(name => /Eric Muntz|Former/.test(name)));
  assert.match(extracted.factCandidates.find(f => f.personName === 'Sahil Lavingia')?.excerpt, /of Gumroad/);
  assert.match(extracted.factCandidates.find(f => f.personName === 'Bradley Greenwood')?.excerpt, /at MrBeast/);
});

test('target officers remain supported, including separate advisory work and departmental titles', () => {
  for (const [name, domain, rawText, person] of [
    ['Abaka AI', 'abaka.ai', 'Yunfei Zhao is the Chief Operating Officer of Abaka AI and an Advisor to Pika Labs.', 'Yunfei Zhao'],
    ['Mercury', 'mercury.com', 'Ryan Wiggins VP of Product at Mercury.', 'Ryan Wiggins'],
    ['Acme', 'acme.test', 'Jane Doe was the former CEO of Acme.', 'Jane Doe'],
  ]) {
    const { target, page } = fixture(name, domain, '/about', rawText);
    assert.equal(verifyClaim(claim('executive', person, page), [page], target, now).status, 'verified', rawText);
  }
  const { target, page } = fixture('Acme', 'acme.test', '/about', 'Our investors Jane Doe CEO " Acme is a great product.');
  assert.equal(verifyClaim(claim('executive', 'Jane Doe', page), [page], target, now).status, 'rejected');
});

test('a Glean appointment to a sales department does not claim a different employer', () => {
  const excerpt = 'Glean today announced the appointment of Marc Wendling as Senior Vice President of Worldwide Sales.';
  const { target, page } = fixture('Glean', 'glean.com', '/press/glean-appoints-marc-wendling', `${excerpt} Wendling brings a wealth of experience in driving sales excellence and operational success to Glean. Most recently, as VP of SMB Sales at Snowflake, Wendling played a pivotal role.`);
  assert.equal(verifyClaim(claim('research.people', excerpt, page, { researchFact: { topic: 'people', value: excerpt, excerpt } }), [page], target, now).status, 'verified');
  page.rawText = 'Glean appointed Marc Wendling, reporting directly to co-founder and CEO Arvind Jain.';
  assert.equal(verifyClaim(claim('founder', 'Arvind Jain', page), [page], target, now).status, 'verified');
});

test('Vanta investor heading after leadership cards does not change preceding officer attribution', () => {
  const rawText = 'Inspiring teams for success Christina Cacioppo CEO & Founder Stevie Case Chief Revenue Officer Sarah Scharf Chief Marketing Officer Jeremy Epling Chief Product Officer John McCauley Chief Financial Officer Our investors Our values are our operating principles';
  const fact = candidate('Christina Cacioppo', 'CEO', 'Christina Cacioppo CEO');
  const { target, page } = fixture('Vanta', 'vanta.com', '/company/about', rawText, [fact]);
  for (const c of [claim('executive', 'Christina Cacioppo', page), claim('executiveRole', fact.value, page), claim('research.people', fact.excerpt, page, { researchFact: { topic: 'people', value: fact.excerpt, excerpt: fact.excerpt } })])
    assert.equal(verifyClaim(c, [page], target, now).status, 'verified');
});

test('Rippling company prose about customers before a leadership card is not a testimonial attribution', () => {
  const excerpt = 'Matt MacInnis President and CPO';
  const rawText = `We understand what’s happening under the hood for our customers and how it could be better. ${excerpt} LinkedIn Matt Plank CRO LinkedIn Albert Strasheim CTO LinkedIn Adam Swiecicki CFO LinkedIn`;
  const { target, page } = fixture('Rippling', 'rippling.com', '/company/about', rawText);
  assert.equal(verifyClaim(claim('research.people', excerpt, page, { researchFact: { topic: 'people', value: excerpt, excerpt } }), [page], target, now).status, 'verified');
});
