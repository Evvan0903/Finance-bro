import {
  CanonicalMetricError,
  MetricRegistry,
  createCanonicalMetric,
} from "../canonical-metrics";
import { UNIVERSAL_METRIC_DEFINITIONS } from "../metric-knowledge/universal-metric-definitions";
import type {
  FilingDimension,
  FilingEnrichmentDiagnostic,
  FilingFactCandidate,
} from "./types";

function attributes(source: string) {
  const result: Record<string, string> = {};
  for (const match of source.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) {
    result[match[1].toLowerCase()] = match[3];
  }
  return result;
}

function text(source: string) {
  return source
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#x2212;|&minus;/gi, "-")
    .trim();
}

function contexts(html: string) {
  const result = new Map<string, {
    start: string | null;
    end: string;
    dimensions: FilingDimension[];
  }>();
  for (const match of html.matchAll(/<(?:xbrli:)?context\b([^>]*)>([\s\S]*?)<\/(?:xbrli:)?context>/gi)) {
    const id = attributes(match[1]).id;
    if (!id) continue;
    const body = match[2];
    const instant = body.match(/<(?:xbrli:)?instant>([^<]+)</i)?.[1];
    const start = body.match(/<(?:xbrli:)?startDate>([^<]+)</i)?.[1] ?? null;
    const end = instant ?? body.match(/<(?:xbrli:)?endDate>([^<]+)</i)?.[1];
    if (!end) continue;
    const dimensions = [...body.matchAll(
      /<(?:xbrldi:)?explicitMember\b([^>]*)>([\s\S]*?)<\/(?:xbrldi:)?explicitMember>/gi,
    )].map((dimension) => ({
      axis: attributes(dimension[1]).dimension ?? "",
      member: text(dimension[2]),
    }));
    result.set(id, { start, end, dimensions });
  }
  return result;
}

function units(html: string) {
  const result = new Map<string, string>();
  for (const match of html.matchAll(/<(?:xbrli:)?unit\b([^>]*)>([\s\S]*?)<\/(?:xbrli:)?unit>/gi)) {
    const id = attributes(match[1]).id;
    const measure = match[2].match(/<(?:xbrli:)?measure>([^<]+)</i)?.[1] ?? "";
    const normalized = measure.split(":").at(-1) ?? measure;
    if (id) result.set(id, normalized === "pure" ? "ratio" : normalized);
  }
  return result;
}

export function parseInlineXbrlFacts(html: string): FilingFactCandidate[] {
  const contextMap = contexts(html);
  const unitMap = units(html);
  const candidates: FilingFactCandidate[] = [];
  for (const match of html.matchAll(
    /<ix:(?:nonFraction|nonfraction)\b([^>]*)>([\s\S]*?)<\/ix:(?:nonFraction|nonfraction)>/gi,
  )) {
    const attrs = attributes(match[1]);
    const context = contextMap.get(attrs.contextref);
    const name = attrs.name;
    const rawValue = text(match[2]);
    if (!context || !name) continue;
    const parsed = Number(rawValue.replace(/[,$()\s]/g, ""));
    if (!Number.isFinite(parsed)) continue;
    const scale = Number(attrs.scale ?? 0);
    const sign = attrs.sign === "-" || rawValue.includes("(") ? -1 : 1;
    const [taxonomy, concept] = name.split(":");
    candidates.push({
      taxonomy: taxonomy ?? "",
      concept: concept ?? name,
      rawLabel: name,
      rawValue,
      value: parsed * Math.pow(10, Number.isFinite(scale) ? scale : 0) * sign,
      unit: unitMap.get(attrs.unitref) ?? attrs.unitref ?? "",
      periodStart: context.start,
      periodEnd: context.end,
      dimensions: context.dimensions,
      decimals: attrs.decimals ?? null,
      scale: Number.isFinite(scale) ? scale : 0,
      sign,
    });
  }
  return candidates;
}

