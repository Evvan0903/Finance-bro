import { MemoryCache } from "../../lib/cache";
import {
  MetricRegistry,
  formatMetricForDisplay,
  publishLocatorAuditToRegistry,
} from "../../lib/canonical-metrics";
import type { CanonicalMetricObject } from "../../lib/canonical-metrics";
import { buildCanonicalScenarios } from "../../lib/canonical-scenarios";
import { auditResearchReport } from "../../lib/metric-consistency-auditor";
import { REPORT_RENDERING_MODEL } from "../../lib/report-rendering-model";
import {
  buildFinancialMetricRegistry,
  ensureCoreDerivedMetrics,
  financialPeriodsFromRegistry,
  FINANCIAL_DEFINITION_IDS,
} from "../../lib/financial-metrics";
import { getSectorMethods } from "../../lib/sector-methodology";
import { getSectorPack } from "../../lib/sector-packs";
import { getSectorOutlook, sectorEvidenceSources } from "../../lib/sector-retrieval";
import {
  runShellMetricValidation,
  SHELL_2025_20F_URL,
} from "../../lib/shell-metric-validation";
import type {
  CompanyFactsPayload,
  MetricLocatorAudit,
} from "../../lib/metric-locator-types";
import type {
  ResearchMarket,
  ResearchOptions,
  ResearchSelection,
  SectorKpiDefinition,
  SectorPack,
  SupportedSector,
  SupportedSubindustry,
} from "../../lib/sector-types";
import type {
  CatalystPoint,
  DashboardMetric,
  FilingSource,
  FinancialPeriod,
  InvestmentDebate,
  MetricUsage,
  PeerComparisonItem,
  ResearchLocale,
  ResearchReport,
  RiskPoint,
  SectorDriverExposure,
  SectorKpiResult,
  ThesisPoint,
} from "../../lib/research-types";
import shellSourceSnapshot from "../../../tests/fixtures/shel-source-snapshot.json";

export const dynamic = "force-dynamic";

const SEC_HEADERS = {
  Accept: "application/json, text/html;q=0.9, */*;q=0.8",
  "Accept-Encoding": "gzip, deflate",
  "User-Agent": process.env.SEC_USER_AGENT ?? "ScopeLine Research contact@example.com",
};
const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"]);
const INTERIM_FORMS = new Set(["10-Q", "10-Q/A", "6-K"]);
const SEC_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const TICKER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RESEARCH_DATE = "2026-07-16";
const FREE_CASH_FLOW_UNAVAILABLE = "Unable to calculate free cash flow from available filings.";

type TickerRecord = { cik_str: number; ticker: string; title: string };
type CompanyFacts = CompanyFactsPayload;
type Submissions = {
  cik: string;
  name: string;
  sic?: string;
  sicDescription?: string;
  fiscalYearEnd?: string;
  exchanges?: string[];
  tickers?: string[];
  entityType?: string;
  category?: string;
  filings?: { recent?: Record<string, Array<string | number | null>> };
};
type ResearchPayload = {
  company?: string;
  locale?: ResearchLocale;
  market?: ResearchMarket;
  sector?: SupportedSector;
  subindustry?: SupportedSubindustry;
  options?: Partial<ResearchOptions>;
  fixture?: boolean;
};
type ReportSourceSnapshot = {
  companyFacts: CompanyFactsPayload;
  submissions: Submissions;
  retrievedAt: string;
};

const COPY = {
  zh: {
    dataUnavailable: "数据不可用",
    notDisclosed: "未披露",
    unableFcf: "无法根据现有申报计算自由现金流。",
    annualFiling: "最新年度申报",
    interimFiling: "最新中期/当前申报",
    reportingIssuer: "SEC 申报发行人",
  },
  en: {
    dataUnavailable: "Data unavailable",
    notDisclosed: "Not disclosed",
    unableFcf: FREE_CASH_FLOW_UNAVAILABLE,
    annualFiling: "Latest annual filing",
    interimFiling: "Latest interim/current filing",
    reportingIssuer: "SEC reporting issuer",
  },
} as const;

const DEFAULT_OPTIONS: ResearchOptions = {
  sectorOutlook: true,
  peerComparison: true,
  valuation: true,
  dueDiligence: true,
  pdfExport: true,
};

const ALIASES: Record<string, string> = {
  google: "GOOGL",
  facebook: "META",
  meta: "META",
  shell: "SHEL",
  nvidia: "NVDA",
  amazon: "AMZN",
  berkshire: "BRK-B",
};

// Resolve the currently supported research universe without spending a remote
// SEC request on the ticker directory. The CIK identifiers are public SEC
// identifiers; all filings and financial facts still come from SEC endpoints.
const SUPPORTED_TICKER_RECORDS: TickerRecord[] = [
  { cik_str: 1306965, ticker: "SHEL", title: "Shell plc" },
  { cik_str: 34088, ticker: "XOM", title: "Exxon Mobil Corp" },
  { cik_str: 93410, ticker: "CVX", title: "Chevron Corp" },
  { cik_str: 313807, ticker: "BP", title: "BP p.l.c." },
  { cik_str: 879764, ticker: "TTE", title: "TotalEnergies SE" },
  { cik_str: 1045810, ticker: "NVDA", title: "NVIDIA Corp" },
  { cik_str: 2488, ticker: "AMD", title: "Advanced Micro Devices Inc" },
  { cik_str: 1730168, ticker: "AVGO", title: "Broadcom Inc" },
  { cik_str: 50863, ticker: "INTC", title: "Intel Corp" },
  { cik_str: 1046179, ticker: "TSM", title: "Taiwan Semiconductor Manufacturing Co Ltd" },
];

