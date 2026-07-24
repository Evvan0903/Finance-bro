import { MemoryCache } from "./cache";

export type SecPipelineStage =
  | "input_validation"
  | "ticker_resolution"
  | "submissions"
  | "company_facts"
  | "filing_retrieval"
  | "filing_parse"
  | "sector_detection"
  | "metric_normalization"
  | "report_initialization"
  | "health_check";

export type ResearchErrorCode =
  | "INVALID_INPUT"
  | "TICKER_NOT_FOUND"
  | "AMBIGUOUS_TICKER"
  | "CIK_RESOLUTION_FAILED"
  | "SEC_FORBIDDEN"
  | "SEC_RATE_LIMITED"
  | "SEC_TIMEOUT"
  | "SEC_SERVICE_UNAVAILABLE"
  | "SUBMISSIONS_NOT_FOUND"
  | "COMPANY_FACTS_NOT_FOUND"
  | "NO_STANDARDIZED_XBRL_FACTS"
  | "FILING_NOT_FOUND"
  | "FILING_PARSE_FAILED"
  | "UNSUPPORTED_REPORTING_ENTITY"
  | "UNSUPPORTED_SECTOR_PACK"
  | "SECTOR_CLASSIFICATION_CONFLICT"
  | "INSUFFICIENT_VERIFIED_METRICS"
  | "INTERNAL_PIPELINE_ERROR";

export type SecRequestDiagnostic = {
  endpointCategory: "ticker_map" | "submissions" | "company_facts" | "filing" | "health";
  url: string;
  httpStatus: number | null;
  retryCount: number;
  cacheHit: boolean;
  elapsedMs: number;
};

export type SecCompanyRecord = {
  cik: string;
  cikNumber: number;
  ticker: string;
  title: string;
  exchange: string | null;
  reportingStatus: "SEC reporting company";
  resolvedAt: string;
  mappingSource:
    | "sec-company-tickers-exchange"
    | "bundled-supported-sec-identities";
};

export type SecTickerCandidate = {
  ticker: string;
  title: string;
  cik: string;
  exchange: string | null;
};

export type SecClientErrorOptions = {
  code: ResearchErrorCode;
  stage: SecPipelineStage;
  diagnostic: string;
  retryable?: boolean;
  httpStatus?: number | null;
  endpointCategory?: SecRequestDiagnostic["endpointCategory"];
  matchDetails?: SecTickerCandidate[];
  details?: Record<string, string | number | boolean | null>;
  cause?: unknown;
};

export class SecClientError extends Error {
  readonly code: ResearchErrorCode;
  readonly stage: SecPipelineStage;
  readonly diagnostic: string;
  readonly retryable: boolean;
  readonly httpStatus: number | null;
  readonly endpointCategory?: SecRequestDiagnostic["endpointCategory"];
  readonly matchDetails?: SecTickerCandidate[];
  readonly details?: Record<string, string | number | boolean | null>;

  constructor(options: SecClientErrorOptions) {
    super(options.code, { cause: options.cause });
    this.name = "SecClientError";
    this.code = options.code;
    this.stage = options.stage;
    this.diagnostic = options.diagnostic;
    this.retryable = options.retryable ?? false;
    this.httpStatus = options.httpStatus ?? null;
    this.endpointCategory = options.endpointCategory;
    this.matchDetails = options.matchDetails;
    this.details = options.details;
  }
}

type SecExchangePayload = {
  fields?: string[];
  data?: Array<Array<string | number | null>>;
};

export type SecTickerRow = {
  cikNumber: number;
  ticker: string;
  title: string;
  exchange: string | null;
};

type FetchLike = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;
type Now = () => number;

type SecClientOptions = {
  fetchImpl?: FetchLike;
  sleep?: Sleep;
  now?: Now;
  userAgent?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  minimumIntervalMs?: number;
};

type RequestOptions = {
  endpointCategory: SecRequestDiagnostic["endpointCategory"];
  stage: SecPipelineStage;
  cacheTtlMs?: number;
  diagnostics?: SecRequestDiagnostic[];
  responseType?: "json" | "text";
};