function unitAccepted(unit: string, accepted: string[]) {
  return accepted.some((value) =>
    value === "currency"
      ? /^[A-Z]{3}$/.test(unit)
      : value === "currency/shares"
        ? /^[A-Z]{3}\/shares$/.test(unit)
        : value === unit,
  );
}

export function enrichRegistryFromInlineXbrl(input: {
  registry: MetricRegistry;
  html: string;
  companyId: string;
  sector: string;
  filingUrl: string;
  filingDate: string;
  reportDate: string;
  form: string;
  retrievedAt: string;
}) {
  const diagnostics: FilingEnrichmentDiagnostic[] = [];
  const candidates = parseInlineXbrlFacts(input.html);
  for (const definition of UNIVERSAL_METRIC_DEFINITIONS) {
    for (const alias of definition.standardConcepts) {
      const matches = candidates.filter(
        (candidate) =>
          candidate.taxonomy.toLowerCase() === alias.taxonomy &&
          candidate.concept === alias.concept &&
          candidate.periodEnd === input.reportDate,
      );
      for (const candidate of matches) {
        const reasons: string[] = [];
        if (candidate.dimensions.length) reasons.push("dimensional fact is not a consolidated total");
        if (!unitAccepted(candidate.unit, definition.acceptedUnits)) reasons.push("unit mismatch");
        if (definition.periodType === "instant" && candidate.periodStart) reasons.push("instant/duration mismatch");
        if (definition.periodType === "duration") {
          if (!candidate.periodStart) reasons.push("duration start missing");
          else {
            const days = (Date.parse(candidate.periodEnd) - Date.parse(candidate.periodStart)) / 86_400_000;
            if (days < 280 || days > 430) reasons.push("duration mismatch");
          }
        }
        if (reasons.length) {
          diagnostics.push({ metricId: definition.metricId, source: "filing-inline-xbrl", concept: candidate.rawLabel, status: "rejected", reasons });
          continue;
        }
        try {
          input.registry.getMetric({
            company_id: input.companyId,
            metric_id: definition.metricId,
            period_end: candidate.periodEnd,
            definition_id: definition.definitionId,
          });
          diagnostics.push({ metricId: definition.metricId, source: "filing-inline-xbrl", concept: candidate.rawLabel, status: "candidate-only", reasons: ["Company Facts value already selected"] });
          break;
        } catch (error) {
          if (!(error instanceof CanonicalMetricError) || error.code !== "METRIC_NOT_FOUND") throw error;
        }
        input.registry.register(createCanonicalMetric({
          metric_id: definition.metricId,
          company_id: input.companyId,
          sector: input.sector,
          period: `FY${candidate.periodEnd.slice(0, 4)}`,
          period_start: candidate.periodStart,
          period_end: candidate.periodEnd,
          value: candidate.value,
          unit: candidate.unit,
          currency: /^[A-Z]{3}$/.test(candidate.unit) ? candidate.unit : null,
          status: "Reported",
          definition_id: definition.definitionId,
          formula_id: null,
          formula: null,
          input_metric_keys: [],
          source_document: `SEC ${input.form} filing`,
          source_url: input.filingUrl,
          source_type: "filing",
          source_date: input.filingDate,
          filing_date: input.filingDate,
          section: "Inline XBRL",
          table: candidate.taxonomy,
          row_label: candidate.rawLabel,
          raw_value: candidate.rawValue,
          extraction_method: `deterministic-filing-inline-xbrl:${candidate.rawLabel}`,
          confidence: 0.97,
          retrieved_at: input.retrievedAt,
          data_version: input.registry.dataVersion,
          calculation_version: input.registry.calculationVersion,
        }));
        diagnostics.push({ metricId: definition.metricId, source: "filing-inline-xbrl", concept: candidate.rawLabel, status: "published", reasons: [] });
        break;
      }
    }
  }
  return diagnostics;
}
