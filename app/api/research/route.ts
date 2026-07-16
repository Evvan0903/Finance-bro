import type {
  DashboardMetric,
  FilingSource,
  FinancialPeriod,
  ResearchLocale,
  ResearchReport,
  RiskPoint,
  Scenario,
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

type TickerRecord = { cik_str: number; ticker: string; title: string };
type SecFact = {
  start?: string;
  end?: string;
  val?: number;
  accn?: string;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  frame?: string;
};
type CompanyFacts = {
  cik: number;
  entityName: string;
  facts: Record<
    string,
    Record<string, { label?: string; description?: string; units?: Record<string, SecFact[]> }>
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
  filings?: {
    recent?: Record<string, Array<string | number | null>>;
  };
};

type Series = { unit: string; values: Map<string, number> };

const COPY = {
  zh: {
    dataUnavailable: "数据不可用",
    notDisclosed: "未披露",
    unableToCalculate: "无法根据现有申报计算",
    annualFiling: "最新年度申报",
    interimFiling: "最新中期/当前申报",
    reportingIssuer: "SEC 申报发行人",
  },
  en: {
    dataUnavailable: "Data unavailable",
    notDisclosed: "Not disclosed",
    unableToCalculate: "Unable to calculate from available filings",
    annualFiling: "Latest annual filing",
    interimFiling: "Latest interim/current filing",
    reportingIssuer: "SEC reporting issuer",
  },
} as const;

let tickerRecordsPromise: Promise<TickerRecord[]> | null = null;

const METRICS = {
  revenue: [
    ["us-gaap", "RevenueFromContractWithCustomerExcludingAssessedTax"],
    ["us-gaap", "Revenues"],
    ["us-gaap", "SalesRevenueNet"],
    ["ifrs-full", "Revenue"],
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
  assets: [
    ["us-gaap", "Assets"],
    ["ifrs-full", "Assets"],
  ],
  liabilities: [
    ["us-gaap", "Liabilities"],
    ["ifrs-full", "Liabilities"],
  ],
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
  currentAssets: [
    ["us-gaap", "AssetsCurrent"],
    ["ifrs-full", "CurrentAssets"],
  ],
  currentLiabilities: [
    ["us-gaap", "LiabilitiesCurrent"],
    ["ifrs-full", "CurrentLiabilities"],
  ],
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
  amazon: "AMZN",
  berkshire: "BRK-B",
};

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
  const response = await fetch(url, {
    headers: SEC_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`SEC returned HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

async function getTickerRecords() {
  if (!tickerRecordsPromise) {
    tickerRecordsPromise = secFetch<Record<string, TickerRecord>>(
      "https://www.sec.gov/files/company_tickers.json",
    ).then((payload) => Object.values(payload));
  }
  return tickerRecordsPromise;
}

async function resolveCompany(query: string) {
  const records = await getTickerRecords();
  const normalizedQuery = normalize(query);
  const upperQuery = query.trim().toUpperCase();
  const aliasTicker = ALIASES[normalizedQuery];

  const exactTicker = records.find(
    (record) => record.ticker.toUpperCase() === (aliasTicker ?? upperQuery),
  );
  if (exactTicker) return exactTicker;

  const candidates = records
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
    .sort((a, b) => a.score - b.score || a.titleLength - b.titleLength);

  return candidates[0]?.record ?? null;
}

function chooseUnit(units: Record<string, SecFact[]> | undefined, requested: "currency" | "shares") {
  if (!units) return null;
  const keys = Object.keys(units);
  if (requested === "shares") {
    return keys.find((key) => key.toLowerCase() === "shares") ?? null;
  }
  return (
    keys.find((key) => key === "USD") ??
    keys.find((key) => /^[A-Z]{3}$/.test(key)) ??
    null
  );
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
    const unit = chooseUnit(fact?.units, "currency");
    if (!fact || !unit) return;

    for (const entry of fact.units?.[unit] ?? []) {
      if (
        !entry.end ||
        typeof entry.val !== "number" ||
        !Number.isFinite(entry.val) ||
        !entry.form ||
        !ANNUAL_FORMS.has(entry.form)
      ) {
        continue;
      }

      let durationDistance = 0;
      if (duration) {
        if (!entry.start) continue;
        const days =
          (Date.parse(entry.end) - Date.parse(entry.start)) / (24 * 60 * 60 * 1000);
        if (!Number.isFinite(days) || days < 280 || days > 430) continue;
        durationDistance = Math.abs(365 - days);
      } else if (entry.start) {
        continue;
      }

      const filed = entry.filed ?? "";
      const existing = selected.get(entry.end);
      const shouldReplace =
        !existing ||
        priority < existing.priority ||
        (priority === existing.priority && durationDistance < existing.durationDistance) ||
        (priority === existing.priority &&
          durationDistance === existing.durationDistance &&
          filed > existing.filed);
      if (shouldReplace) {
        selected.set(entry.end, {
          value: entry.val,
          filed,
          priority,
          unit,
          durationDistance,
        });
      }
    }
  });

  const currency = [...selected.values()][0]?.unit ?? "USD";
  return {
    unit: currency,
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
  const last = usable[usable.length - 1];
  const years =
    (Date.parse(last.periodEnd) - Date.parse(first.periodEnd)) / (365.25 * 24 * 60 * 60 * 1000);
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
  const cik = String(submissions.cik).padStart(10, "0");
  const cikNumber = String(Number(cik));
  const accession = filing.accessionNumber.replace(/-/g, "");
  return {
    title,
    form: filing.form,
    filed: filing.filingDate,
    reportDate: filing.reportDate,
    url: `https://www.sec.gov/Archives/edgar/data/${cikNumber}/${accession}/${filing.primaryDocument}`,
  };
}

function buildScenarios(periods: FinancialPeriod[]): Scenario[] {
  const latest = periods.at(-1);
  const growth = cagr(periods);
  const latestThree = periods.slice(-3);
  const averageNetMargin = average(latestThree.map((period) => period.netMargin));
  const averageOcfMargin = average(
    latestThree.map((period) => safeDivide(period.operatingCashFlow, period.revenue)),
  );
  const averageCashFlowProxyMargin = average(
    latestThree.map((period) => safeDivide(period.freeCashFlowProxy, period.revenue)),
  );

  const baseGrowth = growth === null ? 0 : clamp(growth, -0.08, 0.08);
  const baseNetMargin = averageNetMargin ?? latest?.netMargin ?? null;
  const baseOcfMargin =
    averageOcfMargin ??
    safeDivide(latest?.operatingCashFlow ?? null, latest?.revenue ?? null);
  const baseCashFlowProxyMargin =
    averageCashFlowProxyMargin ??
    safeDivide(latest?.freeCashFlowProxy ?? null, latest?.revenue ?? null);

  const inputs = [
    { name: "Bear" as const, growth: baseGrowth - 0.05, marginDelta: -0.02, capexFactor: 1.05, multiple: 6 },
    { name: "Base" as const, growth: baseGrowth, marginDelta: 0, capexFactor: 1, multiple: 8 },
    { name: "Bull" as const, growth: baseGrowth + 0.05, marginDelta: 0.02, capexFactor: 0.95, multiple: 10 },
  ];

  return inputs.map((input) => {
    const revenueGrowth = clamp(input.growth, -0.2, 0.2);
    const projectedRevenue =
      latest?.revenue === null || latest?.revenue === undefined
        ? null
        : latest.revenue * (1 + revenueGrowth);
    const netMargin =
      baseNetMargin === null ? null : clamp(baseNetMargin + input.marginDelta, -0.25, 0.5);
    const operatingCashFlowMargin =
      baseOcfMargin === null ? null : clamp(baseOcfMargin + input.marginDelta, -0.25, 0.6);
    const projectedNetIncome =
      projectedRevenue === null || netMargin === null ? null : projectedRevenue * netMargin;
    const capex =
      latest?.cashCapex === null || latest?.cashCapex === undefined
        ? null
        : Math.abs(latest.cashCapex) * input.capexFactor;
    const projectedFreeCashFlow =
      projectedRevenue === null
        ? null
        : operatingCashFlowMargin !== null && capex !== null
          ? projectedRevenue * operatingCashFlowMargin - capex
          : baseCashFlowProxyMargin === null
            ? null
            : (projectedRevenue * clamp(baseCashFlowProxyMargin + input.marginDelta, -0.25, 0.6)) /
              input.capexFactor;
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
      modelImpliedEnterpriseValue:
        projectedFreeCashFlow !== null && projectedFreeCashFlow > 0
          ? projectedFreeCashFlow * input.multiple
          : null,
    };
  });
}

function buildNarrative(
  periods: FinancialPeriod[],
  currency: string,
  locale: ResearchLocale,
): {
  dashboard: DashboardMetric[];
  earningsQuality: string[];
  thesis: ThesisPoint[];
  risks: RiskPoint[];
} {
  const latest = periods.at(-1);
  const prior = periods.at(-2);
  const growth = latest?.revenueGrowth ?? null;
  const revenueCagr = cagr(periods);
  const fcf = latest?.freeCashFlowProxy ?? null;
  const cashFlowProxyFormula =
    latest?.cashCapex !== null && latest?.cashCapex !== undefined
      ? locale === "zh"
        ? "经营现金流 − |现金资本开支|"
        : "Operating cash flow − |cash capital expenditure|"
      : latest?.investingCashFlow !== null && latest?.investingCashFlow !== undefined
        ? locale === "zh"
          ? "经营现金流 + 投资活动现金流"
          : "Operating cash flow + investing cash flow"
        : COPY[locale].unableToCalculate;
  const cashConversion = latest?.cashConversion ?? null;
  const liabilityRatio = safeDivide(latest?.liabilities ?? null, latest?.assets ?? null);
  const capexIntensity = safeDivide(latest?.cashCapex ?? null, latest?.revenue ?? null);
  const priorNetMargin = prior?.netMargin ?? null;
  const marginDelta =
    latest?.netMargin === null || latest?.netMargin === undefined || priorNetMargin === null
      ? null
      : latest.netMargin - priorNetMargin;

  if (locale === "en") {
    const dashboard: DashboardMetric[] = [
      {
        label: "Latest revenue",
        value: compactMoney(latest?.revenue ?? null, currency, locale),
        detail: `YoY ${percentage(growth, locale)}; multi-period CAGR ${percentage(revenueCagr, locale)}`,
        classification: "Reported fact",
        tone: growth === null ? "neutral" : growth >= 0 ? "positive" : "watch",
      },
      {
        label: "Net margin",
        value: percentage(latest?.netMargin ?? null, locale),
        detail: `Change from prior year ${marginDelta === null ? COPY.en.dataUnavailable : `${(marginDelta * 100).toFixed(1)}ppt`}`,
        classification: "Derived calculation",
        tone: marginDelta === null ? "neutral" : marginDelta >= 0 ? "positive" : "watch",
      },
      {
        label: "Cash-flow proxy",
        value: compactMoney(fcf, currency, locale),
        detail: `${cashFlowProxyFormula}; the measure may differ from issuer-defined FCF`,
        classification: "Derived calculation",
        tone: fcf === null ? "neutral" : fcf > 0 ? "positive" : "watch",
      },
      {
        label: "Cash conversion",
        value: cashConversion === null ? COPY.en.dataUnavailable : `${cashConversion.toFixed(2)}x`,
        detail: "Cash-flow proxy / net income; calculated only when net income is non-zero",
        classification: "Derived calculation",
        tone: cashConversion === null ? "neutral" : cashConversion >= 0.8 ? "positive" : "watch",
      },
      {
        label: "Liabilities / assets",
        value: percentage(liabilityRatio, locale),
        detail: `Current ratio ${latest?.currentRatio === null || latest?.currentRatio === undefined ? COPY.en.dataUnavailable : `${latest.currentRatio.toFixed(2)}x`}`,
        classification: "Derived calculation",
        tone: liabilityRatio === null ? "neutral" : liabilityRatio <= 0.65 ? "positive" : "watch",
      },
    ];

    const earningsQuality = [
      `Latest annual net income was ${compactMoney(latest?.netIncome ?? null, currency, locale)}, versus operating cash flow of ${compactMoney(latest?.operatingCashFlow ?? null, currency, locale)}.`,
      `The cash-flow proxy (${cashFlowProxyFormula}) was ${compactMoney(fcf, currency, locale)}, for cash conversion of ${cashConversion === null ? COPY.en.dataUnavailable : `${cashConversion.toFixed(2)}x`}.`,
      `Capital-expenditure intensity was ${percentage(capexIntensity, locale)}; a higher ratio raises the bar for revenue quality and funding capacity.`,
      "Standardized XBRL is insufficient to identify every one-off item, restructuring charge, or management adjustment; verify these in the notes to the latest annual filing.",
    ];

    const thesis: ThesisPoint[] = [
      {
        title: "Revenue trend sets the direction of operating leverage",
        view: `Latest annual revenue growth was ${percentage(growth, locale)}, with a multi-period CAGR of ${percentage(revenueCagr, locale)}. Improving revenue can support profit and cash coverage.`,
        counterEvidence:
          growth !== null && growth < 0
            ? "Latest annual revenue was still contracting, so scale benefits remain unproven."
            : "Revenue growth does not automatically convert to cash; margins and working capital still matter.",
        monitor: "Revenue growth, gross/net margin, and management guidance in the next periodic report.",
      },
      {
        title: "Cash conversion is closer to distributable capacity than accounting profit",
        view: `The cash-flow proxy was ${compactMoney(fcf, currency, locale)}, with cash conversion of ${cashConversion === null ? COPY.en.dataUnavailable : `${cashConversion.toFixed(2)}x`}.`,
        counterEvidence:
          cashConversion !== null && cashConversion < 0.8
            ? "Cash conversion below 0.8x may indicate pressure from working capital, capital expenditure, or earnings quality."
            : "A single year of cash release may reflect working-capital timing rather than permanent improvement.",
        monitor: "Operating cash flow, working capital, capital expenditure, and cash balances.",
      },
      {
        title: "The balance sheet determines downside resilience",
        view: `Liabilities / assets were ${percentage(liabilityRatio, locale)}, and the current ratio was ${latest?.currentRatio === null || latest?.currentRatio === undefined ? COPY.en.dataUnavailable : `${latest.currentRatio.toFixed(2)}x`}.`,
        counterEvidence:
          liabilityRatio !== null && liabilityRatio > 0.65
            ? "A high liability share makes rates, refinancing, and earnings weakness transmit more quickly to equity value."
            : "A lower liability share does not rule out off-balance-sheet, lease, or pension obligations.",
        monitor: "Total debt, cash, liquidity, interest expense, and the maturity profile.",
      },
      {
        title: "Capital intensity determines whether growth can be self-funded",
        view: `Cash capital expenditure / revenue was ${percentage(capexIntensity, locale)}. Stable capital efficiency supports free-cash-flow expansion.`,
        counterEvidence: "Standardized data cannot distinguish maintenance from growth capital expenditure.",
        monitor: "Capital-expenditure guidance, asset turnover, project returns, and impairments.",
      },
    ];

    const risks: RiskPoint[] = [
      {
        title: "Sustained revenue or margin deterioration",
        evidence: `Latest revenue growth was ${percentage(growth, locale)}; net margin was ${percentage(latest?.netMargin ?? null, locale)}.`,
        thesisBreaker: "Revenue and margins decline together for two consecutive years without a credible management recovery plan.",
      },
      {
        title: "Cash conversion trails accounting profit",
        evidence: `Cash conversion was ${cashConversion === null ? COPY.en.dataUnavailable : `${cashConversion.toFixed(2)}x`}.`,
        thesisBreaker: "Operating cash flow and the cash-flow proxy remain below net income without a working-capital timing explanation.",
      },
      {
        title: "Capital expenditure or leverage crowds out shareholder returns",
        evidence: `Capital-expenditure intensity was ${percentage(capexIntensity, locale)}; liabilities / assets were ${percentage(liabilityRatio, locale)}.`,
        thesisBreaker: "Capital expenditure and distributions continue to exceed operating cash flow while cash falls or debt rises.",
      },
      {
        title: "Disclosure and standardized-data boundaries",
        evidence: "SEC Company Facts supports verification of core financial history but does not fully capture segment KPIs, orders, customer concentration, or every one-off item.",
        thesisBreaker: "Material differences between the latest annual-filing notes and standardized XBRL cannot be reconciled.",
      },
    ];

    return { dashboard, earningsQuality, thesis, risks };
  }

  const dashboard: DashboardMetric[] = [
    {
      label: "最新营收",
      value: compactMoney(latest?.revenue ?? null, currency, locale),
      detail: `同比 ${percentage(growth, locale)}；多期 CAGR ${percentage(revenueCagr, locale)}`,
      classification: "Reported fact",
      tone: growth === null ? "neutral" : growth >= 0 ? "positive" : "watch",
    },
    {
      label: "净利润率",
      value: percentage(latest?.netMargin ?? null, locale),
      detail: `较上一年度变化 ${marginDelta === null ? COPY.zh.dataUnavailable : `${(marginDelta * 100).toFixed(1)}个百分点`}`,
      classification: "Derived calculation",
      tone: marginDelta === null ? "neutral" : marginDelta >= 0 ? "positive" : "watch",
    },
    {
      label: "现金流代理",
      value: compactMoney(fcf, currency, locale),
      detail: `${cashFlowProxyFormula}；口径可能不同于公司自定义 FCF`,
      classification: "Derived calculation",
      tone: fcf === null ? "neutral" : fcf > 0 ? "positive" : "watch",
    },
    {
      label: "现金转化",
      value: cashConversion === null ? COPY.zh.dataUnavailable : `${cashConversion.toFixed(2)}x`,
      detail: "现金流代理 / 净利润；仅在净利润非零时计算",
      classification: "Derived calculation",
      tone: cashConversion === null ? "neutral" : cashConversion >= 0.8 ? "positive" : "watch",
    },
    {
      label: "负债 / 资产",
      value: percentage(liabilityRatio, locale),
      detail: `流动比率 ${latest?.currentRatio === null || latest?.currentRatio === undefined ? COPY.zh.dataUnavailable : `${latest.currentRatio.toFixed(2)}x`}`,
      classification: "Derived calculation",
      tone: liabilityRatio === null ? "neutral" : liabilityRatio <= 0.65 ? "positive" : "watch",
    },
  ];

  const earningsQuality = [
    `最新年度净利润为 ${compactMoney(latest?.netIncome ?? null, currency, locale)}，经营现金流为 ${compactMoney(latest?.operatingCashFlow ?? null, currency, locale)}。`,
    `现金流代理（${cashFlowProxyFormula}）为 ${compactMoney(fcf, currency, locale)}，现金转化为 ${cashConversion === null ? COPY.zh.dataUnavailable : `${cashConversion.toFixed(2)}x`}。`,
    `资本开支强度为 ${percentage(capexIntensity, locale)}；该比率越高，对收入增长质量和融资能力的要求越高。`,
    "标准化 XBRL 不足以判断全部一次性项目、重组费用或管理层调整项，需回到最新年报附注复核。",
  ];

  const thesis: ThesisPoint[] = [
    {
      title: "收入趋势决定经营杠杆方向",
      view: `最新年度收入增长为 ${percentage(growth, locale)}，多期 CAGR 为 ${percentage(revenueCagr, locale)}。收入改善通常可带动利润和现金覆盖。`,
      counterEvidence: growth !== null && growth < 0 ? "最新年度收入仍在收缩，规模效应尚未得到确认。" : "收入增长并不自动转化为现金，仍需观察利润率和营运资本。",
      monitor: "下一次定期报告中的收入增速、毛利/净利率和管理层指引。",
    },
    {
      title: "现金转化比会计利润更接近分配能力",
      view: `现金流代理为 ${compactMoney(fcf, currency, locale)}，现金转化 ${cashConversion === null ? COPY.zh.dataUnavailable : `${cashConversion.toFixed(2)}x`}。`,
      counterEvidence: cashConversion !== null && cashConversion < 0.8 ? "现金转化低于 0.8x，可能反映营运资本、资本开支或利润质量压力。" : "单一年度的现金释放可能来自营运资本时点，并非永久改善。",
      monitor: "经营现金流、营运资本、资本开支和现金余额。",
    },
    {
      title: "资产负债表决定下行情景的容错空间",
      view: `负债 / 资产为 ${percentage(liabilityRatio, locale)}，流动比率为 ${latest?.currentRatio === null || latest?.currentRatio === undefined ? COPY.zh.dataUnavailable : `${latest.currentRatio.toFixed(2)}x`}。`,
      counterEvidence: liabilityRatio !== null && liabilityRatio > 0.65 ? "负债占比较高，利率、再融资和盈利下行会更快传导到股东价值。" : "较低负债占比也不能排除表外义务、租赁或养老金风险。",
      monitor: "总债务、现金、流动性、利息费用和到期结构。",
    },
    {
      title: "资本强度决定增长是否可自筹",
      view: `现金资本开支 / 收入为 ${percentage(capexIntensity, locale)}。稳定的资本效率有利于自由现金流扩张。`,
      counterEvidence: "标准化数据无法区分维护性与增长性资本开支。",
      monitor: "资本开支指引、资产周转、项目回报和减值。",
    },
  ];

  const risks: RiskPoint[] = [
    {
      title: "收入或利润率持续恶化",
      evidence: `最新收入增长 ${percentage(growth, locale)}；净利润率 ${percentage(latest?.netMargin ?? null, locale)}。`,
      thesisBreaker: "收入和利润率连续两个年度同步下降，且管理层没有可信的修复路径。",
    },
    {
      title: "现金转化弱于会计利润",
      evidence: `现金转化 ${cashConversion === null ? COPY.zh.dataUnavailable : `${cashConversion.toFixed(2)}x`}。`,
      thesisBreaker: "经营现金流和现金流代理持续低于净利润，且无法由营运资本时点解释。",
    },
    {
      title: "资本开支或杠杆挤压股东回报",
      evidence: `资本开支强度 ${percentage(capexIntensity, locale)}；负债 / 资产 ${percentage(liabilityRatio, locale)}。`,
      thesisBreaker: "资本开支和分配持续超过经营现金流，同时现金下降或债务上升。",
    },
    {
      title: "披露与标准化数据边界",
      evidence: "SEC Company Facts 可复核核心财务历史，但无法完整覆盖分部 KPI、订单、客户集中度和所有一次性项目。",
      thesisBreaker: "最新年报附注与标准化 XBRL 出现无法解释的重大差异。",
    },
  ];

  return { dashboard, earningsQuality, thesis, risks };
}

async function buildReport(record: TickerRecord, locale: ResearchLocale): Promise<ResearchReport> {
  const cik = String(record.cik_str).padStart(10, "0");
  const [submissions, facts] = await Promise.all([
    secFetch<Submissions>(`https://data.sec.gov/submissions/CIK${cik}.json`),
    secFetch<CompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`),
  ]);

  const revenue = annualSeries(facts, METRICS.revenue, true);
  const netIncome = annualSeries(facts, METRICS.netIncome, true);
  const operatingCashFlow = annualSeries(facts, METRICS.operatingCashFlow, true);
  const investingCashFlow = annualSeries(facts, METRICS.investingCashFlow, true);
  const cashCapex = annualSeries(facts, METRICS.cashCapex, true);
  const assets = annualSeries(facts, METRICS.assets, false);
  const liabilities = annualSeries(facts, METRICS.liabilities, false);
  const equity = annualSeries(facts, METRICS.equity, false);
  const cash = annualSeries(facts, METRICS.cash, false);
  const currentAssets = annualSeries(facts, METRICS.currentAssets, false);
  const currentLiabilities = annualSeries(facts, METRICS.currentLiabilities, false);
  const totalDebt = annualSeries(facts, METRICS.totalDebt, false);
  const currentDebt = annualSeries(facts, METRICS.currentDebt, false);
  const nonCurrentDebt = annualSeries(facts, METRICS.nonCurrentDebt, false);

  const anchorDates = [...new Set([
    ...revenue.values.keys(),
    ...netIncome.values.keys(),
    ...operatingCashFlow.values.keys(),
  ])]
    .sort()
    .slice(-5);

  const periods: FinancialPeriod[] = anchorDates.map((periodEnd, index) => {
    const revenueValue = revenue.values.get(periodEnd) ?? null;
    const priorRevenue = index > 0 ? revenue.values.get(anchorDates[index - 1]) ?? null : null;
    const netIncomeValue = netIncome.values.get(periodEnd) ?? null;
    const operatingCashFlowValue = operatingCashFlow.values.get(periodEnd) ?? null;
    const investingCashFlowValue = investingCashFlow.values.get(periodEnd) ?? null;
    const capexValue = cashCapex.values.get(periodEnd) ?? null;
    const totalDebtValue =
      totalDebt.values.get(periodEnd) ??
      safeAdd(currentDebt.values.get(periodEnd) ?? null, nonCurrentDebt.values.get(periodEnd) ?? null);
    const cashValue = cash.values.get(periodEnd) ?? null;
    const fcf =
      capexValue !== null
        ? safeSubtract(operatingCashFlowValue, capexValue)
        : safeAdd(operatingCashFlowValue, investingCashFlowValue);
    return {
      periodEnd,
      revenue: revenueValue,
      netIncome: netIncomeValue,
      operatingCashFlow: operatingCashFlowValue,
      investingCashFlow: investingCashFlowValue,
      cashCapex: capexValue === null ? null : Math.abs(capexValue),
      freeCashFlowProxy: fcf,
      assets: assets.values.get(periodEnd) ?? null,
      liabilities: liabilities.values.get(periodEnd) ?? null,
      equity: equity.values.get(periodEnd) ?? null,
      cash: cashValue,
      currentAssets: currentAssets.values.get(periodEnd) ?? null,
      currentLiabilities: currentLiabilities.values.get(periodEnd) ?? null,
      totalDebt: totalDebtValue,
      netDebt:
        totalDebtValue === null || cashValue === null ? null : totalDebtValue - cashValue,
      revenueGrowth: safeDivide(
        revenueValue === null || priorRevenue === null ? null : revenueValue - priorRevenue,
        priorRevenue,
      ),
      netMargin: safeDivide(netIncomeValue, revenueValue),
      cashConversion: safeDivide(fcf, netIncomeValue),
      currentRatio: safeDivide(
        currentAssets.values.get(periodEnd) ?? null,
        currentLiabilities.values.get(periodEnd) ?? null,
      ),
    };
  });

  if (!periods.length) {
    throw new Error("Insufficient standardized annual XBRL data for this issuer.");
  }

  const currency = revenue.unit || netIncome.unit || "USD";
  const latestAnnual = filingSource(submissions, ANNUAL_FORMS, COPY[locale].annualFiling);
  const latestInterim = filingSource(submissions, INTERIM_FORMS, COPY[locale].interimFiling);
  const narrative = buildNarrative(periods, currency, locale);
  const scenarios = buildScenarios(periods);
  const today = new Date();
  const retrievedAt = today.toISOString();
  const latest = periods.at(-1);
  const cashFlowProxyFormula =
    latest?.cashCapex !== null && latest?.cashCapex !== undefined
      ? locale === "zh"
        ? "现金流代理 = 经营现金流 − |现金资本开支|"
        : "Cash-flow proxy = operating cash flow − |cash capital expenditure|"
      : latest?.investingCashFlow !== null && latest?.investingCashFlow !== undefined
        ? locale === "zh"
          ? "现金流代理 = 经营现金流 + 投资活动现金流"
          : "Cash-flow proxy = operating cash flow + investing cash flow"
        : COPY[locale].unableToCalculate;
  const sourceBase = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;

  return {
    locale,
    company: {
      name: submissions.name || facts.entityName || record.title,
      ticker: submissions.tickers?.[0] || record.ticker,
      cik,
      exchange: submissions.exchanges?.[0] || COPY[locale].notDisclosed,
      sic: submissions.sic || COPY[locale].notDisclosed,
      sicDescription: submissions.sicDescription || COPY[locale].notDisclosed,
      fiscalYearEnd: submissions.fiscalYearEnd || COPY[locale].notDisclosed,
      filingStatus: submissions.entityType || submissions.category || COPY[locale].reportingIssuer,
    },
    researchDate: today.toLocaleDateString("en-CA", { timeZone: "UTC" }),
    cutoff: retrievedAt,
    currency,
    latestAnnual,
    latestInterim,
    periods,
    dashboard: narrative.dashboard,
    overview:
      locale === "zh"
        ? `${submissions.name || record.title} 在 SEC 的行业分类为 ${submissions.sicDescription || COPY.zh.notDisclosed}（SIC ${submissions.sic || COPY.zh.notDisclosed}）。本报告以该发行人的申报身份、财政年度和标准化 XBRL 为基础；详细商业模式仍需结合最新年报业务与分部附注。`
        : `${submissions.name || record.title} is classified by the SEC in ${submissions.sicDescription || COPY.en.notDisclosed} (SIC ${submissions.sic || COPY.en.notDisclosed}). This report is based on the issuer's filing status, fiscal year, and standardized XBRL; the detailed business model should be verified against the business and segment notes in the latest annual filing.`,
    segmentAnalysis:
      locale === "zh"
        ? "标准化 Company Facts 无法稳定保留所有分部维度和发行人自定义 KPI。本 MVP 不猜测分部数值；请通过最新年报链接复核分部收入、利润、资本开支及定义变化。"
        : "Standardized Company Facts does not consistently preserve every segment dimension or issuer-defined KPI. This MVP does not infer segment values; use the latest annual-filing link to verify segment revenue, profit, capital expenditure, and definition changes.",
    earningsQuality: narrative.earningsQuality,
    thesis: narrative.thesis,
    catalysts:
      locale === "zh"
        ? [
            latestInterim
              ? {
                  timing: latestInterim.filed,
                  event: `${latestInterim.form} 已提交`,
                  investorRelevance: "检查最新经营变化、流动性、指引和一次性项目。",
                }
              : {
                  timing: COPY.zh.notDisclosed,
                  event: "下一次中期更新",
                  investorRelevance: "SEC 标准化数据未提供可靠的下一次业绩发布日期。",
                },
            latestAnnual
              ? {
                  timing: latestAnnual.filed,
                  event: `${latestAnnual.form} 年报基线`,
                  investorRelevance: "用于复核业务分部、风险因素、资本配置和会计政策。",
                }
              : {
                  timing: COPY.zh.notDisclosed,
                  event: "年度报告",
                  investorRelevance: "最新年度申报链接不可用。",
                },
            {
              timing: "持续监测",
              event: "现金转化和资产负债表",
              investorRelevance: `最新现金流代理 ${compactMoney(latest?.freeCashFlowProxy ?? null, currency, locale)}；重点观察下一期经营现金流、资本开支和债务。`,
            },
          ]
        : [
            latestInterim
              ? {
                  timing: latestInterim.filed,
                  event: `${latestInterim.form} filed`,
                  investorRelevance: "Review the latest operating changes, liquidity, guidance, and one-off items.",
                }
              : {
                  timing: COPY.en.notDisclosed,
                  event: "Next interim update",
                  investorRelevance: "Standardized SEC data does not provide a reliable date for the next results release.",
                },
            latestAnnual
              ? {
                  timing: latestAnnual.filed,
                  event: `${latestAnnual.form} annual baseline`,
                  investorRelevance: "Use it to verify business segments, risk factors, capital allocation, and accounting policies.",
                }
              : {
                  timing: COPY.en.notDisclosed,
                  event: "Annual report",
                  investorRelevance: "The latest annual-filing link is unavailable.",
                },
            {
              timing: "Ongoing",
              event: "Cash conversion and balance sheet",
              investorRelevance: `The latest cash-flow proxy was ${compactMoney(latest?.freeCashFlowProxy ?? null, currency, locale)}; monitor operating cash flow, capital expenditure, and debt in the next period.`,
            },
          ],
    risks: narrative.risks,
    scenarios,
    valuationAssessment:
      locale === "zh"
        ? "该自动化版本没有使用未获许可或未注明日期的实时股价，因此不输出目标价。情景表仅以标准化现金流代理和显式倍数生成模型隐含企业价值，用于敏感性分析，而非投资建议。"
        : "This automated version does not use unlicensed or undated real-time share prices, so it does not provide a price target. The scenario table applies explicit multiples to a standardized cash-flow proxy to produce model-implied enterprise values for sensitivity analysis, not investment advice.",
    cashFlowProxyFormula,
    valuationFormula:
      locale === "zh"
        ? `模型隐含企业价值 = 情景现金流代理 × 假设 EV/现金流倍数；${cashFlowProxyFormula}。`
        : `Model-implied enterprise value = scenario cash-flow proxy × assumed EV/cash-flow multiple; ${cashFlowProxyFormula}.`,
    sources: [
      {
        title: locale === "zh" ? "SEC 公司与交易代码映射" : "SEC company and ticker mapping",
        url: "https://www.sec.gov/files/company_tickers.json",
        retrievedAt,
      },
      {
        title: locale === "zh" ? "SEC 发行人申报索引" : "SEC issuer submissions index",
        url: sourceBase,
        retrievedAt,
      },
      {
        title: locale === "zh" ? "SEC 申报层级 Company Facts" : "SEC filing-level Company Facts",
        url: factsUrl,
        retrievedAt,
      },
      ...(latestAnnual
        ? [
            {
              title:
                locale === "zh"
                  ? `${latestAnnual.form} 年度申报`
                  : `${latestAnnual.form} annual filing`,
              url: latestAnnual.url,
              retrievedAt,
            },
          ]
        : []),
    ],
    limitations:
      locale === "zh"
        ? [
            "MVP 目前覆盖能够在 SEC Company Facts 中取得标准化年度 XBRL 的发行人；非 SEC 发行人或缺乏标准化历史的公司可能无法生成。",
            "分部、运营 KPI、客户集中度、订单、管理层指引和风险因素需要阅读最新年报正文；系统不会填造缺失值。",
            "所有情景均为分析师假设，不是公司指引、概率预测、评级或目标价。",
            "公司名称解析基于 SEC 公司与交易代码映射；重名公司可能需要输入交易代码。",
            "数据按检索时点锁定，并优先使用最新申报或修订后的标准化事实。",
          ]
        : [
            "The MVP currently covers issuers with standardized annual XBRL available in SEC Company Facts; non-SEC issuers or companies without standardized history may not generate a report.",
            "Segments, operating KPIs, customer concentration, orders, management guidance, and risk factors require review of the latest annual filing; the system does not fabricate missing values.",
            "All scenarios are analyst assumptions, not company guidance, probability forecasts, ratings, or price targets.",
            "Company-name resolution uses the SEC company and ticker mapping; similarly named companies may require a ticker.",
            "Data is locked to the retrieval timestamp, with priority given to the latest filed or amended standardized facts.",
          ],
  };
}

export async function POST(request: Request) {
  let locale: ResearchLocale = "zh";
  try {
    const payload = (await request.json()) as { company?: string; locale?: ResearchLocale };
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

    return Response.json({ report: await buildReport(record, locale) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json(
      {
        error:
          message.includes("Insufficient")
            ? locale === "zh"
              ? "该公司缺少足够的标准化年度申报数据。请尝试另一家公司或交易代码。"
              : "This company does not have enough standardized annual filing data. Try another company or ticker."
            : locale === "zh"
              ? "公开数据暂时无法获取，请稍后重试。"
              : "Public data is temporarily unavailable. Please try again later.",
      },
      { status: 502 },
    );
  }
}
