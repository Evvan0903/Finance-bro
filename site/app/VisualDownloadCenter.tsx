"use client";

import { useMemo, useState } from "react";
import {
  AssetDownloadMenu,
  type VisualizationAssetLike,
  type VisualizationLocale,
} from "./VisualizationCard";

type DownloadCategory = "all" | "company" | "financial" | "peer" | "market" | "risk" | "valuation";

const COPY = {
  en: {
    title: "Visual downloads",
    all: "All",
    company: "Company",
    financial: "Financial",
    peer: "Peer",
    market: "Market",
    risk: "Risk",
    valuation: "Valuation",
    assetType: "Asset type",
    section: "Report section",
    formats: "Formats",
    noAssets: "No downloadable visuals in this view",
  },
  zh: {
    title: "图表下载",
    all: "全部",
    company: "公司",
    financial: "财务",
    peer: "同业",
    market: "市场",
    risk: "风险",
    valuation: "估值",
    assetType: "资产类型",
    section: "报告章节",
    formats: "可用格式",
    noAssets: "此视图中没有可下载的图表",
  },
} as const;

const FILTERS: DownloadCategory[] = ["all", "company", "financial", "peer", "market", "risk", "valuation"];

function normalizedCategory(asset: VisualizationAssetLike) {
  return asset.category.trim().toLowerCase().replace(/\s+/g, "-");
}

function typeLabel(assetType: string, locale: VisualizationLocale) {
  const labels: Record<string, { en: string; zh: string }> = {
    chart: { en: "Chart", zh: "图表" },
    table: { en: "Table", zh: "表格" },
    matrix: { en: "Matrix", zh: "矩阵" },
    scorecard: { en: "Scorecard", zh: "评分卡" },
    dataSheet: { en: "Data sheet", zh: "数据表" },
  };
  return labels[assetType]?.[locale] ?? assetType;
}

export function VisualDownloadCenter({
  assets,
  locale,
}: {
  assets: VisualizationAssetLike[];
  locale: VisualizationLocale;
}) {
  const [filter, setFilter] = useState<DownloadCategory>("all");
  const copy = COPY[locale];
  const visibleAssets = useMemo(
    () => filter === "all" ? assets : assets.filter((asset) => normalizedCategory(asset) === filter),
    [assets, filter],
  );

  return (
    <section className="visual-download-center" aria-labelledby="visual-downloads-heading">
      <header>
        <h3 id="visual-downloads-heading">{copy.title}</h3>
        <div className="visual-download-filters" role="group" aria-label={copy.title} data-visual-download-control>
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? "is-active" : undefined}
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
            >
              {copy[item]}
            </button>
          ))}
        </div>
      </header>
      {visibleAssets.length ? (
        <div className="visual-download-list">
          {visibleAssets.map((asset) => (
            <article className="visual-download-item" key={asset.assetId}>
              <div>
                <h4>{asset.title}</h4>
                {asset.subtitle && <p>{asset.subtitle}</p>}
                <dl>
                  <div><dt>{copy.assetType}</dt><dd>{typeLabel(asset.assetType, locale)}</dd></div>
                  <div><dt>{copy.section}</dt><dd>{asset.sectionTitle ?? asset.sectionId ?? "—"}</dd></div>
                  <div><dt>{copy.formats}</dt><dd>{asset.supportedFormats.map((format) => format.toUpperCase()).join(" · ")}</dd></div>
                </dl>
              </div>
              <AssetDownloadMenu asset={asset} locale={locale} />
            </article>
          ))}
        </div>
      ) : <p className="visual-download-empty">{copy.noAssets}</p>}
    </section>
  );
}
