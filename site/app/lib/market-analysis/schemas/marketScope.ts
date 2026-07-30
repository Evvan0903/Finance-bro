import {
  DEFAULT_COMPARISON_CRITERIA,
  DEFAULT_FOCUS_AREAS,
} from "../copy";
import { validateMarketScope } from "../industries/industryMapping";
import type {
  ClassificationCandidate,
  ComparisonCriterion,
  FocusArea,
  MarketDefinition,
  MarketMode,
  MarketScopeInput,
} from "../types";

const MODES = new Set<MarketMode>(["analyze", "trend", "compare"]);
const FOCUS = new Set<FocusArea>([
  "industryFootprint", "economicContribution", "establishments", "employment",
  "payrollLaborCost", "regionalConcentration", "demandIndicators",
  "supplyIndicators", "macroEnvironment", "publicCompanyEvidence",
  "policyEnvironment", "risks", "scenarioOutlook",
]);
const CRITERIA = new Set<ComparisonCriterion>(DEFAULT_COMPARISON_CRITERIA);

function text(value: unknown, maximum = 500) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function stringArray(value: unknown, maximum = 20) {
  return Array.isArray(value)
    ? value.flatMap((item) => typeof item === "string" ? [item.trim().slice(0, 100)] : []).filter(Boolean).slice(0, maximum)
    : [];
}

export function parseMarketScope(value: unknown): MarketScopeInput {
  const input = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const mode = MODES.has(input.mode as MarketMode) ? input.mode as MarketMode : "analyze";
  const startYear = Number(input.startYear);
  const endYear = Number(input.endYear);
  const focusAreas = Array.isArray(input.focusAreas)
    ? input.focusAreas.filter((item): item is FocusArea => FOCUS.has(item as FocusArea))
    : DEFAULT_FOCUS_AREAS;
  const comparisonCriteria = Array.isArray(input.comparisonCriteria)
    ? input.comparisonCriteria.filter((item): item is ComparisonCriterion =>
        CRITERIA.has(item as ComparisonCriterion))
    : DEFAULT_COMPARISON_CRITERIA;
  const scope: MarketScopeInput = {
    mode,
    market: text(input.market, 160),
    subjectB: text(input.subjectB, 160) || undefined,
    geography: text(input.geography, 120),
    geographyB: text(input.geographyB, 120) || undefined,
    startYear,
    endYear,
    analysisYear: Number(input.analysisYear ?? endYear),
    researchQuestion: text(input.researchQuestion, 1_000),
    focusAreas: focusAreas.length ? focusAreas : DEFAULT_FOCUS_AREAS,
    comparisonCriteria: comparisonCriteria.length ? comparisonCriteria : DEFAULT_COMPARISON_CRITERIA,
    leadingIndicators: stringArray(input.leadingIndicators),
    tickers: stringArray(input.tickers, 10).map((ticker) => ticker.toUpperCase()),
    locale: input.locale === "zh" ? "zh" : "en",
    reportDepth: input.reportDepth === "compact" ? "compact" : "standard",
    outputFormat: input.outputFormat === "pdf" || input.outputFormat === "markdown"
      ? input.outputFormat
      : "web",
  };
  const errors = validateMarketScope(scope);
  if (errors.length) throw new Error(errors.join("; "));
  return scope;
}

export function parseCandidates(value: unknown): ClassificationCandidate[] {
  if (!Array.isArray(value)) throw new Error("Classification candidates are required");
  return value.slice(0, 30).flatMap((item): ClassificationCandidate[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const providerId = candidate.providerId;
    const kind = candidate.kind;
    if (
      !["fred", "bea", "census", "sec", "bls", "worldBank", "congressGov", "govInfo"].includes(String(providerId)) ||
      !["naics", "beaIndustry", "fredSeries", "censusDataset", "blsSeries", "worldBankIndicator", "publicCompany"].includes(String(kind))
    ) return [];
    return [{
      mappingId: text(candidate.mappingId, 120),
      kind: kind as ClassificationCandidate["kind"],
      code: text(candidate.code, 80),
      officialLabel: text(candidate.officialLabel, 300),
      description: text(candidate.description, 1_000),
      providerId: providerId as ClassificationCandidate["providerId"],
      includedScope: text(candidate.includedScope, 500),
      knownExclusions: text(candidate.knownExclusions, 500),
      confidence: candidate.confidence === "high" || candidate.confidence === "medium" ? candidate.confidence : "low",
      reason: text(candidate.reason, 500),
      selected: candidate.selected === true,
      isProxy: candidate.isProxy === true,
    }];
  });
}

export function parseMarketDefinition(value: unknown): MarketDefinition {
  if (!value || typeof value !== "object") throw new Error("Confirmed market definition is required");
  const definition = value as MarketDefinition;
  if (definition.userConfirmed !== true || !Array.isArray(definition.officialClassificationMappings)) {
    throw new Error("Market definition must be user-confirmed");
  }
  if (!definition.officialClassificationMappings.length) {
    throw new Error("At least one confirmed official mapping is required");
  }
  return structuredClone(definition);
}
