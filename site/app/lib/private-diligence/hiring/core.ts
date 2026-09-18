import type { CareerSourceCandidate, HiringActivityStatus, HiringIntelligenceSummary, HiringSignal, HiringSourceType, JobFunction, JobPosting, JobSeniority } from "./types";

const FUNCTION_RULES: Array<[JobFunction, RegExp]> = [
  ["Security", /\b(security|security engineer|application security|infosec|cyber)\b/i],
  ["Data / AI", /\b(data (scientist|engineer|analyst)|machine learning|\bml\b|artificial intelligence|\bai\b|analytics)\b/i],
  ["Engineering", /\b(engineer|engineering|developer|software|platform|sre|devops|quality assurance|\bqa\b)\b/i],
  ["Product", /\b(product manager|product design|product operations|ux|ui|user research)\b/i],
  ["Sales", /\b(sales|account executive|business development|revenue|solutions consultant)\b/i],
  ["Marketing", /\b(marketing|brand|communications|content|growth)\b/i],
  ["Finance", /\b(finance|accounting|controller|treasury|investor relations|fp&a)\b/i],
  ["HR / People", /\b(human resources|\bhr\b|people|recruit(?:er|ing)|talent acquisition)\b/i],
  ["Legal / Compliance", /\b(legal|counsel|compliance|privacy|regulatory)\b/i],
  ["Customer Success", /\b(customer success|customer support|technical support|implementation|onboarding)\b/i],
  ["Operations", /\b(operations|supply chain|procurement|business operations|workplace)\b/i],
];

const SENIORITY_RULES: Array<[JobSeniority, RegExp]> = [
  ["Executive", /\b(chief|ceo|cto|cfo|coo|president)\b/i], ["VP", /\b(?:svp|evp|vp|vice president)\b/i],
  ["Director", /\bdirector\b/i], ["Manager", /\bmanager\b/i], ["Lead", /\b(?:lead|principal|staff)\b/i],
  ["Senior", /\b(?:senior|sr\.?|iii|level 3)\b/i], ["Intern", /\b(?:intern|internship)\b/i],
  ["Entry", /\b(?:junior|associate|graduate|entry[ -]?level|level 1)\b/i], ["Mid", /\b(?:ii|level 2)\b/i],
];

export function detectHiringSourceType(value: string): HiringSourceType {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io") return "greenhouse";
    if (host === "jobs.lever.co") return "lever";
    if (host === "jobs.ashbyhq.com") return "ashby";
    return "company_careers";
  } catch { return "unknown"; }
}

export function classifyJobFunction(title: string, department?: string, team?: string): JobFunction {
  const value = [title, department, team].filter(Boolean).join(" ");
  return FUNCTION_RULES.find(([, rule]) => rule.test(value))?.[0] ?? "Other";
}

export function classifyJobSeniority(title: string): JobSeniority {
  return SENIORITY_RULES.find(([, rule]) => rule.test(title))?.[0] ?? "Unknown";
}

export function normalizeJobText(value: string | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function canonicalJobUrl(value: string) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_.+|ref|source)$/i.test(key)) url.searchParams.delete(key);
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch { return null; }
}

export function jobDeduplicationKey(job: JobPosting) {
  if (job.sourceJobId) return `${job.sourceType}:id:${normalizeJobText(job.sourceJobId)}`;
  const sourceUrl = canonicalJobUrl(job.sourceUrl);
  if (sourceUrl) return `url:${sourceUrl}`;
  return `${job.sourceType}:fallback:${normalizeJobText(job.title)}:${normalizeJobText(job.location)}:${normalizeJobText(job.department)}`;
}

