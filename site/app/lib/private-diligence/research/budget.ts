/** One run-local outbound budget, shared by all Quick branches. No credentials in the audit. */
export type ResearchRequestKind = 'search' | 'page' | 'model' | 'official';
export class ResearchBudget {
  readonly startedAt = Date.now();
  readonly deadline: number;
  readonly limits = { search: 9, page: 44, model: 8, official: 8, tools: 10 };
  readonly used = { search: 0, page: 0, model: 0, official: 0, tools: 0 };
  readonly requests: { kind: ResearchRequestKind; host: string; path: string; status?: number; error?: string }[] = [];
  readonly queries: string[] = [];
  private pages = new Map<string, Promise<Response>>();
  constructor(deadline = Date.now() + 50_000) { this.deadline = deadline; }
  take(kind: keyof ResearchBudget['used']) {
    if (Date.now() >= this.deadline || this.used[kind] >= this.limits[kind]) throw new Error('RESEARCH_BUDGET_EXHAUSTED');
    this.used[kind]++;
  }
  fetch(base: typeof fetch = fetch): typeof fetch {
    return async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const kind: ResearchRequestKind = ['serpapi.com', 'api.tavily.com'].includes(url.hostname) ? 'search' : url.hostname === 'api.deepseek.com' ? 'model' : /(^|\.)(sec\.gov|usaspending\.gov)$/.test(url.hostname) ? 'official' : 'page';
      const key = url.toString();
      const reusable = kind === 'page' && (init?.method ?? 'GET') === 'GET';
      if (reusable && this.pages.has(key)) return (await this.pages.get(key)!).clone();
      this.take(kind);
      const audit: ResearchBudget['requests'][number] = { kind, host: url.hostname, path: url.pathname };
      this.requests.push(audit);
      const signal = AbortSignal.timeout(Math.max(1, Math.min(kind === 'model' ? 11_000 : 6_000, this.deadline - Date.now())));
      const pending = base(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal }).then(response => {
        audit.status = response.status; return response;
      }).catch(error => { audit.error = error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name) ? 'timeout' : 'request_failed'; throw error; });
      if (!reusable) return pending;
      this.pages.set(key, pending);
      // Cache only within this run; failed fetches remain rejected to avoid unbounded retries.
      return (await pending).clone();
    };
  }
  snapshot() { return { limits: this.limits, used: { ...this.used }, elapsedMs: Date.now() - this.startedAt, queries: [...this.queries], requests: [...this.requests] }; }
}
