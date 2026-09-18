export type RequestKind = "search" | "fetch" | "sec" | "model";
export class FundingBudget {
  private readonly pages = new Map<string, Promise<Response>>();
  readonly used = { search: 0, fetch: 0, sec: 0, model: 0 };
  readonly limits: Record<RequestKind, number>;
  readonly deadline: number;
  constructor(private options: { baseFetch?: typeof fetch; deadline?: number; limits?: Partial<Record<RequestKind, number>> } = {}) {
    const cap = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(fallback, Math.floor(value))) : fallback;
    const configured = (name: string, fallback: number) => process.env[name] ? cap(Number(process.env[name]), fallback) : fallback;
    this.deadline = Math.min(options.deadline ?? Infinity, Date.now() + configured("CLARA_FUNDING_DEADLINE_MS", 24_000));
    this.limits = {
      search: cap(options.limits?.search, configured("CLARA_FUNDING_SEARCH_CAP", 4)),
      fetch: cap(options.limits?.fetch, configured("CLARA_FUNDING_FETCH_CAP", 6)),
      sec: cap(options.limits?.sec, configured("CLARA_FUNDING_SEC_CAP", 6)),
      model: cap(options.limits?.model, configured("CLARA_FUNDING_MODEL_CAP", 4)),
    };
  }
  take(kind: RequestKind) {
    if (Date.now() >= this.deadline || this.used[kind] >= this.limits[kind]) throw new Error("FUNDING_BUDGET_EXHAUSTED");
    this.used[kind]++;
  }
  fetch = (base: typeof fetch = this.options.baseFetch ?? fetch): typeof fetch => async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const kind = ["serpapi.com", "api.tavily.com"].includes(url.hostname) ? "search" : /(^|\.)sec.gov$/.test(url.hostname) ? "sec" : url.hostname === "api.deepseek.com" ? "model" : "fetch";
    const key = url.toString();
    if (kind === "fetch" && this.pages.has(key)) return (await this.pages.get(key)!).clone();
    this.take(kind);
    const signal = AbortSignal.timeout(Math.max(1, Math.min(kind === "model" ? 10000 : 6000, this.deadline - Date.now())));
    const pending = base(input, { ...init, signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal });
    if (kind !== "fetch") return pending;
    this.pages.set(key, pending);
    try { return (await pending).clone(); } catch (error) { this.pages.delete(key); throw error; }
  };
}
