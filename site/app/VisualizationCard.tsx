"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  aggregateTimeSeries,
  availableDisplayFrequencies,
  readableTickIndices,
  timeSeriesConfiguration,
  tooltipPeriod,
} from "./lib/visual-assets/timeSeries";
import type {
  TimeSeriesFrequency,
  VisualAssetDataset,
  VisualAssetMetadata,
} from "./lib/visual-assets/types";

export type VisualizationLocale = "en" | "zh";
export type DownloadFormat = "png" | "svg" | "csv" | "xlsx";

export type VisualizationColumn =
  | string
  | {
      id?: string;
      key?: string;
      label?: string;
      name?: string;
    };

export type VisualizationDatasetLike = {
  id?: string;
  title?: string;
  description?: string;
  columns: VisualizationColumn[];
  rows: Array<Record<string, unknown> | unknown[]>;
};

export type VisualizationMetadataLike = {
    chartType?: "line" | "bar" | string;
    unit?: string | null;
    currency?: string | null;
    geography?: string | null;
    period?: string | null;
    sourceIds?: string | string[];
    evidenceIds?: string | string[];
    isReported?: boolean;
    isCalculated?: boolean;
    isProxy?: boolean;
    limitations?: string | string[];
    [key: string]: unknown;
};

/**
 * Kept structural so the component can accept the shared visual-asset types
 * without coupling the report surface to one persistence implementation.
 */
export type VisualizationAssetLike = {
  assetId: string;
  title: string;
  subtitle?: string | null;
  assetType: "chart" | "table" | "matrix" | "scorecard" | "dataSheet" | string;
  category: string;
  supportedFormats: DownloadFormat[];
  dataset: VisualizationDatasetLike;
  metadata?: VisualizationMetadataLike;
  sectionId?: string;
  sectionTitle?: string;
};

export const VISUAL_COPY = {
  en: {
    download: "Download",
    reported: "Reported",
    calculated: "Calculated",
    proxy: "Proxy",
    source: "Source",
    period: "Period",
    geography: "Geography",
    unit: "Unit",
    limitations: "Limitations",
    noData: "No compatible structured data",
    data: "Data",
    png: "Download PNG",
    svg: "Download SVG",
    csv: "Download CSV",
    xlsx: "Download Excel",
    monthly: "Monthly",
    quarterly: "Quarterly",
    annual: "Annual",
    frequency: "Display frequency",
    sourceFrequency: "Source frequency",
    displayFrequency: "Display frequency",
    aggregationMethod: "Aggregation",
  },
  zh: {
    download: "下载",
    reported: "已披露",
    calculated: "已计算",
    proxy: "代理指标",
    source: "来源",
    period: "期间",
    geography: "地理范围",
    unit: "单位",
    limitations: "限制",
    noData: "没有兼容的结构化数据",
    data: "数据",
    png: "下载 PNG",
    svg: "下载 SVG",
    csv: "下载 CSV",
    xlsx: "下载 Excel",
    monthly: "月度",
    quarterly: "季度",
    annual: "年度",
    frequency: "显示频率",
    sourceFrequency: "源数据频率",
    displayFrequency: "显示频率",
    aggregationMethod: "聚合方法",
  },
} as const;

function columnKey(column: VisualizationColumn, index: number) {
  if (typeof column === "string") return column;
  return column.key ?? column.id ?? column.name ?? column.label ?? `column-${index + 1}`;
}

function columnLabel(column: VisualizationColumn, index: number) {
  return typeof column === "string"
    ? column
    : column.label ?? column.name ?? column.key ?? column.id ?? `Column ${index + 1}`;
}

function recordsFor(dataset: VisualizationDatasetLike) {
  const keys = dataset.columns.map(columnKey);
  return dataset.rows.map((row) => {
    if (!Array.isArray(row)) return row;
    return Object.fromEntries(keys.map((key, index) => [key, row[index]]));
  });
}

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function displayValue(value: unknown, locale: VisualizationLocale) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
      maximumFractionDigits: 3,
    }).format(value);
  }
  return String(value);
}

function chartColumns(dataset: VisualizationDatasetLike) {
  const rows = recordsFor(dataset);
  const keys = dataset.columns.map(columnKey);
  const numericKeys = keys.filter((key) => rows.some((row) => numeric(row[key]) !== null));
  return { rows, keys, numericKeys };
}

const CHART_COLORS = ["#0055FF", "#12A594", "#A46BFF"];

