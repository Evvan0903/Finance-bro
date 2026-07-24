import { secClient } from "../../lib/sec-client";

export const dynamic = "force-dynamic";

// Cached by the SEC client for five minutes; this endpoint is diagnostic only
// and is never called as part of ordinary report rendering.
export async function GET() {
  const health = await secClient.checkHealth();
  const status = health.status === "available" ? 200 : health.status === "degraded" ? 206 : 503;
  return Response.json(health, { status });
}