const SEC_RESPONSE_TTL_MS = 6 * 60 * 60 * 1000;
const SEC_TICKER_TTL_MS = 24 * 60 * 60 * 1000;
const SEC_HEALTH_TTL_MS = 5 * 60 * 1000;
const SEC_TICKER_MAP_URL =
  "https://www.sec.gov/files/company_tickers_exchange.json";

const COMPANY_ALIASES: Record<string, string> = {
  apple: "AAPL",
  "apple inc": "AAPL",
  amazon: "AMZN",
  berkshire: "BRK-B",
  facebook: "META",
  google: "GOOGL",
  "jp morgan": "JPM",
  jpmorgan: "JPM",
  "eli lilly": "LLY",
  lilly: "LLY",
  meta: "META",
  nvidia: "NVDA",
  shell: "SHEL",
};

// These accepted-company identities are a disclosed availability fallback.
// Every other issuer is resolved from the current SEC ticker association file.
export const SUPPORTED_TICKER_RECORDS: SecTickerRow[] = [
  { cikNumber: 320193, ticker: "AAPL", title: "Apple Inc.", exchange: "Nasdaq" },
  { cikNumber: 1306965, ticker: "SHEL", title: "Shell plc", exchange: "NYSE" },
  { cikNumber: 34088, ticker: "XOM", title: "Exxon Mobil Corp", exchange: "NYSE" },
  { cikNumber: 93410, ticker: "CVX", title: "Chevron Corp", exchange: "NYSE" },
  { cikNumber: 313807, ticker: "BP", title: "BP p.l.c.", exchange: "NYSE" },
  { cikNumber: 879764, ticker: "TTE", title: "TotalEnergies SE", exchange: "NYSE" },
  { cikNumber: 1045810, ticker: "NVDA", title: "NVIDIA Corp", exchange: "Nasdaq" },
  { cikNumber: 2488, ticker: "AMD", title: "Advanced Micro Devices Inc", exchange: "Nasdaq" },
  { cikNumber: 1730168, ticker: "AVGO", title: "Broadcom Inc", exchange: "Nasdaq" },
  { cikNumber: 50863, ticker: "INTC", title: "Intel Corp", exchange: "Nasdaq" },
  { cikNumber: 1046179, ticker: "TSM", title: "Taiwan Semiconductor Manufacturing Co Ltd", exchange: "NYSE" },
  { cikNumber: 19617, ticker: "JPM", title: "JPMorgan Chase & Co", exchange: "NYSE" },
  { cikNumber: 70858, ticker: "BAC", title: "Bank of America Corp", exchange: "NYSE" },
  { cikNumber: 831001, ticker: "C", title: "Citigroup Inc", exchange: "NYSE" },
  { cikNumber: 72971, ticker: "WFC", title: "Wells Fargo & Co", exchange: "NYSE" },
  { cikNumber: 886982, ticker: "GS", title: "Goldman Sachs Group Inc", exchange: "NYSE" },
  { cikNumber: 59478, ticker: "LLY", title: "Eli Lilly and Co", exchange: "NYSE" },
  { cikNumber: 310158, ticker: "MRK", title: "Merck & Co Inc", exchange: "NYSE" },
  { cikNumber: 78003, ticker: "PFE", title: "Pfizer Inc", exchange: "NYSE" },
  { cikNumber: 1551152, ticker: "ABBV", title: "AbbVie Inc", exchange: "NYSE" },
  { cikNumber: 14272, ticker: "BMY", title: "Bristol-Myers Squibb Co", exchange: "NYSE" },
  { cikNumber: 18230, ticker: "CAT", title: "Caterpillar Inc", exchange: "NYSE" },
  { cikNumber: 315189, ticker: "DE", title: "Deere & Co", exchange: "NYSE" },
  { cikNumber: 26172, ticker: "CMI", title: "Cummins Inc", exchange: "NYSE" },
  { cikNumber: 75362, ticker: "PCAR", title: "PACCAR Inc", exchange: "Nasdaq" },
  { cikNumber: 97216, ticker: "TEX", title: "Terex Corp", exchange: "NYSE" },
];

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function normalizeCompanyName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(incorporated|inc|corp|corporation|company|co|plc|limited|ltd|holdings?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeTickerInput(value: string) {
  return value
    .trim()
    .replace(/^\$/, "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[./]/g, "-");
}

export function padCik(value: string | number) {
  const digits = String(value).replace(/\D/g, "");
  if (!digits || digits.length > 10) {
    throw new SecClientError({
      code: "CIK_RESOLUTION_FAILED",
      stage: "ticker_resolution",
      diagnostic: "Resolved ticker record did not contain a valid SEC CIK.",
    });
  }
  return digits.padStart(10, "0");
}

function tickerCandidate(row: SecTickerRow): SecTickerCandidate {
  return {
    ticker: row.ticker,
    title: row.title,
    cik: padCik(row.cikNumber),
    exchange: row.exchange,
  };
}

function dedupeRows(rows: SecTickerRow[], identity: "ticker-cik" | "cik") {
  const unique = new Map<string, SecTickerRow>();
  for (const row of rows) {
    const normalizedTicker = normalizeTickerInput(row.ticker);
    const key = identity === "ticker-cik"
      ? `${normalizedTicker}|${padCik(row.cikNumber)}`
      : padCik(row.cikNumber);
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, { ...row, ticker: normalizedTicker });
      continue;
    }
    unique.set(key, {
      ...existing,
      title: existing.title.length <= row.title.length ? existing.title : row.title,
      exchange: existing.exchange ?? row.exchange,
    });
  }
  return [...unique.values()];
}