const secCache = new MemoryCache<unknown>(SEC_CACHE_TTL_MS);
const tickerCache = new MemoryCache<TickerRecord[]>(TICKER_CACHE_TTL_MS);

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(incorporated|inc|corp|corporation|company|co|plc|limited|ltd|holdings?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function secFetch<T>(url: string): Promise<T> {
  return secCache.getOrLoad(url, async () => {
    const response = await fetch(url, {
      headers: SEC_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`SEC_HTTP_${response.status}`);
    return response.json();
  }) as Promise<T>;
}

async function secTextFetch(url: string): Promise<string> {
  return secCache.getOrLoad(`text:${url}`, async () => {
    const response = await fetch(url, {
      headers: SEC_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`SEC_HTTP_${response.status}`);
    return response.text();
  }) as Promise<string>;
}

async function getTickerRecords() {
  return tickerCache.getOrLoad("sec-tickers", async () => {
    const payload = await secFetch<Record<string, TickerRecord>>(
      "https://www.sec.gov/files/company_tickers.json",
    );
    return Object.values(payload);
  });
}

async function resolveCompany(query: string) {
  const normalizedQuery = normalize(query);
  const upperQuery = query.trim().toUpperCase();
  const aliasTicker = ALIASES[normalizedQuery];
  const supportedRecord = SUPPORTED_TICKER_RECORDS.find(
    (record) =>
      record.ticker === (aliasTicker ?? upperQuery) ||
      normalize(record.title) === normalizedQuery,
  );
  if (supportedRecord) return supportedRecord;

  const records = await getTickerRecords();
  const exactTicker = records.find(
    (record) => record.ticker.toUpperCase() === (aliasTicker ?? upperQuery),
  );
  if (exactTicker) return exactTicker;

  return records
    .map((record) => {
      const title = normalize(record.title);
      let score = 99;
      if (title === normalizedQuery) score = 0;
      else if (title.startsWith(normalizedQuery)) score = 1;
      else if (title.includes(normalizedQuery)) score = 2;
      else if (normalizedQuery.includes(title) && title.length > 3) score = 3;
      return { record, score, titleLength: title.length };
    })
    .filter((candidate) => candidate.score < 99)
    .sort((a, b) => a.score - b.score || a.titleLength - b.titleLength)[0]?.record ?? null;
}

function compactMoney(value: number | null, currency: string, locale: ResearchLocale) {
  if (value === null) return "—";
  const absolute = Math.abs(value);
  const scale = absolute >= 1e9 ? 1e9 : absolute >= 1e6 ? 1e6 : 1;
  const suffix = scale === 1e9 ? "bn" : scale === 1e6 ? "m" : "";
  const amount = value / scale;
  return `${currency} ${new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    minimumFractionDigits: Math.abs(amount) >= 100 ? 0 : 1,
    maximumFractionDigits: Math.abs(amount) >= 100 ? 0 : 1,
  }).format(amount)}${suffix}`;
}

function percentage(value: number | null, locale: ResearchLocale) {
  return value === null
    ? "—"
    : new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value);
}

function recentFilings(submissions: Submissions) {
  const recent = submissions.filings?.recent ?? {};
  const forms = (recent.form ?? []) as Array<string | null>;
  return forms.map((form, index) => ({
    form: String(form ?? ""),
    accessionNumber: String(recent.accessionNumber?.[index] ?? ""),
    filingDate: String(recent.filingDate?.[index] ?? ""),
    reportDate: String(recent.reportDate?.[index] ?? ""),
    primaryDocument: String(recent.primaryDocument?.[index] ?? ""),
  }));
}

function filingSource(
  submissions: Submissions,
  forms: Set<string>,
  title: string,
): FilingSource | null {
  const filing = recentFilings(submissions).find((item) => forms.has(item.form));
  if (!filing?.accessionNumber || !filing.primaryDocument) return null;
  const cikNumber = String(Number(String(submissions.cik).padStart(10, "0")));
  const accession = filing.accessionNumber.replace(/-/g, "");
  return {
    title,
    form: filing.form,
    filed: filing.filingDate,
    reportDate: filing.reportDate,
    url: `https://www.sec.gov/Archives/edgar/data/${cikNumber}/${accession}/${filing.primaryDocument}`,
  };
}

async function shellMetricAudit(
  record: TickerRecord,
  facts: CompanyFacts,
  verifiedSnapshot = false,
): Promise<MetricLocatorAudit | null> {
  if (record.ticker !== "SHEL") return null;
  if (verifiedSnapshot) {
    return runShellMetricValidation({
      companyFacts: facts as CompanyFactsPayload,
      verifiedSnapshot: true,
    });
  }
  try {
    const filingHtml = await secTextFetch(SHELL_2025_20F_URL);
    return runShellMetricValidation({
      companyFacts: facts as CompanyFactsPayload,
      filingHtml,
      verifiedSnapshot: false,
    });
  } catch {
    return runShellMetricValidation({
      companyFacts: facts as CompanyFactsPayload,
      verifiedSnapshot: true,
    });
  }
}

function kpiValue(
  definition: SectorKpiDefinition,
  latest: FinancialPeriod,
  currency: string,
  locale: ResearchLocale,
) {
  switch (definition.availability) {
    case "revenue":
      return compactMoney(latest.revenue, currency, locale);
    case "grossMargin":
      return percentage(latest.grossMargin, locale);
    case "inventory":
      return compactMoney(latest.inventory, currency, locale);
    case "cashCapex":
      return compactMoney(latest.cashCapex, currency, locale);
    case "freeCashFlow":
      return latest.cashCapex === null || latest.operatingCashFlow === null
        ? "—"
        : compactMoney(latest.freeCashFlowProxy, currency, locale);
    case "netDebt":
      return compactMoney(latest.netDebt, currency, locale);
    default:
      return "—";
  }
}

function kpiHasValue(definition: SectorKpiDefinition, latest: FinancialPeriod) {
  switch (definition.availability) {
    case "revenue":
      return latest.revenue !== null;
    case "grossMargin":
      return latest.grossMargin !== null;
    case "inventory":
      return latest.inventory !== null;
    case "cashCapex":
      return latest.cashCapex !== null;
    case "freeCashFlow":
      return latest.freeCashFlowProxy !== null;
    case "netDebt":
      return latest.netDebt !== null;
    default:
      return false;
  }
}

function buildSectorKpis(
  pack: SectorPack,
  latest: FinancialPeriod,
  currency: string,
  locale: ResearchLocale,
  metricAudit: MetricLocatorAudit | null,
  metricRegistry: MetricRegistry,
  companyId: string,
): SectorKpiResult[] {
  const located = new Map(
    metricAudit?.results.map((result) => [result.metricId, result]) ?? [],
  );
  return pack.coreKpis.map((definition): SectorKpiResult => {
    const locatorResult = located.get(definition.id);
    if (locatorResult) {
      const canonicalMetric = metricRegistry.getMetric({
        company_id: companyId,
        metric_id: locatorResult.metricId,
        period_end: locatorResult.period ?? undefined,
        definition_id: locatorResult.definitionId,
      });
      return {
        id: definition.id,
        label: definition.label[locale],
        value: locatorResult.displayValue ?? "—",
        usable: locatorResult.found,
        status: locatorResult.status,
        period: locatorResult.period,
        definition:
          locatorResult.definitionId === FINANCIAL_DEFINITION_IDS.issuerNetDebt
            ? locale === "zh"
              ? "发行人报告净债务：流动与非流动债务减现金，并调整债务对冲衍生品及相关抵押品。"
              : "Issuer-reported net debt: current and non-current debt less cash, adjusted for debt-hedging derivatives and associated collateral."
            : locatorResult.definitionId === FINANCIAL_DEFINITION_IDS.issuerCashCapex
              ? locale === "zh"
                ? "发行人报告现金资本开支，来自年度申报的自定义 XBRL。"
                : "Issuer-reported cash capital expenditure from filing-level custom XBRL."
              : definition.description[locale],
        classification:
          locatorResult.status === "Derived" ? "Derived calculation" : "Reported fact",
        sourceNote: locatorResult.found
          ? `${locatorResult.sourceDocument} · ${locatorResult.filingDate} · ${locatorResult.section}${locatorResult.table ? ` / ${locatorResult.table}` : ""} / ${locatorResult.row} · ${(locatorResult.confidence * 100).toFixed(0)}% confidence`
          : locatorResult.reason ?? locatorResult.status,
        sourceUrl: locatorResult.sourceUrl,
        confidence: locatorResult.confidence,
        extractionMethod: locatorResult.extractionMethod,
        canonicalKey: canonicalMetric.canonical_key,
        whyItMatters:
          locale === "zh"
            ? `该指标用于回答：${pack.researchQuestions[
                pack.coreKpis.indexOf(definition) % pack.researchQuestions.length
              ].zh}`
            : `This metric helps answer: ${pack.researchQuestions[
                pack.coreKpis.indexOf(definition) % pack.researchQuestions.length
              ].en}`,
      } satisfies SectorKpiResult;
    }
    const derived = ["grossMargin", "freeCashFlow", "netDebt"].includes(definition.availability);
    const available = kpiHasValue(definition, latest);
    const metricField = {
      revenue: "revenue",
      grossMargin: "grossMargin",
      inventory: "inventory",
      cashCapex: "cashCapex",
      freeCashFlow: "freeCashFlowProxy",
      netDebt: "netDebt",
      notStandardized: "",
    }[definition.availability];
    const canonicalKey = metricField ? latest.metricKeys[metricField] ?? "" : "";
    return {
      id: definition.id,
      label: definition.label[locale],
      value: kpiValue(definition, latest, currency, locale),
      usable: available,
      status: available ? (derived ? "Derived" : "Reported") : "Not yet extracted",
      period: available ? latest.periodEnd : null,
      definition: definition.description[locale],
      classification: derived ? "Derived calculation" : "Reported fact",
      sourceNote: available
        ? locale === "zh"
          ? "SEC Company Facts；按本页公式标准化。"
          : "SEC Company Facts; normalized using the displayed formula."
        : locale === "zh"
          ? "标准化 SEC Company Facts 未披露；需回到最新年报分部与业务附注。"
          : "Not disclosed in standardized SEC Company Facts; review the latest annual filing's segment and business notes.",
      sourceUrl: null,
      confidence: available ? 0.9 : 0,
      extractionMethod: available ? "Deterministic SEC Company Facts normalization" : null,
      canonicalKey,
      whyItMatters:
        locale === "zh"
          ? `该指标用于回答：${pack.researchQuestions[
              pack.coreKpis.indexOf(definition) % pack.researchQuestions.length
            ].zh}`
          : `This metric helps answer: ${pack.researchQuestions[
              pack.coreKpis.indexOf(definition) % pack.researchQuestions.length
            ].en}`,
    };
  }).filter((result) => result.usable && result.canonicalKey);
}

function matchingClaim(
  query: string,
  outlook: Awaited<ReturnType<typeof getSectorOutlook>>,
) {
  const tokens = new Set(
    query
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
  return [...outlook.claims]
    .map((claim) => {
      const haystack = `${claim.topic} ${claim.title}`.toLowerCase();
      const score = [...tokens].reduce(
        (sum, token) => sum + (haystack.includes(token) ? 1 : 0),
        0,
      );
      return { claim, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.claim;
}

const PERIOD_FIELD_BY_METRIC_ID: Record<string, string> = {
  revenue: "revenue",
  "revenue-growth": "revenueGrowth",
  "revenue-cagr": "revenueCagr",
  "gross-profit": "grossProfit",
  "net-income": "netIncome",
  "net-margin": "netMargin",
  "net-margin-change": "netMarginChange",
  "gross-margin": "grossMargin",
  "operating-cash-flow": "operatingCashFlow",
  "operating-cash-flow-margin": "operatingCashFlowMargin",
  "cash-capex": "cashCapex",
  fcf: "freeCashFlowProxy",
  "fcf-margin": "freeCashFlowMargin",
  "cash-conversion": "cashConversion",
  assets: "assets",
  liabilities: "liabilities",
  "liabilities-assets": "liabilitiesAssets",
  inventory: "inventory",
  "current-ratio": "currentRatio",
  "net-debt": "netDebt",
};

const DRIVER_METRIC_IDS: Record<string, string[]> = {
  "oil-balance": ["production", "realized-prices", "operating-cash-flow"],
  "lng-cycle": ["lng", "segment-earnings", "operating-cash-flow"],
  "refining-cycle": ["refining-margin", "segment-earnings", "operating-cash-flow"],
  "capital-discipline": ["cash-capex", "fcf", "net-debt", "dividends", "share-buybacks"],
  "ai-demand": ["revenue", "revenue-growth", "gross-margin", "fcf"],
  capacity: ["gross-margin", "inventory", "cash-capex"],
  "product-cycle": ["revenue-growth", "gross-margin", "inventory"],
  "export-controls": ["revenue", "revenue-growth", "inventory"],
};

function selectedCanonicalMetrics(
  registry: MetricRegistry,
  companyId: string,
  latest: FinancialPeriod,
  metricIds: string[],
) {
  const selected: CanonicalMetricObject[] = [];
  for (const metricId of metricIds) {
    const field = PERIOD_FIELD_BY_METRIC_ID[metricId];
    const exactKey = field ? latest.metricKeys[field] : undefined;
    const exact = exactKey ? registry.getByKey(exactKey) : null;
    const candidates = exact
      ? [exact]
      : registry.findMetrics({
          company_id: companyId,
          metric_id: metricId,
          period_end: latest.periodEnd,
        }).filter((metric) => metric.value !== null && ["Reported", "Derived"].includes(metric.status));
    const chosen = candidates.sort((left, right) =>
      right.confidence - left.confidence ||
      left.definition_id.localeCompare(right.definition_id)
    )[0];
    if (chosen && !selected.some((metric) => metric.canonical_key === chosen.canonical_key)) {
      selected.push(chosen);
    }
  }
  return selected;
}

function buildDriverExposure(
  companyName: string,
  pack: SectorPack,
  outlook: Awaited<ReturnType<typeof getSectorOutlook>>,
  locale: ResearchLocale,
  registry: MetricRegistry,
  companyId: string,
  latest: FinancialPeriod,
): SectorDriverExposure[] {
  return pack.marketDrivers.map((driver, index) => {
    const claim =
      matchingClaim(driver.query, outlook) ??
      outlook.claims[index % Math.max(outlook.claims.length, 1)];
    const canonicalMetrics = selectedCanonicalMetrics(
      registry,
      companyId,
      latest,
      DRIVER_METRIC_IDS[driver.id] ?? [],
    );
    const canonicalEvidence = canonicalMetrics
      .slice(0, 3)
      .map((metric) => `${metric.metric_id}: ${formatMetricForDisplay(metric, locale)}`)
      .join("; ");
    return {
      driver: driver.name[locale],
      companyExposure: [
        `${companyName}: ${driver.companyExposure[locale]}`,
        canonicalEvidence
          ? locale === "zh"
            ? `最新规范指标：${canonicalEvidence}。`
            : `Latest canonical metrics: ${canonicalEvidence}.`
          : "",
      ].filter(Boolean).join(" "),
      evidence: claim?.claim ?? COPY[locale].dataUnavailable,
      evidencePublisher: claim?.publisher ?? COPY[locale].dataUnavailable,
      evidenceDate: claim?.publicationDate ?? COPY[locale].dataUnavailable,
      evidenceUrl: claim?.url ?? "",
      investmentImplication: driver.implication[locale],
      metricReferences: canonicalMetrics.map((metric) => metric.canonical_key),
    };
  });
}

function buildNarrative(
  companyName: string,
  periods: FinancialPeriod[],
  currency: string,
  pack: SectorPack,
  outlook: Awaited<ReturnType<typeof getSectorOutlook>>,
  locale: ResearchLocale,
  registry: MetricRegistry,
  companyId: string,
) {
  const latest = periods.at(-1)!;
  const revenueCagr = latest.revenueCagr;
  const marginDelta = latest.netMarginChange;
  const liabilityRatio = latest.liabilitiesAssets;
  const cashConversion = latest.cashConversion;
  const primaryNetDebtMetric = latest.metricKeys.netDebt
    ? registry.getByKey(latest.metricKeys.netDebt)
    : null;
  const primarySectorMetric =
    pack.id === "semiconductors"
      ? {
          label: locale === "zh" ? "毛利率" : "Gross margin",
          value: percentage(latest.grossMargin, locale),
          detail:
            locale === "zh"
              ? "毛利率 = 毛利润 ÷ 营收；产品组合与供给成本的重要信号。"
              : "Gross margin = gross profit / revenue; a key signal for product mix and supply cost.",
          metricKey: latest.metricKeys.grossMargin ?? "",
          classification: "Derived calculation" as const,
        }
      : {
          label: locale === "zh" ? "净债务" : "Net debt",
          value: compactMoney(latest.netDebt, currency, locale),
          detail:
            primaryNetDebtMetric?.definition_id ===
            FINANCIAL_DEFINITION_IDS.issuerNetDebt
              ? locale === "zh"
                ? "发行人报告口径；包括债务对冲衍生品及相关抵押品调整，用于衡量下行周期韧性。"
                : "Issuer-reported definition including debt-hedging derivative and associated-collateral adjustments; a measure of downside-cycle resilience."
              : locale === "zh"
                ? "标准化净债务 = 总债务 - 现金；衡量周期下行韧性。"
                : "Normalized net debt = total debt - cash; a measure of downside-cycle resilience.",
          metricKey: latest.metricKeys.netDebt ?? "",
          classification:
            primaryNetDebtMetric?.status === "Reported"
              ? "Reported fact" as const
              : "Derived calculation" as const,
        };
  const fcfValue =
    latest.freeCashFlowProxy === null
      ? "—"
      : compactMoney(latest.freeCashFlowProxy, currency, locale);
  const inlineFcfValue = fcfValue.replace(/[。.]+$/, "");
  const dashboard: DashboardMetric[] = [
    {
      label: locale === "zh" ? "最新营收" : "Latest revenue",
      value: compactMoney(latest.revenue, currency, locale),
      detail:
        locale === "zh"
          ? `同比 ${percentage(latest.revenueGrowth, locale)}；多期 CAGR ${percentage(revenueCagr, locale)}`
          : `YoY ${percentage(latest.revenueGrowth, locale)}; multi-period CAGR ${percentage(revenueCagr, locale)}`,
      classification: "Reported fact",
      tone: latest.revenueGrowth === null ? "neutral" : latest.revenueGrowth >= 0 ? "positive" : "watch",
      metricKey: latest.metricKeys.revenue ?? "",
    },
    {
      label: locale === "zh" ? "净利润率" : "Net margin",
      value: percentage(latest.netMargin, locale),
      detail:
        locale === "zh"
          ? `较上年 ${marginDelta === null ? COPY.zh.dataUnavailable : `${(marginDelta * 100).toFixed(1)}个百分点`}`
          : `YoY change ${marginDelta === null ? COPY.en.dataUnavailable : `${(marginDelta * 100).toFixed(1)}ppt`}`,
      classification: "Derived calculation",
      tone: marginDelta === null ? "neutral" : marginDelta >= 0 ? "positive" : "watch",
      metricKey: latest.metricKeys.netMargin ?? "",
    },
    {
      label: locale === "zh" ? "自由现金流" : "Free cash flow",
      value: fcfValue,
      detail:
        locale === "zh"
          ? "FCF = 经营现金流 - 现金资本开支；资本开支缺失时不计算。"
          : "FCF = operating cash flow - cash capital expenditure; no value is calculated when capex is unavailable.",
      classification: "Derived calculation",
      tone: latest.freeCashFlowProxy === null ? "neutral" : latest.freeCashFlowProxy > 0 ? "positive" : "watch",
      metricKey: latest.metricKeys.freeCashFlowProxy ?? "",
    },
    {
      label: primarySectorMetric.label,
      value: primarySectorMetric.value,
      detail: primarySectorMetric.detail,
      classification: primarySectorMetric.classification,
      tone: "neutral",
      metricKey: primarySectorMetric.metricKey,
    },
    {
      label: locale === "zh" ? "负债 / 资产" : "Liabilities / assets",
      value: percentage(liabilityRatio, locale),
      detail:
        locale === "zh"
          ? `流动比率 ${latest.currentRatio === null ? COPY.zh.dataUnavailable : `${latest.currentRatio.toFixed(2)}x`}`
          : `Current ratio ${latest.currentRatio === null ? COPY.en.dataUnavailable : `${latest.currentRatio.toFixed(2)}x`}`,
      classification: "Derived calculation",
      tone: liabilityRatio === null ? "neutral" : liabilityRatio <= 0.65 ? "positive" : "watch",
      metricKey: latest.metricKeys.liabilitiesAssets ?? "",
    },
  ];
  const visibleDashboard = dashboard.filter((_, index) => [
    latest.revenue !== null,
    latest.netMargin !== null,
    latest.freeCashFlowProxy !== null,
    pack.id === "semiconductors" ? latest.grossMargin !== null : latest.netDebt !== null,
    liabilityRatio !== null,
  ][index]);

  const earningsQuality =
    locale === "zh"
      ? [
          `${companyName} 最新年度净利润为 ${compactMoney(latest.netIncome, currency, locale)}，经营现金流为 ${compactMoney(latest.operatingCashFlow, currency, locale)}。`,
          latest.freeCashFlowProxy === null
            ? COPY.zh.unableFcf
            : `FCF = 经营现金流 - 现金资本开支 = ${compactMoney(latest.freeCashFlowProxy, currency, locale)}；FCF / 净利润为 ${cashConversion === null ? COPY.zh.dataUnavailable : `${cashConversion.toFixed(2)}x`}。`,
          pack.id === "semiconductors"
            ? `毛利率 ${percentage(latest.grossMargin, locale)}，库存 ${compactMoney(latest.inventory, currency, locale)}；需结合产品换代和供给承诺判断周期质量。`
            : `现金资本开支 ${compactMoney(latest.cashCapex, currency, locale)}，净债务 ${compactMoney(latest.netDebt, currency, locale)}；需结合商品价格与分配政策判断覆盖。`,
          "标准化 XBRL 不足以识别所有重组、减值、一次性项目或管理层调整项，需回到年报附注复核。",
        ]
      : [
          `${companyName}'s latest annual net income was ${compactMoney(latest.netIncome, currency, locale)}, versus operating cash flow of ${compactMoney(latest.operatingCashFlow, currency, locale)}.`,
          latest.freeCashFlowProxy === null
            ? COPY.en.unableFcf
            : `FCF = operating cash flow - cash capital expenditure = ${compactMoney(latest.freeCashFlowProxy, currency, locale)}; FCF / net income was ${cashConversion === null ? COPY.en.dataUnavailable : `${cashConversion.toFixed(2)}x`}.`,
          pack.id === "semiconductors"
            ? `Gross margin was ${percentage(latest.grossMargin, locale)} and inventory was ${compactMoney(latest.inventory, currency, locale)}; assess both with product transitions and supply commitments.`
            : `Cash capex was ${compactMoney(latest.cashCapex, currency, locale)} and net debt was ${compactMoney(latest.netDebt, currency, locale)}; assess coverage with commodity prices and distribution policy.`,
          "Standardized XBRL cannot identify every restructuring, impairment, one-off, or management adjustment; verify them in the annual-filing notes.",
        ];

  const thesis: ThesisPoint[] = pack.marketDrivers.slice(0, 4).map((driver, index) => {
    const claim =
      matchingClaim(driver.query, outlook) ??
      outlook.claims[index % Math.max(outlook.claims.length, 1)];
    const metricReferences = selectedCanonicalMetrics(
      registry,
      companyId,
      latest,
      [
        ...(DRIVER_METRIC_IDS[driver.id] ?? []),
        "revenue-growth",
        "fcf",
      ],
    ).map((metric) => metric.canonical_key);
    return {
      title: driver.name[locale],
      view:
        locale === "zh"
          ? `${companyName} 的相关敞口是${driver.companyExposure.zh} 最新营收增长 ${percentage(latest.revenueGrowth, locale)}、FCF ${inlineFcfValue}。行业证据：${claim?.publisher ?? COPY.zh.dataUnavailable} · ${claim?.publicationDate ?? COPY.zh.dataUnavailable}。`
          : `${companyName}'s relevant exposure is ${driver.companyExposure.en} Latest revenue growth was ${percentage(latest.revenueGrowth, locale)} and FCF was ${inlineFcfValue}. Sector evidence: ${claim?.publisher ?? COPY.en.dataUnavailable} · ${claim?.publicationDate ?? COPY.en.dataUnavailable}.`,
      counterEvidence: pack.risks[index % pack.risks.length][locale],
      monitor: pack.researchQuestions[index % pack.researchQuestions.length][locale],
      metricReferences,
    };
  });

  const riskMetricReferences = selectedCanonicalMetrics(
    registry,
    companyId,
    latest,
    ["revenue-growth", "net-margin", "fcf", "net-debt"],
  ).map((metric) => metric.canonical_key);
  const risks: RiskPoint[] = pack.risks.map((risk, index) => ({
    title: risk[locale],
    evidence:
      locale === "zh"
        ? `${companyName} 最新营收增速 ${percentage(latest.revenueGrowth, locale)}、净利润率 ${percentage(latest.netMargin, locale)}、FCF ${inlineFcfValue}。`
        : `${companyName}'s latest revenue growth was ${percentage(latest.revenueGrowth, locale)}, net margin ${percentage(latest.netMargin, locale)}, and FCF ${inlineFcfValue}.`,
    thesisBreaker:
      locale === "zh"
        ? `若“${pack.researchQuestions[index % pack.researchQuestions.length].zh}”连续两个报告期无法得到积极验证，则该论点失效。`
        : `The thesis breaks if "${pack.researchQuestions[index % pack.researchQuestions.length].en}" cannot be positively validated for two reporting periods.`,
    metricReferences: riskMetricReferences,
  }));
  return { dashboard: visibleDashboard, earningsQuality, thesis, risks };
}

function buildDebates(
  companyName: string,
  pack: SectorPack,
  outlook: Awaited<ReturnType<typeof getSectorOutlook>>,
  locale: ResearchLocale,
  registry: MetricRegistry,
  companyId: string,
  latest: FinancialPeriod,
): InvestmentDebate[] {
  return pack.researchQuestions.slice(0, 4).map((question, index) => {
    const driver = pack.marketDrivers[index % pack.marketDrivers.length];
    const claim =
      matchingClaim(driver.query, outlook) ??
      outlook.claims[index % Math.max(outlook.claims.length, 1)];
    return {
      question: question[locale],
      evidenceFor:
        claim?.claim ??
        (locale === "zh" ? "近期行业证据不足。" : "Recent sector evidence is insufficient."),
      evidenceAgainst: pack.risks[index % pack.risks.length][locale],
      monitor: `${companyName}: ${pack.coreKpis[index % pack.coreKpis.length].label[locale]}`,
      metricReferences: selectedCanonicalMetrics(
        registry,
        companyId,
        latest,
        DRIVER_METRIC_IDS[driver.id] ?? [],
      ).map((metric) => metric.canonical_key),
    };
  });
}

function catalystPoints(
  items: SectorPack["catalysts"]["operating"],
  locale: ResearchLocale,
  metricReferences: string[],
): CatalystPoint[] {
  return items.map((item) => ({
    timing: locale === "zh" ? "持续监测" : "Ongoing monitor",
    event: item[locale],
    investorRelevance:
      locale === "zh"
        ? "仅在经营或财务结果改变时视为催化剂；单纯申报日期不是催化剂。"
        : "Treated as a catalyst only when operating or financial outcomes change; a filing date alone is not a catalyst.",
    metricReferences,
  }));
}

async function buildPeerComparison(
  pack: SectorPack,
  locale: ResearchLocale,
  reportRegistry: MetricRegistry,
  dataVersion: string,
  retrievedAt: string,
): Promise<PeerComparisonItem[]> {
  return Promise.all(
    pack.peers.map(async (peer) => {
      try {
        const facts = await secFetch<CompanyFacts>(
          `https://data.sec.gov/api/xbrl/companyfacts/CIK${peer.cik}.json`,
        );
        const peerRegistry = buildFinancialMetricRegistry({
          facts: facts as CompanyFactsPayload,
          companyId: peer.ticker,
          sector: pack.id,
          dataVersion,
          retrievedAt,
        });
        for (const metric of peerRegistry.values()) {
          reportRegistry.registerOrVerify(metric);
        }
        const { periods } = financialPeriodsFromRegistry(peerRegistry, peer.ticker);
        const latest = periods.at(-1);
        return {
          ticker: peer.ticker,
          name: peer.name,
          rationale: peer.rationale[locale],
          revenueGrowth: latest?.revenueGrowth ?? null,
          netMargin: latest?.netMargin ?? null,
          freeCashFlowMargin: latest?.freeCashFlowMargin ?? null,
          periodEnd: latest?.periodEnd ?? null,
          metricReferences: {
            ...(latest?.metricKeys.revenueGrowth
              ? { revenueGrowth: latest.metricKeys.revenueGrowth }
              : {}),
            ...(latest?.metricKeys.netMargin
              ? { netMargin: latest.metricKeys.netMargin }
              : {}),
            ...(latest?.metricKeys.freeCashFlowMargin
              ? { freeCashFlowMargin: latest.metricKeys.freeCashFlowMargin }
              : {}),
          },
        };
      } catch {
        return {
          ticker: peer.ticker,
          name: peer.name,
          rationale: peer.rationale[locale],
          revenueGrowth: null,
          netMargin: null,
          freeCashFlowMargin: null,
          periodEnd: null,
          metricReferences: {},
        };
      }
    }),
  );
}

function buildMetricUsage(
  registry: MetricRegistry,
  locale: ResearchLocale,
  groups: Array<{ module: string; keys: string[] }>,
): MetricUsage[] {
  const seen = new Set<string>();
  const usage: MetricUsage[] = [];
  for (const group of groups) {
    for (const canonicalKey of group.keys.filter(Boolean)) {
      const usageKey = `${group.module}|${canonicalKey}`;
      if (seen.has(usageKey)) continue;
      seen.add(usageKey);
      const metric = registry.getByKey(canonicalKey);
      usage.push({
        module: group.module,
        canonicalKey,
        canonicalValue: metric.value,
        displayedValue:
          metric.value === null ? null : formatMetricForDisplay(metric, locale),
      });
    }
  }
  return usage;
}

function selectionFromPayload(payload: ResearchPayload): ResearchSelection | null {
  const market = payload.market ?? "Global";
  const sector = payload.sector ?? "energy";
  const subindustry = payload.subindustry ?? "integrated-oil-gas";
  if (!["US", "Europe", "Global"].includes(market)) return null;
  if (!["energy", "technology"].includes(sector)) return null;
  if (!["integrated-oil-gas", "semiconductors"].includes(subindustry)) return null;
  if (
    (sector === "energy" && subindustry !== "integrated-oil-gas") ||
    (sector === "technology" && subindustry !== "semiconductors")
  ) return null;
  return {
    market,
    sector,
    subindustry,
    options: { ...DEFAULT_OPTIONS, ...payload.options },
  };
}

async function buildReport(
  record: TickerRecord,
  selection: ResearchSelection,
  locale: ResearchLocale,
  sourceSnapshot?: ReportSourceSnapshot,
): Promise<ResearchReport> {
  const cik = String(record.cik_str).padStart(10, "0");
  const [submissions, facts, sectorOutlook] = await Promise.all([
    sourceSnapshot
      ? Promise.resolve(sourceSnapshot.submissions)
      : secFetch<Submissions>(`https://data.sec.gov/submissions/CIK${cik}.json`),
    sourceSnapshot
      ? Promise.resolve(sourceSnapshot.companyFacts)
      : secFetch<CompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`),
    getSectorOutlook(selection.market, selection.subindustry, locale),
  ]);
  const pack = getSectorPack(selection.subindustry);
  if (submissions.sic && !pack.sicCodes.includes(submissions.sic)) {
    throw new Error("SECTOR_MISMATCH");
  }

  const companyName = submissions.name || facts.entityName || record.title;
  const companyDataRetrievedAt =
    sourceSnapshot?.retrievedAt ?? new Date().toISOString();
  const latestAnnual = filingSource(submissions, ANNUAL_FORMS, COPY[locale].annualFiling);
  const latestInterim = filingSource(submissions, INTERIM_FORMS, COPY[locale].interimFiling);
  const dataVersion = [
    record.ticker,
    latestAnnual?.reportDate ?? "latest",
    latestAnnual?.filed ?? "unfiled",
    "canonical-v1",
  ].join("-");
  const metricRegistry = buildFinancialMetricRegistry({
    facts: facts as CompanyFactsPayload,
    companyId: record.ticker,
    sector: pack.id,
    dataVersion,
    retrievedAt: companyDataRetrievedAt,
  });
  const metricAudit = await shellMetricAudit(record, facts, Boolean(sourceSnapshot));
  if (metricAudit) {
    publishLocatorAuditToRegistry({
      registry: metricRegistry,
      audit: metricAudit,
      companyId: record.ticker,
      sector: pack.id,
      retrievedAt: companyDataRetrievedAt,
    });
    ensureCoreDerivedMetrics(metricRegistry, record.ticker);
  }
  const { periods, currency } = financialPeriodsFromRegistry(metricRegistry, record.ticker);
  if (!periods.length) throw new Error("INSUFFICIENT_XBRL");
  const latest = periods.at(-1)!;
  const narrative = buildNarrative(
    companyName,
    periods,
    currency,
    pack,
    sectorOutlook,
    locale,
    metricRegistry,
    record.ticker,
  );
  const scenarios = selection.options.valuation
    ? buildCanonicalScenarios({
        registry: metricRegistry,
        companyId: record.ticker,
        periods,
        pack,
        locale,
      })
    : [];
  const peerComparison = selection.options.peerComparison
    ? await buildPeerComparison(
        pack,
        locale,
        metricRegistry,
        dataVersion,
        companyDataRetrievedAt,
      )
    : [];
  const driverExposure = buildDriverExposure(
    companyName,
    pack,
    sectorOutlook,
    locale,
    metricRegistry,
    record.ticker,
    latest,
  );
  const sectorKpis = buildSectorKpis(
    pack,
    latest,
    currency,
    locale,
    metricAudit,
    metricRegistry,
    record.ticker,
  );
  const investmentDebates = selection.options.dueDiligence
    ? buildDebates(
        companyName,
        pack,
        sectorOutlook,
        locale,
        metricRegistry,
        record.ticker,
        latest,
      )
    : [];
  const filingMetricReferences = selectedCanonicalMetrics(
    metricRegistry,
    record.ticker,
    latest,
    ["revenue", "net-income", "operating-cash-flow", "fcf"],
  ).map((metric) => metric.canonical_key);
  const filingWatchlist: CatalystPoint[] = [
    ...(latestAnnual
      ? [{
          timing: latestAnnual.filed,
          event: `${latestAnnual.form} · ${latestAnnual.reportDate}`,
          investorRelevance:
            locale === "zh"
              ? "申报监测项：复核分部、会计政策、风险与资本配置；申报日期本身不是催化剂。"
              : "Filing watch item: reconcile segments, accounting policy, risks, and capital allocation; the filing date itself is not a catalyst.",
          metricReferences: filingMetricReferences,
        }]
      : []),
    ...(latestInterim
      ? [{
          timing: latestInterim.filed,
          event: `${latestInterim.form} · ${latestInterim.reportDate}`,
          investorRelevance:
            locale === "zh"
              ? "申报监测项：检查经营、流动性与指引变化；申报日期本身不是催化剂。"
              : "Filing watch item: review operating, liquidity, and guidance changes; the filing date itself is not a catalyst.",
          metricReferences: filingMetricReferences,
        }]
      : []),
  ];
  const operatingCatalystReferences = selectedCanonicalMetrics(
    metricRegistry,
    record.ticker,
    latest,
    pack.id === "integrated-oil-gas"
      ? ["production", "lng", "refining-margin", "major-projects"]
      : ["revenue-growth", "gross-margin", "inventory"],
  ).map((metric) => metric.canonical_key);
  const financialCatalystReferences = selectedCanonicalMetrics(
    metricRegistry,
    record.ticker,
    latest,
    ["cash-capex", "fcf", "net-debt", "dividends", "share-buybacks"],
  ).map((metric) => metric.canonical_key);
  const regulatoryCatalystReferences = selectedCanonicalMetrics(
    metricRegistry,
    record.ticker,
    latest,
    pack.id === "integrated-oil-gas"
      ? ["major-projects", "cash-capex"]
      : ["revenue", "inventory"],
  ).map((metric) => metric.canonical_key);
  const catalysts = {
    operating: catalystPoints(pack.catalysts.operating, locale, operatingCatalystReferences),
    financial: catalystPoints(pack.catalysts.financial, locale, financialCatalystReferences),
    regulatory: catalystPoints(pack.catalysts.regulatory, locale, regulatoryCatalystReferences),
  };
  const sourceBase = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
  const evidenceSources = sectorEvidenceSources(selection.market, selection.subindustry);
  const strictFcfFormula =
    locale === "zh"
      ? "自由现金流 = 经营现金流 - 现金资本开支"
      : "Free cash flow = operating cash flow - cash capital expenditure";
  const useValuationFallback =
    pack.valuation.metric === "freeCashFlow" &&
    (latest.cashCapex === null || latest.operatingCashFlow === null) &&
    pack.valuation.fallback !== undefined;
  const effectiveValuation = useValuationFallback ? pack.valuation.fallback! : pack.valuation;
  const valuationFormula = `${effectiveValuation.formula[locale]}; ${strictFcfFormula}.`;
  const displayedOutlook = selection.options.sectorOutlook
    ? sectorOutlook
    : { ...sectorOutlook, claims: [] };
  const criticalMetricIds = metricAudit
    ? ["cash-capex", "fcf", "net-debt"].filter(
        (id) => !metricAudit.results.find((result) => result.metricId === id)?.found,
      )
    : [
        ...(latest.cashCapex === null ? ["cash-capex"] : []),
        ...(latest.freeCashFlowProxy === null ? ["fcf"] : []),
        ...(pack.valuation.metric === "freeCashFlow" && latest.netDebt === null
          ? ["net-debt"]
          : []),
      ];
  const usageGroups = [
    ...periods.map((period) => ({
      module: `historical-table:${period.periodEnd}`,
      keys: Object.values(period.metricKeys),
    })),
    ...periods.map((period) => ({
      module: `trend-chart:${period.periodEnd}`,
      keys: [
        period.metricKeys.revenue,
        period.metricKeys.operatingCashFlow,
      ].filter(Boolean),
    })),
    { module: "dashboard", keys: narrative.dashboard.map((metric) => metric.metricKey) },
    {
      module: "earnings-quality",
      keys: selectedCanonicalMetrics(
        metricRegistry,
        record.ticker,
        latest,
        ["net-income", "operating-cash-flow", "cash-capex", "fcf", "cash-conversion", "net-debt"],
      ).map((metric) => metric.canonical_key),
    },
    ...narrative.thesis.map((item) => ({ module: "investment-thesis", keys: item.metricReferences })),
    ...narrative.risks.map((item) => ({ module: "risks", keys: item.metricReferences })),
    ...driverExposure.map((item) => ({ module: "driver-exposure", keys: item.metricReferences })),
    ...sectorKpis.map((item) => ({ module: "sector-kpis", keys: [item.canonicalKey] })),
    ...investmentDebates.map((item) => ({ module: "investment-debates", keys: item.metricReferences })),
    ...filingWatchlist.map((item) => ({ module: "filing-watchlist", keys: item.metricReferences })),
    ...Object.values(catalysts).flat().map((item) => ({
      module: "catalysts",
      keys: item.metricReferences,
    })),
    ...scenarios.map((item) => ({
      module: "scenarios",
      keys: Object.values(item.metricReferences),
    })),
    ...scenarios.map((item) => ({
      module: "valuation",
      keys: [
        item.metricReferences.enterpriseValueMultiple,
        item.metricReferences.valuationStartingPoint,
        item.metricReferences.valuationMetric,
        item.metricReferences.modelImpliedEnterpriseValue,
      ].filter(Boolean),
    })),
    ...peerComparison.map((item) => ({
      module: "peer-comparison",
      keys: Object.values(item.metricReferences),
    })),
  ];
  const quantitativeKeys = [...new Set(
    usageGroups.flatMap((group) => group.keys).filter(Boolean),
  )];
  const metricUsage = buildMetricUsage(metricRegistry, locale, [
    ...usageGroups,
    { module: "json-research-object", keys: quantitativeKeys },
    { module: "web-report", keys: quantitativeKeys },
    { module: "pdf-data-model", keys: quantitativeKeys },
  ]);

  return {
    locale,
    selection,
    company: {
      name: companyName,
      ticker: submissions.tickers?.[0] || record.ticker,
      cik,
      exchange: submissions.exchanges?.[0] || COPY[locale].notDisclosed,
      sic: submissions.sic || COPY[locale].notDisclosed,
      sicDescription: submissions.sicDescription || COPY[locale].notDisclosed,
      fiscalYearEnd: submissions.fiscalYearEnd || COPY[locale].notDisclosed,
      filingStatus: submissions.entityType || submissions.category || COPY[locale].reportingIssuer,
    },
    researchDate: RESEARCH_DATE,
    cutoff: companyDataRetrievedAt,
    evidenceCutoff: sectorOutlook.evidenceCutoff,
    sectorLastRefreshedAt: sectorOutlook.lastRefreshedAt,
    companyDataRetrievedAt,
    currency,
    latestAnnual,
    latestInterim,
    metricRegistry: metricRegistry.snapshot(),
    metricUsage,
    renderingModel: REPORT_RENDERING_MODEL,
    periods,
    dashboard: narrative.dashboard,
    sectorPack: {
      id: pack.id,
      sectorLabel: pack.sectorLabel[locale],
      subindustryLabel: pack.subindustryLabel[locale],
      researchQuestions: pack.researchQuestions.map((item) => item[locale]),
      reportGuidance: pack.reportGuidance.map((item) => item[locale]),
      valuationMethod: effectiveValuation.method[locale],
    },
    sectorOutlook: displayedOutlook,
    driverExposure,
    sectorKpis,
    dataCoverage: {
      limited: criticalMetricIds.length > 0,
      criticalMetricIds,
      searchedSources: metricAudit?.searchedSources ?? ["standard-sec-xbrl"],
      metrics: metricAudit?.results ?? [],
      notes: [
        ...(metricAudit
          ? [
              locale === "zh"
                ? `Shell FY2025 指标定位器已提取 ${metricAudit.extractedCount}/${metricAudit.requestedCount} 项。`
                : `The Shell FY2025 locator extracted ${metricAudit.extractedCount}/${metricAudit.requestedCount} requested metrics.`,
            ]
          : []),
        ...(criticalMetricIds.length
          ? [
              locale === "zh"
                ? `影响 FCF 或估值的关键输入尚未可用：${criticalMetricIds.join(", ")}。`
                : `Critical FCF or valuation inputs remain unavailable: ${criticalMetricIds.join(", ")}.`,
            ]
          : []),
      ],
    },
    overview:
      locale === "zh"
        ? `${companyName} 被纳入 ${pack.sectorLabel.zh} / ${pack.subindustryLabel.zh} 分析师包。SEC 分类为 ${submissions.sicDescription || COPY.zh.notDisclosed}（SIC ${submissions.sic || COPY.zh.notDisclosed}）。结论同时使用标准化申报事实、显式计算和 2025 年以来的近期行业证据。`
        : `${companyName} is analyzed with the ${pack.sectorLabel.en} / ${pack.subindustryLabel.en} analyst pack. Its SEC classification is ${submissions.sicDescription || COPY.en.notDisclosed} (SIC ${submissions.sic || COPY.en.notDisclosed}). Conclusions combine normalized filing facts, visible calculations, and recent sector evidence published since 2025.`,
    segmentAnalysis:
      metricAudit
        ? locale === "zh"
          ? `指标定位器依次检索标准 SEC XBRL、自定义 XBRL、申报表格与正文，并保留口径验证和拒绝记录；本期提取 ${metricAudit.extractedCount}/${metricAudit.requestedCount} 项。${pack.reportGuidance.map((item) => item.zh).join(" ")}`
          : `The metric locator searches standard SEC XBRL, custom XBRL, filing tables, and filing text in order while retaining validation and rejection records; it extracted ${metricAudit.extractedCount}/${metricAudit.requestedCount} items for this period. ${pack.reportGuidance.map((item) => item.en).join(" ")}`
        : locale === "zh"
          ? `标准化 Company Facts 不能稳定保留发行人自定义分部和经营 KPI，因此系统不推测缺失值。${pack.reportGuidance.map((item) => item.zh).join(" ")}`
          : `Standardized Company Facts does not consistently preserve issuer-defined segments and operating KPIs, so missing values are not inferred. ${pack.reportGuidance.map((item) => item.en).join(" ")}`,
    earningsQuality: narrative.earningsQuality,
    thesis: narrative.thesis,
    investmentDebates,
    filingWatchlist,
    catalysts,
    risks: narrative.risks,
    scenarios,
    peerComparison,
    valuationAssessment:
      !selection.options.valuation
        ? locale === "zh" ? "本次未选择估值模块。" : "Valuation was not selected for this run."
        : locale === "zh"
          ? `采用${effectiveValuation.method.zh}，不使用未注明日期的实时股价，不输出评级或目标价。${useValuationFallback ? "由于现金资本开支不可取得，经营现金流仅作为估值指标，未被表述为 FCF。" : ""}倍数为分析假设，企业价值用于敏感性而非价格预测。`
          : `Uses ${effectiveValuation.method.en} without an undated real-time share price, rating, or price target. ${useValuationFallback ? "Because cash capex is unavailable, operating cash flow is used only as the valuation metric and is not presented as FCF. " : ""}Multiples are analyst assumptions and enterprise values are sensitivities, not forecasts.`,
    cashFlowProxyFormula:
      latest.cashCapex === null || latest.operatingCashFlow === null
        ? COPY[locale].unableFcf
        : strictFcfFormula,
    valuationFormula,
    methodology: getSectorMethods(selection.subindustry).map((method) => ({
      name: method.name[locale],
      purpose: method.purpose[locale],
      steps: method.steps.map((step) => step[locale]),
    })),
    sources: [
      {
        title: locale === "zh" ? "SEC 公司与交易代码映射" : "SEC company and ticker mapping",
        url: "https://www.sec.gov/files/company_tickers.json",
        retrievedAt: companyDataRetrievedAt,
        publisher: "U.S. Securities and Exchange Commission",
      },
      {
        title: locale === "zh" ? "SEC 发行人申报索引" : "SEC issuer submissions index",
        url: sourceBase,
        retrievedAt: companyDataRetrievedAt,
        publisher: "U.S. Securities and Exchange Commission",
      },
      {
        title: locale === "zh" ? "SEC Company Facts" : "SEC Company Facts",
        url: factsUrl,
        retrievedAt: companyDataRetrievedAt,
        publisher: "U.S. Securities and Exchange Commission",
      },
      ...(latestAnnual
        ? [{
            title: `${latestAnnual.form} ${locale === "zh" ? "年度申报" : "annual filing"}`,
            url: latestAnnual.url,
            retrievedAt: companyDataRetrievedAt,
            publisher: companyName,
            publicationDate: latestAnnual.filed,
            topic: "Issuer filing",
          }]
        : []),
      ...evidenceSources.map((source) => ({
        title: source.title,
        url: source.url,
        retrievedAt: companyDataRetrievedAt,
        publisher: source.publisher,
        publicationDate: source.publicationDate,
        topic: source.topic,
      })),
    ],
    limitations: [
      ...(sectorOutlook.insufficientEvidence
        ? ["Insufficient recent sector research available for 2025–2026."]
        : []),
      locale === "zh"
        ? "标准化 SEC XBRL 不足以稳定提取全部分部、产量、实现价格、终端市场、客户集中度、市场份额和发行人自定义 KPI；缺失值保持为未披露。"
        : "Standardized SEC XBRL does not consistently expose every segment, production, realization, end-market, customer-concentration, market-share, or issuer-defined KPI; missing values remain not disclosed.",
      latest.cashCapex === null || latest.operatingCashFlow === null
        ? COPY[locale].unableFcf
        : locale === "zh"
          ? "FCF 严格按经营现金流减现金资本开支计算，可能不同于发行人自定义口径。"
          : "FCF is calculated strictly as operating cash flow less cash capital expenditure and may differ from the issuer's definition.",
      locale === "zh"
        ? "同业比较使用各公司最近可取得的标准化年度事实，财政年度、业务组合和会计口径可能不同。"
        : "Peer comparison uses each company's latest available standardized annual facts; fiscal years, business mixes, and accounting definitions may differ.",
      locale === "zh"
        ? "行业证据仅包含发布日期在 2025-01-01 至研究日之间、可公开访问且通过去重和相关性筛选的来源。"
        : "Sector evidence includes only accessible, deduplicated, relevant sources published from 2025-01-01 through the research date.",
      locale === "zh"
        ? "未使用实时股价，因此不提供评级、目标价或股权价值。"
        : "No real-time share price is used, so the report does not provide a rating, price target, or equity value.",
    ],
  };
}

export async function POST(request: Request) {
  let locale: ResearchLocale = "zh";
  try {
    const payload = (await request.json()) as ResearchPayload;
    locale = payload.locale === "en" ? "en" : "zh";
    const company = payload.company?.trim() ?? "";
    if (company.length < 2 || company.length > 100) {
      return Response.json(
        {
          error:
            locale === "zh"
              ? "请输入 2-100 个字符的公司名或交易代码。"
              : "Enter a company name or ticker between 2 and 100 characters.",
        },
        { status: 400 },
      );
    }
    const selection = selectionFromPayload(payload);
    if (!selection) {
      return Response.json(
        {
          error:
            locale === "zh"
              ? "请选择当前支持的市场、行业和子行业组合。"
              : "Select a currently supported market, sector, and subindustry combination.",
        },
        { status: 400 },
      );
    }
    const record = await resolveCompany(company);
    if (!record) {
      return Response.json(
        {
          error:
            locale === "zh"
              ? "在 SEC 公司目录中未找到匹配项。请尝试法定公司名或交易代码。"
              : "No match was found in the SEC company directory. Try the legal company name or ticker.",
        },
        { status: 404 },
      );
    }
    const requestHostname = new URL(request.url).hostname;
    const localFixtureAllowed =
      ["localhost", "127.0.0.1"].includes(requestHostname);
    const sourceSnapshot =
      payload.fixture && localFixtureAllowed && record.ticker === "SHEL"
        ? {
            companyFacts:
              shellSourceSnapshot.companyFacts as CompanyFactsPayload,
            submissions:
              shellSourceSnapshot.submissions as unknown as Submissions,
            retrievedAt: "2026-07-17T00:00:00.000Z",
          }
        : undefined;
    const report = await buildReport(record, selection, locale, sourceSnapshot);
    return Response.json({
      report,
      consistencyAudit: auditResearchReport(report),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (message === "SECTOR_MISMATCH") {
      return Response.json(
        {
          error:
            locale === "zh"
              ? "所选行业与该发行人的 SEC 行业分类不匹配。请核对行业和子行业。"
              : "The selected sector does not match the issuer's SEC industry classification. Check the sector and subindustry.",
        },
        { status: 422 },
      );
    }
    if (message === "INSUFFICIENT_XBRL") {
      return Response.json(
        {
          error:
            locale === "zh"
              ? "该公司缺少足够的标准化年度申报数据。请尝试另一家公司或交易代码。"
              : "This company does not have enough standardized annual filing data. Try another company or ticker.",
        },
        { status: 422 },
      );
    }
    const statusMatch = message.match(/SEC_HTTP_(\d+)/);
    return Response.json(
      {
        error:
          locale === "zh"
            ? `SEC 公开数据服务暂时不可用${statusMatch ? `（HTTP ${statusMatch[1]}）` : ""}。已保留行业选择，请稍后重试。`
            : `The SEC public-data service is temporarily unavailable${statusMatch ? ` (HTTP ${statusMatch[1]})` : ""}. Your sector selection is preserved; please try again later.`,
      },
      { status: 502 },
    );
  }
}
