import { getSectorOutlook } from "../../lib/sector-retrieval";
import type {
  ResearchMarket,
  SupportedSubindustry,
} from "../../lib/sector-types";
import type { ResearchLocale } from "../../lib/research-types";

export const dynamic = "force-dynamic";

type OutlookPayload = {
  market?: ResearchMarket;
  subindustry?: SupportedSubindustry;
  locale?: ResearchLocale;
  refresh?: boolean;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as OutlookPayload;
    const locale: ResearchLocale = payload.locale === "en" ? "en" : "zh";
    const market = payload.market ?? "Global";
    const subindustry = payload.subindustry ?? "integrated-oil-gas";
    if (
      !["US", "Europe", "Global"].includes(market) ||
      !["integrated-oil-gas", "semiconductors", "banks", "biopharma"].includes(subindustry)
    ) {
      return Response.json(
        {
          error:
            locale === "zh"
              ? "请选择当前支持的市场和子行业。"
              : "Select a currently supported market and subindustry.",
        },
        { status: 400 },
      );
    }
    return Response.json({
      outlook: await getSectorOutlook(market, subindustry, locale, payload.refresh === true),
    });
  } catch {
    return Response.json(
      { error: "Unable to refresh sector outlook." },
      { status: 500 },
    );
  }
}
