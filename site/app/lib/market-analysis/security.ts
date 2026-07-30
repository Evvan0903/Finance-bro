const SECRET_QUERY_KEYS = new Set([
  "api_key",
  "apikey",
  "key",
  "userid",
  "user_id",
]);

const OFFICIAL_HOSTS = new Set([
  "api.stlouisfed.org",
  "fred.stlouisfed.org",
  "apps.bea.gov",
  "bea.gov",
  "www.bea.gov",
  "api.census.gov",
  "census.gov",
  "www.census.gov",
  "data.sec.gov",
  "sec.gov",
  "www.sec.gov",
  "api.bls.gov",
  "bls.gov",
  "www.bls.gov",
  "api.worldbank.org",
  "worldbank.org",
  "www.worldbank.org",
  "data.worldbank.org",
  "api.congress.gov",
  "congress.gov",
  "www.congress.gov",
  "api.govinfo.gov",
  "govinfo.gov",
  "www.govinfo.gov",
]);

export type SafeFetchOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  cacheTtlMs?: number;
};

export class MarketProviderError extends Error {
  readonly code:
    | "invalidConfiguration"
    | "rateLimited"
    | "temporarilyUnavailable"
    | "invalidRequest"
    | "malformedResponse";
  readonly providerStatus: "invalid" | "rateLimited" | "temporarilyUnavailable";
  readonly httpStatus: number | null;

  constructor(
    code: MarketProviderError["code"],
    message: string,
    httpStatus: number | null = null,
  ) {
    super(message);
    this.name = "MarketProviderError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.providerStatus =
      code === "rateLimited"
        ? "rateLimited"
        : code === "invalidConfiguration"
          ? "invalid"
          : "temporarilyUnavailable";
  }
}

type OfficialCacheEntry = { expiresAt: number; value: unknown };

declare global {
  var __finbroOfficialDataCache: Map<string, OfficialCacheEntry> | undefined;
}

const officialDataCache =
  globalThis.__finbroOfficialDataCache ??
  (globalThis.__finbroOfficialDataCache = new Map<string, OfficialCacheEntry>());

export function redactUrl(value: string) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (SECRET_QUERY_KEYS.has(key.toLowerCase())) url.searchParams.set(key, "[REDACTED]");
    }
    return url.toString();
  } catch {
    return value.replace(
      /([?&](?:api_?key|key|userid|user_id)=)[^&\s]+/gi,
      "$1[REDACTED]",
    );
  }
}

export function sanitizeSecrets<T>(value: T, secrets: Array<string | null> = []): T {
  const activeSecrets = secrets.filter((item): item is string => Boolean(item));
  const serialized = JSON.stringify(value, (key, entry) => {
    if (SECRET_QUERY_KEYS.has(key.toLowerCase())) return "[REDACTED]";
    if (/authorization|x-api-key/i.test(key)) return "[REDACTED]";
    return entry;
  });
  let sanitized = redactUrl(serialized);
  for (const secret of activeSecrets) sanitized = sanitized.replaceAll(secret, "[REDACTED]");
  return JSON.parse(sanitized) as T;
}

export function assertOfficialUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !OFFICIAL_HOSTS.has(url.hostname)) {
    throw new MarketProviderError(
      "invalidRequest",
      "Provider request was outside the approved official-domain allowlist.",
    );
  }
  return url;
}

export async function fetchOfficialJson<T>(
  urlValue: string,
  options: SafeFetchOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const url = assertOfficialUrl(urlValue);
  const cacheKey = stableRequestSignature("official-json", {
    method: options.method ?? "GET",
    url: redactUrl(url.toString()),
    body: options.body ?? "",
  });
  const cached = officialDataCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return structuredClone(cached.value) as T;
  const controller = new AbortController();
  const timeoutMs = Math.max(1_000, Math.min(options.timeoutMs ?? 15_000, 30_000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.headers ?? {}),
      },
      body: options.body,
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (response.status === 429) {
      throw new MarketProviderError("rateLimited", "Official provider rate limit reached.", 429);
    }
    if (response.status === 401 || response.status === 403) {
      throw new MarketProviderError(
        "invalidConfiguration",
        "Official provider rejected its server-side configuration.",
        response.status,
      );
    }
    if (!response.ok) {
      throw new MarketProviderError(
        response.status >= 500 ? "temporarilyUnavailable" : "invalidRequest",
        `Official provider returned HTTP ${response.status}.`,
        response.status,
      );
    }
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    const maxBytes = options.maxBytes ?? 4_000_000;
    if (declaredLength > maxBytes) {
      throw new MarketProviderError("malformedResponse", "Official response exceeded the size limit.");
    }
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new MarketProviderError("malformedResponse", "Official response exceeded the size limit.");
    }
    try {
      const parsed = JSON.parse(text) as T;
      const ttl = Math.max(0, options.cacheTtlMs ?? 60 * 60 * 1_000);
      if (ttl > 0) {
        officialDataCache.set(cacheKey, {
          expiresAt: Date.now() + ttl,
          value: structuredClone(parsed),
        });
      }
      return parsed;
    } catch {
      throw new MarketProviderError("malformedResponse", "Official provider returned malformed JSON.");
    }
  } catch (error) {
    if (error instanceof MarketProviderError) throw error;
    if (controller.signal.aborted) {
      throw new MarketProviderError(
        "temporarilyUnavailable",
        `Official provider request timed out after ${timeoutMs}ms.`,
      );
    }
    throw new MarketProviderError(
      "temporarilyUnavailable",
      "Official provider request failed before a usable response was received.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function stableRequestSignature(
  provider: string,
  parameters: Record<string, string | number | boolean | null | undefined>,
) {
  return [
    provider,
    ...Object.entries(parameters)
      .filter(([key, value]) => value !== undefined && !SECRET_QUERY_KEYS.has(key.toLowerCase()))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${String(value)}`),
  ].join("|");
}
