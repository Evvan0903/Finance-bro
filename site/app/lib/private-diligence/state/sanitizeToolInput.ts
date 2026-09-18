import { redactPrivateDiligenceText } from "../security";

const REDACTED = "[REDACTED]";
const OMITTED = "[OMITTED]";
const SECRET_FIELD = /(?:^|_)(?:authorization|proxy_authorization|api_?key|token|access_?token|refresh_?token|cookies?|set_?cookie|password|secret|client_?secret|environment(?:_?variables)?|env)(?:$|_)/i;
const BULK_FIELD = /(?:^|_)(?:raw_?html|html|browser_?payload|page_?content|response_?body)(?:$|_)/i;

function sanitizeString(value: string) {
  return redactPrivateDiligenceText(value)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\bBasic\s+[A-Za-z0-9+/=]+/gi, "Basic [REDACTED]")
    .slice(0, 2_000);
}

function sanitizeValue(value: unknown, key: string, depth: number, seen: WeakSet<object>): unknown {
  if (SECRET_FIELD.test(key)) return REDACTED;
  if (BULK_FIELD.test(key)) return OMITTED;
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value !== "object") return String(value).slice(0, 500);
  if (depth >= 8 || seen.has(value)) return OMITTED;
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeValue(item, "", depth + 1, seen));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 100)
    .map(([childKey, childValue]) => [childKey, sanitizeValue(childValue, childKey, depth + 1, seen)]));
}

export function sanitizeToolInput(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeValue(value, "", 0, new WeakSet());
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? sanitized as Record<string, unknown>
    : { value: sanitized };
}
