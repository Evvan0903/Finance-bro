import type { MetricApplicability } from "../metric-coverage/types";

export type StandardConceptAlias = {
  taxonomy: "us-gaap" | "ifrs-full" | "dei";
  concept: string;
  priority: number;
};

export type MetricValidationRule =
  | { kind: "finite" }
  | { kind: "non-negative" }
  | { kind: "annual-duration"; minDays: number; maxDays: number }
  | { kind: "instant" }
  | { kind: "ratio-range"; min: number; max: number };

export type UniversalMetricDefinition = {
  metricId: string;
  displayName: string;
  definitionId: string;
  statement: "income" | "balance-sheet" | "cash-flow" | "per-share" | "derived";
  periodType: "duration" | "instant";
  acceptedUnits: string[];
  standardConcepts: StandardConceptAlias[];
  commonLabels: string[];
  applicability: MetricApplicability;
  validationRules: MetricValidationRule[];
  derivation?: {
    formulaId: string;
    formula: string;
    requiredInputs: string[];
  };
};
