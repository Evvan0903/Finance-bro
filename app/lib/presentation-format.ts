export type PresentationLocale = "zh" | "en";

export type PresentationMetric = {
  value: number | null;
  unit: string;
  currency?: string | null;
};

type FinancialUnit = "million" | "billion" | "trillion";

const NUMBER_LOCALE: Record<PresentationLocale, string> = {
  zh: "zh-CN",
  en: "en-US",
};

const DIVISOR: Record<FinancialUnit, number> = {
  million: 1e6,
  billion: 1e9,
  trillion: 1e12,
};

function number(value: number, locale: PresentationLocale, maximumFractionDigits = 1) {
  return new Intl.NumberFormat(NUMBER_LOCALE[locale], {
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

function currencyLabel(currency: string | null | undefined) {
  return currency === "USD" ? "US$" : currency ?? "";
}

function bestFinancialUnit(value: number): FinancialUnit {
  const absolute = Math.abs(value);
  if (absolute >= DIVISOR.trillion) return "trillion";
  if (absolute >= DIVISOR.billion) return "billion";
  return "million";
}

export function formatFinancialValue(
  value: number | null,
  currency: string | null | undefined,
  locale: PresentationLocale,
  maximumFractionDigits?: number,
) {
  if (value === null || !Number.isFinite(value)) return "—";
  const unit = bestFinancialUnit(value);
  const prefix = currencyLabel(currency);
  const displayPrefix = prefix === "US$" ? prefix : prefix ? `${prefix} ` : "";
  const scaled = value / DIVISOR[unit];
  const digits = maximumFractionDigits ?? (
    unit === "trillion" ? 2 : unit === "million" && Math.abs(scaled) >= 100 ? 0 : 1
  );
  const unitLabel = locale === "zh"
    ? { million: "百万", billion: "十亿", trillion: "万亿" }[unit]
    : unit;
  return `${displayPrefix}${number(scaled, locale, digits)} ${unitLabel}`;
}

export function formatFinancialTableValue(
  value: number | null,
  locale: PresentationLocale,
  unit: FinancialUnit = "billion",
) {
  if (value === null || !Number.isFinite(value)) return "—";
  return number(value / DIVISOR[unit], locale, 1);
}

export function formatFinancialUnitLabel(
  currency: string | null | undefined,
  locale: PresentationLocale,
  unit: FinancialUnit = "billion",
) {
  const currencyUnit = `${currencyLabel(currency)} ${unit}`.trim();
  return locale === "zh" ? `单位：${unit === "million" ? "百万" : unit === "billion" ? "十亿" : "万亿"}${currency === "USD" ? "美元" : currency ?? ""}` : `Unit: ${currencyUnit}`;
}

export function formatFinancialMixedUnitLabel(
  currency: string | null | undefined,
  locale: PresentationLocale,
  unit: FinancialUnit = "billion",
  percentageKind: "margins" | "rates-ratios" = "margins",
) {
  const financial = `${currencyLabel(currency)} ${unit}`.trim();
  return locale === "zh"
    ? `金额单位：${unit === "million" ? "百万" : unit === "billion" ? "十亿" : "万亿"}${currency === "USD" ? "美元" : currency ?? ""}；${percentageKind === "rates-ratios" ? "利率及比率" : "利润率"}单位：%`
    : `Financial values in ${financial}; ${percentageKind === "rates-ratios" ? "rates and ratios" : "margins"} in %`;
}

export function formatPercentage(value: number | null, locale: PresentationLocale) {
  return value === null || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat(NUMBER_LOCALE[locale], {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value);
}

export function formatPerUnitValue(
  value: number,
  currency: string | null | undefined,
  locale: PresentationLocale,
  denominator: string,
) {
  const prefix = currencyLabel(currency);
  const displayPrefix = prefix === "US$" ? prefix : prefix ? `${prefix} ` : "";
  if (locale === "zh") {
    const denominatorLabel: Record<string, string> = {
      share: "股",
      unit: "单位",
      bbl: "桶",
      boe: "桶油当量",
      day: "日",
    };
    return `${displayPrefix}${number(value, locale, 2)} / ${denominatorLabel[denominator] ?? denominator}`;
  }
  return `${displayPrefix}${number(value, locale, 2)} per ${denominator === "unit" ? "unit" : denominator}`;
}

export function formatMultiple(
  value: number | null,
  locale: PresentationLocale,
  fractionDigits = 2,
) {
  return value === null || !Number.isFinite(value)
    ? "—"
    : `${number(value, locale, fractionDigits)}x`;
}

export function formatCanonicalMetricValue(
  metric: PresentationMetric,
  locale: PresentationLocale = "en",
) {
  if (metric.value === null) return "—";
  if (metric.currency && metric.unit === metric.currency) {
    return formatFinancialValue(metric.value, metric.currency, locale);
  }
  if (metric.unit === "ratio") return formatPercentage(metric.value, locale);
  if (metric.unit === "year") {
    return new Intl.NumberFormat(NUMBER_LOCALE[locale], {
      useGrouping: false,
      maximumFractionDigits: 0,
    }).format(metric.value);
  }
  if (metric.currency && metric.unit.startsWith(`${metric.currency}/`)) {
    return formatPerUnitValue(
      metric.value,
      metric.currency,
      locale,
      metric.unit.slice(metric.currency.length + 1),
    );
  }
  return `${number(metric.value, locale, 1)} ${metric.unit}`;
}
