import type { CareerSourceCandidate, HiringActivityStatus, HiringIntelligenceSummary, HiringRoleAnalysis, HiringSignal, HiringSourceType, JobFunction, JobPosting, JobSeniority, KeyRoleCategory } from "./types";

const FUNCTION_RULES: Array<[JobFunction, RegExp]> = [
  ["Security", /\b(security|security engineer|application security|infosec|cyber|ciso)\b/i],
  ["Data / AI", /\b(data (scientist|engineer|analyst)|machine learning|ml|artificial intelligence|ai|analytics|research scientist|applied scientist|head of data)\b/i],
  ["Engineering", /\b(engineer|engineering|developer|software|platform|sre|devops|quality assurance|qa|cto|chief architect|chief technology)\b/i],
  ["Product", /\b(product manager|product design|product operations|ux|ui|user research)\b/i],
  ["Sales", /\b(sales|account executive|business development|revenue|solutions consultant)\b/i],
  ["Marketing", /\b(marketing|brand|communications|content|growth)\b/i],
  ["Finance", /\b(finance|financial|cfo|accounting|controller|treasur(?:y|er)|investor relations|fp&a)\b/i],
  ["HR / People", /\b(human resources|\bhr\b|people|recruit(?:er|ing)|talent acquisition)\b/i],
  ["Legal / Compliance", /\b(legal|counsel|compliance|privacy|regulatory|aml|kyc|risk)\b/i],
  ["Customer Success", /\b(customer success|customer support|technical support|implementation|onboarding)\b/i],
  ["Operations", /\b(operations|supply chain|procurement|business operations|workplace)\b/i],
];

const SENIORITY_RULES: Array<[JobSeniority, RegExp]> = [
  ["VP", /\b(?:svp|evp|vp|vice president)\b/i], ["Executive", /\b(?:ceo|cto|cfo|coo|cro|cmo|ciso|chief (?!of staff)|president)\b/i],
  ["Director", /\b(?:director|head of)\b/i], ["Manager", /\bmanager\b/i], ["Lead", /\b(?:lead|principal|staff)\b/i],
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
  // A specific title wins over an unrelated broad department label.
  const normalized = normalizeJobTitle(title);
  if (/\b(?:account executive|sales development representative|business development representative)\b/.test(normalized)) return "Sales";
  if (/\b(?:executive|administrative) assistant\b/.test(normalized)) return "Operations";
  return FUNCTION_RULES.find(([, rule]) => rule.test(normalized))?.[0]
    ?? FUNCTION_RULES.find(([, rule]) => rule.test([department, team].filter(Boolean).join(" ")))?.[0] ?? "Other";
}

export function classifyJobSeniority(title: string): JobSeniority {
  const normalized = normalizeJobTitle(title);
  if (/\b(?:assistant|associate|advisor|adviser|consultant)\s+(?:to|for)\b/.test(normalized)) return "Unknown";
  if (/\b(?:account executive|sales development representative|business development representative)\b/.test(normalized))
    return /\bsenior\b/.test(normalized) ? "Senior" : "Unknown";
  return SENIORITY_RULES.find(([, rule]) => rule.test(normalized))?.[0] ?? "Unknown";
}

/** Normalization is only for classification; the source title is never replaced. */
export function normalizeJobTitle(title: string) {
  return title.normalize("NFKC").toLowerCase()
    .replace(/\((?:m\s*\/\s*f\s*\/\s*d|f\s*\/\s*m\s*\/\s*d|all genders)\)/g, " ")
    .replace(/\bv\.?\s*p\.?\b/g, "vp").replace(/\bvice[ -]+president\b/g, "vice president")
    .replace(/\b(?:sr\.?)(?=\s|,|$)/g, "senior").replace(/\b(?:jr\.?)(?=\s|,|$)/g, "junior")
    .replace(/\b(?:a\.?i\.?)\b/g, "ai").replace(/\b(?:m\.?l\.?)\b/g, "ml")
    .replace(/\./g, "").replace(/[-–—_/,:()]+/g, " ").replace(/\s+/g, " ").trim();
}

