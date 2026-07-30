import { NextResponse } from "next/server";
import { marketReportToMarkdown } from "../../../lib/market-analysis/reports/markdown";
import { parseMarketDefinition } from "../../../lib/market-analysis/schemas/marketScope";
import type { MarketReport } from "../../../lib/market-analysis/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body?.format !== "markdown") {
      return NextResponse.json({
        code: "UNSUPPORTED_SERVER_EXPORT",
        message: "PDF and print exports are generated from the shared browser report surface.",
      }, { status: 400 });
    }
    const report = body?.report as MarketReport;
    if (!report || typeof report !== "object") throw new Error("Report is required");
    parseMarketDefinition(report.marketDefinition);
    const markdown = marketReportToMarkdown(report);
    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="finbro-mason-${report.mode}-${report.locale}.md"`,
      },
    });
  } catch (error) {
    return NextResponse.json({
      code: "INVALID_EXPORT_REQUEST",
      message: error instanceof Error ? error.message : "Invalid export request",
    }, { status: 400 });
  }
}
