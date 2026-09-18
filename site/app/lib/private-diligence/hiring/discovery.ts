import { safeCompanyFetch } from "../security";
import { detectHiringSourceType, rankCareerSources } from "./core";
import type { CareerSourceCandidate } from "./types";

const CAREER_PATHS = ["/careers", "/jobs", "/company/careers"];
const CAREER_LINK = /\b(careers?|jobs?|join us|open roles|openings)\b/i;

function anchors(html: string, base: URL) {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap((match) => {
    const label = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    try { return [{ url: new URL(match[1], base).toString(), label }]; } catch { return []; }
  });
}

function sitemapLocations(xml: string, official: URL) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].flatMap((match) => {
    try {
      const url = new URL(match[1]);
      if (url.hostname.toLowerCase().replace(/^www\./, "") !== official.hostname.toLowerCase().replace(/^www\./, "")) return [];
      return CAREER_LINK.test(url.pathname) ? [url.toString()] : [];
    } catch { return []; }
  });
}

export async function discoverCareerSources(input: { officialUrl: string; fetchImpl?: typeof fetch; resolveHost?: Parameters<typeof safeCompanyFetch>[1]["resolveHost"] }) {
  const official = new URL(input.officialUrl);
  const candidates: CareerSourceCandidate[] = [];
  const pages = [official.toString(), ...CAREER_PATHS.map((path) => new URL(path, official).toString())];
  for (const page of pages) {
    try {
      const response = await safeCompanyFetch(page, { officialHostname: official.hostname, fetchImpl: input.fetchImpl, resolveHost: input.resolveHost, timeoutMs: 8_000, maxBytes: 1_000_000 });
      const current = new URL(response.url);
      for (const link of anchors(response.text, current)) {
        const type = detectHiringSourceType(link.url);
        if (type !== "company_careers" || CAREER_LINK.test(link.label) || CAREER_LINK.test(new URL(link.url).pathname)) {
          candidates.push({ url: link.url, sourceType: type, discoveryMethod: "linked_from_website", score: type === "company_careers" ? 30 : 50 });
        }
      }
      if (CAREER_LINK.test(current.pathname)) candidates.push({ url: current.toString(), sourceType: "company_careers", discoveryMethod: "known_path", score: 20 });
    } catch { /* Continue with other safe, same-domain candidates. */ }
  }
  try {
    const sitemap = await safeCompanyFetch(new URL("/sitemap.xml", official), {
      officialHostname: official.hostname, fetchImpl: input.fetchImpl, resolveHost: input.resolveHost,
      expectedContent: "xml", timeoutMs: 8_000, maxBytes: 1_000_000,
    });
    for (const url of sitemapLocations(sitemap.text, official)) {
      candidates.push({ url, sourceType: detectHiringSourceType(url), discoveryMethod: "known_path", score: 25 });
    }
  } catch { /* A missing or unsupported sitemap is not a source-discovery failure. */ }
  return rankCareerSources(candidates);
}