function InlineChart({
  asset,
  locale,
  dataset,
  pointPeriods,
}: {
  asset: VisualizationAssetLike;
  locale: VisualizationLocale;
  dataset: VisualizationDatasetLike;
  pointPeriods: Array<{ label: string; start: string; end: string }>;
}) {
  const { rows, keys, numericKeys } = chartColumns(dataset);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(760);
  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setChartWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  if (!rows.length || !numericKeys.length) {
    return <p className="visualization-empty">{VISUAL_COPY[locale].noData}</p>;
  }

  const xKey = keys.find((key) => !numericKeys.includes(key)) ?? keys[0];
  const series = numericKeys.slice(0, 3);
  const values = series.flatMap((key) => rows.map((row) => numeric(row[key])).filter((value): value is number => value !== null));
  const min = Math.min(0, ...values);
  const max = Math.max(...values, 1);
  const range = Math.max(max - min, 1);
  const width = 760;
  const height = 270;
  const pad = { top: 20, right: 24, bottom: 44, left: 48 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const y = (value: number) => pad.top + ((max - value) / range) * plotHeight;
  const x = (index: number) =>
    pad.left + (rows.length === 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth);
  const isBar = asset.metadata?.chartType === "bar";
  const labels = dataset.columns.map(columnLabel);
  const tickIndices = new Set(readableTickIndices(rows.length, chartWidth));

  return (
    <div className="visualization-chart" role="img" aria-label={asset.title} ref={containerRef}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={asset.title}>
        <title>{asset.title}</title>
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const value = min + (max - min) * step;
          const lineY = y(value);
          return (
            <g key={step}>
              <line x1={pad.left} x2={width - pad.right} y1={lineY} y2={lineY} stroke="#dfe5ec" strokeWidth="1" />
              <text x={pad.left - 8} y={lineY + 4} textAnchor="end" fill="#617080" fontSize="11">
                {displayValue(value, locale)}
              </text>
            </g>
          );
        })}
        {isBar
          ? series.map((key, seriesIndex) => {
              const groupWidth = Math.max(8, plotWidth / rows.length);
              const barWidth = Math.max(3, Math.min(28, (groupWidth * 0.68) / series.length));
              return rows.map((row, index) => {
                const value = numeric(row[key]);
                if (value === null) return null;
                const zeroY = y(0);
                const barY = value >= 0 ? y(value) : zeroY;
                const barHeight = Math.max(1, Math.abs(zeroY - y(value)));
                const barX = x(index) - (series.length * barWidth) / 2 + seriesIndex * barWidth;
                return <rect key={`${key}-${index}`} x={barX} y={barY} width={barWidth - 2} height={barHeight} fill={CHART_COLORS[seriesIndex]} rx="1"><title>{`${tooltipPeriod(pointPeriods[index], String(row[xKey] ?? ""))}: ${displayValue(value, locale)}`}</title></rect>;
              });
            })
          : series.map((key, seriesIndex) => {
              const points = rows
                .map((row, index) => {
                  const value = numeric(row[key]);
                  return value === null ? null : `${x(index)},${y(value)}`;
                })
                .filter((point): point is string => point !== null)
                .join(" ");
              return (
                <g key={key}>
                  {points && <polyline points={points} fill="none" stroke={CHART_COLORS[seriesIndex]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                  {rows.map((row, index) => {
                    const value = numeric(row[key]);
                    return value === null ? null : <circle key={`${key}-${index}`} cx={x(index)} cy={y(value)} r="3.5" fill={CHART_COLORS[seriesIndex]}><title>{`${tooltipPeriod(pointPeriods[index], String(row[xKey] ?? ""))}: ${displayValue(value, locale)}`}</title></circle>;
                  })}
                </g>
              );
            })}
        {rows.map((row, index) => tickIndices.has(index) && (
          <text key={`label-${index}`} x={x(index)} y={height - 16} textAnchor="middle" fill="#617080" fontSize="11">
            {displayValue(row[xKey], locale).slice(0, 18)}
          </text>
        ))}
      </svg>
      <div className="visualization-legend" aria-label={VISUAL_COPY[locale].data}>
        {series.map((key, index) => <span key={key}><i style={{ "--visual-color": CHART_COLORS[index] } as CSSProperties} />{labels[keys.indexOf(key)]}</span>)}
      </div>
    </div>
  );
}