export function resolveCompanyFromRows(input: string, rows: SecTickerRow[]) {
  const raw = input.trim();
  const normalizedName = normalizeCompanyName(raw);
  const aliasTicker = COMPANY_ALIASES[normalizedName];
  const normalizedTicker = aliasTicker ?? normalizeTickerInput(raw);
  const looksLikeTicker = /^[A-Z][A-Z0-9-]{0,9}$/.test(normalizedTicker);
  if (looksLikeTicker) {
    const exactTickerMatches = dedupeRows(
      rows.filter((row) => normalizeTickerInput(row.ticker) === normalizedTicker),
      "ticker-cik",
    );
    if (exactTickerMatches.length === 1) return exactTickerMatches[0];
    if (exactTickerMatches.length > 1) {
      throw new SecClientError({
        code: "AMBIGUOUS_TICKER",
        stage: "ticker_resolution",
        diagnostic: `Exact ticker ${normalizedTicker} maps to multiple distinct SEC CIKs.`,
        matchDetails: exactTickerMatches.slice(0, 8).map(tickerCandidate),
      });
    }
  }
  const exactNameMatches = dedupeRows(
    rows.filter((row) => normalizeCompanyName(row.title) === normalizedName),
    "cik",
  );
  const controlledMatches = exactNameMatches.length
    ? exactNameMatches
    : dedupeRows(
        rows.filter((row) => {
          const title = normalizeCompanyName(row.title);
          return normalizedName.length >= 3 && title.startsWith(normalizedName);
        }),
        "cik",
      );
  if (!controlledMatches.length) {
    throw new SecClientError({
      code: "TICKER_NOT_FOUND",
      stage: "ticker_resolution",
      diagnostic: `No SEC ticker association matched normalized input "${normalizedTicker}".`,
    });
  }
  if (controlledMatches.length > 1) {
    throw new SecClientError({
      code: "AMBIGUOUS_TICKER",
      stage: "ticker_resolution",
      diagnostic: `Multiple SEC reporting identities matched "${normalizedName}".`,
      matchDetails: controlledMatches.slice(0, 8).map(tickerCandidate),
    });
  }
  return controlledMatches[0];
}

