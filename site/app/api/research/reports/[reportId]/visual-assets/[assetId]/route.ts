import { NextResponse } from "next/server";
import { visualAssetDescriptor, visualAssetStore } from "../../../../../../lib/visual-assets/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ reportId: string; assetId: string }> },
) {
  const { reportId, assetId } = await context.params;
  const asset = visualAssetStore.get(assetId);
  if (!asset || asset.reportId !== reportId) {
    return NextResponse.json({ code: "VISUAL_ASSET_NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json(visualAssetDescriptor(asset), {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
