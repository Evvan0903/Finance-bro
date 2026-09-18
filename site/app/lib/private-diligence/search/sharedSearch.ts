// Server-side, run-local discovery only. Search text is never source evidence.
export type SearchProvider = "serpapi" | "tavily";
export type SearchReason = "results" | "empty" | "filteredOut" | "missingConfiguration" | "authenticationFailed" | "quotaExhausted" | "planUsageLimit" | "payAsYouGoLimit" | "rateLimited" | "upstreamUnavailable" | "timeout" | "deadlineExceeded" | "cancelled" | "invalidRequest" | "securityRejected" | "malformedResponse" | "responseTooLarge" | "budgetExhausted";
export type DiscoveryLead = {
  url: string; title: string; snippet: string | null; position: number;
  searchProvider: SearchProvider; searchRetrievedAt: string; providerRequestId?: string;
  relevanceScore?: number; publicationDateHint?: string;
};
export type SearchAttempt = { provider: SearchProvider; attempted: boolean; reason: SearchReason | "notNeeded"; httpStatus?: number; reportedCredits?: number; estimatedCredits?: number; estimatedRequests?: number };
export type SearchOutcome = { reason: SearchReason; leads: DiscoveryLead[]; attempts: SearchAttempt[]; cacheHit?: boolean };
export function createSearchSession() {
  return {
    health: new Map<SearchProvider, { reason: SearchReason; until: number }>(),
    cache: new Map<string, { expires: number; result: SearchOutcome }>(),
    pending: new Map<string, Promise<SearchOutcome>>(),
    usage: { logicalOperations: 0, outboundAttempts: 0, cacheHits: 0, reportedCredits: 0, estimatedTavilyCredits: 0, estimatedSerpApiRequests: 0 },
  };
}
export type SearchSession = ReturnType<typeof createSearchSession>;
export type SearchOptions = {
  apiKey?: string | null; tavilyApiKey?: string | null; primary?: SearchProvider;
  fetchImpl?: typeof fetch; session?: SearchSession; deadline?: number; timeoutMs?: number;
  maxAttempts?: number; reserveAttempt?: () => void; onQuery?: (query: string) => void;
};
export type SearchInput = { query: string; limit?: number; domains?: string[]; locale?: string; timeRange?: "day" | "week" | "month" | "year"; signal?: AbortSignal };
class SearchError extends Error { constructor(readonly reason: SearchReason) { super(reason); } }
const successful = (reason: SearchReason) => ["results", "empty", "filteredOut"].includes(reason);
const retryable = new Set<SearchReason>(["missingConfiguration", "authenticationFailed", "quotaExhausted", "planUsageLimit", "payAsYouGoLimit", "rateLimited", "upstreamUnavailable", "timeout"]);
export function safeDiscoveryUrl(value: string) {
  try {
    const u = new URL(value);
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password || (u.port && !["80", "443"].includes(u.port))) return null;
    if (!u.hostname.includes(".") || /(?:^|\.)(?:localhost|local|internal)$/.test(u.hostname) || /^[\d.:\[\]]+$/.test(u.hostname)) return null;
    u.hash = "";
    // Only known tracking parameters; ref/source may identify a document.
    for (const key of [...u.searchParams.keys()]) if (/^(?:utm_.+|gclid|fbclid)$/i.test(key)) u.searchParams.delete(key);
    return u.toString();
  } catch { return null; }
}
async function boundedJson(response: Response) {
  if (Number(response.headers.get("content-length")) > 1_000_000) { await response.body?.cancel(); throw new SearchError("responseTooLarge"); }
  const reader = response.body?.getReader();
  if (!reader) throw new SearchError("malformedResponse");
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 1_000_000) throw new SearchError("responseTooLarge");
      chunks.push(part.value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { const data = JSON.parse(new TextDecoder().decode(bytes)); if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(); return data as Record<string, unknown>; }
  catch { throw new SearchError("malformedResponse"); }
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
function failure(provider: SearchProvider, status: number, data: Record<string, unknown>): SearchReason | null {
  const message = typeof data.error === "string" ? data.error : "";
  if (status === 401 || status === 403) return "authenticationFailed";
  if (provider === "tavily" && status === 432) return "planUsageLimit";
  if (provider === "tavily" && status === 433) return "payAsYouGoLimit";
  if (provider === "serpapi" && !(status === 200 && record(data.search_metadata).status === "Success") && /run out|quota|searches.*(?:exceed|limit)|credits? exhausted/i.test(message)) return "quotaExhausted";
  if (status === 429) return "rateLimited";
  if (status >= 500) return "upstreamUnavailable";
  if (status >= 300) return "invalidRequest";
  if (provider === "serpapi") {
    const meta = record(data.search_metadata);
    if (meta.status === "Success") return null;
    if (/invalid.*api.?key|api.?key.*invalid|unauthorized/i.test(message)) return "authenticationFailed";
    if (data.error || (meta.status && meta.status !== "Success")) return "upstreamUnavailable";
  }
  return null;
}
export function createSharedSearch(options: SearchOptions = {}) {
  const keys = { serpapi: options.apiKey === undefined ? process.env.SERPAPI_API_KEY?.trim() : options.apiKey?.trim(), tavily: options.tavilyApiKey === undefined ? process.env.TAVILY_API_KEY?.trim() : options.tavilyApiKey?.trim() };
  const primary = options.primary ?? (process.env.CLARA_SEARCH_PRIMARY === "tavily" ? "tavily" : "serpapi");
  const order: SearchProvider[] = primary === "tavily" ? ["tavily", "serpapi"] : ["serpapi", "tavily"];
  const redact = (value: string) => Object.values(keys).reduce<string>((text, key) => key ? text.replaceAll(key, "[redacted]") : text, value);
  const session = options.session ?? createSearchSession();
  let used = 0;
  const diagnostics: SearchOutcome[] = [];
  async function search(input: SearchInput): Promise<SearchOutcome> {
    session.usage.logicalOperations++;
    const invalid = (): SearchOutcome => ({ reason: "invalidRequest", leads: [], attempts: order.map(provider => ({ provider, attempted: false, reason: "invalidRequest" })) });
    if (!input || typeof input !== "object" || (input.domains !== undefined && (!Array.isArray(input.domains) || input.domains.some(d => typeof d !== "string"))) || typeof input.query !== "string" || !input.query.trim() || input.query.length > 2000 || /[\x00-\x1f]/.test(input.query) || (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 20)) || (input.locale !== undefined && !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(input.locale)) || (input.timeRange && !["day", "week", "month", "year"].includes(input.timeRange))) return invalid();
    const sites = [...input.query.matchAll(/(?:^|\s)site:([^\s"()]+)/gi)].map(m => m[1]);
    const restrictions = [...(input.domains ?? []), ...sites];
    if (restrictions.length > 10 || restrictions.some(d => !/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s?#]*)?$/i.test(d))) return invalid();
    options.onQuery?.(input.query);
    const limit = Math.min(input.limit ?? 5, 5);
    const deadline = Math.min(options.deadline ?? Infinity, Date.now() + 2 * (options.timeoutMs ?? 8000));
    const cacheKey = JSON.stringify([input.query.trim(), restrictions, input.locale ?? "en", input.timeRange ?? null, limit, primary, order.map(p => Boolean(keys[p])), "basic-general-v1"]);
    const stop = (): SearchReason | null => input.signal?.aborted ? "cancelled" : Date.now() >= deadline ? "deadlineExceeded" : null;
    const stopped = stop();
    if (stopped) return { reason: stopped, leads: [], attempts: order.map(provider => ({ provider, attempted: false, reason: stopped })) };
    const cached = session.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) { session.usage.cacheHits++; return { ...structuredClone(cached.result), attempts: [], cacheHit: true }; }
    // A caller with cancellation owns its transport and must not cancel another caller.
    if (!input.signal && session.pending.has(cacheKey)) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          session.pending.get(cacheKey)!,
          new Promise<SearchOutcome>(resolve => { timer = setTimeout(() => resolve({ reason: "deadlineExceeded", leads: [], attempts: [] }), Math.max(1, deadline - Date.now())); }),
        ]);
        if (!successful(result.reason)) return { reason: result.reason, leads: [], attempts: [] };
        session.usage.cacheHits++;
        return { ...structuredClone(result), attempts: [], cacheHit: true };
      } finally { clearTimeout(timer); }
    }
    const run = async (): Promise<SearchOutcome> => {
      const attempts: SearchAttempt[] = []; let reason: SearchReason = "missingConfiguration";
      for (let index = 0; index < order.length; index++) {
        const provider = order[index]; const key = keys[provider];
        const stopped = stop(); if (stopped) { reason = stopped; attempts.push({ provider, attempted: false, reason }); continue; }
        if (!key) { attempts.push({ provider, attempted: false, reason: "missingConfiguration" }); continue; }
        const health = session.health.get(provider);
        if (health && health.until > Date.now()) { reason = health.reason; attempts.push({ provider, attempted: false, reason }); continue; }
        if (!options.reserveAttempt && used >= (options.maxAttempts ?? 6)) { reason = "budgetExhausted"; attempts.push({ provider, attempted: false, reason }); continue; }
        const attempt: SearchAttempt = { provider, attempted: false, reason: "upstreamUnavailable" };
        attempts.push(attempt);
        let httpStatus: number | undefined;
        try {
          const url = new URL(provider === "tavily" ? "https://api.tavily.com/search" : "https://serpapi.com/search.json");
          let init: RequestInit;
          if (provider === "tavily") {
            init = { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: input.query, search_depth: "basic", auto_parameters: false, topic: "general", max_results: limit, include_answer: false, include_raw_content: false, include_images: false, include_usage: true, ...(restrictions.length ? { include_domains: [...new Set(restrictions.map(d => d.split("/")[0]))] } : {}), ...(input.timeRange ? { time_range: input.timeRange } : {}), language: (input.locale ?? "en").split("-")[0] }) };
          } else {
            url.search = new URLSearchParams({ engine: "google", q: input.query + (input.domains?.length ? ` ${input.domains.map(d => `site:${d}`).join(" ")}` : ""), api_key: key, num: String(limit), output: "json", hl: input.locale ?? "en", safe: "active", ...(input.timeRange ? { tbs: `qdr:${input.timeRange[0]}` } : {}) }).toString();
            init = { method: "GET", headers: { Accept: "application/json" } };
          }
          const signal = AbortSignal.timeout(Math.max(1, Math.min(options.timeoutMs ?? 8000, deadline - Date.now())));
          init = { ...init, cache: "no-store", redirect: "error", signal: input.signal ? AbortSignal.any([input.signal, signal]) : signal };
          try { options.reserveAttempt?.(); } catch { throw new SearchError(Date.now() >= deadline ? "deadlineExceeded" : "budgetExhausted"); }
          used++; session.usage.outboundAttempts++; attempt.attempted = true;
          const response = await (options.fetchImpl ?? fetch)(url, init); httpStatus = response.status;
          let data: Record<string, unknown>;
          try { data = await boundedJson(response); } catch (error) {
            // Non-JSON failures retain HTTP semantics; malformed 2xx never means empty.
            const mapped = failure(provider, response.status, {});
            if (mapped) throw new SearchError(mapped); throw error;
          }
          const usage = record(data.usage).credits;
          if (typeof usage === "number" && Number.isFinite(usage) && usage >= 0) { attempt.reportedCredits = usage; session.usage.reportedCredits += usage; }
          const failed = failure(provider, response.status, data); if (failed) throw new SearchError(failed);
          let rows = provider === "tavily" ? data.results : data.organic_results;
          if (rows === undefined && provider === "serpapi" && record(data.search_metadata).status === "Success" && (typeof data.error === "string" || /empty/i.test(String(record(data.search_information).organic_results_state)))) rows = [];
          if (!Array.isArray(rows) || rows.some(v => { const r = record(v); return typeof r.title !== "string" || typeof r[provider === "tavily" ? "url" : "link"] !== "string" || [r.content, r.snippet, r.published_date].some(v => v != null && typeof v !== "string") || (r.score !== undefined && (typeof r.score !== "number" || !Number.isFinite(r.score))); })) throw new SearchError("malformedResponse");
          const retrievedAt = new Date().toISOString();
          const requestId = provider === "tavily" ? data.request_id : record(data.search_metadata).id;
          const leads: DiscoveryLead[] = []; const seen = new Set<string>();
          for (const [rank, item] of rows.entries()) {
            const r = record(item); const rawUrl = String(r[provider === "tavily" ? "url" : "link"]);
            const url = Object.values(keys).some(secret => secret && rawUrl.includes(secret)) ? null : safeDiscoveryUrl(rawUrl);
            if (!url || !String(r.title).trim() || seen.has(url)) continue;
            const target = new URL(url);
            if (restrictions.length && !restrictions.every(d => { const filter = new URL(`https://${d}`); return (target.hostname === filter.hostname || target.hostname.endsWith(`.${filter.hostname}`)) && target.pathname.startsWith(filter.pathname); })) continue;
            seen.add(url);
            const snippet = r[provider === "tavily" ? "content" : "snippet"];
            leads.push({ url, title: redact(String(r.title)).slice(0, 240), snippet: typeof snippet === "string" ? redact(snippet).slice(0, 600) : null, position: typeof r.position === "number" ? r.position : rank + 1, searchProvider: provider, searchRetrievedAt: retrievedAt, ...(typeof requestId === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(requestId) && !requestId.includes(key) ? { providerRequestId: requestId } : {}), ...(typeof r.score === "number" && Number.isFinite(r.score) ? { relevanceScore: r.score } : {}), ...(typeof r.published_date === "string" ? { publicationDateHint: redact(r.published_date).slice(0, 80) } : {}) });
          }
          reason = leads.length ? "results" : rows.length ? "filteredOut" : "empty";
          attempt.reason = reason; attempt.httpStatus = httpStatus;
          for (const remaining of order.slice(index + 1)) attempts.push({ provider: remaining, attempted: false, reason: "notNeeded" });
          const result = { reason, leads: leads.slice(0, limit), attempts };
          session.cache.set(cacheKey, { result: structuredClone(result), expires: Date.now() + (reason === "empty" ? 30_000 : 120_000) });
          if (session.cache.size > 32) session.cache.delete(session.cache.keys().next().value!);
          return result;
        } catch (error) {
          const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
          const transportReason: SearchReason = ["blockedAddress", "redirectRejected", "invalidUrl"].includes(code) ? "securityRejected"
            : code === "invalidRequest" || error instanceof SyntaxError || error instanceof ReferenceError || error instanceof RangeError ? "invalidRequest"
            : error instanceof SearchError ? error.reason
            : error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name) ? "timeout" : "upstreamUnavailable";
          reason = stop() ?? transportReason;
          attempt.reason = reason; attempt.httpStatus = httpStatus;
          if (["authenticationFailed", "quotaExhausted", "planUsageLimit", "payAsYouGoLimit", "rateLimited"].includes(reason)) session.health.set(provider, { reason, until: reason === "rateLimited" ? Date.now() + 30_000 : Infinity });
          if (!retryable.has(reason)) { for (const remaining of order.slice(index + 1)) attempts.push({ provider: remaining, attempted: false, reason }); break; }
        } finally {
          if (attempt.attempted && attempt.reportedCredits === undefined) {
            if (provider === "tavily") { attempt.estimatedCredits = 1; session.usage.estimatedTavilyCredits++; }
            else { attempt.estimatedRequests = 1; session.usage.estimatedSerpApiRequests++; }
          }
        }
      }
      return { reason, leads: [], attempts };
    };
    const pending = run(); if (!input.signal) session.pending.set(cacheKey, pending);
    try { return await pending; } finally { if (!input.signal) session.pending.delete(cacheKey); }
  }
  return { session, isConfigured: () => Boolean(keys.serpapi || keys.tavily), diagnostics,
    search: async (input: SearchInput) => { const result = await search(input); diagnostics.push(structuredClone(result)); return result; },
  };
}
export function searchProviderStatus(reason: SearchReason): import("../types").ProviderStatus {
  if (successful(reason)) return reason === "results" ? "success" : "noData";
  if (reason === "missingConfiguration") return "invalidConfiguration";
  if (reason === "authenticationFailed") return "authenticationFailed";
  if (["quotaExhausted", "planUsageLimit", "payAsYouGoLimit", "rateLimited"].includes(reason)) return "rateLimited";
  if (["timeout", "deadlineExceeded", "cancelled"].includes(reason)) return "timeout";
  if (["malformedResponse", "responseTooLarge"].includes(reason)) return "parseFailed";
  if (reason === "invalidRequest" || reason === "securityRejected") return "invalidRequest";
  return "upstreamUnavailable";
}