function errorForHttpStatus(
  status: number,
  options: Pick<RequestOptions, "stage" | "endpointCategory">,
  url: string,
) {
  if (status === 403) {
    return new SecClientError({
      code: "SEC_FORBIDDEN",
      stage: options.stage,
      diagnostic: `SEC rejected the server request for ${options.endpointCategory} with HTTP 403.`,
      retryable: false,
      httpStatus: status,
      endpointCategory: options.endpointCategory,
    });
  }
  if (status === 429) {
    return new SecClientError({
      code: "SEC_RATE_LIMITED",
      stage: options.stage,
      diagnostic: `SEC rate-limited the server request for ${options.endpointCategory}.`,
      retryable: true,
      httpStatus: status,
      endpointCategory: options.endpointCategory,
    });
  }
  if (status === 404) {
    const code =
      options.endpointCategory === "submissions"
        ? "SUBMISSIONS_NOT_FOUND"
        : options.endpointCategory === "company_facts"
          ? "COMPANY_FACTS_NOT_FOUND"
          : options.endpointCategory === "filing"
            ? "FILING_NOT_FOUND"
            : "SEC_SERVICE_UNAVAILABLE";
    return new SecClientError({
      code,
      stage: options.stage,
      diagnostic: `SEC returned HTTP 404 for ${options.endpointCategory}: ${new URL(url).pathname}.`,
      retryable: false,
      httpStatus: status,
      endpointCategory: options.endpointCategory,
    });
  }
  return new SecClientError({
    code: "SEC_SERVICE_UNAVAILABLE",
    stage: options.stage,
    diagnostic: `SEC returned HTTP ${status} for ${options.endpointCategory}.`,
    retryable: status >= 500,
    httpStatus: status,
    endpointCategory: options.endpointCategory,
  });
}

export class SecClient {
  private readonly fetchImpl: FetchLike;
  private readonly sleep: Sleep;
  private readonly now: Now;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly minimumIntervalMs: number;
  private readonly headers: Record<string, string>;
  private readonly responseCache = new MemoryCache<unknown>(SEC_RESPONSE_TTL_MS);
  private readonly tickerCache = new MemoryCache<SecTickerRow[]>(SEC_TICKER_TTL_MS);
  private readonly healthCache = new MemoryCache<SecHealthResult>(SEC_HEALTH_TTL_MS);
  private lastRequestStartedAt = 0;
  private throttleQueue: Promise<void> = Promise.resolve();

