import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isBlockedNetworkAddress, safeCompanyFetch } from "../security";
import { canonicalJobUrl, classifyJobFunction, classifyJobSeniority, detectHiringSourceType } from "./core";
import type { HiringSourceType, JobPosting, SourceAdapter } from "./types";

export type CareersAdapterInput = {
  companyId: string;
  sourceUrl: string;
  officialHostname: string;
  retrievedAt: string;
  fetchImpl?: typeof fetch;
  resolveHost?: typeof lookup;
  browserRenderer?: (url: string) => Promise<string>;
};

function value(record: Record<string, unknown>, key: string) { return typeof record[key] === "string" ? record[key].trim() : undefined; }
function stableId(sourceType: HiringSourceType, companyId: string, sourceJobId: string | undefined, sourceUrl: string, title: string) {
  return `${sourceType}-${createHash("sha256").update(`${companyId}|${sourceJobId ?? sourceUrl}|${title}`).digest("hex").slice(0, 18)}`;
}
function job(input: Omit<JobPosting, "id" | "function" | "seniority">) {
  return { ...input, id: stableId(input.sourceType, input.companyId, input.sourceJobId, input.sourceUrl, input.title), function: classifyJobFunction(input.title, input.department, input.team), seniority: classifyJobSeniority(input.title) } satisfies JobPosting;
}
function remoteIndication(location: string | undefined, explicit?: unknown): boolean | undefined {
  if (typeof explicit === "boolean") return explicit;
  if (/\b(?:not|non)[ -]?remote\b/i.test(location ?? "")) return false;
  return /\bremote\b/i.test(location ?? "") ? true : undefined;
}
function boardToken(sourceUrl: string) {
  const path = new URL(sourceUrl).pathname.split("/").filter(Boolean);
  return path[0] ?? null;
}
function normalizeExternalUrl(value: string) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error("Unsupported public source URL");
  return url;
}
async function safeProviderFetch(urlText: string, allowedHosts: string[], input: CareersAdapterInput, maxBytes = 2_000_000) {
  const url = normalizeExternalUrl(urlText);
  if (!allowedHosts.includes(url.hostname.toLowerCase())) throw new Error("Unsupported recruiting provider host");
  const resolver = input.resolveHost ?? lookup;
  const addresses = await resolver(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isBlockedNetworkAddress(item.address))) throw new Error("Recruiting provider resolved to a blocked address");
  const response = await (input.fetchImpl ?? fetch)(url, { method: "GET", headers: { Accept: "application/json" }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Recruiting provider returned ${response.status}`);
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) throw new Error("Recruiting provider response exceeded the size limit");
  try { return JSON.parse(body) as unknown; } catch { throw new Error("Recruiting provider returned malformed JSON"); }
}

export const GreenhouseAdapter: SourceAdapter<CareersAdapterInput, JobPosting> = {
  name: "GreenhouseAdapter", sourceType: "greenhouse",
  canHandle: (input) => detectHiringSourceType(input.sourceUrl) === "greenhouse",
  collect: async (input) => {
    const token = boardToken(input.sourceUrl); if (!token) throw new Error("Greenhouse board was not identifiable");
    // Full `content=true` boards can exceed the response safety limit. The
    // public listing endpoint retains the fields required for a job snapshot;
    // descriptions are optional and are not required for hiring signals.
    const payload = await safeProviderFetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs`, ["boards-api.greenhouse.io"], input);
    if (!payload || typeof payload !== "object" || !Array.isArray((payload as { jobs?: unknown }).jobs)) throw new Error("Greenhouse response did not contain jobs");
    const rows = (payload as { jobs: unknown[] }).jobs;
    const jobs = rows.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const item = row as Record<string, unknown>; const title = value(item, "title"); const absoluteUrl = value(item, "absolute_url");
      if (!title || !absoluteUrl || !canonicalJobUrl(absoluteUrl)) return [];
      const location = item.location && typeof item.location === "object" ? value(item.location as Record<string, unknown>, "name") : undefined;
      const departments = Array.isArray(item.departments) ? item.departments : [];
      const department = departments.find((entry) => entry && typeof entry === "object" && value(entry as Record<string, unknown>, "name")) as Record<string, unknown> | undefined;
      return [job({ companyId: input.companyId, title, department: department ? value(department, "name") : undefined, location, remote: remoteIndication(location), description: value(item, "content"), sourceUrl: absoluteUrl, sourceType: "greenhouse", sourceJobId: String(item.id ?? "") || undefined, updatedAt: value(item, "updated_at"), retrievedAt: input.retrievedAt })];
    });
    if (rows.length && !jobs.length) throw new Error("Greenhouse response did not contain jobs with usable titles and source URLs");
    return jobs;
  },
  validate: (results) => ({ valid: results.every((item) => item.sourceType === "greenhouse" && Boolean(item.title && item.sourceUrl)), limitations: [] }),
};