export function deduplicateJobs(jobs: JobPosting[]) {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = jobDeduplicationKey(job);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function rankCareerSources(candidates: CareerSourceCandidate[]) {
  const unique = new Map<string, CareerSourceCandidate>();
  for (const source of candidates) {
    const url = canonicalJobUrl(source.url);
    if (!url) continue;
    const type = detectHiringSourceType(url);
    const score = source.score + (type !== "company_careers" && type !== "unknown" ? 20 : 0) + (source.discoveryMethod === "linked_from_website" ? 10 : 0);
    const existing = unique.get(url);
    if (!existing || score > existing.score) unique.set(url, { ...source, url, sourceType: type, score });
  }
  return [...unique.values()].sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
}

/** A failed source lookup must never be presented as an observed zero-role result. */
export function finalHiringFailureStatus(
  failures: Array<{ status: HiringActivityStatus }>,
): HiringActivityStatus {
  if (failures.some((item) => item.status === "parse_failed")) return "parse_failed";
  if (failures.some((item) => item.status === "browser_fallback_failed")) return "browser_fallback_failed";
  return "retrieval_failed";
}

function count<T extends string>(values: T[]) { return values.reduce<Record<T, number>>((out, value) => { out[value] = (out[value] ?? 0) + 1; return out; }, {} as Record<T, number>); }
function strength(countValue: number): HiringSignal["strength"] { return countValue >= 8 ? "high" : countValue >= 3 ? "medium" : "low"; }
function matching(jobs: JobPosting[], matcher: (job: JobPosting) => boolean) { return jobs.filter(matcher); }

export function buildHiringSignals(jobs: JobPosting[]): HiringSignal[] {
  const rules: Array<[HiringSignal["type"], (job: JobPosting) => boolean, string]> = [
    ["engineering_expansion", (job) => job.function === "Engineering", "Observed open engineering roles indicate active engineering recruitment."],
    ["ai_ml_hiring", (job) => /\b(machine learning|\bml\b|artificial intelligence|\bai\b|data scientist)\b/i.test(`${job.title} ${job.description ?? ""}`), "Observed AI/ML-oriented openings indicate current AI/ML recruitment activity."],
    ["enterprise_gtm_hiring", (job) => job.function === "Sales" && /\b(enterprise|strategic|account executive|business development)\b/i.test(job.title), "Observed enterprise go-to-market openings indicate current enterprise sales recruitment activity."],
    ["international_hiring", (job) => Boolean(job.country) || /\b(emea|apac|europe|united kingdom|canada|india|singapore|australia)\b/i.test(job.location ?? ""), "Observed roles outside an unspecified home market indicate geographically distributed recruitment activity."],
    ["compliance_investment", (job) => job.function === "Legal / Compliance", "Observed legal/compliance openings indicate current compliance recruitment activity."],
    ["leadership_hiring", (job) => ["Director", "VP", "Executive"].includes(job.seniority ?? "Unknown"), "Observed director-level or above openings indicate current leadership recruitment activity."],
    ["finance_team_buildout", (job) => job.function === "Finance", "Observed finance openings indicate current finance-team recruitment activity."],
  ];
  return rules.flatMap(([type, matcher, explanation]) => {
    const supported = matching(jobs, matcher);
    return supported.length ? [{ type, strength: strength(supported.length), evidenceCount: supported.length, supportingJobIds: supported.map((job) => job.id), explanation }] : [];
  });
}

export function summarizeHiring(companyId: string, jobs: JobPosting[], source: { adapter: string; sourceUrl: string; retrievedAt: string } | null, limitations: string[] = []): HiringIntelligenceSummary {
  const normalized = jobs.map((job) => ({ ...job, function: job.function ?? classifyJobFunction(job.title, job.department, job.team), seniority: job.seniority ?? classifyJobSeniority(job.title) }));
  return {
    companyId,
    totalOpenRoles: normalized.length,
    byFunction: count(normalized.map((job) => job.function!)),
    bySeniority: count(normalized.map((job) => job.seniority!)),
    byLocation: count(normalized.map((job) => job.location?.trim() || "Unspecified")),
    remoteRoles: normalized.filter((job) => job.remote).length,
    sources: source ? [{ ...source, jobCount: normalized.length }] : [],
    signals: buildHiringSignals(normalized),
    limitations,
  };
}
