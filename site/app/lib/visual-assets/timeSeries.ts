import type {
  TimeSeriesAggregationMethod,
  TimeSeriesFrequency,
  VisualAssetDataset,
  VisualAssetMetadata,
  VisualAssetValue,
} from "./types";

type DatasetRow = Record<string, VisualAssetValue>;

export type AggregatedTimeSeries = {
  dataset: VisualAssetDataset;
  displayFrequency: TimeSeriesFrequency;
  pointPeriods: Array<{ label: string; start: string; end: string }>;
};

const FREQUENCIES: TimeSeriesFrequency[] = ["monthly", "quarterly", "annual"];

export function isTimeSeriesFrequency(value: unknown): value is TimeSeriesFrequency {
  return typeof value === "string" && FREQUENCIES.includes(value as TimeSeriesFrequency);
}

export function isAggregationMethod(value: unknown): value is TimeSeriesAggregationMethod {
  return value === "average" || value === "endOfPeriod" || value === "sum";
}

export function timeSeriesConfiguration(metadata: VisualAssetMetadata | undefined) {
  if (
    !isTimeSeriesFrequency(metadata?.sourceFrequency) ||
    !isTimeSeriesFrequency(metadata?.displayFrequency) ||
    !isAggregationMethod(metadata?.aggregationMethod)
  ) return null;
  return {
    sourceFrequency: metadata.sourceFrequency,
    displayFrequency: metadata.displayFrequency,
    aggregationMethod: metadata.aggregationMethod,
    periodKey: typeof metadata.periodKey === "string" ? metadata.periodKey : "period",
  };
}

export function availableDisplayFrequencies(source: TimeSeriesFrequency): TimeSeriesFrequency[] {
  if (source === "monthly") return ["monthly", "quarterly", "annual"];
  if (source === "quarterly") return ["quarterly", "annual"];
  return ["annual"];
}

export function defaultDisplayFrequency(source: TimeSeriesFrequency): TimeSeriesFrequency {
  return source === "annual" ? "annual" : "quarterly";
}

export function normalizeDisplayFrequency(
  source: TimeSeriesFrequency,
  requested: unknown,
): TimeSeriesFrequency {
  const allowed = availableDisplayFrequencies(source);
  if (isTimeSeriesFrequency(requested) && allowed.includes(requested)) return requested;
  return defaultDisplayFrequency(source);
}

function parsedPeriod(value: VisualAssetValue, source: TimeSeriesFrequency) {
  if (typeof value !== "string") return null;
  if (source === "monthly") {
    const match = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if (!match) return null;
    const month = Number(match[2]);
    if (month < 1 || month > 12) return null;
    return { year: Number(match[1]), month, sourceLabel: value };
  }
  if (source === "quarterly") {
    const match = value.match(/^(\d{4})(?:[- ]?Q([1-4])|-(\d{2})(?:-\d{2})?)$/i);
    if (!match) return null;
    const quarter = match[2] ? Number(match[2]) : Math.ceil(Number(match[3]) / 3);
    return { year: Number(match[1]), month: (quarter - 1) * 3 + 1, sourceLabel: value };
  }
  const match = value.match(/^(\d{4})/);
  if (!match) return null;
  return { year: Number(match[1]), month: 1, sourceLabel: value };
}

function bucketLabel(
  period: NonNullable<ReturnType<typeof parsedPeriod>>,
  frequency: TimeSeriesFrequency,
) {
  if (frequency === "monthly") return period.sourceLabel;
  if (frequency === "quarterly") return `${period.year} Q${Math.ceil(period.month / 3)}`;
  return String(period.year);
}

function aggregateNumbers(values: number[], method: TimeSeriesAggregationMethod) {
  if (!values.length) return null;
  if (method === "endOfPeriod") return values.at(-1) ?? null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return method === "average" ? total / values.length : total;
}

export function aggregateTimeSeries(
  sourceDataset: VisualAssetDataset,
  metadata: VisualAssetMetadata,
  requestedFrequency?: TimeSeriesFrequency,
): AggregatedTimeSeries {
  const config = timeSeriesConfiguration(metadata);
  if (!config) {
    return {
      dataset: structuredClone(sourceDataset),
      displayFrequency: "annual",
      pointPeriods: [],
    };
  }
  const displayFrequency = normalizeDisplayFrequency(config.sourceFrequency, requestedFrequency);
  const parsedRows = sourceDataset.rows
    .map((row, index) => ({ row, index, period: parsedPeriod(row[config.periodKey], config.sourceFrequency) }))
    .filter((item): item is typeof item & { period: NonNullable<typeof item.period> } => item.period !== null)
    .sort((left, right) =>
      left.period.year - right.period.year ||
      left.period.month - right.period.month ||
      left.index - right.index,
    );
  const groups = new Map<string, typeof parsedRows>();
  for (const item of parsedRows) {
    const label = bucketLabel(item.period, displayFrequency);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  const numericColumns = sourceDataset.columns.filter((column) => column.type === "number");
  const rows: DatasetRow[] = [];
  const pointPeriods: AggregatedTimeSeries["pointPeriods"] = [];
  for (const [label, group] of groups) {
    const row: DatasetRow = { [config.periodKey]: label };
    for (const column of sourceDataset.columns) {
      if (column.key === config.periodKey) continue;
      if (column.type === "number") {
        const values = group
          .map((item) => item.row[column.key])
          .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
        row[column.key] = aggregateNumbers(values, config.aggregationMethod);
      } else {
        row[column.key] = [...group]
          .reverse()
          .map((item) => item.row[column.key])
          .find((value) => value !== null && value !== "") ?? null;
      }
    }
    if (numericColumns.some((column) => typeof row[column.key] === "number")) {
      rows.push(row);
      pointPeriods.push({
        label,
        start: group[0].period.sourceLabel,
        end: group.at(-1)!.period.sourceLabel,
      });
    }
  }
  return {
    dataset: { ...sourceDataset, rows },
    displayFrequency,
    pointPeriods,
  };
}

export function readableTickIndices(observationCount: number, chartWidth: number) {
  if (observationCount <= 0) return [];
  const maxTicks = Math.max(2, Math.floor(Math.max(240, chartWidth) / 92));
  if (observationCount <= maxTicks) return Array.from({ length: observationCount }, (_, index) => index);
  const indices = new Set<number>([0, observationCount - 1]);
  for (let slot = 1; slot < maxTicks - 1; slot += 1) {
    indices.add(Math.round(slot * (observationCount - 1) / (maxTicks - 1)));
  }
  return [...indices].sort((left, right) => left - right);
}

export function tooltipPeriod(point: { start: string; end: string } | undefined, fallback: string) {
  if (!point) return fallback;
  return point.start === point.end ? point.start : `${point.start}–${point.end}`;
}
