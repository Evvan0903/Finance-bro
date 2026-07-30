import { NextResponse } from "next/server";
import { visualAssetStore } from "../../../../../lib/visual-assets/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await context.params;
  const assets = visualAssetStore.list(reportId);
  return NextResponse.json(
    { reportId, assets },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
