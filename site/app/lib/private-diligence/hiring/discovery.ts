import { safeCompanyFetch } from "../security";
import { detectHiringSourceType, rankCareerSources } from "./core";
import type { CareerSourceCandidate } from "./types";

const CAREER_PATHS = ["/careers", "/jobs", "/company/careers"];
const CAREER_LINK = /\b(careers?|jobs?|join[ -]us|open[ -]roles|openings|opportunities)\b/i;
const CAREER_PATH = /\/(?:careers?|jobs?|join-us|open-roles|openings)(?:\/|$)/i;
const EDITORIAL_PATH = /\/(?:blog|resources?|downloads?|customers?|case-studies|news|articles?)\//i;
const isCareerPage = (url: URL) => CAREER_PATH.test(url.pathname) && !EDITORIAL_PATH.test(url.pathname);
const officialHost = (url: URL) => url.hostname.toLowerCase().replace(/^www\./, "");
const decodeReference = (value: string) => value.replace(/&amp;|&#38;/gi, "&").replace(/\\\//g, "/").replace(/\\u002f/gi, "/");

/** Accept only explicit references to supported ATS hosts; never guess a brand's board slug. */
export function normalizeSupportedAtsReference(value: string, base?: URL): string | null {
  try {
    const url = new URL(decodeReference(value), base);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const segments = url.pathname.split("/").filter(Boolean);
    let token: string | undefined;
    let host: string;
    if (["boards.greenhouse.io", "job-boards.greenhouse.io"].includes(url.hostname)) {
      token = segments[0] === "embed" ? url.searchParams.get("for") ?? undefined : segments[0]; host = "boards.greenhouse.io";
    } else if (url.hostname === "boards-api.greenhouse.io" && segments[0] === "v1" && segments[1] === "boards") {
      token = segments[2]; host = "boards.greenhouse.io";
    } else if (url.hostname === "jobs.lever.co") { token = segments[0]; host = url.hostname;
    } else if (url.hostname === "api.lever.co" && segments[0] === "v0" && segments[1] === "postings") { token = segments[2]; host = "jobs.lever.co";
    } else if (url.hostname === "jobs.ashbyhq.com") { token = segments[0]; host = url.hostname;
    } else if (url.hostname === "api.ashbyhq.com" && segments[0] === "posting-api" && segments[1] === "job-board") { token = segments[2]; host = "jobs.ashbyhq.com";
    } else return null;
    return token && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/.test(token) ? `https://${host}/${token}` : null;
  } catch { return null; }
}

export function supportedAtsReferences(html: string, pageUrl: string): CareerSourceCandidate[] {
  const candidates: CareerSourceCandidate[] = [];
  const page = new URL(pageUrl);
  if (EDITORIAL_PATH.test(page.pathname)) return candidates;
  const add = (reference: string, referenceType: CareerSourceCandidate["referenceType"]) => {
    const url = normalizeSupportedAtsReference(reference, new URL(pageUrl));
    if (url) candidates.push({ url, sourceType: detectHiringSourceType(url), discoveryMethod: "linked_from_website", score: 50, sourcePageUrl: pageUrl, referenceType });
  };
  for (const match of html.matchAll(/<(iframe|script)\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    if (match[1].toLowerCase() === "iframe" || isCareerPage(page)) add(match[2], match[1].toLowerCase() === "iframe" ? "iframe" : "supported_reference");
  }
  // Static ATS URLs in supported integration scripts/data attributes are evidence;
  // arbitrary script execution, inferred tokens and arbitrary hosts are not.
  const decoded = decodeReference(html);
  if (isCareerPage(page)) for (const match of decoded.matchAll(/https:\/\/(?:boards\.greenhouse\.io|job-boards\.greenhouse\.io|boards-api\.greenhouse\.io|jobs\.lever\.co|api\.lever\.co|jobs\.ashbyhq\.com|api\.ashbyhq\.com)\/[^\s"'<>`\\]+/gi)) add(match[0], "supported_reference");
  return candidates.filter((candidate, index) => candidates.findIndex(previous => previous.url === candidate.url) === index);
}

function anchors(html: string, base: URL) {
  return [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap((match) => {
    const label = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    try { return [{ url: new URL(decodeReference(match[1]), base).toString(), label }]; } catch { return []; }
  });
}

function sitemapLocations(xml: string, official: URL) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].flatMap((match) => {
    try {
      const url = new URL(match[1]);
      if (url.hostname.toLowerCase().replace(/^www\./, "") !== official.hostname.toLowerCase().replace(/^www\./, "")) return [];
      return isCareerPage(url) ? [url.toString()] : [];
    } catch { return []; }
  });
}

export type InspectedCompanyCareerPage = { url: string; links: string[] };
export async function discoverCareerSources(input: { officialUrl: string; fetchImpl?: typeof fetch; resolveHost?: Parameters<typeof safeCompanyFetch>[1]["resolveHost"]; inspectedCompanyPages?: InspectedCompanyCareerPage[] }) {
  const official = new URL(input.officialUrl);
  const candidates: CareerSourceCandidate[] = [];
  // Only the server may supply these previously retrieved, company-owned pages.
  // Reuse explicit career-page links; search snippets and editorial mentions are excluded.
  for (const page of (input.inspectedCompanyPages ?? []).slice(0, 12)) {
    try {
      const url = new URL(page.url);
      if (officialHost(url) !== officialHost(official) || !isCareerPage(url)) continue;
      for (const link of page.links.slice(0, 500)) {
        const ats = normalizeSupportedAtsReference(link, url);
        if (ats) candidates.push({ url: ats, sourceType: detectHiringSourceType(ats), discoveryMethod: "linked_from_website", score: 50, sourcePageUrl: url.toString(), referenceType: "anchor" });
      }
    } catch { /* An invalid cached URL is not a source. */ }
  }
  if (candidates.length) return rankCareerSources(candidates);
  const pages = [official.toString(), ...CAREER_PATHS.map((path) => new URL(path, official).toString())];
  const inspected = new Set<string>();
  // Keep the original four-page discovery bound, but follow an actual careers
  // link ahead of guessed paths. Stop once an explicit supported board is found.
  while (pages.length && inspected.size < 4) {
    const page = pages.shift()!;
    if (inspected.has(page)) continue;
    inspected.add(page);
    try {
      const response = await safeCompanyFetch(page, { officialHostname: official.hostname, fetchImpl: input.fetchImpl, resolveHost: input.resolveHost, timeoutMs: 8_000, maxBytes: 1_000_000 });
      const current = new URL(response.url);
      candidates.push(...supportedAtsReferences(response.text, current.toString()));
      for (const link of anchors(response.text, current)) {
        const ats = normalizeSupportedAtsReference(link.url);
        const url = new URL(link.url), type = detectHiringSourceType(ats ?? link.url);
        const careers = !EDITORIAL_PATH.test(url.pathname) && (CAREER_LINK.test(link.label) || isCareerPage(url));
        if (ats || (officialHost(url) === officialHost(official) && careers)) {
          candidates.push({ url: ats ?? link.url, sourceType: type, discoveryMethod: "linked_from_website", score: ats ? 50 : 30, sourcePageUrl: current.toString(), referenceType: "anchor" });
          if (!ats && !inspected.has(link.url)) pages.unshift(link.url);
        }
      }
      if (isCareerPage(current)) candidates.push({ url: current.toString(), sourceType: "company_careers", discoveryMethod: "known_path", score: 20, sourcePageUrl: current.toString(), referenceType: "known_path" });
      if (candidates.some(candidate => ["greenhouse", "lever", "ashby"].includes(candidate.sourceType))) return rankCareerSources(candidates);
    } catch { /* Continue with other safe, same-domain candidates. */ }
  }
  try {
    const sitemap = await safeCompanyFetch(new URL("/sitemap.xml", official), {
      officialHostname: official.hostname, fetchImpl: input.fetchImpl, resolveHost: input.resolveHost,
      expectedContent: "xml", timeoutMs: 8_000, maxBytes: 1_000_000,
    });
    for (const url of sitemapLocations(sitemap.text, official)) {
      candidates.push({ url, sourceType: detectHiringSourceType(url), discoveryMethod: "known_path", score: 25, sourcePageUrl: new URL("/sitemap.xml", official).toString(), referenceType: "sitemap" });
    }
  } catch { /* A missing or unsupported sitemap is not a source-discovery failure. */ }
  return rankCareerSources(candidates);
}
