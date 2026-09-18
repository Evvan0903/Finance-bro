import { tsImport } from 'tsx/esm/api';
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function moduleUrl(path, replacements = {}) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(from, to);
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}

const coreUrl = await moduleUrl("../app/lib/private-diligence/hiring/core.ts");
const securityUrl = await moduleUrl("../app/lib/private-diligence/security.ts");
const adaptersUrl = await moduleUrl("../app/lib/private-diligence/hiring/adapters.ts", {
  '"../security"': JSON.stringify(securityUrl),
  '"./core"': JSON.stringify(coreUrl),
});
const hiringEvidenceUrl = await moduleUrl("../app/lib/private-diligence/evidence/hiringEvidence.ts");
const { classifyJobFunction, classifyJobSeniority, deduplicateJobs, detectHiringSourceType, finalHiringFailureStatus, rankCareerSources, summarizeHiring } = await import(coreUrl);
const { AshbyAdapter, GenericCareersAdapter, GreenhouseAdapter, LeverAdapter } = await import(adaptersUrl);
const { hiringEvidenceFromResult } = await import(hiringEvidenceUrl);

function job(overrides = {}) {
  return { id: "job-1", companyId: "company-1", title: "Software Engineer", location: "New York, NY", sourceUrl: "https://boards.greenhouse.io/example/jobs/1", sourceType: "greenhouse", sourceJobId: "1", retrievedAt: "2026-08-30T00:00:00.000Z", ...overrides };
}

test("detects supported ATS sources and preserves generic careers sources", () => {
  assert.equal(detectHiringSourceType("https://boards.greenhouse.io/acme/jobs/1"), "greenhouse");
  assert.equal(detectHiringSourceType("https://jobs.lever.co/acme/1"), "lever");
  assert.equal(detectHiringSourceType("https://jobs.ashbyhq.com/acme/1"), "ashby");
  assert.equal(detectHiringSourceType("https://acme.example/careers"), "company_careers");
});

test("selects the intended adapter by careers URL", async () => {
  const input = (sourceUrl) => ({ companyId: "company-1", sourceUrl, officialHostname: "acme.example", retrievedAt: "2026-08-30T00:00:00.000Z" });
  assert.equal(await GreenhouseAdapter.canHandle(input("https://boards.greenhouse.io/acme")), true);
  assert.equal(await LeverAdapter.canHandle(input("https://jobs.lever.co/acme")), true);
  assert.equal(await AshbyAdapter.canHandle(input("https://jobs.ashbyhq.com/acme")), true);
  assert.equal(await GenericCareersAdapter.canHandle(input("https://acme.example/careers")), true);
});

test("normalizes Greenhouse, Lever, Ashby, and generic provider payloads into one job shape", async () => {
  const resolver = async () => [{ address: "8.8.8.8", family: 4 }];
  const payloads = {
    greenhouse: { jobs: [{ id: 1, title: "Senior Software Engineer", absolute_url: "https://boards.greenhouse.io/acme/jobs/1", location: { name: "Remote — US" }, departments: [{ name: "Engineering" }], updated_at: "2026-08-30" }] },
    lever: [{ id: "lever-1", text: "Senior Software Engineer", hostedUrl: "https://jobs.lever.co/acme/lever-1", categories: { department: "Engineering", location: "Remote — US", commitment: "Full-time" } }],
    ashby: { jobs: [{ id: "ashby-1", title: "Senior Software Engineer", jobUrl: "https://jobs.ashbyhq.com/acme/ashby-1", location: "Remote — US", department: "Engineering", isRemote: true }] },
  };
  const input = (sourceUrl, payload) => ({
    companyId: "company-1", sourceUrl, officialHostname: "acme.example", retrievedAt: "2026-08-30T00:00:00.000Z", resolveHost: resolver,
    fetchImpl: async () => new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } }),
  });
  const greenhouse = await GreenhouseAdapter.collect(input("https://boards.greenhouse.io/acme", payloads.greenhouse));
  const lever = await LeverAdapter.collect(input("https://jobs.lever.co/acme", payloads.lever));
  const ashby = await AshbyAdapter.collect(input("https://jobs.ashbyhq.com/acme", payloads.ashby));
  const generic = await GenericCareersAdapter.collect({
    companyId: "company-1", sourceUrl: "https://acme.example/careers", officialHostname: "acme.example", retrievedAt: "2026-08-30T00:00:00.000Z", resolveHost: resolver,
    fetchImpl: async () => new Response('<a href="/jobs/software-engineer">Software Engineer</a>', { headers: { "content-type": "text/html" } }),
  });
  for (const role of [greenhouse[0], lever[0], ashby[0], generic[0]]) {
    assert.equal(role.companyId, "company-1");
    assert.ok(role.id);
    assert.ok(role.title);
    assert.ok(role.sourceUrl);
    assert.ok(role.retrievedAt);
  }
  assert.equal(greenhouse[0].sourceType, "greenhouse");
  assert.equal(lever[0].sourceType, "lever");
  assert.equal(ashby[0].sourceType, "ashby");
  assert.equal(generic[0].sourceType, "company_careers");
});

