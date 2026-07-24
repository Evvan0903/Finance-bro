import type { MetricValidationRule } from "./types";

export const DURATION_CURRENCY_RULES: MetricValidationRule[] = [
  { kind: "finite" },
  { kind: "annual-duration", minDays: 280, maxDays: 430 },
];

export const NON_NEGATIVE_DURATION_RULES: MetricValidationRule[] = [
  ...DURATION_CURRENCY_RULES,
  { kind: "non-negative" },
];

export const INSTANT_CURRENCY_RULES: MetricValidationRule[] = [
  { kind: "finite" },
  { kind: "instant" },
];

export const NON_NEGATIVE_INSTANT_RULES: MetricValidationRule[] = [
  ...INSTANT_CURRENCY_RULES,
  { kind: "non-negative" },
];

export const RATIO_RULES: MetricValidationRule[] = [
  { kind: "finite" },
  { kind: "ratio-range", min: -10, max: 10 },
];