const KEY_ROLE_RULES: Array<[KeyRoleCategory, RegExp]> = [
  ["finance_leadership", /\b(?:cfo|chief financial officer|(?:vp|vice president|head|director)(?:\s+of)?(?:\s+(?:strategic|corporate|global|group|commercial|operational)){0,2}\s+(?:finance|accounting|treasury|financial planning|financial operations)|(?:finance|accounting|treasury)\s+(?:director|vp|head)|(?:corporate\s+)?controller|treasurer)\b/],
  ["technical_leadership", /\b(?:cto|chief technology officer|chief architect|(?:vp|vice president|head|director)(?:\s+of)?(?:\s+global)?\s+(?:engineering|technology)|(?:engineering|technology)\s+(?:director|vp|head))\b/],
  ["ai_ml", /\b(?:(?:machine learning|ml|ai|artificial intelligence)\s+(?:research(?:er)?|engineer(?:ing)?|scientist|infrastructure|platform|architect)|(?:research|applied)\s+scientist|research(?:er)?\s+(?:ai|ml|machine learning))\b/],
  ["data", /\b(?:(?:data|analytics)\s+(?:scientist|engineer(?:ing)?|analyst)|(?:head|director|vp)(?:\s+of)?\s+data)\b/],
  ["security_compliance", /\b(?:ciso|security|infosec|cybersecurity|compliance|risk|aml|kyc|privacy)\b/],
  ["commercial_leadership", /\b(?:cro|cmo|chief (?:revenue|marketing|commercial) officer|(?:vp|vice president|head|director)(?:\s+of)?(?:\s+global)?\s+(?:sales|marketing|partnerships|revenue|commercial)|(?:sales|marketing|partnerships|revenue)\s+(?:director|vp|head))\b/],
];
export function classifyKeyRoleTitle(title: string): KeyRoleCategory[] {
  const normalized = normalizeJobTitle(title);
  if (/\b(?:assistant|associate|advisor|adviser|consultant)\s+(?:to|for)\b/.test(normalized)) return [];
  if (/\b(?:account executive|sales development representative|business development representative)\b/.test(normalized)) return [];
  const categories = KEY_ROLE_RULES.filter(([, rule]) => rule.test(normalized)).map(([category]) => category);
  // Titles place specialisms before or after the occupation (for example,
  // "Data Scientist - Risk ML"). Require both a technical occupation and an
  // explicit AI/ML phrase in the title, never company-description boilerplate.
  if (!categories.includes("ai_ml") && /\b(?:ai|ml|machine learning|artificial intelligence|deep learning)\b/.test(normalized)
    && /\b(?:engineer(?:ing)?|scientist|researcher|architect|infrastructure|technical staff)\b/.test(normalized)) categories.push("ai_ml");
  return categories;
}

