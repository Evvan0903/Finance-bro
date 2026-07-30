import type { IndustryMetric, MarketEvidence } from "../types";

export class CalculationCompatibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalculationCompatibilityError";
  }
}

export function percentageChange(start: number, end: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === 0) {
    throw new CalculationCompatibilityError("Percentage change requires finite values and a nonzero starting value");
  }
  return ((end / start) - 1) * 100;
}

export function compoundAnnualGrowthRate(start: number, end: number, years: number) {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start <= 0 ||
    end < 0 ||
    !Number.isInteger(years) ||
    years <= 0
  ) {
    throw new CalculationCompatibilityError("CAGR requires positive compatible endpoints and a positive whole-year interval");
  }
  return ((end / start) ** (1 / years) - 1) * 100;
}

export function safeRatio(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    throw new CalculationCompatibilityError("Ratio requires finite inputs and a nonzero denominator");
  }
  return numerator / denominator;
}

function ratioCompatible(left: MarketEvidence, right: MarketEvidence) {
  return (
    left.frequency === right.frequency &&
    left.observationPeriod === right.observationPeriod &&
    left.geography === right.geography &&
    left.industryCode === right.industryCode &&
    left.seasonalAdjustment === right.seasonalAdjustment
  );
}

function metricFromEvidence(evidence: MarketEvidence): IndustryMetric {
  const category =
    /establishment/i.test(evidence.metricLabel) ? "establishments"
      : /employment|employees/i.test(evidence.metricLabel) ? "employment"
        : /payroll/i.test(evidence.metricLabel) ? "payroll"
          : evidence.providerId === "bea" ? "value added"
            : evidence.providerId === "sec" ? "company evidence"
              : evidence.providerId === "congressGov" || evidence.providerId === "govInfo" ? "policy context"
                : "macroeconomic";
  return {
    metricId: `metric-${evidence.evidenceId}`,
    canonicalLabel: evidence.metricLabel,
    displayLabel: evidence.metricLabel,
    category,
    value: evidence.value,
    unit: evidence.unit,
    currency: evidence.currency,
    period: evidence.observationPeriod,
    geography: evidence.geography,
    industryScope: evidence.marketScope,
    definition: evidence.sourceTitle,
    method: evidence.isCalculated ? evidence.calculationMethod ?? "Deterministic calculation" : "Reported by official provider",
    providerIds: [evidence.providerId],
    evidenceIds: [evidence.evidenceId],
    confidence: evidence.confidence,
    isHistorical: evidence.frequency !== "pointInTime",
    isCalculated: evidence.isCalculated,
    isProxy: evidence.isProxy,
    lowerBound: null,
    upperBound: null,
    limitations: [...evidence.notes],
  };
}

