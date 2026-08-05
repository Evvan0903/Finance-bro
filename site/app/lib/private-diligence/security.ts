import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const SENSITIVE_QUERY = new Set(["key", "api_key", "apikey", "token", "access_token", "secret", "userid"]);
const LOCAL_PATH = /(?:file:\/\/|\/(?:Users|home|private|var|tmp)\/)[^\s"'<>]*/gi;

export class PrivateDiligenceFetchError extends Error {
  constructor(
    readonly code:
      | "invalidUrl"
      | "blockedAddress"
      | "redirectRejected"
      | "timeout"
      | "responseTooLarge"
      | "unsupportedContentType"
      | "upstreamUnavailable",
    message: string,
  ) {
    super(message);
    this.name = "PrivateDiligenceFetchError";
  }
}

export function redactPrivateDiligenceText(value: string) {
  const output = value.replace(LOCAL_PATH, "[REDACTED_PATH]");
  try {
    const url = new URL(output);
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY.has(key.toLowerCase())) url.searchParams.set(key, "[REDACTED]");
    }
    return url.toString();
  } catch {
    return output.replace(/([?&](?:api_?key|key|token|secret|userid)=)[^&#\s]*/gi, "$1[REDACTED]");
  }
}

function blockedIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) || a >= 224;
}

export function isBlockedNetworkAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return blockedIpv4(address);
  if (version !== 6) return true;
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized.startsWith("::ffff:")) return blockedIpv4(normalized.slice(7));
  return normalized === "::" || normalized === "::1" ||
    normalized.startsWith("fc") || normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) || normalized.startsWith("2001:db8");
}

export function normalizeOfficialCompanyUrl(value: string) {
  const url = new URL(value.includes("://") ? value : `https://${value}`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new PrivateDiligenceFetchError("invalidUrl", "Company website URL is not supported");
  }
  if ((url.protocol === "https:" && url.port && url.port !== "443") ||
      (url.protocol === "http:" && url.port && url.port !== "80")) {
    throw new PrivateDiligenceFetchError("invalidUrl", "Company website uses an unsupported port");
  }
  url.hash = "";
  return url;
}

function allowedHost(hostname: string, officialHostname: string) {
  const normalize = (host: string) => host.toLowerCase().replace(/^www\./, "");
  return normalize(hostname) === normalize(officialHostname);
}

async function validatePublicHost(
  hostname: string,
  resolveHost: typeof lookup,
) {
  if (hostname === "localhost" || hostname.endsWith(".local") || isIP(hostname)) {
    if (!isIP(hostname) || isBlockedNetworkAddress(hostname)) {
      throw new PrivateDiligenceFetchError("blockedAddress", "Company website resolved to a blocked address");
    }
  }
  const addresses = await resolveHost(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isBlockedNetworkAddress(item.address))) {
    throw new PrivateDiligenceFetchError("blockedAddress", "Company website resolved to a blocked address");
  }
}

export type SafeCompanyFetchOptions = {
  officialHostname: string;
  fetchImpl?: typeof fetch;
  resolveHost?: typeof lookup;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  expectedContent?: "html" | "text";
};

export async function safeCompanyFetch(
  input: string | URL,
  options: SafeCompanyFetchOptions,
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolveHost = options.resolveHost ?? lookup;
  const timeoutMs = Math.max(1_000, Math.min(options.timeoutMs ?? 10_000, 20_000));
  const maxBytes = Math.max(1_024, Math.min(options.maxBytes ?? 1_500_000, 3_000_000));
  const maxRedirects = Math.max(0, Math.min(options.maxRedirects ?? 3, 5));
  let url = normalizeOfficialCompanyUrl(String(input));
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    if (!allowedHost(url.hostname, options.officialHostname)) {
      throw new PrivateDiligenceFetchError("redirectRejected", "Company website redirected outside the confirmed official domain");
    }
    await validatePublicHost(url.hostname, resolveHost);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        headers: { Accept: options.expectedContent === "text" ? "text/plain,*/*;q=0.1" : "text/html,application/xhtml+xml" },
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirects === maxRedirects) {
          throw new PrivateDiligenceFetchError("redirectRejected", "Company website redirect limit was reached");
        }
        url = normalizeOfficialCompanyUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok) throw new PrivateDiligenceFetchError("upstreamUnavailable", "Company website did not return a usable page");
      const contentType = response.headers.get("content-type") ?? "";
      const allowedType = options.expectedContent === "text"
        ? /text\/(?:plain|html)/i.test(contentType)
        : /text\/html|application\/xhtml\+xml/i.test(contentType);
      if (!allowedType) throw new PrivateDiligenceFetchError("unsupportedContentType", "Company website response was not HTML");
      const declaredLength = Number(response.headers.get("content-length") ?? 0);
      if (declaredLength > maxBytes) throw new PrivateDiligenceFetchError("responseTooLarge", "Company website response exceeded the size limit");
      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > maxBytes) {
        throw new PrivateDiligenceFetchError("responseTooLarge", "Company website response exceeded the size limit");
      }
      return { url: url.toString(), text, contentType };
    } catch (error) {
      if (error instanceof PrivateDiligenceFetchError) throw error;
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw new PrivateDiligenceFetchError("timeout", "Company website request timed out");
      }
      throw new PrivateDiligenceFetchError("upstreamUnavailable", "Company website request failed");
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new PrivateDiligenceFetchError("redirectRejected", "Company website redirect limit was reached");
}

export function robotsDisallows(robotsText: string, path: string) {
  const lines = robotsText.split(/\r?\n/).map((line) => line.replace(/#.*$/, "").trim());
  let applies = false;
  for (const line of lines) {
    const [field, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (field?.toLowerCase() === "user-agent") applies = value === "*";
    if (applies && field?.toLowerCase() === "disallow" && value && path.startsWith(value)) return true;
  }
  return false;
}