/** Describes only the observed postings; never interprets openings as growth or missing incumbents. */
export function analyzeHiringRoles(jobs: JobPosting[], notableLimit = 8): HiringRoleAnalysis {
  const observed = deduplicateJobs(jobs);
  const classified = observed.map(posting => ({ ...posting, normalizedTitle: normalizeJobTitle(posting.title), keyRoleCategories: classifyKeyRoleTitle(posting.title) }));
  const leadership = classified.filter(j => ["Director", "VP", "Executive"].includes(classifyJobSeniority(j.title)));
  const byKeyRole = Object.fromEntries(KEY_ROLE_RULES.map(([category]) => [category, classified.filter(j => j.keyRoleCategories.includes(category)).length])) as Record<KeyRoleCategory, number>;
  const labels: Record<KeyRoleCategory, string> = { finance_leadership: "finance leadership", technical_leadership: "technical leadership", ai_ml: "AI / ML", data: "data", security_compliance: "security / compliance", commercial_leadership: "commercial leadership" };
  const descriptiveSignals: HiringRoleAnalysis["descriptiveSignals"] = KEY_ROLE_RULES.flatMap(([category]) => {
    const matching = classified.filter(j => j.keyRoleCategories.includes(category));
    return matching.length ? [{ type: "category_count" as const, text: `${matching.length} observed ${labels[category]} opening${matching.length === 1 ? "" : "s"}`, evidenceCount: matching.length, supportingJobIds: matching.map(j => j.id) }] : [];
  });
  if (leadership.length) descriptiveSignals.push({ type: "leadership_count", text: `${leadership.length} observed senior leadership opening${leadership.length === 1 ? "" : "s"}`, evidenceCount: leadership.length, supportingJobIds: leadership.map(j => j.id) });
  const functions = Object.entries(count(classified.map(j => j.function ?? classifyJobFunction(j.title, j.department, j.team)))).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (functions.length && functions[0][0] !== "Other" && functions[0][1] > (functions[1]?.[1] ?? 0)) {
    const supporting = classified.filter(j => (j.function ?? classifyJobFunction(j.title, j.department, j.team)) === functions[0][0]);
    descriptiveSignals.push({ type: "largest_function", text: `${functions[0][0]} is the largest observed job category (${supporting.length} openings)`, evidenceCount: supporting.length, supportingJobIds: supporting.map(j => j.id) });
  }
  const locations = [...new Set(classified.map(j => j.location?.trim()).filter((v): v is string => Boolean(v)))];
  if (locations.length >= 2) descriptiveSignals.push({ type: "observed_locations", text: `Public openings observed in ${locations.slice(0, 4).join("; ")}${locations.length > 4 ? ` and ${locations.length - 4} other listed locations` : ""}`, evidenceCount: classified.filter(j => j.location?.trim()).length, supportingJobIds: classified.filter(j => j.location?.trim()).map(j => j.id) });
  const weights: Record<KeyRoleCategory, number> = { finance_leadership: 35, technical_leadership: 30, commercial_leadership: 25, ai_ml: 20, security_compliance: 18, data: 12 };
  const rank = (j: typeof classified[number]) => ({ Executive: 100, VP: 80, Director: 60, Lead: 20, Senior: 10, Manager: 15, Intern: 0, Entry: 0, Mid: 0, Unknown: 0 }[classifyJobSeniority(j.title)] + Math.max(0, ...j.keyRoleCategories.map(c => weights[c])));
  const compare = (a: typeof classified[number], b: typeof classified[number]) => rank(b) - rank(a) || a.normalizedTitle.localeCompare(b.normalizedTitle) || a.sourceUrl.localeCompare(b.sourceUrl) || a.id.localeCompare(b.id);
  const ranked = [...classified].sort(compare);
  const limit = Math.max(0, Math.min(10, Math.floor(notableLimit)));
  const selected = ranked.slice(0, limit);
  const diverseIds = new Set<string>();
  // Reserve at most two places for represented strategic categories that a
  // leadership-heavy board would otherwise hide. Never displace the top role,
  // a CFO/VP/executive, or a role already selected for category coverage.
  const maxReplacements = Math.min(2, Math.floor(limit / 3));
  for (const category of ["finance_leadership", "ai_ml", "technical_leadership", "security_compliance", "data"] as KeyRoleCategory[]) {
    if (diverseIds.size >= maxReplacements) break;
    if (selected.some(j => j.keyRoleCategories.includes(category))) continue;
    const candidate = ranked.find(j => j.keyRoleCategories.includes(category));
    if (!candidate) continue;
    const replace = [...selected].reverse().find(j => j.id !== ranked[0]?.id && !diverseIds.has(j.id)
      && !["VP", "Executive"].includes(classifyJobSeniority(j.title))
      && !j.keyRoleCategories.includes("finance_leadership")
      && j.keyRoleCategories.every(c => selected.filter(other => other.keyRoleCategories.includes(c)).length > 1));
    if (!replace) continue;
    selected[selected.findIndex(j => j.id === replace.id)] = candidate;
    diverseIds.add(candidate.id);
  }
  const notableRoles = selected.sort(compare)
    .map(j => ({ ...j, selectionReasons: [...j.keyRoleCategories.map(category => `${labels[category]} title`), ...(["Director", "VP", "Executive"].includes(classifyJobSeniority(j.title)) ? ["leadership title"] : []), ...(diverseIds.has(j.id) ? ["strategic category coverage"] : []), ...(!j.keyRoleCategories.length && !["Director", "VP", "Executive"].includes(classifyJobSeniority(j.title)) ? ["observed public role"] : [])] }));
  return { metrics: { leadership: leadership.length, aiMl: byKeyRole.ai_ml, financeLeadership: byKeyRole.finance_leadership, securityCompliance: byKeyRole.security_compliance }, byKeyRole, notableRoles, descriptiveSignals };
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
    ["ai_ml_hiring", (job) => classifyKeyRoleTitle(job.title).includes("ai_ml"), "Observed AI/ML-oriented job titles indicate current AI/ML recruitment activity."],
    ["enterprise_gtm_hiring", (job) => job.function === "Sales" && /\b(enterprise|strategic|account executive|business development)\b/i.test(job.title), "Observed enterprise go-to-market openings indicate current enterprise sales recruitment activity."],
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
    roleAnalysis: analyzeHiringRoles(normalized),
  };
}