export function calculateIndustryMetrics(evidence: MarketEvidence[]) {
  const metrics = evidence.map(metricFromEvidence);
  const census = evidence.filter(
    (item) => item.providerId === "census" && typeof item.value === "number",
  );
  const byPeriod = Map.groupBy(
    census,
    (item) => `${item.observationPeriod}|${item.geography}|${item.industryCode}`,
  );
  for (const [key, rows] of byPeriod) {
    const employment = rows.find((item) => item.metricLabel === "Employment");
    const establishments = rows.find((item) => item.metricLabel === "Establishment count");
    const payroll = rows.find((item) => item.metricLabel === "Annual payroll");
    const [period, geography, industryCode] = key.split("|");
    if (employment && establishments && ratioCompatible(employment, establishments)) {
      const value = safeRatio(employment.value as number, establishments.value as number);
      metrics.push({
        metricId: `employees-per-establishment-${period}-${geography}-${industryCode}`,
        canonicalLabel: "Average employees per establishment",
        displayLabel: "Average employees per establishment",
        category: "employment",
        value,
        unit: "Employees per establishment",
        currency: null,
        period,
        geography,
        industryScope: employment.marketScope,
        definition: "Employment divided by establishments",
        method: "Employment ÷ establishments",
        providerIds: ["census"],
        evidenceIds: [employment.evidenceId, establishments.evidenceId],
        confidence: "high",
        isHistorical: true,
        isCalculated: true,
        isProxy: false,
        lowerBound: null,
        upperBound: null,
        limitations: ["Establishments are physical business locations, not unique companies."],
      });
    }
    if (employment && payroll && ratioCompatible(employment, payroll)) {
      const value = safeRatio((payroll.value as number) * 1_000, employment.value as number);
      metrics.push({
        metricId: `payroll-per-employee-${period}-${geography}-${industryCode}`,
        canonicalLabel: "Annual payroll per employee",
        displayLabel: "Annual payroll per employee",
        category: "wages",
        value,
        unit: "U.S. dollars per employee",
        currency: "USD",
        period,
        geography,
        industryScope: employment.marketScope,
        definition: "Annual payroll divided by employment",
        method: "(Annual payroll × 1,000) ÷ employment",
        providerIds: ["census"],
        evidenceIds: [payroll.evidenceId, employment.evidenceId],
        confidence: "high",
        isHistorical: true,
        isCalculated: true,
        isProxy: false,
        lowerBound: null,
        upperBound: null,
        limitations: ["Payroll is a labor-cost indicator and not total employee compensation."],
      });
    }
  }

  const seriesGroups = Map.groupBy(
    metrics.filter((item) => typeof item.value === "number" && /^\d{4}/.test(item.period)),
    (item) => `${item.canonicalLabel}|${item.unit}|${item.geography}|${item.industryScope}`,
  );
  for (const rows of seriesGroups.values()) {
    const ordered = [...rows].sort((left, right) => left.period.localeCompare(right.period));
    if (ordered.length < 2) continue;
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const years = Number(last.period.slice(0, 4)) - Number(first.period.slice(0, 4));
    if (years <= 0 || Number(first.value) <= 0 || Number(last.value) < 0) continue;
    const cagr = compoundAnnualGrowthRate(Number(first.value), Number(last.value), years);
    metrics.push({
      metricId: `cagr-${first.metricId}-${last.metricId}`,
      canonicalLabel: `${first.canonicalLabel} CAGR`,
      displayLabel: `${first.displayLabel} CAGR`,
      category: first.category,
      value: cagr,
      unit: "%",
      currency: null,
      period: `${first.period}–${last.period}`,
      geography: first.geography,
      industryScope: first.industryScope,
      definition: "Compound annual growth rate across compatible official observations",
      method: `((End ÷ Start)^(1 ÷ ${years}) − 1) × 100`,
      providerIds: [...new Set([...first.providerIds, ...last.providerIds])],
      evidenceIds: [...new Set([...first.evidenceIds, ...last.evidenceIds])],
      confidence: first.confidence === "high" && last.confidence === "high" ? "high" : "medium",
      isHistorical: true,
      isCalculated: true,
      isProxy: first.isProxy || last.isProxy,
      lowerBound: null,
      upperBound: null,
      limitations: [...new Set([...first.limitations, ...last.limitations])],
    });
  }

  const regionalGroups = Map.groupBy(
    metrics.filter((item) =>
      typeof item.value === "number" &&
      (item.canonicalLabel === "Establishment count" || item.canonicalLabel === "Employment")),
    (item) => `${item.canonicalLabel}|${item.period}|${item.industryScope}`,
  );
  for (const rows of regionalGroups.values()) {
    const national = rows.find((item) => item.geography === "United States");
    if (!national || Number(national.value) === 0) continue;
    for (const regional of rows.filter((item) => item.geography !== "United States")) {
      if (regional.unit !== national.unit) continue;
      const value = safeRatio(Number(regional.value), Number(national.value)) * 100;
      metrics.push({
        metricId: `regional-share-${regional.metricId}`,
        canonicalLabel: `Regional ${regional.canonicalLabel.toLowerCase()} share`,
        displayLabel: `Regional ${regional.displayLabel.toLowerCase()} share`,
        category: "regional concentration",
        value,
        unit: "%",
        currency: null,
        period: regional.period,
        geography: regional.geography,
        industryScope: regional.industryScope,
        definition: `${regional.geography} divided by the national ${regional.canonicalLabel.toLowerCase()}`,
        method: `Regional ${regional.canonicalLabel} ÷ national ${national.canonicalLabel} × 100`,
        providerIds: ["census"],
        evidenceIds: [...new Set([...regional.evidenceIds, ...national.evidenceIds])],
        confidence: "high",
        isHistorical: true,
        isCalculated: true,
        isProxy: false,
        lowerBound: null,
        upperBound: null,
        limitations: ["The share reflects the confirmed NAICS employer footprint, not the full commercial market."],
      });
    }
  }
  return metrics;
}