export const LeverAdapter: SourceAdapter<CareersAdapterInput, JobPosting> = {
  name: "LeverAdapter", sourceType: "lever",
  canHandle: (input) => detectHiringSourceType(input.sourceUrl) === "lever",
  collect: async (input) => {
    const token = boardToken(input.sourceUrl); if (!token) throw new Error("Lever site was not identifiable");
    const payload = await safeProviderFetch(`https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`, ["api.lever.co"], input);
    if (!Array.isArray(payload)) throw new Error("Lever response did not contain jobs");
    const jobs = payload.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const item = row as Record<string, unknown>; const title = value(item, "text"); const sourceUrl = value(item, "hostedUrl");
      if (!title || !sourceUrl || !canonicalJobUrl(sourceUrl)) return [];
      const categories = item.categories && typeof item.categories === "object" ? item.categories as Record<string, unknown> : {};
      return [job({ companyId: input.companyId, title, department: value(categories, "department"), team: value(categories, "team"), location: value(categories, "location"), remote: remoteIndication(value(categories, "location")), employmentType: value(categories, "commitment"), description: value(item, "descriptionPlain"), sourceUrl, sourceType: "lever", sourceJobId: value(item, "id"), retrievedAt: input.retrievedAt })];
    });
    if (payload.length && !jobs.length) throw new Error("Lever response did not contain jobs with usable titles and source URLs");
    return jobs;
  },
  validate: (results) => ({ valid: results.every((item) => item.sourceType === "lever" && Boolean(item.title && item.sourceUrl)), limitations: [] }),
};

