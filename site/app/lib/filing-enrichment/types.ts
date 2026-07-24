export type FilingDimension = { axis: string; member: string };

export type FilingFactCandidate = {
  taxonomy: string;
  concept: string;
  rawLabel: string;
  rawValue: string;
  value: number;
  unit: string;
  periodStart: string | null;
  periodEnd: string;
  dimensions: FilingDimension[];
  decimals: string | null;
  scale: number;
  sign: number;
};

export type FilingEnrichmentDiagnostic = {
  metricId: string;
  source: "filing-inline-xbrl" | "filing-custom-xbrl" | "filing-html-table";
  concept: string;
  status: "published" | "candidate-only" | "rejected";
  reasons: string[];
};
