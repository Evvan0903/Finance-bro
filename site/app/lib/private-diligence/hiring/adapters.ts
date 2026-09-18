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
  const response = await (input.fetchImpl ?? fetch)(url, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
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
    return (payload as { jobs: unknown[] }).jobs.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const item = row as Record<string, unknown>; const title = value(item, "title"); const absoluteUrl = value(item, "absolute_url");
      if (!title || !absoluteUrl || !canonicalJobUrl(absoluteUrl)) return [];
      const location = item.location && typeof item.location === "object" ? value(item.location as Record<string, unknown>, "name") : undefined;
      const departments = Array.isArray(item.departments) ? item.departments : [];
      const department = departments.find((entry) => entry && typeof entry === "object" && value(entry as Record<string, unknown>, "name")) as Record<string, unknown> | undefined;
      return [job({ companyId: input.companyId, title, department: department ? value(department, "name") : undefined, location, remote: /remote/i.test(location ?? ""), description: value(item, "content"), sourceUrl: absoluteUrl, sourceType: "greenhouse", sourceJobId: String(item.id ?? "") || undefined, postedAt: value(item, "updated_at"), retrievedAt: input.retrievedAt })];
    });
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
    return payload.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const item = row as Record<string, unknown>; const title = value(item, "text"); const sourceUrl = value(item, "hostedUrl");
      if (!title || !sourceUrl || !canonicalJobUrl(sourceUrl)) return [];
      const categories = item.categories && typeof item.categories === "object" ? item.categories as Record<string, unknown> : {};
      return [job({ companyId: input.companyId, title, department: value(categories, "department"), team: value(categories, "team"), location: value(categories, "location"), remote: /remote/i.test(value(categories, "location") ?? ""), employmentType: value(categories, "commitment"), description: value(item, "descriptionPlain"), sourceUrl, sourceType: "lever", sourceJobId: value(item, "id"), retrievedAt: input.retrievedAt })];
    });
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
    return (payload as { jobs: unknown[] }).jobs.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const item = row as Record<string, unknown>; const title = value(item, "title"); const sourceUrl = value(item, "jobUrl") ?? value(item, "url");
      if (!title || !sourceUrl || !canonicalJobUrl(sourceUrl)) return [];
      const location = value(item, "location");
      return [job({ companyId: input.companyId, title, department: value(item, "department"), team: value(item, "team"), location, remote: Boolean(item.isRemote) || /remote/i.test(location ?? ""), employmentType: value(item, "employmentType"), description: value(item, "descriptionPlain") ?? value(item, "description"), sourceUrl, sourceType: "ashby", sourceJobId: value(item, "id") ?? value(item, "jobId"), postedAt: value(item, "publishedAt"), retrievedAt: input.retrievedAt })];
    });
  },
  validate: (results) => ({ valid: results.every((item) => item.sourceType === "ashby" && Boolean(item.title && item.sourceUrl)), limitations: [] }),
};

function linksFromHtml(html: string, base: URL) {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap((match) => {
    const title = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!title || title.length > 180) return [];
    try {
      const url = new URL(match[1], base);
      if (!['http:','https:'].includes(url.protocol) || url.username || url.password) return [];
      // A pagination/demo link on a /careers page is not a job posting.
      if (url.hostname===base.hostname && url.pathname===base.pathname) return [];
      if (/^(?:next|previous|apply|learn more|see.*demo|view.*(?:jobs|roles)|careers?|jobs?|open roles)$/i.test(title)) return [];
      const rolePath = /\/(?:jobs?|careers?|positions?|openings?)\/[^/]+/i.test(url.pathname);
      const roleTitle = /\b(?:engineer|manager|analyst|designer|developer|scientist|specialist|executive|director|counsel|lead|associate|recruiter|coordinator|intern)\b/i.test(title);
      return rolePath && roleTitle ? [{title,url:url.toString()}] : [];
    } catch { return []; }
  });
}

export const GenericCareersAdapter: SourceAdapter<CareersAdapterInput, JobPosting> = {
  name: "GenericCareersAdapter", sourceType: "company_careers",
  canHandle: (input) => detectHiringSourceType(input.sourceUrl) === "company_careers",
  collect: async (input) => {
    let html: string;
    try {
      html = (await safeCompanyFetch(input.sourceUrl, { officialHostname: input.officialHostname, fetchImpl: input.fetchImpl, resolveHost: input.resolveHost, timeoutMs: 10_000, maxBytes: 1_500_000 })).text;
    } catch (error) { throw error; }
    let links = linksFromHtml(html, new URL(input.sourceUrl));
    if (!links.length && input.browserRenderer) {
      // The renderer is injected by server-side infrastructure only; this module never exposes browser navigation to a client.
      const safeUrl = new URL(input.sourceUrl);
      if (safeUrl.hostname.toLowerCase().replace(/^www\./, "") !== input.officialHostname.toLowerCase().replace(/^www\./, "")) throw new Error("Browser fallback destination was rejected");
      try { html = await input.browserRenderer(safeUrl.toString()); }
      catch { throw new Error("Browser fallback did not return a usable public careers page"); }
      links = linksFromHtml(html, safeUrl);
    }
    return links.map(({ title, url }) => job({ companyId: input.companyId, title, location: undefined, sourceUrl: url, sourceType: "company_careers", retrievedAt: input.retrievedAt }));
  },
  validate: (results) => ({ valid: results.every((item) => item.sourceType === "company_careers" && Boolean(item.title && item.sourceUrl)), limitations: results.length ? ["Company-hosted pages may omit structured location, department, and posting-date fields."] : [] }),
};
