import { NextResponse } from "next/server";
import {
  assertVisualAssetFormat,
  exportVisualAsset,
  VisualAssetExportError,
} from "../../../../../../../lib/visual-assets/exportService";
import { visualAssetStore } from "../../../../../../../lib/visual-assets/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentDisposition(filename: string) {
  const encoded = encodeURIComponent(filename).replaceAll("'", "%27");
  return `attachment; filename="${filename}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ reportId: string; assetId: string }> },
) {
  const { reportId, assetId } = await context.params;
  try {
    const format = assertVisualAssetFormat(
      new URL(request.url).searchParams.get("format") ?? "",
    );
    const asset = visualAssetStore.get(assetId);
    if (!asset || asset.reportId !== reportId) {
      return NextResponse.json({ code: "VISUAL_ASSET_NOT_FOUND" }, { status: 404 });
    }
    const exported = await exportVisualAsset(asset, format);
    return new Response(exported.body.slice().buffer as ArrayBuffer, {
      headers: {
        "Content-Type": exported.contentType,
        "Content-Disposition": contentDisposition(exported.filename),
        "Content-Length": String(exported.body.byteLength),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    const code =
      error instanceof VisualAssetExportError
        ? error.code
        : "VISUAL_ASSET_EXPORT_FAILED";
    return NextResponse.json(
      { code },
      { status: code === "UNSUPPORTED_FORMAT" ? 400 : 422 },
    );
  }
}