test("uses an injected server-side browser fallback only when static careers HTML has no job links", async () => {
  const jobs = await GenericCareersAdapter.collect({
    companyId: "company-1", sourceUrl: "https://acme.example/careers", officialHostname: "acme.example", retrievedAt: "2026-08-30T00:00:00.000Z",
    resolveHost: async () => [{ address: "8.8.8.8", family: 4 }],
    fetchImpl: async () => new Response("<main>Loading roles</main>", { headers: { "content-type": "text/html" } }),
    browserRenderer: async () => '<a href="/jobs/data-engineer">Data Engineer</a>',
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, "Data Engineer");
  assert.equal(jobs[0].sourceType, "company_careers");
});

test("ranks linked supported ATS candidates deterministically", () => {
  const ranked = rankCareerSources([
    { url: "https://acme.example/careers", sourceType: "company_careers", discoveryMethod: "known_path", score: 20 },
    { url: "https://jobs.lever.co/acme", sourceType: "lever", discoveryMethod: "linked_from_website", score: 50 },
  ]);
  assert.equal(ranked[0].sourceType, "lever");
  assert.equal(ranked[0].url, "https://jobs.lever.co/acme");
});

test("deduplicates provider IDs and canonical URLs without merging distinct openings", () => {
  const jobs = deduplicateJobs([
    job(), job({ id: "job-duplicate", sourceUrl: "https://boards.greenhouse.io/example/jobs/1?utm_source=test" }),
    job({ id: "job-2", sourceJobId: "2", sourceUrl: "https://boards.greenhouse.io/example/jobs/2", title: "Software Engineer", location: "Boston, MA" }),
  ]);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[1].location, "Boston, MA");
});

test("preserves retrieval failures instead of misreporting zero open jobs", () => {
  assert.equal(finalHiringFailureStatus([{ status: "retrieval_failed" }]), "retrieval_failed");
  assert.equal(finalHiringFailureStatus([{ status: "browser_fallback_failed" }]), "browser_fallback_failed");
  assert.equal(finalHiringFailureStatus([{ status: "parse_failed" }, { status: "retrieval_failed" }]), "parse_failed");
  assert.notEqual(finalHiringFailureStatus([{ status: "retrieval_failed" }]), "success_zero_jobs");
});

test("classifies representative functions and seniority conservatively", () => {
  assert.equal(classifyJobFunction("Senior Machine Learning Engineer"), "Data / AI");
  assert.equal(classifyJobFunction("Director, Regulatory Compliance"), "Legal / Compliance");
  assert.equal(classifyJobFunction("Chief Information Security Officer"), "Security");
  assert.equal(classifyJobFunction("Mystery role"), "Other");
  assert.equal(classifyJobSeniority("VP, Enterprise Sales"), "VP");
  assert.equal(classifyJobSeniority("Senior Backend Engineer"), "Senior");
  assert.equal(classifyJobSeniority("Analyst"), "Unknown");
});

test("produces evidence-linked, non-headcount hiring signals", () => {
  const summary = summarizeHiring("company-1", [
    job({ id: "eng-1", title: "Senior Software Engineer", function: "Engineering", seniority: "Senior" }),
    job({ id: "ml-1", title: "Machine Learning Engineer", function: "Data / AI", seniority: "Mid", sourceJobId: "2", sourceUrl: "https://boards.greenhouse.io/example/jobs/2" }),
    job({ id: "compliance-1", title: "Director, Compliance", function: "Legal / Compliance", seniority: "Director", sourceJobId: "3", sourceUrl: "https://boards.greenhouse.io/example/jobs/3" }),
  ], { adapter: "GreenhouseAdapter", sourceUrl: "https://boards.greenhouse.io/example", retrievedAt: "2026-08-30T00:00:00.000Z" });
  const engineering = summary.signals.find((signal) => signal.type === "engineering_expansion");
  assert.deepEqual(engineering?.supportingJobIds, ["eng-1"]);
  assert.match(engineering?.explanation ?? "", /recruitment/i);
  assert.doesNotMatch(JSON.stringify(summary), /headcount growth/i);
  assert.equal(summary.sources[0].jobCount, 3);
});

test("records job-level evidence provenance without converting postings into headcount claims", () => {
  const observedJob = job({ id: "eng-1", title: "Senior Software Engineer", function: "Engineering", seniority: "Senior" });
  const result = {
    companyId: "company-1", status: "success_with_jobs", adapter: "GreenhouseAdapter",
    selectedSource: { url: "https://boards.greenhouse.io/acme", sourceType: "greenhouse", discoveryMethod: "linked_from_website", score: 100 },
    sourceCandidates: [], jobs: [observedJob], limitations: ["Snapshot only"], failures: [],
    summary: summarizeHiring("company-1", [observedJob], { adapter: "GreenhouseAdapter", sourceUrl: "https://boards.greenhouse.io/acme", retrievedAt: observedJob.retrievedAt }),
  };
  const evidence = hiringEvidenceFromResult("research-1", { entityId: "company-1", identityConfidence: "high" }, result);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].sourceUrl, observedJob.sourceUrl);
  assert.equal(evidence[0].structuredData.sourceJobId, observedJob.sourceJobId);
  assert.match(evidence[0].limitations.join(" "), /not evidence of headcount growth/i);
});

test('generic careers pages do not count pagination and demo links as jobs', async () => {
 const { GenericCareersAdapter } = await tsImport(new URL('../app/lib/private-diligence/hiring/adapters.ts', import.meta.url).href, import.meta.url);
 const jobs=await GenericCareersAdapter.collect({companyId:'acme',sourceUrl:'https://acme.example/company/careers',officialHostname:'acme.example',retrievedAt:'2026-09-18',resolveHost:async()=>[{address:'93.184.216.34',family:4}],fetchImpl:async()=>new Response('<html><a href="?page=2">Next</a><a href="#">See an interactive demo</a><a href="/careers/engineer-123">Software Engineer</a></html>',{headers:{'content-type':'text/html'}})});
 assert.deepEqual(jobs.map(j=>j.title),['Software Engineer']);
});