export const AshbyAdapter: SourceAdapter<CareersAdapterInput, JobPosting> = {
  name: "AshbyAdapter", sourceType: "ashby",
  canHandle: (input) => detectHiringSourceType(input.sourceUrl) === "ashby",
  collect: async (input) => {
    const token = boardToken(input.sourceUrl); if (!token) throw new Error("Ashby board was not identifiable");
    // Ashby returns individual public job descriptions with the board payload.
    // A bounded 5 MB cap permits larger legitimate boards while retaining a hard limit.
    const payload = await safeProviderFetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}`, ["api.ashbyhq.com"], input, 5_000_000);
    if (!payload || typeof payload !== "object" || !Array.isArray((payload as { jobs?: unknown }).jobs)) throw new Error("Ashby response did not contain jobs");
    const rows = (payload as { jobs: unknown[] }).jobs;
    const jobs = rows.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const item = row as Record<string, unknown>; const title = value(item, "title"); const sourceUrl = value(item, "jobUrl") ?? value(item, "url");
      if (!title || !sourceUrl || !canonicalJobUrl(sourceUrl)) return [];
      const location = value(item, "location");
      return [job({ companyId: input.companyId, title, department: value(item, "department"), team: value(item, "team"), location, remote: remoteIndication(location, item.isRemote), employmentType: value(item, "employmentType"), description: value(item, "descriptionPlain") ?? value(item, "description"), sourceUrl, sourceType: "ashby", sourceJobId: value(item, "id") ?? value(item, "jobId"), postedAt: value(item, "publishedAt"), retrievedAt: input.retrievedAt })];
    });
    if (rows.length && !jobs.length) throw new Error("Ashby response did not contain jobs with usable titles and source URLs");
    return jobs;
  },
  validate: (results) => ({ valid: results.every((item) => item.sourceType === "ashby" && Boolean(item.title && item.sourceUrl)), limitations: [] }),
};

function linksFromHtml(html: string, base: URL) {
  return [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap((match) => {
    const title = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!title || title.length > 180) return [];
    try {
      const url = new URL(match[1], base);
      if (!['http:','https:'].includes(url.protocol) || url.username || url.password) return [];
      // A pagination/demo link on a /careers page is not a job posting.
      if (url.hostname===base.hostname && url.pathname===base.pathname) return [];
      if (/^(?:next|previous|apply|learn more|see.*demo|view.*(?:jobs|roles)|careers?|jobs?|open roles)$/i.test(title)) return [];
      const rolePath = /\/(?:jobs?|careers?|positions?|openings?)\/[^/]+/i.test(url.pathname);
      const roleTitle = /\b(?:engineer|manager|analyst|designer|developer|scientist|specialist|executive|director|counsel|lead|associate|recruiter|coordinator|intern|chief|cfo|cto|ciso|cro|vp|vice president|head of|controller|treasurer)\b/i.test(title);
      return url.hostname === base.hostname && rolePath && roleTitle ? [{title,url:url.toString()}] : [];
    } catch { return []; }
  });
}

/** Use explicit JobPosting markup where a company publishes it; no guessed details. */
function structuredJobs(html: string, input: CareersAdapterInput): { jobs: JobPosting[]; referencedUrls: Set<string> } {
  const records: Record<string, unknown>[] = [];
  const organizations: Record<string, unknown>[] = [];
  const ownUrl = (url: unknown) => {
    if (typeof url !== "string") return false;
    try { return new URL(url, input.sourceUrl).hostname.toLowerCase().replace(/^www\./, "") === input.officialHostname.toLowerCase().replace(/^www\./, ""); } catch { return false; }
  };
  const visit = (node: unknown, depth = 0) => {
    if (depth > 6 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.slice(0, 1000).forEach(child => visit(child, depth + 1)); return; }
    const row = node as Record<string, unknown>;
    if ([row["@type"]].flat().includes("JobPosting")) records.push(row);
    if ([row["@type"]].flat().some(type => ["Organization", "Corporation"].includes(String(type)))) organizations.push(row);
    for (const key of ["@graph", "itemListElement", "item"]) visit(row[key], depth + 1);
  };
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { /* Invalid markup cannot establish a role. */ }
  }
  const referencedUrls = new Set(records.flatMap(row => {
    try { const url = value(row, "url"); return url ? [canonicalJobUrl(new URL(url, input.sourceUrl).toString()) ?? ""] : []; } catch { return []; }
  }));
  const jobs = records.flatMap(row => {
    const title = value(row, "title");
    const suppliedUrl = value(row, "url");
    if (!title || !suppliedUrl) return [];
    const employer = row.hiringOrganization;
    if (employer && typeof employer === "object") {
      const organization = employer as Record<string, unknown>;
      const employerUrl = value(organization, "url") ?? value(organization, "sameAs");
      // A company-owned page may embed third-party openings. An explicit
      // foreign employer cannot be re-attributed merely because its URL is local.
      if (employerUrl && !ownUrl(employerUrl)) return [];
      const name = value(organization, "name")?.toLowerCase();
      const id = value(organization, "@id");
      const matchedOwnedOrganization = organizations.some(owned => ownUrl(owned.url) && ((name && value(owned, "name")?.toLowerCase() === name) || (id && value(owned, "@id") === id)));
      if (!employerUrl && !matchedOwnedOrganization) return [];
    } else if (employer) return [];
    let sourceUrl: string;
    try {
      const url = new URL(suppliedUrl, input.sourceUrl);
      if (url.hostname.toLowerCase().replace(/^www\./, "") !== input.officialHostname.toLowerCase().replace(/^www\./, "")) return [];
      sourceUrl = canonicalJobUrl(url.toString()) ?? "";
    } catch { return []; }
    if (!sourceUrl) return [];
    const locationRows = (Array.isArray(row.jobLocation) ? row.jobLocation : [row.jobLocation]).filter((v): v is Record<string, unknown> => Boolean(v && typeof v === "object"));
    const locations = locationRows.flatMap(location => {
      const address = location.address && typeof location.address === "object" ? location.address as Record<string, unknown> : {};
      const country = typeof address.addressCountry === "string" ? address.addressCountry : address.addressCountry && typeof address.addressCountry === "object" ? value(address.addressCountry as Record<string, unknown>, "name") : undefined;
      const parts = [value(address, "addressLocality"), value(address, "addressRegion"), country].filter(Boolean);
      return parts.length ? [{ text: parts.join(", "), country }] : value(location, "name") ? [{ text: value(location, "name")!, country }] : [];
    });
    const identifier = row.identifier && typeof row.identifier === "object" ? (row.identifier as Record<string, unknown>).value : row.identifier;
    const description = value(row, "description")?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const remote = value(row, "jobLocationType") === "TELECOMMUTE" ? true : undefined;
    const countries = [...new Set(locations.map(l => l.country).filter(Boolean))];
    return [job({ companyId: input.companyId, title, location: locations.length ? [...new Set(locations.map(l => l.text))].join("; ") : undefined,
      country: countries.length === 1 ? countries[0] : undefined, remote, employmentType: value(row, "employmentType"), description,
      sourceUrl, sourceType: "company_careers", sourceJobId: ["string", "number"].includes(typeof identifier) ? String(identifier) : undefined,
      postedAt: value(row, "datePosted"), retrievedAt: input.retrievedAt })];
  });
  return { jobs, referencedUrls };
}

export const GenericCareersAdapter: SourceAdapter<CareersAdapterInput, JobPosting> = {
  name: "GenericCareersAdapter", sourceType: "company_careers",
  canHandle: (input) => detectHiringSourceType(input.sourceUrl) === "company_careers",
  collect: async (input) => {
    let html: string;
    try {
      html = (await safeCompanyFetch(input.sourceUrl, { officialHostname: input.officialHostname, fetchImpl: input.fetchImpl, resolveHost: input.resolveHost, timeoutMs: 10_000, maxBytes: 1_500_000 })).text;
    } catch (error) { throw error; }
    let structured = structuredJobs(html, input);
    let links = linksFromHtml(html, new URL(input.sourceUrl)).filter(link => !structured.referencedUrls.has(canonicalJobUrl(link.url) ?? ""));
    const explicitZero = (source: string) => /\b(?:no (?:current(?:ly)? |open |available )?(?:job openings|openings|positions|vacancies|jobs)|0 (?:open )?(?:jobs|positions|openings))\b/i.test(source.replace(/<[^>]+>/g, " "));
    if (!links.length && !structured.jobs.length && !explicitZero(html) && input.browserRenderer) {
      // The renderer is injected by server-side infrastructure only; this module never exposes browser navigation to a client.
      const safeUrl = new URL(input.sourceUrl);
      if (safeUrl.hostname.toLowerCase().replace(/^www\./, "") !== input.officialHostname.toLowerCase().replace(/^www\./, "")) throw new Error("Browser fallback destination was rejected");
      try { html = await input.browserRenderer(safeUrl.toString()); }
      catch { throw new Error("Browser fallback did not return a usable public careers page"); }
      structured = structuredJobs(html, input);
      links = linksFromHtml(html, safeUrl).filter(link => !structured.referencedUrls.has(canonicalJobUrl(link.url) ?? ""));
    }
    if (!structured.jobs.length && !links.length && !explicitZero(html)) throw new Error("Careers page did not contain jobs or an explicit zero-openings statement");
    return [...structured.jobs, ...links.map(({ title, url }) => job({ companyId: input.companyId, title, location: undefined, sourceUrl: url, sourceType: "company_careers", retrievedAt: input.retrievedAt }))];
  },
  validate: (results) => ({ valid: results.every((item) => item.sourceType === "company_careers" && Boolean(item.title && item.sourceUrl)), limitations: results.length ? ["Company-hosted pages may omit structured location, department, and posting-date fields."] : [] }),
};