function StructuredTable({ asset, locale }: { asset: VisualizationAssetLike; locale: VisualizationLocale }) {
  const rows = recordsFor(asset.dataset);
  if (!rows.length || !asset.dataset.columns.length) return <p className="visualization-empty">{VISUAL_COPY[locale].noData}</p>;
  return (
    <div className="table-wrap visualization-table-wrap">
      <table className="visualization-table">
        <thead>
          <tr>{asset.dataset.columns.map((column, index) => <th key={columnKey(column, index)}>{columnLabel(column, index)}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${asset.assetId}-${rowIndex}`}>
              {asset.dataset.columns.map((column, columnIndex) => {
                const key = columnKey(column, columnIndex);
                return <td key={key}>{displayValue(row[key], locale)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function assetDownloadHref(
  assetId: string,
  format: DownloadFormat,
  displayFrequency?: TimeSeriesFrequency,
) {
  const reportId = assetId.split("--", 1)[0];
  const frequency = displayFrequency ? `&frequency=${encodeURIComponent(displayFrequency)}` : "";
  return `/api/research/reports/${encodeURIComponent(reportId)}/visual-assets/${encodeURIComponent(assetId)}/download?format=${encodeURIComponent(format)}${frequency}`;
}

export function AssetDownloadMenu({
  asset,
  locale,
  displayFrequency,
}: {
  asset: Pick<VisualizationAssetLike, "assetId" | "supportedFormats" | "title">;
  locale: VisualizationLocale;
  displayFrequency?: TimeSeriesFrequency;
}) {
  const copy = VISUAL_COPY[locale];
  const labels: Record<DownloadFormat, string> = {
    png: copy.png,
    svg: copy.svg,
    csv: copy.csv,
    xlsx: copy.xlsx,
  };
  if (!asset.supportedFormats.length) return null;
  return (
    <details className="visual-download-menu" data-visual-download-control>
      <summary aria-label={`${copy.download} ${asset.title}`}>{copy.download}</summary>
      <div role="menu">
        {asset.supportedFormats.map((format) => (
          <a key={format} role="menuitem" href={assetDownloadHref(asset.assetId, format, displayFrequency)}>
            {labels[format]}
          </a>
        ))}
      </div>
    </details>
  );
}

function MetadataLine({ label, children }: { label: string; children: ReactNode }) {
  return <span><b>{label}</b> {children}</span>;
}

function metadataList(value: string | string[] | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value : value.split(" · ").filter(Boolean);
}

export function VisualizationCard({
  asset,
  locale,
}: {
  asset: VisualizationAssetLike;
  locale: VisualizationLocale;
}) {
  const copy = VISUAL_COPY[locale];
  const metadata = asset.metadata ?? {};
  const timeSeries = timeSeriesConfiguration(metadata as VisualAssetMetadata);
  const sourceFrequency = timeSeries?.sourceFrequency;
  const defaultFrequency = timeSeries?.displayFrequency;
  const [displayFrequency, setDisplayFrequency] = useState<TimeSeriesFrequency>(
    defaultFrequency ?? "annual",
  );
  const frequencies = sourceFrequency ? availableDisplayFrequencies(sourceFrequency) : [];
  const displayed = sourceFrequency
    ? aggregateTimeSeries(
        asset.dataset as unknown as VisualAssetDataset,
        metadata as VisualAssetMetadata,
        displayFrequency,
      )
    : { dataset: asset.dataset, displayFrequency: "annual" as const, pointPeriods: [] };
  const showTable = asset.assetType !== "chart";
  const sourceIds = metadataList(metadata.sourceIds);
  const evidenceIds = metadataList(metadata.evidenceIds);
  const limitations = metadataList(metadata.limitations);
  return (
    <article className={`visualization-card visualization-${asset.assetType}`} data-visualization-id={asset.assetId}>
      <header className="visualization-card-header">
        <div>
          <h4>{asset.title}</h4>
          {asset.subtitle && <p>{asset.subtitle}</p>}
        </div>
        <div className="visualization-card-controls">
          {frequencies.length > 1 && (
            <div className="frequency-selector" role="group" aria-label={copy.frequency} data-visual-download-control>
              {frequencies.map((frequency) => (
                <button
                  type="button"
                  key={frequency}
                  className={displayFrequency === frequency ? "is-active" : ""}
                  aria-pressed={displayFrequency === frequency}
                  onClick={() => setDisplayFrequency(frequency)}
                >
                  {copy[frequency]}
                </button>
              ))}
            </div>
          )}
          <AssetDownloadMenu asset={asset} locale={locale} displayFrequency={timeSeries ? displayFrequency : undefined} />
        </div>
      </header>
      <div className="visualization-badges" aria-label={asset.title}>
        {metadata.isReported && <span className="evidence-badge reported-fact">{copy.reported}</span>}
        {metadata.isCalculated && <span className="evidence-badge derived-calculation">{copy.calculated}</span>}
        {metadata.isProxy && <span className="evidence-badge market-data-value">{copy.proxy}</span>}
      </div>
      {showTable
        ? <StructuredTable asset={asset} locale={locale} />
        : <InlineChart asset={asset} locale={locale} dataset={displayed.dataset} pointPeriods={displayed.pointPeriods} />}
      <footer className="visualization-metadata">
        <div>
          {metadata.unit && <MetadataLine label={copy.unit}>{String(metadata.unit)}</MetadataLine>}
          {metadata.geography && <MetadataLine label={copy.geography}>{String(metadata.geography)}</MetadataLine>}
          {metadata.period && <MetadataLine label={copy.period}>{String(metadata.period)}</MetadataLine>}
          {timeSeries && <MetadataLine label={copy.sourceFrequency}>{copy[timeSeries.sourceFrequency]}</MetadataLine>}
          {timeSeries && <MetadataLine label={copy.displayFrequency}>{copy[displayFrequency]}</MetadataLine>}
          {timeSeries && <MetadataLine label={copy.aggregationMethod}>{String(timeSeries.aggregationMethod)}</MetadataLine>}
        </div>
        {(sourceIds.length > 0 || evidenceIds.length > 0) && (
          <small>
            <b>{copy.source}</b> {[...sourceIds, ...evidenceIds].join(" · ")}
          </small>
        )}
        {limitations.length > 0 && <p><b>{copy.limitations}</b> {limitations.join(" ")}</p>}
      </footer>
    </article>
  );
}
