export const VISUAL_ASSET_FORMATS = ["csv", "xlsx", "svg", "png"] as const;

export type VisualAssetFormat = (typeof VISUAL_ASSET_FORMATS)[number];

export type VisualAssetValue = string | number | boolean | null;

export type VisualAssetColumn = {
  key: string;
  label: string;
  type: "string" | "number" | "boolean";
  description?: string;
};

export type VisualAssetDataset = {
  id: string;
  title: string;
  description?: string;
  columns: VisualAssetColumn[];
  rows: Array<Record<string, VisualAssetValue>>;
};

export type TimeSeriesFrequency = "monthly" | "quarterly" | "annual";

export type TimeSeriesAggregationMethod = "average" | "endOfPeriod" | "sum";

export type VisualAssetMetadata = Record<string, VisualAssetValue> & {
  sourceFrequency?: TimeSeriesFrequency;
  displayFrequency?: TimeSeriesFrequency;
  aggregationMethod?: TimeSeriesAggregationMethod;
  periodKey?: string;
};

export type VisualAssetType =
  | "chart"
  | "table"
  | "matrix"
  | "scorecard"
  | "dataSheet";

export type VisualAssetCategory =
  | "company"
  | "financial"
  | "peer"
  | "market"
  | "risk"
  | "valuation";

/**
 * A self-contained, server-side export artifact. SVG is deliberately optional:
 * tabular assets can still be exported as CSV/XLSX without a chart surface.
 */
export type VisualAssetInput = {
  reportId: string;
  title: string;
  subtitle?: string;
  filenameStem: string;
  assetType: VisualAssetType;
  category: VisualAssetCategory;
  sectionId: string;
  sectionTitle: string;
  dataset: VisualAssetDataset;
  metadata?: VisualAssetMetadata;
  svg?: string;
  formats?: VisualAssetFormat[];
};

export type StoredVisualAsset = VisualAssetInput & {
  assetId: string;
  createdAt: string;
  expiresAt: string;
};

export type VisualAssetDescriptor = {
  reportId: string;
  assetId: string;
  title: string;
  subtitle?: string;
  assetType: VisualAssetType;
  category: VisualAssetCategory;
  sectionId: string;
  sectionTitle: string;
  supportedFormats: VisualAssetFormat[];
  dataset: VisualAssetDataset;
  metadata?: VisualAssetMetadata;
  createdAt: string;
  expiresAt: string;
};

export type VisualAssetExport = {
  body: Uint8Array;
  contentType: string;
  extension: string;
  filename: string;
};
