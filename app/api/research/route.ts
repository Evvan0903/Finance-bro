import { MemoryCache } from "../../lib/cache";
import { getSectorMethods } from "../../lib/sector-methodology";
import { getSectorPack } from "../../lib/sector-packs";
import { getSectorOutlook, sectorEvidenceSources } from "../../lib/sector-retrieval";
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
  PeerComparisonItem,
  ResearchLocale,
  ResearchReport,
  RiskPoint,
  Scenario,
  SectorDriverExposure,
  SectorKpiResult,
  ThesisPoint,
} from "../../lib/research-types";

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
type SecFact = {
  start?: string;
  end?: string;
  val?: number;
  form?: string;
  filed?: string;
};
type CompanyFacts = {
  cik: number;
  entityName: string;
  facts: Record<
    string,
    Record<string, { units?: Record<string, SecFact[]> }>
  >;
};
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
type Series = { unit: string; values: Map<string, number> };
type ResearchPayload = {
  company?: string;
  locale?: ResearchLocale;
  market?: ResearchMarket;
  sector?: SupportedSector;
  subindustry?: SupportedSubindustry;
  options?: Partial<ResearchOptions>;
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

const METRICS = {
  revenue: [
    ["us-gaap", "RevenueFromContractWithCustomerExcludingAssessedTax"],
    ["us-gaap", "Revenues"],
    ["us-gaap", "SalesRevenueNet"],
    ["ifrs-full", "Revenue"],
  ],
  grossProfit: [
    ["us-gaap", "GrossProfit"],
    ["ifrs-full", "GrossProfit"],
  ],
  netIncome: [
    ["us-gaap", "NetIncomeLoss"],
    ["us-gaap", "ProfitLoss"],
    ["ifrs-full", "ProfitLossAttributableToOwnersOfParent"],
    ["ifrs-full", "ProfitLoss"],
  ],
  operatingCashFlow: [
    ["us-gaap", "NetCashProvidedByUsedInOperatingActivities"],
    ["us-gaap", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
    ["ifrs-full", "CashFlowsFromUsedInOperatingActivities"],
  ],
  investingCashFlow: [
    ["us-gaap", "NetCashProvidedByUsedInInvestingActivities"],
    ["ifrs-full", "CashFlowsFromUsedInInvestingActivities"],
  ],
  cashCapex: [
    ["us-gaap", "PaymentsToAcquirePropertyPlantAndEquipment"],
    ["us-gaap", "PaymentsToAcquireProductiveAssets"],
    ["ifrs-full", "PurchaseOfPropertyPlantAndEquipment"],
  ],
  assets: [["us-gaap", "Assets"], ["ifrs-full", "Assets"]],
  liabilities: [["us-gaap", "Liabilities"], ["ifrs-full", "Liabilities"]],
  equity: [
    ["us-gaap", "StockholdersEquity"],
    ["us-gaap", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
    ["ifrs-full", "Equity"],
    ["ifrs-full", "EquityAttributableToOwnersOfParent"],
  ],
  cash: [
    ["us-gaap", "CashAndCashEquivalentsAtCarryingValue"],
    ["us-gaap", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
    ["ifrs-full", "CashAndCashEquivalents"],
  ],
  inventory: [
    ["us-gaap", "InventoryNet"],
    ["ifrs-full", "Inventories"],
  ],
  currentAssets: [["us-gaap", "AssetsCurrent"], ["ifrs-full", "CurrentAssets"]],
  currentLiabilities: [["us-gaap", "LiabilitiesCurrent"], ["ifrs-full", "CurrentLiabilities"]],
  totalDebt: [
    ["us-gaap", "LongTermDebtAndFinanceLeaseObligations"],
    ["us-gaap", "LongTermDebtAndCapitalLeaseObligations"],
    ["ifrs-full", "Borrowings"],
  ],
  currentDebt: [
    ["us-gaap", "LongTermDebtAndFinanceLeaseObligationsCurrent"],
    ["us-gaap", "ShortTermBorrowings"],
    ["ifrs-full", "CurrentBorrowings"],
  ],
  nonCurrentDebt: [
    ["us-gaap", "LongTermDebtAndFinanceLeaseObligationsNoncurrent"],
    ["us-gaap", "LongTermDebtNoncurrent"],
    ["ifrs-full", "NoncurrentBorrowings"],
  ],
} satisfies Record<string, Array<[string, string]>>;

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

function chooseUnit(units: Record<string, SecFact[]> | undefined) {
  if (!units) return null;
  const keys = Object.keys(units);
  return keys.find((key) => key === "USD") ?? keys.find((key) => /^[A-Z]{3}$/.test(key)) ?? null;
}

function annualSeries(
  facts: CompanyFacts,
  candidates: Array<[string, string]>,
  duration: boolean,
): Series {
  const selected = new Map<
    string,
    { value: number; filed: string; priority: number; unit: string; durationDistance: number }
  >();

  candidates.forEach(([taxonomy, concept], priority) => {
    const fact = facts.facts?.[taxonomy]?.[concept];
    const unit = chooseUnit(fact?.units);
    if (!fact || !unit) return;
    for (const entry of fact.units?.[unit] ?? []) {
      if (
        !entry.end ||
        typeof entry.val !== "number" ||
        !Number.isFinite(entry.val) ||
        !entry.form ||
        !ANNUAL_FORMS.has(entry.form)
      ) continue;

      let durationDistance = 0;
      if (duration) {
        if (!entry.start) continue;
        const days = (Date.parse(entry.end) - Date.parse(entry.start)) / 86_400_000;
        if (!Number.isFinite(days) || days < 280 || days > 430) continue;
        durationDistance = Math.abs(365 - days);
      } else if (entry.start) {
        continue;
      }

      const filed = entry.filed ?? "";
      const existing = selected.get(entry.end);
      if (
        !existing ||
        priority < existing.priority ||
        (priority === existing.priority && durationDistance < existing.durationDistance) ||
        (priority === existing.priority &&
          durationDistance === existing.durationDistance &&
          filed > existing.filed)
      ) {
        selected.set(entry.end, { value: entry.val, filed, priority, unit, durationDistance });
      }
    }
  });

  return {
    unit: [...selected.values()][0]?.unit ?? "USD",
    values: new Map(
      [...selected.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([periodEnd, entry]) => [periodEnd, entry.value]),
    ),
  };
}

function safeDivide(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

function safeSubtract(a: number | null, b: number | null) {
  if (a === null || b === null) return null;
  return a - Math.abs(b);
}

function safeAdd(a: number | null, b: number | null) {
  if (a === null || b === null) return null;
  return a + b;
}

function average(values: Array<number | null>) {
  const usable = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function cagr(periods: FinancialPeriod[]) {
  const usable = periods.filter((period) => period.revenue !== null && period.revenue > 0);
  if (usable.length < 2) return null;
  const first = usable[0];
  const last = usable.at(-1)!;
  const years = (Date.parse(last.periodEnd) - Date.parse(first.periodEnd)) / 31_557_600_000;
  if (years <= 0 || first.revenue === null || last.revenue === null) return null;
  return Math.pow(last.revenue / first.revenue, 1 / years) - 1;
}

function compactMoney(value: number | null, currency: string, locale: ResearchLocale) {
  if (value === null) return COPY[locale].dataUnavailable;
  const absolute = Math.abs(value);
  const scale = absolute >= 1e9 ? 1e9 : absolute >= 1e6 ? 1e6 : 1;
  const suffix = scale === 1e9 ? "bn" : scale === 1e6 ? "m" : "";
  const amount = value / scale;
  return `${currency} ${amount.toFixed(Math.abs(amount) >= 100 ? 0 : 1)}${suffix}`;
}

function percentage(value: number | null, locale: ResearchLocale) {
  return value === null ? COPY[locale].dataUnavailable : `${(value * 100).toFixed(1)}%`;
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

function normalizedPeriods(facts: CompanyFacts) {
  const series = {
    revenue: annualSeries(facts, METRICS.revenue, true),
    grossProfit: annualSeries(facts, METRICS.grossProfit, true),
    netIncome: annualSeries(facts, METRICS.netIncome, true),
    operatingCashFlow: annualSeries(facts, METRICS.operatingCashFlow, true),
    investingCashFlow: annualSeries(facts, METRICS.investingCashFlow, true),
    cashCapex: annualSeries(facts, METRICS.cashCapex, true),
    assets: annualSeries(facts, METRICS.assets, false),
    liabilities: annualSeries(facts, METRICS.liabilities, false),
    equity: annualSeries(facts, METRICS.equity, false),
    cash: annualSeries(facts, METRICS.cash, false),
    inventory: annualSeries(facts, METRICS.inventory, false),
    currentAssets: annualSeries(facts, METRICS.currentAssets, false),
    currentLiabilities: annualSeries(facts, METRICS.currentLiabilities, false),
    totalDebt: annualSeries(facts, METRICS.totalDebt, false),
    currentDebt: annualSeries(facts, METRICS.currentDebt, false),
    nonCurrentDebt: annualSeries(facts, METRICS.nonCurrentDebt, false),
  };
  const anchorDates = [...new Set([
    ...series.revenue.values.keys(),
    ...series.netIncome.values.keys(),
    ...series.operatingCashFlow.values.keys(),
  ])].sort().slice(-5);

  const periods: FinancialPeriod[] = anchorDates.map((periodEnd, index) => {
    const revenue = series.revenue.values.get(periodEnd) ?? null;
    const priorRevenue = index ? series.revenue.values.get(anchorDates[index - 1]) ?? null : null;
    const netIncome = series.netIncome.values.get(periodEnd) ?? null;
    const operatingCashFlow = series.operatingCashFlow.values.get(periodEnd) ?? null;
    const capexRaw = series.cashCapex.values.get(periodEnd) ?? null;
    const cashCapex = capexRaw === null ? null : Math.abs(capexRaw);
    const freeCashFlow = safeSubtract(operatingCashFlow, cashCapex);
    const totalDebt =
      series.totalDebt.values.get(periodEnd) ??
      safeAdd(
        series.currentDebt.values.get(periodEnd) ?? null,
        series.nonCurrentDebt.values.get(periodEnd) ?? null,
      );
    const cash = series.cash.values.get(periodEnd) ?? null;
    const grossProfit = series.grossProfit.values.get(periodEnd) ?? null;
    return {
      periodEnd,
      revenue,
      grossProfit,
      netIncome,
      operatingCashFlow,
      investingCashFlow: series.investingCashFlow.values.get(periodEnd) ?? null,
      cashCapex,
      freeCashFlowProxy: freeCashFlow,
      assets: series.assets.values.get(periodEnd) ?? null,
      liabilities: series.liabilities.values.get(periodEnd) ?? null,
      equity: series.equity.values.get(periodEnd) ?? null,
      cash,
      inventory: series.inventory.values.get(periodEnd) ?? null,
      currentAssets: series.currentAssets.values.get(periodEnd) ?? null,
      currentLiabilities: series.currentLiabilities.values.get(periodEnd) ?? null,
      totalDebt,
      netDebt: totalDebt === null || cash === null ? null : totalDebt - cash,
      revenueGrowth: safeDivide(
        revenue === null || priorRevenue === null ? null : revenue - priorRevenue,
        priorRevenue,
      ),
      netMargin: safeDivide(netIncome, revenue),
      grossMargin: safeDivide(grossProfit, revenue),
      freeCashFlowMargin: safeDivide(freeCashFlow, revenue),
      cashConversion: safeDivide(freeCashFlow, netIncome),
      currentRatio: safeDivide(
        series.currentAssets.values.get(periodEnd) ?? null,
        series.currentLiabilities.values.get(periodEnd) ?? null,
      ),
    };
  });
  return { periods, currency: series.revenue.unit || series.netIncome.unit || "USD" };
}

function buildScenarios(
  periods: FinancialPeriod[],
  pack: SectorPack,
  locale: ResearchLocale,
): Scenario[] {
  const latest = periods.at(-1);
  const revenueCagr = cagr(periods);
  const averageNetMargin = average(periods.slice(-3).map((period) => period.netMargin));
  const averageOcfMargin = average(
    periods.slice(-3).map((period) => safeDivide(period.operatingCashFlow, period.revenue)),
  );
  const baseGrowth =
    pack.id === "semiconductors"
      ? clamp(revenueCagr ?? 0.08, -0.05, 0.3)
      : clamp(revenueCagr ?? 0, -0.08, 0.08);
  const growthSpread = pack.id === "semiconductors" ? 0.08 : 0.05;
  const baseNetMargin = averageNetMargin ?? latest?.netMargin ?? null;
  const baseOcfMargin =
    averageOcfMargin ?? safeDivide(latest?.operatingCashFlow ?? null, latest?.revenue ?? null);
  const useFallback =
    pack.valuation.metric === "freeCashFlow" &&
    (latest?.cashCapex === null || latest?.operatingCashFlow === null) &&
    pack.valuation.fallback !== undefined;
  const framework = useFallback ? pack.valuation.fallback! : pack.valuation;
  const assumptions = [
    { name: "Bear" as const, growth: baseGrowth - growthSpread, marginDelta: -0.03, capexFactor: 1.1, multiple: framework.multiples.bear },
    { name: "Base" as const, growth: baseGrowth, marginDelta: 0, capexFactor: 1, multiple: framework.multiples.base },
    { name: "Bull" as const, growth: baseGrowth + growthSpread, marginDelta: 0.03, capexFactor: 0.95, multiple: framework.multiples.bull },
  ];

  return assumptions.map((input) => {
    const revenueGrowth = clamp(input.growth, -0.25, 0.45);
    const projectedRevenue =
      latest?.revenue === null || latest?.revenue === undefined
        ? null
        : latest.revenue * (1 + revenueGrowth);
    const netMargin =
      baseNetMargin === null ? null : clamp(baseNetMargin + input.marginDelta, -0.3, 0.65);
    const operatingCashFlowMargin =
      baseOcfMargin === null ? null : clamp(baseOcfMargin + input.marginDelta, -0.25, 0.7);
    const projectedNetIncome =
      projectedRevenue === null || netMargin === null ? null : projectedRevenue * netMargin;
    const projectedCapex =
      latest?.cashCapex === null || latest?.cashCapex === undefined
        ? null
        : latest.cashCapex * input.capexFactor;
    const projectedFreeCashFlow =
      projectedRevenue === null || operatingCashFlowMargin === null || projectedCapex === null
        ? null
        : projectedRevenue * operatingCashFlowMargin - projectedCapex;
    const projectedOperatingCashFlow =
      projectedRevenue === null || operatingCashFlowMargin === null
        ? null
        : projectedRevenue * operatingCashFlowMargin;
    const valuationMetric =
      framework.metric === "revenue"
        ? projectedRevenue
        : framework.metric === "operatingCashFlow"
          ? projectedOperatingCashFlow
          : projectedFreeCashFlow;
    return {
      name: input.name,
      revenueGrowth,
      netMargin,
      operatingCashFlowMargin,
      capexFactor: input.capexFactor,
      projectedRevenue,
      projectedNetIncome,
      projectedFreeCashFlow,
      enterpriseValueMultiple: input.multiple,
      valuationMethod: framework.method[locale],
      valuationMetric,
      multipleLabel: framework.multipleLabel,
      modelImpliedEnterpriseValue:
        valuationMetric !== null && valuationMetric > 0
          ? valuationMetric * input.multiple
          : null,
    };
  });
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
        ? COPY[locale].unableFcf
        : compactMoney(latest.freeCashFlowProxy, currency, locale);
    case "netDebt":
      return compactMoney(latest.netDebt, currency, locale);
    default:
      return COPY[locale].notDisclosed;
  }
}

function buildSectorKpis(
  pack: SectorPack,
  latest: FinancialPeriod,
  currency: string,
  locale: ResearchLocale,
): SectorKpiResult[] {
  return pack.coreKpis.map((definition) => {
    const derived = ["grossMargin", "freeCashFlow", "netDebt"].includes(definition.availability);
    const available = definition.availability !== "notStandardized";
    return {
      id: definition.id,
      label: definition.label[locale],
      value: kpiValue(definition, latest, currency, locale),
      definition: definition.description[locale],
      classification: derived ? "Derived calculation" : "Reported fact",
      sourceNote: available
        ? locale === "zh"
          ? "SEC Company Facts；按本页公式标准化。"
          : "SEC Company Facts; normalized using the displayed formula."
        : locale === "zh"
          ? "标准化 SEC Company Facts 未披露；需回到最新年报分部与业务附注。"
          : "Not disclosed in standardized SEC Company Facts; review the latest annual filing's segment and business notes.",
      whyItMatters:
        locale === "zh"
          ? `该指标用于回答：${pack.researchQuestions[
              pack.coreKpis.indexOf(definition) % pack.researchQuestions.length
            ].zh}`
          : `This metric helps answer: ${pack.researchQuestions[
              pack.coreKpis.indexOf(definition) % pack.researchQuestions.length
            ].en}`,
    };
  });
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

function buildDriverExposure(
  companyName: string,
  pack: SectorPack,
  outlook: Awaited<ReturnType<typeof getSectorOutlook>>,
  locale: ResearchLocale,
): SectorDriverExposure[] {
  return pack.marketDrivers.map((driver, index) => {
    const claim =
      matchingClaim(driver.query, outlook) ??
      outlook.claims[index % Math.max(outlook.claims.length, 1)];
    return {
      driver: driver.name[locale],
      companyExposure: `${companyName}: ${driver.companyExposure[locale]}`,
      evidence: claim?.claim ?? COPY[locale].dataUnavailable,
      evidencePublisher: claim?.publisher ?? COPY[locale].dataUnavailable,
      evidenceDate: claim?.publicationDate ?? COPY[locale].dataUnavailable,
      evidenceUrl: claim?.url ?? "",
      investmentImplication: driver.implication[locale],
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
) {
  const latest = periods.at(-1)!;
  const prior = periods.at(-2);
  const revenueCagr = cagr(periods);
  const marginDelta =
    latest.netMargin === null || prior?.netMargin === null || prior?.netMargin === undefined
      ? null
      : latest.netMargin - prior.netMargin;
  const liabilityRatio = safeDivide(latest.liabilities, latest.assets);
  const cashConversion = latest.cashConversion;
  const primarySectorMetric =
    pack.id === "semiconductors"
      ? {
          label: locale === "zh" ? "毛利率" : "Gross margin",
          value: percentage(latest.grossMargin, locale),
          detail:
            locale === "zh"
              ? "毛利率 = 毛利润 ÷ 营收；产品组合与供给成本的重要信号。"
              : "Gross margin = gross profit / revenue; a key signal for product mix and supply cost.",
        }
      : {
          label: locale === "zh" ? "净债务" : "Net debt",
          value: compactMoney(latest.netDebt, currency, locale),
          detail:
            locale === "zh"
              ? "净债务 = 标准化总债务 - 现金；衡量周期下行韧性。"
              : "Net debt = normalized debt - cash; a measure of downside-cycle resilience.",
        };
  const fcfValue =
    latest.freeCashFlowProxy === null
      ? COPY[locale].unableFcf
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
    },
    {
      label: primarySectorMetric.label,
      value: primarySectorMetric.value,
      detail: primarySectorMetric.detail,
      classification: "Derived calculation",
      tone: "neutral",
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
    },
  ];

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
    return {
      title: driver.name[locale],
      view:
        locale === "zh"
          ? `${companyName} 的相关敞口是${driver.companyExposure.zh} 最新营收增长 ${percentage(latest.revenueGrowth, locale)}、FCF ${inlineFcfValue}。行业证据：${claim?.publisher ?? COPY.zh.dataUnavailable} · ${claim?.publicationDate ?? COPY.zh.dataUnavailable}。`
          : `${companyName}'s relevant exposure is ${driver.companyExposure.en} Latest revenue growth was ${percentage(latest.revenueGrowth, locale)} and FCF was ${inlineFcfValue}. Sector evidence: ${claim?.publisher ?? COPY.en.dataUnavailable} · ${claim?.publicationDate ?? COPY.en.dataUnavailable}.`,
      counterEvidence: pack.risks[index % pack.risks.length][locale],
      monitor: pack.researchQuestions[index % pack.researchQuestions.length][locale],
    };
  });

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
  }));
  return { dashboard, earningsQuality, thesis, risks };
}

function buildDebates(
  companyName: string,
  pack: SectorPack,
  outlook: Awaited<ReturnType<typeof getSectorOutlook>>,
  locale: ResearchLocale,
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
    };
  });
}

