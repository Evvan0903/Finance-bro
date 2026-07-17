import { METRIC_SOURCE_ORDER } from "./metric-definitions";
import type {
  CompanyFactsPayload,
  MetricCandidate,
  MetricDefinition,
  MetricDocument,
  MetricExtractionBatch,
  MetricLocatorAudit,
  MetricLocatorResult,
  MetricSourceTier,
  RejectedMetricCandidate,
} from "./metric-locator-types";

const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"]);
const SOURCE_RANK = new Map(
  METRIC_SOURCE_ORDER.map((source, index) => [source, index]),
);

type FilingContext = {
  id: string;
  start?: string;
  end?: string;
  instant?: string;
  dimensions: string[];
};

function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replaceAll("&nbsp;", " ")
    .replaceAll("&#160;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

export function filingHtmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(p|div|tr|td|th|li|h[1-6])>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttributes(value: string) {
  const attributes: Record<string, string> = {};
  for (const match of value.matchAll(/([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[3]);
  }
  return attributes;
}

function parseContexts(html: string) {
  const contexts = new Map<string, FilingContext>();
  for (const match of html.matchAll(
    /<(?:xbrli:)?context\b([^>]*)>([\s\S]*?)<\/(?:xbrli:)?context>/gi,
  )) {
    const attributes = parseAttributes(match[1]);
    const body = match[2];
    const id = attributes.id;
    if (!id) continue;
    const start = body.match(/<(?:xbrli:)?startDate\b[^>]*>([^<]+)</i)?.[1]?.trim();
    const end = body.match(/<(?:xbrli:)?endDate\b[^>]*>([^<]+)</i)?.[1]?.trim();
    const instant = body.match(/<(?:xbrli:)?instant\b[^>]*>([^<]+)</i)?.[1]?.trim();
    const dimensions = [...body.matchAll(
      /<(?:xbrldi:)?explicitMember\b[^>]*dimension=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/(?:xbrldi:)?explicitMember>/gi,
    )].map((dimension) =>
      `${decodeEntities(dimension[2])}=${filingHtmlToText(dimension[3])}`,
    );
    contexts.set(id, { id, start, end, instant, dimensions });
  }
  return contexts;
}

function parseUnits(html: string) {
  const units = new Map<string, string>();
  for (const match of html.matchAll(
    /<(?:xbrli:)?unit\b([^>]*)>([\s\S]*?)<\/(?:xbrli:)?unit>/gi,
  )) {
    const id = parseAttributes(match[1]).id;
    if (!id) continue;
    const value = filingHtmlToText(match[2]);
    units.set(id, /\bUSD\b/i.test(value) ? "USD" : value);
  }
  return units;
}

function normalizedNumber(rawValue: string, scaleValue?: string, signValue?: string) {
  const text = filingHtmlToText(rawValue).trim();
  if (!text || /^[-—–]$/.test(text)) return null;
  const negative = /^\(.*\)$/.test(text) || signValue === "-";
  const parsed = Number.parseFloat(text.replace(/[(),\s$]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  const scale = scaleValue ? Number.parseInt(scaleValue, 10) : 0;
  return (negative ? -1 : 1) * parsed * 10 ** (Number.isFinite(scale) ? scale : 0);
}

function fiscalDurationIsValid(start: string | undefined, end: string) {
  if (!start) return false;
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000;
  return Number.isFinite(days) && days >= 280 && days <= 430;
}

function companyFactSourceUrl(facts: CompanyFactsPayload) {
  return `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(facts.cik).padStart(10, "0")}.json`;
}

export function extractStandardSecXbrl(
  facts: CompanyFactsPayload,
  definitions: MetricDefinition[],
  reportingPeriod: string,
): MetricExtractionBatch {
  const candidates: MetricCandidate[] = [];
  for (const definition of definitions) {
    for (const concept of definition.standardConcepts) {
      const fact = facts.facts[concept.taxonomy]?.[concept.concept];
      if (!fact?.units) continue;
      for (const [unit, entries] of Object.entries(fact.units)) {
        for (const entry of entries) {
          if (
            entry.val === undefined ||
            !entry.end ||
            entry.end !== reportingPeriod ||
            !entry.form ||
            !ANNUAL_FORMS.has(entry.form)
          ) continue;
          if (
            definition.periodRule === "fiscal-year-duration" &&
            !fiscalDurationIsValid(entry.start, entry.end)
          ) continue;
          candidates.push({
            metricId: definition.id,
            company: facts.entityName,
            periodStart: entry.start,
            reportingPeriod: entry.end,
            value: entry.val,
            rawValue: String(entry.val),
            unit,
            currency: unit === "USD" ? "USD" : undefined,
            status: "Reported",
            sourceTier: "standard-sec-xbrl",
            sourceDocument: `SEC Company Facts — ${entry.form}`,
            sourceUrl: companyFactSourceUrl(facts),
            filingDate: entry.filed ?? "",
            sourceDate: entry.filed ?? "",
            section: "Standardized XBRL facts",
            table: concept.taxonomy,
            row: fact.label ?? concept.concept,
            rawLabel: fact.label ?? concept.concept,
            confidence: 0.99,
            extractionMethod: `Deterministic SEC Company Facts lookup: ${concept.taxonomy}:${concept.concept}`,
            accountingDefinition: fact.description ?? fact.label ?? concept.concept,
            definitionKey: concept.definitionKey,
            context: entry.accn ?? `${entry.start ?? "instant"}:${entry.end}`,
          });
        }
      }
    }
  }
  return {
    candidates,
    searchedSources: ["standard-sec-xbrl"],
    extractionFailures: {},
  };
}

export function extractFilingCustomXbrl(
  document: MetricDocument,
  definitions: MetricDefinition[],
): MetricExtractionBatch {
  try {
    const contexts = parseContexts(document.html);
    const units = parseUnits(document.html);
    const conceptMap = new Map<string, Array<{ definition: MetricDefinition; definitionKey: string }>>();
    for (const definition of definitions) {
      for (const concept of definition.customConcepts) {
        const key = `${concept.taxonomy}:${concept.concept}`.toLowerCase();
        const current = conceptMap.get(key) ?? [];
        current.push({ definition, definitionKey: concept.definitionKey });
        conceptMap.set(key, current);
      }
    }
    const candidates: MetricCandidate[] = [];
    for (const match of document.html.matchAll(
      /<ix:(?:nonFraction|nonfraction)\b([^>]*)>([\s\S]*?)<\/ix:(?:nonFraction|nonfraction)>/gi,
    )) {
      const attributes = parseAttributes(match[1]);
      const name = attributes.name?.toLowerCase();
      const matches = name ? conceptMap.get(name) : undefined;
      if (!matches?.length) continue;
      const context = contexts.get(attributes.contextref);
      const value = normalizedNumber(match[2], attributes.scale, attributes.sign);
      if (!context || value === null) continue;
      const unit = units.get(attributes.unitref) ??
        (attributes.unitref?.toLowerCase().includes("usd") ? "USD" : attributes.unitref);
      const reportingPeriod = context.instant ?? context.end ?? document.reportingPeriod;
      for (const item of matches) {
        candidates.push({
          metricId: item.definition.id,
          company: document.company,
          periodStart: context.start,
          reportingPeriod,
          value,
          rawValue: filingHtmlToText(match[2]),
          unit,
          currency: unit === "USD" ? "USD" : undefined,
          status: "Reported",
          sourceTier: "filing-custom-xbrl",
          sourceDocument: document.title,
          sourceUrl: document.url,
          filingDate: document.filingDate,
          sourceDate: document.sourceDate,
          section: "Inline XBRL",
          table: attributes.name,
          row: item.definition.aliases[0] ?? item.definition.displayName.en,
          rawLabel: attributes.name,
          confidence: 0.98,
          extractionMethod:
            `Deterministic inline XBRL extraction: ${attributes.name}` +
            (document.extractionMethodSuffix ?? ""),
          accountingDefinition: item.definition.validationRules.join(" "),
          definitionKey: item.definitionKey,
          context:
            `${context.id}; ${context.start ?? "instant"} to ${reportingPeriod}; ` +
            `dimensions=${context.dimensions.length ? context.dimensions.join(", ") : "none"}`,
        });
      }
    }
    return {
      candidates,
      searchedSources: ["filing-custom-xbrl"],
      extractionFailures: {},
    };
  } catch (error) {
    return {
      candidates: [],
      searchedSources: ["filing-custom-xbrl"],
      extractionFailures: {
        "filing-custom-xbrl": error instanceof Error ? error.message : "Unknown inline XBRL error",
      },
    };
  }
}

export function extractFilingText(
  document: MetricDocument,
  definitions: MetricDefinition[],
): MetricExtractionBatch {
  try {
    const text = filingHtmlToText(document.html);
    const candidates: MetricCandidate[] = [];
    const searched = new Set<MetricSourceTier>();
    for (const definition of definitions) {
      for (const rule of definition.textRules) {
        searched.add(rule.sourceTier);
        const match = text.match(rule.pattern);
        if (!match) continue;
        const rawValue = match[rule.captureGroup ?? 1];
        const parsed = Number.parseFloat(rawValue.replace(/[$,\s]/g, ""));
        if (!Number.isFinite(parsed)) continue;
        candidates.push({
          metricId: definition.id,
          company: document.company,
          reportingPeriod: document.reportingPeriod,
          value: parsed * rule.scale,
          rawValue,
          unit: rule.unit,
          currency: rule.currency,
          status: "Reported",
          sourceTier: rule.sourceTier,
          sourceDocument: document.title,
          sourceUrl: document.url,
          filingDate: document.filingDate,
          sourceDate: document.sourceDate,
          section: rule.section,
          table: rule.table,
          row: rule.row,
          rawLabel: rule.rawLabel,
          confidence: rule.confidence,
          extractionMethod:
            `Deterministic row-label and numeric-pattern extraction` +
            (document.extractionMethodSuffix ?? ""),
          accountingDefinition: rule.accountingDefinition,
          definitionKey: rule.definitionKey,
          context: `${rule.section}${rule.table ? ` / ${rule.table}` : ""} / ${rule.row}`,
        });
      }
    }
    return {
      candidates,
      searchedSources: [...searched].sort(
        (a, b) => (SOURCE_RANK.get(a) ?? 99) - (SOURCE_RANK.get(b) ?? 99),
      ),
      extractionFailures: {},
    };
  } catch (error) {
    return {
      candidates: [],
      searchedSources: ["filing-html-table", "filing-text"],
      extractionFailures: {
        "filing-text": error instanceof Error ? error.message : "Unknown text extraction error",
      },
    };
  }
}

function validateCandidate(
  candidate: MetricCandidate,
  definition: MetricDefinition,
  company: string,
  reportingPeriod: string,
) {
  const reasons: string[] = [];
  const normalizedCompany = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  const candidateCompany = candidate.company.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (
    normalizedCompany !== candidateCompany &&
    !candidateCompany.includes(normalizedCompany) &&
    !normalizedCompany.includes(candidateCompany)
  ) reasons.push("Company mismatch");
  if (candidate.reportingPeriod !== reportingPeriod) reasons.push("Reporting-period mismatch");
  if (!definition.acceptedUnits.includes(candidate.unit)) reasons.push("Unit or currency mismatch");
  if (!definition.acceptedDefinitionKeys.includes(candidate.definitionKey)) {
    reasons.push("Accounting-definition mismatch");
  }
  if (!candidate.sourceDate || !candidate.filingDate) reasons.push("Missing source or filing date");
  if (!candidate.section || !candidate.row || !candidate.context) {
    reasons.push("Missing table or section context");
  }
  if (!Number.isFinite(candidate.value)) reasons.push("Non-numeric value");
  if (definition.minimum !== undefined && candidate.value < definition.minimum) {
    reasons.push("Value below validation range");
  }
  if (definition.maximum !== undefined && candidate.value > definition.maximum) {
    reasons.push("Value above validation range");
  }
  if (
    definition.periodRule === "fiscal-year-duration" &&
    candidate.periodStart &&
    !fiscalDurationIsValid(candidate.periodStart, candidate.reportingPeriod)
  ) reasons.push("Duration is not a fiscal year");
  if (
    ["segment-earnings", "cash-capex"].includes(definition.id) &&
    candidate.sourceTier === "filing-custom-xbrl" &&
    !candidate.context.includes("dimensions=none")
  ) reasons.push("Dimensional fact is not the consolidated total");
  return reasons;
}

function rejectedCandidate(
  candidate: MetricCandidate,
  rejectionReasons: string[],
): RejectedMetricCandidate {
  return {
    sourceTier: candidate.sourceTier,
    sourceDocument: candidate.sourceDocument,
    sourceUrl: candidate.sourceUrl,
    reportingPeriod: candidate.reportingPeriod,
    rawLabel: candidate.rawLabel,
    rawValue: candidate.rawValue,
    value: candidate.value,
    unit: candidate.unit,
    rejectionReasons,
  };
}

export function displayMetricValue(
  value: number,
  unit: string,
  currency?: string,
) {
  if (unit === "USD") {
    const absolute = Math.abs(value);
    const divisor = absolute >= 1_000_000_000 ? 1_000_000_000 : 1_000_000;
    const suffix = divisor === 1_000_000_000 ? "bn" : "m";
    const decimals = absolute / divisor >= 100 ? 1 : 3;
    return `${currency ?? "USD"} ${(value / divisor).toFixed(decimals).replace(/\.?0+$/, "")}${suffix}`;
  }
  if (unit === "USD/bbl") return `${currency ?? "USD"} ${value.toFixed(2)}/bbl`;
  if (unit === "kboe/d") return `${Math.round(value).toLocaleString("en-US")} kboe/d`;
  if (unit === "million tonnes") return `${value.toFixed(1)} million tonnes`;
  if (unit === "projects") return `${Math.round(value)} projects`;
  return `${value.toLocaleString("en-US")} ${unit}`;
}

function emptyResult(
  definition: MetricDefinition,
  status: MetricLocatorResult["status"],
  reason: string,
  rejectedCandidates: RejectedMetricCandidate[],
): MetricLocatorResult {
  return {
    metricId: definition.id,
    displayName: definition.displayName,
    found: false,
    selectedValue: null,
    displayValue: null,
    period: null,
    unit: null,
    currency: null,
    status,
    sourceTier: null,
    sourceDocument: null,
    sourceUrl: null,
    filingDate: null,
    sourceDate: null,
    section: null,
    table: null,
    row: null,
    rawLabel: null,
    rawValue: null,
    definitionId: definition.acceptedDefinitionKeys[0] ?? `unresolved-${definition.id}`,
    formula: definition.derivationFormula ?? null,
    confidence: 0,
    extractionMethod: null,
    accountingDefinition: null,
    reason,
    rejectedCandidates,
  };
}

function selectedResult(
  definition: MetricDefinition,
  selected: MetricCandidate,
  rejectedCandidates: RejectedMetricCandidate[],
): MetricLocatorResult {
  return {
    metricId: definition.id,
    displayName: definition.displayName,
    found: true,
    selectedValue: selected.value,
    displayValue: displayMetricValue(selected.value, selected.unit, selected.currency),
    period: selected.reportingPeriod,
    unit: selected.unit,
    currency: selected.currency ?? null,
    status: selected.status,
    sourceTier: selected.sourceTier,
    sourceDocument: selected.sourceDocument,
    sourceUrl: selected.sourceUrl,
    filingDate: selected.filingDate,
    sourceDate: selected.sourceDate,
    section: selected.section,
    table: selected.table ?? null,
    row: selected.row,
    rawLabel: selected.rawLabel,
    rawValue: selected.rawValue,
    definitionId: selected.definitionKey,
    formula: selected.formula ?? null,
    confidence: selected.confidence,
    extractionMethod: selected.extractionMethod,
    accountingDefinition: selected.accountingDefinition,
    reason: null,
    rejectedCandidates,
  };
}

export function locateMetrics(input: {
  company: string;
  reportingPeriod: string;
  definitions: MetricDefinition[];
  candidates: MetricCandidate[];
  searchedSources: MetricSourceTier[];
  extractionFailures?: Partial<Record<MetricSourceTier, string>>;
}): MetricLocatorAudit {
  const searchedSources = [...new Set(input.searchedSources)].sort(
    (a, b) => (SOURCE_RANK.get(a) ?? 99) - (SOURCE_RANK.get(b) ?? 99),
  );
  const results = new Map<string, MetricLocatorResult>();

  for (const definition of input.definitions.filter((item) => !item.derivationFormula)) {
    const metricCandidates = input.candidates.filter(
      (candidate) => candidate.metricId === definition.id,
    );
    const accepted: MetricCandidate[] = [];
    const rejected: RejectedMetricCandidate[] = [];
    for (const candidate of metricCandidates) {
      const reasons = validateCandidate(
        candidate,
        definition,
        input.company,
        input.reportingPeriod,
      );
      if (reasons.length) rejected.push(rejectedCandidate(candidate, reasons));
      else accepted.push(candidate);
    }
    accepted.sort((a, b) => {
      const sourceDifference =
        (SOURCE_RANK.get(a.sourceTier) ?? 99) - (SOURCE_RANK.get(b.sourceTier) ?? 99);
      if (sourceDifference) return sourceDifference;
      if (a.filingDate !== b.filingDate) return b.filingDate.localeCompare(a.filingDate);
      return b.confidence - a.confidence;
    });
    const selected = accepted[0];
    for (const candidate of accepted.slice(1)) {
      rejected.push(rejectedCandidate(candidate, ["Lower-priority valid candidate"]));
    }
    if (selected) {
      results.set(definition.id, selectedResult(definition, selected, rejected));
      continue;
    }
    const relevantFailure = searchedSources.find(
      (source) => input.extractionFailures?.[source],
    );
    const allSourcesSearched = METRIC_SOURCE_ORDER.every((source) =>
      searchedSources.includes(source),
    );
    const status = relevantFailure
      ? "Extraction failed"
      : metricCandidates.length
        ? "Definition mismatch"
        : allSourcesSearched
          ? "Not disclosed by issuer"
          : "Not yet extracted";
    const reason = relevantFailure
      ? input.extractionFailures?.[relevantFailure] ?? "Extraction failed"
      : metricCandidates.length
        ? "Candidates were located but failed deterministic validation."
        : allSourcesSearched
          ? "No candidate remained after every supported source tier was searched."
          : "No candidate was found in the source tiers searched so far.";
    results.set(definition.id, emptyResult(definition, status, reason, rejected));
  }

  for (const definition of input.definitions.filter((item) => item.derivationFormula)) {
    const metricCandidates = input.candidates.filter(
      (candidate) => candidate.metricId === definition.id,
    );
    const rejected = metricCandidates.map((candidate) => {
      const reasons = validateCandidate(
        candidate,
        definition,
        input.company,
        input.reportingPeriod,
      );
      return rejectedCandidate(
        candidate,
        reasons.length ? reasons : ["Issuer definition is not the required derivation formula"],
      );
    });
    const inputs = definition.requiredInputs.map((id) => results.get(id));
    if (
      inputs.length === 2 &&
      inputs.every((result) => result?.found && result.selectedValue !== null) &&
      inputs[0]?.period === inputs[1]?.period &&
      inputs[0]?.currency === inputs[1]?.currency
    ) {
      const value = inputs[0]!.selectedValue! - inputs[1]!.selectedValue!;
      const sourceDocuments = inputs.map((result) => result!.sourceDocument).join(" + ");
      const sourceUrls = inputs.map((result) => result!.sourceUrl).filter(Boolean);
      const derived: MetricCandidate = {
        metricId: definition.id,
        company: input.company,
        reportingPeriod: input.reportingPeriod,
        value,
        rawValue: `${inputs[0]!.selectedValue} - ${inputs[1]!.selectedValue}`,
        unit: inputs[0]!.unit!,
        currency: inputs[0]!.currency ?? undefined,
        status: "Reported",
        sourceTier: inputs[0]!.sourceTier!,
        sourceDocument: sourceDocuments,
        sourceUrl: sourceUrls[0] ?? "",
        filingDate: [inputs[0]!.filingDate, inputs[1]!.filingDate].sort().at(-1) ?? "",
        sourceDate: [inputs[0]!.sourceDate, inputs[1]!.sourceDate].sort().at(-1) ?? "",
        section: "Derived metric",
        table: "Verified input ledger",
        row: definition.displayName.en,
        rawLabel: definition.derivationFormula!,
        formula: `${definition.derivationFormula} = ${displayMetricValue(inputs[0]!.selectedValue!, inputs[0]!.unit!, inputs[0]!.currency ?? undefined)} - ${displayMetricValue(inputs[1]!.selectedValue!, inputs[1]!.unit!, inputs[1]!.currency ?? undefined)} = ${displayMetricValue(value, inputs[0]!.unit!, inputs[0]!.currency ?? undefined)}`,
        confidence: Math.min(inputs[0]!.confidence, inputs[1]!.confidence),
        extractionMethod: "Deterministic arithmetic using two validated inputs",
        accountingDefinition: definition.derivationFormula!,
        definitionKey: "strict-ocf-minus-cash-capex",
        context: `${input.company}; ${input.reportingPeriod}; matching currency and fiscal period`,
      };
      const selected = selectedResult(definition, derived, rejected);
      selected.status = "Derived";
      results.set(definition.id, selected);
    } else {
      results.set(
        definition.id,
        emptyResult(
          definition,
          "Unable to calculate",
          `Required verified inputs are unavailable or inconsistent: ${definition.requiredInputs.join(", ")}.`,
          rejected,
        ),
      );
    }
  }

  const allResults = input.definitions
    .map((definition) => results.get(definition.id)!)
    .filter(Boolean);
  const visibleResults = input.definitions
    .filter((definition) => definition.visible)
    .map((definition) => results.get(definition.id)!)
    .filter(Boolean);
  const extractedCount = visibleResults.filter((result) => result.found).length;
  return {
    company: input.company,
    reportingPeriod: input.reportingPeriod,
    searchedSources,
    results: visibleResults,
    allResults,
    extractionSuccessRate: visibleResults.length ? extractedCount / visibleResults.length : 0,
    extractedCount,
    requestedCount: visibleResults.length,
    generatedAt: new Date().toISOString(),
  };
}

export function mergeExtractionBatches(
  ...batches: MetricExtractionBatch[]
): MetricExtractionBatch {
  return {
    candidates: batches.flatMap((batch) => batch.candidates),
    searchedSources: [...new Set(batches.flatMap((batch) => batch.searchedSources))],
    extractionFailures: Object.assign(
      {},
      ...batches.map((batch) => batch.extractionFailures),
    ),
  };
}