  constructor(options: SecClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? delay;
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 3, 4));
    this.minimumIntervalMs = Math.max(options.minimumIntervalMs ?? 125, 110);
    this.headers = {
      Accept: "application/json, text/html;q=0.9, */*;q=0.8",
      "Accept-Encoding": "gzip, deflate",
      "User-Agent":
        options.userAgent ??
        process.env.SEC_USER_AGENT ??
        "FinBro research-ops@example.com",
    };
  }

  private async throttle() {
    const run = this.throttleQueue.then(async () => {
      const waitMs = Math.max(
        0,
        this.lastRequestStartedAt + this.minimumIntervalMs - this.now(),
      );
      if (waitMs > 0) await this.sleep(waitMs);
      this.lastRequestStartedAt = this.now();
    });
    this.throttleQueue = run.catch(() => undefined);
    await run;
  }

  private async fetchWithPolicy<T>(
    url: string,
    options: RequestOptions,
  ): Promise<T> {
    const startedAt = this.now();
    let lastError: SecClientError | null = null;

    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      await this.throttle();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          headers: this.headers,
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const retryableStatus = response.status === 429 || response.status >= 500;
        if (!response.ok) {
          lastError = errorForHttpStatus(response.status, options, url);
          if (!retryableStatus || attempt === this.maxAttempts - 1) throw lastError;
          const retryAfter = Number(response.headers.get("retry-after"));
          const backoff = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1_000, 10_000)
            : Math.min(250 * 2 ** attempt + Math.floor(Math.random() * 125), 4_000);
          await this.sleep(backoff);
          continue;
        }
        options.diagnostics?.push({
          endpointCategory: options.endpointCategory,
          url: new URL(url).pathname,
          httpStatus: response.status,
          retryCount: attempt,
          cacheHit: false,
          elapsedMs: this.now() - startedAt,
        });
        return (options.responseType === "text"
          ? await response.text()
          : await response.json()) as T;
      } catch (error) {
        clearTimeout(timeout);
        if (error instanceof SecClientError) throw error;
        const timedOut =
          controller.signal.aborted ||
          (error instanceof Error && /abort|timeout/i.test(error.message));
        lastError = new SecClientError({
          code: timedOut ? "SEC_TIMEOUT" : "SEC_SERVICE_UNAVAILABLE",
          stage: options.stage,
          diagnostic: timedOut
            ? `SEC request timed out after ${this.timeoutMs}ms for ${options.endpointCategory}.`
            : `Server-side SEC request failed for ${options.endpointCategory}.`,
          retryable: true,
          endpointCategory: options.endpointCategory,
          cause: error,
        });
        if (attempt === this.maxAttempts - 1) throw lastError;
        await this.sleep(
          Math.min(250 * 2 ** attempt + Math.floor(Math.random() * 125), 4_000),
        );
      }
    }
    throw lastError ?? new SecClientError({
      code: "SEC_SERVICE_UNAVAILABLE",
      stage: options.stage,
      diagnostic: "SEC request failed without a response.",
      retryable: true,
      endpointCategory: options.endpointCategory,
    });
  }

  private async cachedRequest<T>(url: string, options: RequestOptions): Promise<T> {
    let loaded = false;
    const cacheKey = `${options.responseType ?? "json"}:${url}`;
    const value = await this.responseCache.getOrLoad(cacheKey, async () => {
      loaded = true;
      return this.fetchWithPolicy<T>(url, options);
    });
    if (!loaded) {
      options.diagnostics?.push({
        endpointCategory: options.endpointCategory,
        url: new URL(url).pathname,
        httpStatus: 200,
        retryCount: 0,
        cacheHit: true,
        elapsedMs: 0,
      });
    }
    return value as T;
  }

  private async tickerRows(diagnostics?: SecRequestDiagnostic[]) {
    return this.tickerCache.getOrLoad("sec-company-tickers-exchange", async () => {
      const payload = await this.cachedRequest<SecExchangePayload>(
        SEC_TICKER_MAP_URL,
        {
          endpointCategory: "ticker_map",
          stage: "ticker_resolution",
          diagnostics,
        },
      );
      const fields = payload.fields ?? [];
      const cikIndex = fields.indexOf("cik");
      const nameIndex = fields.indexOf("name");
      const tickerIndex = fields.indexOf("ticker");
      const exchangeIndex = fields.indexOf("exchange");
      if ([cikIndex, nameIndex, tickerIndex].some((index) => index < 0)) {
        throw new SecClientError({
          code: "CIK_RESOLUTION_FAILED",
          stage: "ticker_resolution",
          diagnostic: "SEC ticker association payload did not contain the expected fields.",
        });
      }
      return (payload.data ?? [])
        .map((row): SecTickerRow | null => {
          const cikNumber = Number(row[cikIndex]);
          const ticker = String(row[tickerIndex] ?? "").toUpperCase();
          const title = String(row[nameIndex] ?? "").trim();
          if (!Number.isInteger(cikNumber) || !ticker || !title) return null;
          return {
            cikNumber,
            ticker: normalizeTickerInput(ticker),
            title,
            exchange:
              exchangeIndex >= 0 && row[exchangeIndex]
                ? String(row[exchangeIndex])
                : null,
          };
        })
        .filter((row): row is SecTickerRow => row !== null);
    });
  }

  async resolveCompany(
    input: string,
    diagnostics: SecRequestDiagnostic[] = [],
  ): Promise<SecCompanyRecord> {
    const raw = input.trim();
    if (raw.length < 2 || raw.length > 100) {
      throw new SecClientError({
        code: "INVALID_INPUT",
        stage: "input_validation",
        diagnostic: "Company input must contain between 2 and 100 characters.",
      });
    }
    const normalizedName = normalizeCompanyName(raw);
    const aliasTicker = COMPANY_ALIASES[normalizedName];
    const normalizedTicker = aliasTicker ?? normalizeTickerInput(raw);
    const supportedMatch = SUPPORTED_TICKER_RECORDS.find(
      (row) =>
        row.ticker === normalizedTicker ||
        normalizeCompanyName(row.title) === normalizedName,
    );
    if (supportedMatch) {
      return {
        cik: padCik(supportedMatch.cikNumber),
        cikNumber: supportedMatch.cikNumber,
        ticker: supportedMatch.ticker,
        title: supportedMatch.title,
        exchange: supportedMatch.exchange,
        reportingStatus: "SEC reporting company",
        resolvedAt: new Date(this.now()).toISOString(),
        mappingSource: "bundled-supported-sec-identities",
      };
    }

    let rows: SecTickerRow[];
    const mappingSource: SecCompanyRecord["mappingSource"] =
      "sec-company-tickers-exchange";
    try {
      rows = await this.tickerRows(diagnostics);
    } catch (error) {
      throw error;
    }

    const selected = resolveCompanyFromRows(input, rows);
    return {
      cik: padCik(selected.cikNumber),
      cikNumber: selected.cikNumber,
      ticker: selected.ticker,
      title: selected.title,
      exchange: selected.exchange,
      reportingStatus: "SEC reporting company",
      resolvedAt: new Date(this.now()).toISOString(),
      mappingSource,
    };
  }

  async getSubmissions<T>(
    cik: string,
    diagnostics: SecRequestDiagnostic[] = [],
  ) {
    return this.cachedRequest<T>(
      `https://data.sec.gov/submissions/CIK${padCik(cik)}.json`,
      {
        endpointCategory: "submissions",
        stage: "submissions",
        diagnostics,
      },
    );
  }

  async getCompanyFacts<T>(
    cik: string,
    diagnostics: SecRequestDiagnostic[] = [],
  ) {
    return this.cachedRequest<T>(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`,
      {
        endpointCategory: "company_facts",
        stage: "company_facts",
        diagnostics,
      },
    );
  }

  async getFilingDocument(
    url: string,
    diagnostics: SecRequestDiagnostic[] = [],
  ) {
    if (!url.startsWith("https://www.sec.gov/Archives/")) {
      throw new SecClientError({
        code: "FILING_NOT_FOUND",
        stage: "filing_retrieval",
        diagnostic: "Filing URL was outside the official SEC Archives host.",
      });
    }
    return this.cachedRequest<string>(url, {
      endpointCategory: "filing",
      stage: "filing_retrieval",
      diagnostics,
      responseType: "text",
    });
  }

  async checkHealth(): Promise<SecHealthResult> {
    return this.healthCache.getOrLoad("sec-health", async () => {
      const diagnostics: SecRequestDiagnostic[] = [];
      const checks: SecHealthResult["checks"] = {
        backend: "ok",
        tickerMap: "unknown",
        submissions: "unknown",
        companyFacts: "unknown",
      };
      try {
        await this.tickerRows(diagnostics);
        checks.tickerMap = "ok";
        await this.getSubmissions("0000320193", diagnostics);
        checks.submissions = "ok";
        await this.getCompanyFacts("0000320193", diagnostics);
        checks.companyFacts = "ok";
        return {
          status: "available",
          checkedAt: new Date(this.now()).toISOString(),
          checks,
          diagnostics,
        };
      } catch (error) {
        const secError = toSecClientError(error, "health_check");
        if (secError.code === "SEC_RATE_LIMITED") {
          checks.tickerMap = checks.tickerMap === "unknown" ? "rate_limited" : checks.tickerMap;
          checks.submissions = checks.submissions === "unknown" ? "rate_limited" : checks.submissions;
          checks.companyFacts = checks.companyFacts === "unknown" ? "rate_limited" : checks.companyFacts;
        }
        return {
          status:
            checks.tickerMap === "ok" ||
              checks.submissions === "ok" ||
              checks.companyFacts === "ok"
              ? "degraded"
              : "unavailable",
          checkedAt: new Date(this.now()).toISOString(),
          checks,
          diagnostics,
          errorCode: secError.code,
        };
      }
    });
  }
}

export type SecHealthResult = {
  status: "available" | "degraded" | "unavailable";
  checkedAt: string;
  checks: {
    backend: "ok";
    tickerMap: "ok" | "rate_limited" | "unknown";
    submissions: "ok" | "rate_limited" | "unknown";
    companyFacts: "ok" | "rate_limited" | "unknown";
  };
  diagnostics: SecRequestDiagnostic[];
  errorCode?: ResearchErrorCode;
};

export function toSecClientError(
  error: unknown,
  stage: SecPipelineStage,
) {
  if (error instanceof SecClientError) return error;
  return new SecClientError({
    code: "INTERNAL_PIPELINE_ERROR",
    stage,
    diagnostic: "The research pipeline failed outside the classified SEC request path.",
    retryable: false,
    cause: error,
  });
}

export const secClient = new SecClient();