function catalystPoints(
  items: SectorPack["catalysts"]["operating"],
  locale: ResearchLocale,
): CatalystPoint[] {
  return items.map((item) => ({
    timing: locale === "zh" ? "持续监测" : "Ongoing monitor",
    event: item[locale],
    investorRelevance:
      locale === "zh"
        ? "仅在经营或财务结果改变时视为催化剂；单纯申报日期不是催化剂。"
        : "Treated as a catalyst only when operating or financial outcomes change; a filing date alone is not a catalyst.",
  }));
}

async function buildPeerComparison(
  pack: SectorPack,
  locale: ResearchLocale,
): Promise<PeerComparisonItem[]> {
  return Promise.all(
    pack.peers.map(async (peer) => {
      try {
        const facts = await secFetch<CompanyFacts>(
          `https://data.sec.gov/api/xbrl/companyfacts/CIK${peer.cik}.json`,
        );
        const { periods } = normalizedPeriods(facts);
        const latest = periods.at(-1);
        return {
          ticker: peer.ticker,
          name: peer.name,
          rationale: peer.rationale[locale],
          revenueGrowth: latest?.revenueGrowth ?? null,
          netMargin: latest?.netMargin ?? null,
          freeCashFlowMargin: latest?.freeCashFlowMargin ?? null,
          periodEnd: latest?.periodEnd ?? null,
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
        };
      }
    }),
  );
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
): Promise<ResearchReport> {
  const cik = String(record.cik_str).padStart(10, "0");
  const [submissions, facts, sectorOutlook] = await Promise.all([
    secFetch<Submissions>(`https://data.sec.gov/submissions/CIK${cik}.json`),
    secFetch<CompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`),
    getSectorOutlook(selection.market, selection.subindustry, locale),
  ]);
  const pack = getSectorPack(selection.subindustry);
  if (submissions.sic && !pack.sicCodes.includes(submissions.sic)) {
    throw new Error("SECTOR_MISMATCH");
  }

  const { periods, currency } = normalizedPeriods(facts);
  if (!periods.length) throw new Error("INSUFFICIENT_XBRL");
  const latest = periods.at(-1)!;
  const companyName = submissions.name || facts.entityName || record.title;
  const today = new Date();
  const companyDataRetrievedAt = today.toISOString();
  const latestAnnual = filingSource(submissions, ANNUAL_FORMS, COPY[locale].annualFiling);
  const latestInterim = filingSource(submissions, INTERIM_FORMS, COPY[locale].interimFiling);
  const narrative = buildNarrative(companyName, periods, currency, pack, sectorOutlook, locale);
  const scenarios = selection.options.valuation ? buildScenarios(periods, pack, locale) : [];
  const peerComparison = selection.options.peerComparison
    ? await buildPeerComparison(pack, locale)
    : [];
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
    driverExposure: buildDriverExposure(companyName, pack, sectorOutlook, locale),
    sectorKpis: buildSectorKpis(pack, latest, currency, locale),
    overview:
      locale === "zh"
        ? `${companyName} 被纳入 ${pack.sectorLabel.zh} / ${pack.subindustryLabel.zh} 分析师包。SEC 分类为 ${submissions.sicDescription || COPY.zh.notDisclosed}（SIC ${submissions.sic || COPY.zh.notDisclosed}）。结论同时使用标准化申报事实、显式计算和 2025 年以来的近期行业证据。`
        : `${companyName} is analyzed with the ${pack.sectorLabel.en} / ${pack.subindustryLabel.en} analyst pack. Its SEC classification is ${submissions.sicDescription || COPY.en.notDisclosed} (SIC ${submissions.sic || COPY.en.notDisclosed}). Conclusions combine normalized filing facts, visible calculations, and recent sector evidence published since 2025.`,
    segmentAnalysis:
      locale === "zh"
        ? `标准化 Company Facts 不能稳定保留发行人自定义分部和经营 KPI，因此系统不推测缺失值。${pack.reportGuidance.map((item) => item.zh).join(" ")}`
        : `Standardized Company Facts does not consistently preserve issuer-defined segments and operating KPIs, so missing values are not inferred. ${pack.reportGuidance.map((item) => item.en).join(" ")}`,
    earningsQuality: narrative.earningsQuality,
    thesis: narrative.thesis,
    investmentDebates: selection.options.dueDiligence
      ? buildDebates(companyName, pack, sectorOutlook, locale)
      : [],
    filingWatchlist: [
      ...(latestAnnual
        ? [{
            timing: latestAnnual.filed,
            event: `${latestAnnual.form} · ${latestAnnual.reportDate}`,
            investorRelevance:
              locale === "zh"
                ? "申报监测项：复核分部、会计政策、风险与资本配置；申报日期本身不是催化剂。"
                : "Filing watch item: reconcile segments, accounting policy, risks, and capital allocation; the filing date itself is not a catalyst.",
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
          }]
        : []),
    ],
    catalysts: {
      operating: catalystPoints(pack.catalysts.operating, locale),
      financial: catalystPoints(pack.catalysts.financial, locale),
      regulatory: catalystPoints(pack.catalysts.regulatory, locale),
    },
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
    return Response.json({ report: await buildReport(record, selection, locale) });
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
