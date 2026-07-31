import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateTimeSeries,
  availableDisplayFrequencies,
  defaultDisplayFrequency,
  readableTickIndices,
  tooltipPeriod,
} from "../app/lib/visual-assets/timeSeries.ts";

const columns = [
  { key: "period", label: "Period", type: "string" },
  { key: "flow", label: "Flow", type: "number" },
  { key: "rate", label: "Rate", type: "number" },
  { key: "balance", label: "Balance", type: "number" },
];

const rows = Array.from({ length: 12 }, (_, index) => ({
  period: `2025-${String(index + 1).padStart(2, "0")}`,
  flow: index + 1,
  rate: index + 1,
  balance: (index + 1) * 10,
}));

test("defaults monthly and quarterly source series to quarterly display", () => {
  assert.equal(defaultDisplayFrequency("monthly"), "quarterly");
  assert.equal(defaultDisplayFrequency("quarterly"), "quarterly");
  assert.equal(defaultDisplayFrequency("annual"), "annual");
  assert.deepEqual(availableDisplayFrequencies("monthly"), ["monthly", "quarterly", "annual"]);
  assert.deepEqual(availableDisplayFrequencies("quarterly"), ["quarterly", "annual"]);
});

test("aggregates monthly observations with deterministic sum, average, and end-of-period methods", () => {
  const source = { id: "monthly", title: "Monthly source", columns, rows };
  const original = structuredClone(source);
  const sum = aggregateTimeSeries(source, {
    sourceFrequency: "monthly",
    displayFrequency: "quarterly",
    aggregationMethod: "sum",
    periodKey: "period",
  });
  assert.deepEqual(sum.dataset.rows.map((row) => row.flow), [6, 15, 24, 33]);
  assert.deepEqual(sum.dataset.rows.map((row) => row.period), ["2025 Q1", "2025 Q2", "2025 Q3", "2025 Q4"]);
  const average = aggregateTimeSeries(source, {
    sourceFrequency: "monthly",
    displayFrequency: "quarterly",
    aggregationMethod: "average",
    periodKey: "period",
  });
  assert.deepEqual(average.dataset.rows.map((row) => row.rate), [2, 5, 8, 11]);
  const end = aggregateTimeSeries(source, {
    sourceFrequency: "monthly",
    displayFrequency: "quarterly",
    aggregationMethod: "endOfPeriod",
    periodKey: "period",
  });
  assert.deepEqual(end.dataset.rows.map((row) => row.balance), [30, 60, 90, 120]);
  assert.deepEqual(source, original, "display aggregation must not mutate original observations");
  assert.deepEqual(sum.pointPeriods[0], { label: "2025 Q1", start: "2025-01", end: "2025-03" });
});

test("limits responsive ticks and preserves precise tooltip periods", () => {
  const ticks = readableTickIndices(60, 480);
  assert.ok(ticks.length <= 5);
  assert.equal(ticks[0], 0);
  assert.equal(ticks.at(-1), 59);
  assert.equal(tooltipPeriod({ start: "2025-01", end: "2025-03" }, "fallback"), "2025-01–2025-03");
});
