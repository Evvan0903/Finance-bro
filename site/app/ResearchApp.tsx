"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  DashboardMetric,
  EvidenceKind,
  FinancialPeriod,
  ResearchReport,
} from "./lib/research-types";
import type {
  ResearchOptions,
  SectorOutlook,
} from "./lib/sector-types";
import {
  formatFinancialMixedUnitLabel,
  formatFinancialTableValue,
  formatFinancialUnitLabel,
  formatFinancialValue,
  formatMultiple,
  formatPercentage,
  formatPerUnitValue,
} from "./lib/presentation-format";

type Locale = "zh" | "en";

const LOCALE_STORAGE_KEY = "scopeline-locale";
const RESEARCH_SELECTION_STORAGE_KEY = "finbro-research-selection-v2";
const LEGACY_RESEARCH_SELECTION_STORAGE_KEY = "finbro-research-selection-v1";
type ResearchErrorState = {
  code: string;
  title: string;
  message: string;
  technicalDiagnostic?: string;
  retryable?: boolean;
  failedStage?: string;
  traceId?: string;
  httpStatus?: number | null;
  details?: Record<string, string | number | boolean | null>;
  capabilities?: { filingFallback?: boolean; limitedCoverage?: boolean };
};

type SavedResearchSelection = {
  company: string;
  options: ResearchOptions;
};
const DEFAULT_OPTIONS: ResearchOptions = {
  sectorOutlook: true,
  peerComparison: true,
  valuation: true,
  dueDiligence: true,
  pdfExport: true,
};
const EXAMPLES: Array<{
  label: Record<Locale, string>;
  company: string;
}> = [
  {
    label: { zh: "SHEL · 能源", en: "SHEL · Energy" },
    company: "SHEL",
  },
  {
    label: { zh: "NVDA · 半导体", en: "NVDA · Semiconductors" },
    company: "NVDA",
  },
  {
    label: { zh: "JPM · 银行", en: "JPM · Banks" },
    company: "JPM",
  },
  {
    label: { zh: "LLY · 生物制药", en: "LLY · Biopharma" },
    company: "LLY",
  },
  {
    label: { zh: "CAT · 工业机械", en: "CAT · Industrial Machinery" },
    company: "CAT",
  },
];

const EVIDENCE_LABELS: Record<Locale, Record<EvidenceKind, string>> = {
  zh: {
    "Reported fact": "已披露事实",
    "Derived calculation": "推导计算",
    "Market-data value": "市场数据",
    "Analyst assumption": "分析假设",
    Interpretation: "研究解读",
    "Management statement": "管理层陈述",
  },
  en: {
    "Reported fact": "Reported fact",
    "Derived calculation": "Derived calculation",
    "Market-data value": "Market-data value",
    "Analyst assumption": "Analyst assumption",
    Interpretation: "Interpretation",
    "Management statement": "Management statement",
  },
};

const COPY = {
  zh: {
    brandHome: "FinBro 首页",
    languagePicker: "切换报告语言",
    headerNote: "ETHAN · AI 初级分析师",
    heroEyebrow: "FINBRO 研究工作台",
    heroTitle: "把股票代码交给 Ethan。",
    heroCopy: "他会读申报、学习行业、核对数字，并准备一份你可以向上汇报的材料。",
    featureMarket: "申报优先",
    featureSector: "行业语境",
    featureEvidence: "可追溯证据",
    ethanName: "Ethan · AI 初级分析师",
    ethanStatus: "在岗。咖啡是虚拟的。",
    ethanDetail: "负责把公开信息变成有出处、可复核的研究底稿。",
    assignmentTitle: "给 Ethan 分配任务",
    assignmentNote: "输入公司名称或代码，选择研究范围。Ethan 负责整理，你负责判断。",
    assignmentFinePrint: "不会代替持牌顾问，也不会替你做投资决定。",
    market: "市场",
    sector: "行业",
    subindustry: "子行业",
    ticker: "公司名或交易代码",
    companyPlaceholder: "例如：SHEL、NVDA、JPM、LLY 或 CAT",
    energy: "能源",
    technology: "科技",
    integrated: "综合石油与天然气",
    semiconductors: "半导体",
    banks: "银行",
    biopharma: "生物制药",
    industrialMachinery: "工业机械",
    us: "美国",
    europe: "欧洲",
    global: "全球",
    comingSoon: "即将推出",
    financialSector: "金融",
    healthcare: "医疗保健",
    industrials: "工业",
    consumer: "消费",
    options: "研究模块",
    sectorOutlookOption: "行业展望",
    peerOption: "同业比较",
    valuationOption: "估值",
    dueDiligenceOption: "公开信息尽调",
    pdfOption: "PDF 导出",
    generate: "交给 Ethan",
    researching: "Ethan 正在处理…",
    examplesLabel: "已验证示例",
    progressTitle: "Ethan 正在翻阅申报文件",
    progressSteps: "筛选近期证据 → 标准化申报数据 → 加载行业 KPI → 构建可复核的研究输出",
    reportUnavailable: "报告暂时无法生成。",
    researchDate: "研究日期",
    researchWindow: "研究窗口",
    sectorRefresh: "行业最近刷新",
    companyRetrieved: "公司数据检索",
    classificationDetails: "SEC SIC 分类详情",
    detectedSector: "检测行业",
    selectedPack: "研究包",
    fallbackLevel: "回退级别",
    classificationReason: "选择依据",
    sicCode: "SIC 代码",
    sicDescription: "SIC 描述",
    refreshOutlook: "仅刷新行业展望",
    refreshing: "刷新中…",
    reportEyebrow: "FinBro 股票研究简报",
    actualKey: "A = 已报告实际值",
    unavailable: "数据不可用",
    notDisclosed: "未披露",
    dashboard: "研究仪表板",
    outlook: "当前行业展望",
    outlookNote: "每项市场判断显示发布机构和原始发布日期。",
    insufficientEvidence: "近期行业证据有限",
    viewSource: "查看来源",
    whyMatters: "对投资者为何重要",
    driverExposure: "公司对行业驱动因素的敞口",
    driver: "行业驱动",
    companyExposure: "公司敞口",
    evidence: "证据",
    implication: "投资含义",
    businessSegments: "业务与分部分析",
    companyBaseline: "公司与申报基线",
    secIndustry: "SEC 行业",
    issuerStatus: "发行人身份",
    latestAnnual: "最新年报",
    latestInterim: "最新中期/当前报告",
    officialFilings: "官方申报",
    viewFiling: "查看申报",
    financials: "历史财务",
    financialNote: "标准化年度实际值；所有计算均使用页面公式。",
    year: "年度",
    revenue: "营收",
    netRevenue: "净收入",
    grossMargin: "毛利率",
    netIncome: "净利润",
    researchAndDevelopment: "研发支出",
    netInterestIncome: "净利息收入",
    deposits: "存款",
    loans: "贷款",
    loanGrowth: "贷款增长",
    creditLossProvision: "信用损失拨备",
    efficiencyRatio: "效率比率",
    tangibleBookValue: "有形账面价值",
    capitalReturns: "资本回报",
    operatingCashFlow: "经营现金流",
    cashCapex: "现金资本开支",
    freeCashFlow: "自由现金流",
    operatingMargin: "营业利润率",
    workingCapital: "营运资本",
    fcfConversion: "FCF 转化率",
    netMargin: "净利率",
    sectorKpis: "行业 KPI",
    productEconomics: "产品经济性",
    therapeuticArea: "治疗领域",
    revenueShare: "营收占比",
    indication: "适应症",
    geography: "地区",
    volumePrice: "销量 / 价格",
    supplyCapacity: "供应 / 产能",
    approvalStatus: "获批状态",
    patentLifecycle: "专利生命周期",
    commercialRisks: "商业化风险",
    pipelineAssets: "研发管线",
    stage: "阶段",
    latestMilestone: "最新里程碑",
    nextMilestone: "下一里程碑",
    successProbability: "成功概率",
    launchTiming: "上市时间",
    peakSalesAssumption: "峰值销售假设",
    valuationTreatment: "估值处理",
    kpiDefinition: "定义",
    sourceBoundary: "来源 / 数据边界",
    limitedCoverage: "数据覆盖有限",
    dataCoverage: "数据覆盖",
    coverageSummary: "指标提取与拒绝候选的审计记录",
    coverageMode: "报告模式",
    tierOneCoverage: "核心指标覆盖",
    tierTwoCoverage: "补充指标覆盖",
    missingMetrics: "未解决核心指标",
    technicalAudit: "技术提取审计",
    sourceOrder: "检索顺序",
    extractionMethod: "提取方法",
    confidence: "置信度",
    rejectedCandidates: "拒绝候选",
    formula: "公式",
    unresolvedReason: "未解决原因",
    researchQuestions: "分析师问题清单",
    cashCapital: "现金流与资本配置",
    bankCapital: "资本、流动性与股东回报",
    biopharmaCapital: "研发、流动性与资金安排",
    cash: "现金",
    totalDebt: "总债务",
    netDebt: "净债务",
    inventory: "库存",
    currentRatio: "流动比率",
    earningsQuality: "盈利质量观察",
    peerComparison: "同业比较",
    peerNote: "使用各公司最近可取得的标准化年度事实；财政年度和业务组合可能不同。",
    peer: "同业",
    rationale: "可比逻辑",
    period: "期间",
    revenueGrowth: "营收增长",
    fcfMargin: "FCF 利润率",
    debates: "投资争议",
    evidenceFor: "支持证据",
    evidenceAgainst: "反方证据",
    monitor: "监测",
    investmentInterpretation: "投资解读",
    catalystsRisks: "催化剂、申报监测与风险",
    filingWatchlist: "申报监测清单",
    operatingCatalysts: "经营催化剂",
    financialCatalysts: "财务催化剂",
    regulatoryCatalysts: "监管催化剂",
    risks: "风险与论点破坏条件",
    thesisBreaker: "论点破坏条件",
    scenariosValuation: "情景与估值",
    scenarioNote: "分析师假设，不是公司指引、概率预测或目标价。",
    bear: "悲观",
    base: "基准",
    bull: "乐观",
    revenueGrowthAssumption: "营收增长假设",
    tangibleBookGrowthAssumption: "有形账面增长假设",
    netMarginAssumption: "净利率假设",
    reinvestmentFactor: "资本开支系数",
    valuationMetric: "估值指标",
    valuationStartingPoint: "估值起点",
    impliedPricePerShare: "模型隐含每股价值",
    impliedPe: "模型隐含市盈率",
    impliedDividendYield: "模型隐含现金股息率",
    rotceCostOfEquity: "ROTCE - 股权成本",
    impliedEv: "模型隐含企业价值",
    marketValuation: "带日期市场估值",
    asOfDate: "截至日期",
    sharePrice: "股价",
    marketCapitalization: "市值",
    enterpriseValue: "企业价值",
    netDebtAdjustment: "净债务调整",
    dilutedShares: "稀释后股数",
    currentEvRevenue: "当前 EV / 营收",
    currentPe: "当前市盈率",
    currentEvEbitda: "当前 EV / EBITDA",
    impliedEquityValue: "模型隐含股权价值",
    valuationBridge: "估值桥",
    valuationAssessment: "估值判断",
    sourcesLimitations: "来源与限制",
    sourceLedger: "来源账本",
    methodology: "方法",
    limitations: "限制",
    publicationDate: "发布日期",
    retrieved: "检索于",
    downloadMarkdown: "下载 Markdown",
    exportPdf: "导出应用 PDF",
    exportingPdf: "正在生成 PDF…",
    footerDescriptor: "近期行业证据 · 申报实际值 · 透明公式",
    siteFooter: "FinBro 是研究工作流助手。输出不构成投资建议、评级或目标价。",
    markdownTitle: "行业感知机构研究快报",
  },
  en: {
    brandHome: "FinBro home",
    languagePicker: "Switch report language",
    headerNote: "ETHAN · AI JUNIOR ANALYST",
    heroEyebrow: "FINBRO RESEARCH DESK",
    heroTitle: "Give Ethan a ticker.",
    heroCopy: "He’ll read the filings, learn the sector, check the numbers, and prepare something you can send upstairs.",
    featureMarket: "Filing-first",
    featureSector: "Sector-aware",
    featureEvidence: "Source-linked",
    ethanName: "Ethan · AI junior analyst",
    ethanStatus: "At desk. Coffee is fictional.",
    ethanDetail: "Turns public information into sourced, reviewable research prep.",
    assignmentTitle: "Assign Ethan a research task",
    assignmentNote: "Give him a company, set the scope, and keep your judgment where it belongs.",
    assignmentFinePrint: "He is a research workflow assistant—not a licensed adviser or a decision-maker.",
    market: "Market",
    sector: "Sector",
    subindustry: "Subindustry",
    ticker: "Company name or ticker",
    companyPlaceholder: "e.g. SHEL, NVDA, JPM, LLY, or CAT",
    energy: "Energy",
    technology: "Technology",
    integrated: "Integrated Oil & Gas",
    semiconductors: "Semiconductors",
    banks: "Banks",
    biopharma: "Biopharma",
    industrialMachinery: "Industrial Machinery",
    us: "US",
    europe: "Europe",
    global: "Global",
    comingSoon: "Coming soon",
    financialSector: "Financials",
    healthcare: "Healthcare",
    industrials: "Industrials",
    consumer: "Consumer",
    options: "Research modules",
    sectorOutlookOption: "Sector outlook",
    peerOption: "Peer comparison",
    valuationOption: "Valuation",
    dueDiligenceOption: "Public-side due diligence",
    pdfOption: "PDF export",
    generate: "Assign Ethan",
    researching: "Ethan is on it…",
    examplesLabel: "Validated examples",
    progressTitle: "Ethan is working through the filings",
    progressSteps: "Screen recent evidence → normalize filings → load sector KPIs → prepare a reviewable research output",
    reportUnavailable: "The report could not be generated right now.",
    researchDate: "Research date",
    researchWindow: "Research window",
    sectorRefresh: "Last sector refresh",
    companyRetrieved: "Company data retrieved",
    classificationDetails: "SEC SIC classification details",
    detectedSector: "Detected sector",
    selectedPack: "Research pack",
    fallbackLevel: "Fallback level",
    classificationReason: "Selection reason",
    sicCode: "SIC code",
    sicDescription: "SIC description",
    refreshOutlook: "Refresh sector outlook only",
    refreshing: "Refreshing…",
    reportEyebrow: "FinBro equity research brief",
    actualKey: "A = reported actual",
    unavailable: "Data unavailable",
    notDisclosed: "Not disclosed",
    dashboard: "Research dashboard",
    outlook: "Current sector outlook",
    outlookNote: "Every market claim shows its publisher and original publication date.",
    insufficientEvidence: "Limited recent sector evidence",
    viewSource: "View source",
    whyMatters: "Why it matters to investors",
    driverExposure: "Company exposure to sector drivers",
    driver: "Sector driver",
    companyExposure: "Company exposure",
    evidence: "Evidence",
    implication: "Investment implication",
    businessSegments: "Business and segment analysis",
    companyBaseline: "Company and filing baseline",
    secIndustry: "SEC industry",
    issuerStatus: "Issuer status",
    latestAnnual: "Latest annual filing",
    latestInterim: "Latest interim/current filing",
    officialFilings: "Official filings",
    viewFiling: "View filing",
    financials: "Historical financials",
    financialNote: "Normalized annual actuals; all calculations use displayed formulas.",
    year: "Year",
    revenue: "Revenue",
    netRevenue: "Net revenue",
    grossMargin: "Gross margin",
    netIncome: "Net income",
    researchAndDevelopment: "R&D expense",
    netInterestIncome: "Net interest income",
    deposits: "Deposits",
    loans: "Loans",
    loanGrowth: "Loan growth",
    creditLossProvision: "Credit-loss provision",
    efficiencyRatio: "Efficiency ratio",
    tangibleBookValue: "Tangible book value",
    capitalReturns: "Capital returns",
    operatingCashFlow: "Operating cash flow",
    cashCapex: "Cash capex",
    freeCashFlow: "Free cash flow",
    operatingMargin: "Operating margin",
    workingCapital: "Working capital",
    fcfConversion: "FCF conversion",
    netMargin: "Net margin",
    sectorKpis: "Sector KPIs",
    productEconomics: "Product economics",
    therapeuticArea: "Therapeutic area",
    revenueShare: "Revenue share",
    indication: "Indication",
    geography: "Geography",
    volumePrice: "Volume / price",
    supplyCapacity: "Supply / capacity",
    approvalStatus: "Approval status",
    patentLifecycle: "Patent lifecycle",
    commercialRisks: "Commercial risks",
    pipelineAssets: "Pipeline assets",
    stage: "Stage",
    latestMilestone: "Latest milestone",
    nextMilestone: "Next milestone",
    successProbability: "Success probability",
    launchTiming: "Launch timing",
    peakSalesAssumption: "Peak-sales assumption",
    valuationTreatment: "Valuation treatment",
    kpiDefinition: "Definition",
    sourceBoundary: "Source / data boundary",
    limitedCoverage: "Limited data coverage",
    dataCoverage: "Data Coverage",
    coverageSummary: "Audit trail for extracted metrics and rejected candidates",
    coverageMode: "Report mode",
    tierOneCoverage: "Core metric coverage",
    tierTwoCoverage: "Supplemental metric coverage",
    missingMetrics: "Unresolved core metrics",
    technicalAudit: "Technical extraction audit",
    sourceOrder: "Search order",
    extractionMethod: "Extraction method",
    confidence: "Confidence",
    rejectedCandidates: "Rejected candidates",
    formula: "Formula",
    unresolvedReason: "Unresolved reason",
    researchQuestions: "Analyst question set",
    cashCapital: "Cash flow and capital allocation",
    bankCapital: "Capital, liquidity, and shareholder returns",
    biopharmaCapital: "R&D, liquidity, and funding",
    cash: "Cash",
    totalDebt: "Total debt",
    netDebt: "Net debt",
    inventory: "Inventory",
    currentRatio: "Current ratio",
    earningsQuality: "Earnings-quality observations",
    peerComparison: "Peer comparison",
    peerNote: "Uses each company's latest available standardized annual facts; fiscal years and business mixes may differ.",
    peer: "Peer",
    rationale: "Comparison logic",
    period: "Period",
    revenueGrowth: "Revenue growth",
    fcfMargin: "FCF margin",
    debates: "Investment debates",
    evidenceFor: "Evidence for",
    evidenceAgainst: "Evidence against",
    monitor: "Monitor",
    investmentInterpretation: "Investment interpretation",
    catalystsRisks: "Catalysts, filing watchlist, and risks",
    filingWatchlist: "Filing watchlist",
    operatingCatalysts: "Operating catalysts",
    financialCatalysts: "Financial catalysts",
    regulatoryCatalysts: "Regulatory catalysts",
    risks: "Risks and thesis breakers",
    thesisBreaker: "Thesis breaker",
    scenariosValuation: "Scenarios and valuation",
    scenarioNote: "Analyst assumptions—not company guidance, probability forecasts, or price targets.",
    bear: "Bear",
    base: "Base",
    bull: "Bull",
    revenueGrowthAssumption: "Revenue growth assumption",
    tangibleBookGrowthAssumption: "Tangible-book growth assumption",
    netMarginAssumption: "Net margin assumption",
    reinvestmentFactor: "Capex factor",
    valuationMetric: "Valuation metric",
    valuationStartingPoint: "Valuation starting point",
    impliedPricePerShare: "Model-implied value per share",
    impliedPe: "Model-implied P/E",
    impliedDividendYield: "Model-implied cash-dividend yield",
    rotceCostOfEquity: "ROTCE less cost of equity",
    impliedEv: "Model-implied enterprise value",
    marketValuation: "Dated market valuation",
    asOfDate: "As of",
    sharePrice: "Share price",
    marketCapitalization: "Market capitalization",
    enterpriseValue: "Enterprise value",
    netDebtAdjustment: "Net-debt adjustment",
    dilutedShares: "Diluted shares",
    currentEvRevenue: "Current EV / revenue",
    currentPe: "Current P/E",
    currentEvEbitda: "Current EV / EBITDA",
    impliedEquityValue: "Model-implied equity value",
    valuationBridge: "Valuation bridge",
    valuationAssessment: "Valuation assessment",
    sourcesLimitations: "Sources and limitations",
    sourceLedger: "Source ledger",
    methodology: "Methodology",
    limitations: "Limitations",
    publicationDate: "Publication date",
    retrieved: "Retrieved",
    downloadMarkdown: "Download Markdown",
    exportPdf: "Export application PDF",
    exportingPdf: "Generating PDF…",
    footerDescriptor: "Recent sector evidence · filing actuals · transparent formulas",
    siteFooter: "FinBro is a research workflow assistant. Output is not investment advice, a rating, or a price target.",
    markdownTitle: "Sector-Aware Institutional Research Brief",
  },
} as const;

function formatMoney(value: number | null, currency: string, locale: Locale) {
  return formatFinancialValue(value, currency, locale);
}

function formatTableMoney(value: number | null, locale: Locale) {
  return formatFinancialTableValue(value, locale);
}

function formatShareCount(value: number | null, locale: Locale) {
  if (value === null || !Number.isFinite(value)) return "—";
  const displayed = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 1e6);
  return locale === "zh" ? `${displayed}百万股` : `${displayed} million shares`;
}

function formatPercent(value: number | null, locale: Locale) {
  return formatPercentage(value, locale);
}

type PeerDisplayMetric = {
  id: string;
  value: number | null;
  unit?: string;
  currency?: string | null;
  displayType?: "percent" | "multiple" | "money" | "per-share";
};

function formatPeerMetric(metric: PeerDisplayMetric, locale: Locale) {
  if (metric.value === null) return "—";
  if (metric.displayType === "multiple" || metric.unit === "multiple") {
    return formatMultiple(metric.value, locale);
  }
  if (metric.displayType === "money" || (metric.currency && metric.unit === metric.currency)) {
    return formatFinancialValue(metric.value, metric.currency, locale);
  }
  if (
    metric.displayType === "per-share" ||
    (metric.currency && metric.unit === `${metric.currency}/share`)
  ) {
    return formatPerUnitValue(metric.value, metric.currency, locale, "share");
  }
  return formatPercent(metric.value, locale);
}

function shortYear(periodEnd: string) {
  return periodEnd.slice(0, 4);
}

function formatTimestamp(value: string, locale: Locale) {
  return new Date(value).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function EvidenceBadge({ kind, locale }: { kind: EvidenceKind; locale: Locale }) {
  const className = kind.toLowerCase().replaceAll(" ", "-");
  return <span className={`evidence-badge ${className}`}>{EVIDENCE_LABELS[locale][kind]}</span>;
}

function MetricCard({ metric, locale }: { metric: DashboardMetric; locale: Locale }) {
  return (
    <article className={`metric-card ${metric.tone}`}>
      <div className="metric-topline">
        <span>{metric.label}</span>
        <EvidenceBadge kind={metric.classification} locale={locale} />
      </div>
      <strong>{metric.value}</strong>
      <p>{metric.detail}</p>
    </article>
  );
}

function TrendChart({
  periods,
  currency,
  locale,
  bank = false,
}: {
  periods: FinancialPeriod[];
  currency: string;
  locale: Locale;
  bank?: boolean;
}) {
  const copy = COPY[locale];
  const secondMetric = (period: FinancialPeriod) =>
    bank ? period.netInterestIncome : period.operatingCashFlow;
  const chartPeriods = periods.filter(
    (period) => period.revenue !== null || secondMetric(period) !== null,
  );
  if (!chartPeriods.length) return null;
  const maxRevenue = Math.max(...chartPeriods.map((period) => Math.abs(period.revenue ?? 0)), 1);
  const maxCash = Math.max(...chartPeriods.map((period) => Math.abs(secondMetric(period) ?? 0)), 1);
  const firstLabel = bank ? copy.netRevenue : copy.revenue;
  const secondLabel = bank ? copy.netInterestIncome : copy.operatingCashFlow;
  return (
    <div className="trend-chart" role="img" aria-label={`${firstLabel} / ${secondLabel}`}>
      <span className="chart-unit-label">{formatFinancialUnitLabel(currency, locale)}</span>
      <div className="chart-legend">
        <span><i className="legend-revenue" />{firstLabel}</span>
        <span><i className="legend-cash" />{secondLabel}</span>
      </div>
      <div
        className="chart-grid"
        style={{ gridTemplateColumns: `repeat(${chartPeriods.length}, minmax(0, 1fr))` }}
      >
        {chartPeriods.map((period) => (
          <div className="chart-column" key={period.periodEnd}>
            <div className="bar-stage">
              {period.revenue !== null && (
                <div
                  className="bar revenue-bar"
                  style={{ height: `${Math.max(5, (Math.abs(period.revenue) / maxRevenue) * 100)}%` }}
                  title={`${firstLabel} ${formatMoney(period.revenue, currency, locale)}`}
                />
              )}
              {secondMetric(period) !== null && (
                <div
                  className="bar cash-bar"
                  style={{ height: `${Math.max(5, (Math.abs(secondMetric(period)!) / maxCash) * 82)}%` }}
                  title={`${secondLabel} ${formatMoney(secondMetric(period), currency, locale)}`}
                />
              )}
            </div>
            <span>{shortYear(period.periodEnd)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function reportToMarkdown(report: ResearchReport, locale: Locale) {
  const copy = COPY[locale];
  const hasBiopharmaOperatingCashFlow = report.periods.some(
    (period) => period.operatingCashFlow !== null,
  );
  const hasBiopharmaFreeCashFlow = report.periods.some(
    (period) => period.freeCashFlowProxy !== null,
  );
  const lines = [
    `# ${report.company.name} — ${copy.markdownTitle}`,
    "",
    `**${copy.researchDate}:** ${report.researchDate}  `,
    `**${copy.researchWindow}:** ${report.sectorOutlook.researchWindowStart} to ${report.sectorOutlook.researchWindowEnd}  `,
    `**${copy.companyRetrieved}:** ${report.companyDataRetrievedAt}`,
    "",
    `## 1. ${copy.dashboard}`,
    ...report.dashboard.map((item) => `- **${item.label}: ${item.value}** — ${item.detail}`),
    "",
    `## 2. ${copy.outlook}`,
    ...report.sectorOutlook.claims.map(
      (claim) => `- ${claim.claim} — [${claim.publisher} · ${claim.publicationDate} · ${copy.viewSource} ↗](${claim.url})\n  - ${copy.whyMatters}: ${claim.whyItMatters}`,
    ),
    "",
    `## 3. ${copy.driverExposure}`,
    ...report.driverExposure.map(
      (item) => `- **${item.driver}** — ${item.companyExposure}\n  - [${item.evidenceTitle} · ${item.evidenceDate} · ${copy.viewSource} ↗](${item.evidenceUrl}) — ${item.evidence}\n  - ${copy.implication}: ${item.investmentImplication}`,
    ),
    "",
    `## 4. ${copy.businessSegments}`,
    report.overview,
    "",
    report.segmentAnalysis,
    "",
    `## 5. ${copy.financials}`,
    `*${formatFinancialMixedUnitLabel(report.currency, locale, "billion", report.sectorPack.id === "banks" ? "rates-ratios" : "margins")}*`,
    ...(report.sectorPack.id === "banks"
      ? [
          `| ${copy.year} | ${copy.netRevenue} | ${copy.netInterestIncome} | ${copy.deposits} | ${copy.loanGrowth} | ${copy.creditLossProvision} | ${copy.efficiencyRatio} |`,
          "|---|---:|---:|---:|---:|---:|---:|",
          ...report.periods.map(
            (period) =>
              `| ${shortYear(period.periodEnd)}A | ${formatTableMoney(period.revenue, locale)} | ${formatTableMoney(period.netInterestIncome, locale)} | ${formatTableMoney(period.deposits, locale)} | ${formatPercent(period.loanGrowth, locale)} | ${formatTableMoney(period.creditLossProvision, locale)} | ${formatPercent(period.efficiencyRatio, locale)} |`,
          ),
        ]
      : report.sectorPack.id === "biopharma"
        ? [
            `| ${copy.year} | ${copy.revenue} | ${copy.grossMargin} | ${copy.researchAndDevelopment} | ${copy.netIncome} |${hasBiopharmaOperatingCashFlow ? ` ${copy.operatingCashFlow} |` : ""}${hasBiopharmaFreeCashFlow ? ` ${copy.freeCashFlow} |` : ""}`,
            `|---|---:|---:|---:|---:|${hasBiopharmaOperatingCashFlow ? "---:|" : ""}${hasBiopharmaFreeCashFlow ? "---:|" : ""}`,
            ...report.periods.map(
              (period) =>
              `| ${shortYear(period.periodEnd)}A | ${formatTableMoney(period.revenue, locale)} | ${formatPercent(period.grossMargin, locale)} | ${formatTableMoney(period.researchAndDevelopment, locale)} | ${formatTableMoney(period.netIncome, locale)} |${hasBiopharmaOperatingCashFlow ? ` ${formatTableMoney(period.operatingCashFlow, locale)} |` : ""}${hasBiopharmaFreeCashFlow ? ` ${formatTableMoney(period.freeCashFlowProxy, locale)} |` : ""}`,
            ),
          ]
      : report.sectorPack.id === "industrial-machinery"
        ? [
            `| ${copy.year} | ${copy.revenue} | ${copy.operatingMargin} | ${copy.inventory} | ${copy.cashCapex} | ${copy.freeCashFlow} | ${copy.fcfConversion} |`,
            "|---|---:|---:|---:|---:|---:|---:|",
            ...report.periods.map(
              (period) =>
              `| ${shortYear(period.periodEnd)}A | ${formatTableMoney(period.revenue, locale)} | ${formatPercent(period.operatingMargin, locale)} | ${formatTableMoney(period.inventory, locale)} | ${formatTableMoney(period.cashCapex, locale)} | ${formatTableMoney(period.freeCashFlowProxy, locale)} | ${formatPercent(period.cashConversion, locale)} |`,
            ),
          ]
      : [
          `| ${copy.year} | ${copy.revenue} | ${copy.netIncome} | ${copy.operatingCashFlow} | ${copy.cashCapex} | ${copy.freeCashFlow} |`,
          "|---|---:|---:|---:|---:|---:|",
          ...report.periods.map(
            (period) =>
              `| ${shortYear(period.periodEnd)}A | ${formatTableMoney(period.revenue, locale)} | ${formatTableMoney(period.netIncome, locale)} | ${formatTableMoney(period.operatingCashFlow, locale)} | ${formatTableMoney(period.cashCapex, locale)} | ${formatTableMoney(period.freeCashFlowProxy, locale)} |`,
          ),
        ]),
    "",
    `## 6. ${copy.sectorKpis}`,
    ...report.sectorKpis.map(
      (item) => `- **${item.label}: ${item.value}** — ${item.definition}\n  - ${item.sourceNote}\n  - ${copy.whyMatters}: ${item.whyItMatters}`,
    ),
    ...(
      report.productMetrics.length
        ? [
            "",
            `### ${copy.productEconomics}`,
            ...report.productMetrics.map(
              (item) =>
                `- **${item.product} · ${formatMoney(item.revenue, report.currency, locale)} · ${item.period}**${item.revenueGrowth !== null ? ` · ${copy.revenueGrowth} ${formatPercent(item.revenueGrowth, locale)}` : ""}${item.revenueShare !== null ? ` · ${copy.revenueShare} ${formatPercent(item.revenueShare, locale)}` : ""}\n  - ${copy.therapeuticArea}: ${item.therapeuticArea}; ${copy.indication}: ${item.indication}; ${copy.geography}: ${item.geography}\n  - ${copy.volumePrice}: ${item.volumePrice}; ${copy.supplyCapacity}: ${item.supplyCapacity}\n  - ${copy.approvalStatus}: ${item.approvalStatus}; ${copy.patentLifecycle}: ${item.patentLifecycle}\n  - ${copy.commercialRisks}: ${item.commercialRisks}\n  - [${item.sourceTitle} · ${item.sourceDate} · ${copy.viewSource} ↗](${item.sourceUrl})`,
            ),
          ]
        : []
    ),
    ...(
      report.pipelineAssets.length
        ? [
            "",
            `### ${copy.pipelineAssets}`,
            ...report.pipelineAssets.map(
              (item) =>
                `- **${item.asset} · ${item.stage}** — ${item.indication}\n  - ${copy.latestMilestone}: ${item.latestMilestone}\n  - ${copy.nextMilestone}: ${item.nextMilestone}; ${copy.launchTiming}: ${item.launchTiming}\n  - ${copy.successProbability}: ${item.successProbability}; ${copy.peakSalesAssumption}: ${item.peakSalesAssumption}\n  - ${copy.valuationTreatment}: ${item.valuationTreatment}\n  - [${item.sourceTitle} · ${item.sourceDate} · ${copy.viewSource} ↗](${item.sourceUrl})`,
            ),
          ]
        : []
    ),
    "",
    `### ${copy.dataCoverage}`,
    `- ${copy.sourceOrder}: ${report.dataCoverage.searchedSources.join(" → ")}`,
    ...report.dataCoverage.notes.map((note) => `- ${note}`),
    ...report.dataCoverage.metrics.map(
      (metric) =>
        `- **${metric.displayName[locale]} — ${metric.status}**${metric.displayValue ? ` · ${metric.displayValue} · ${metric.period}` : ""}\n  - ${metric.sourceDocument ?? metric.reason ?? "—"}${metric.extractionMethod ? `\n  - ${copy.extractionMethod}: ${metric.extractionMethod}` : ""}${metric.formula ? `\n  - ${copy.formula}: ${metric.formula}` : ""}`,
    ),
    "",
    `## 7. ${report.sectorPack.id === "banks" ? copy.bankCapital : copy.cashCapital}`,
    ...report.earningsQuality.map((item) => `- ${item}`),
    "",
    ...(
      report.peerComparison.some(
        (peer) => peer.periodEnd && peer.metrics.some((metric) => metric.value !== null),
      )
        ? [
            `## 8. ${copy.peerComparison}`,
            ...report.peerComparison
              .filter((peer) => peer.periodEnd && peer.metrics.some((metric) => metric.value !== null))
              .map(
                (item) => `- **${item.ticker}** — ${item.rationale}; ${item.metrics.filter((metric) => metric.value !== null).map((metric) => `${metric.label} ${formatPeerMetric(metric, locale)}`).join("; ")}`,
              ),
            "",
          ]
        : []
    ),
    ...(
      report.investmentDebates.length
        ? [
            `## 9. ${copy.debates}`,
            ...report.investmentDebates.map(
              (item) => `- **${item.question}**\n  - ${copy.evidenceFor}: ${item.evidenceFor}\n  - ${copy.evidenceAgainst}: ${item.evidenceAgainst}\n  - ${copy.monitor}: ${item.monitor}\n  - ${copy.investmentInterpretation}: ${item.interpretation}`,
            ),
            "",
          ]
        : []
    ),
    `## 10. ${copy.catalystsRisks}`,
    ...report.risks.map(
      (item) => `- **${item.title}** — ${item.evidence}\n  - ${copy.thesisBreaker}: ${item.thesisBreaker}`,
    ),
    "",
    `## 11. ${copy.scenariosValuation}`,
    ...(
      report.marketValuation
        ? [
            `### ${copy.marketValuation} · ${report.marketValuation.asOfDate}`,
            `- ${copy.sharePrice}: ${formatPerUnitValue(report.marketValuation.sharePrice, report.currency, locale, "share")}`,
            `- ${copy.marketCapitalization}: ${formatMoney(report.marketValuation.marketCapitalization, report.currency, locale)}`,
            `- ${copy.enterpriseValue}: ${formatMoney(report.marketValuation.enterpriseValue, report.currency, locale)}`,
            `- ${copy.netDebtAdjustment}: ${formatMoney(report.marketValuation.netDebtAdjustment, report.currency, locale)}`,
            `- ${copy.dilutedShares}: ${formatShareCount(report.marketValuation.dilutedShares, locale)}`,
            `- ${copy.currentEvRevenue}: ${formatMultiple(report.marketValuation.currentEvRevenue, locale, 1)}; ${copy.currentPe}: ${formatMultiple(report.marketValuation.currentPe, locale, 1)}${report.marketValuation.currentEvEbitda !== null ? `; ${copy.currentEvEbitda}: ${formatMultiple(report.marketValuation.currentEvEbitda, locale, 1)}` : ""}`,
            `- [${report.marketValuation.sourceTitle} · ${copy.viewSource} ↗](${report.marketValuation.sourceUrl})`,
            ...report.marketValuation.formulas.map((formula) => `- ${copy.formula}: ${formula}`),
            "",
          ]
        : []
    ),
    ...report.scenarios.map(
      (scenario) =>
        `### ${copy[scenario.name.toLowerCase() as "bear" | "base" | "bull"]}\n- ${copy.valuationMetric}: ${scenario.valuationMetric === null ? "—" : formatMoney(scenario.valuationMetric, report.currency, locale)}\n- ${copy.impliedEv}: ${scenario.modelImpliedEnterpriseValue === null ? "—" : formatMoney(scenario.modelImpliedEnterpriseValue, report.currency, locale)}\n- ${copy.netDebtAdjustment}: ${scenario.netDebtAdjustment === null ? "—" : formatMoney(scenario.netDebtAdjustment, report.currency, locale)}\n- ${copy.impliedEquityValue}: ${scenario.modelImpliedEquityValue === null ? "—" : formatMoney(scenario.modelImpliedEquityValue, report.currency, locale)}\n- ${copy.dilutedShares}: ${formatShareCount(scenario.dilutedShares, locale)}\n- ${copy.impliedPricePerShare}: ${scenario.impliedPricePerShare === null ? "—" : formatPerUnitValue(scenario.impliedPricePerShare, report.currency, locale, "share")}`,
    ),
    report.valuationAssessment,
    "",
    report.valuationFormula,
    "",
    `## 12. ${copy.sourcesLimitations}`,
    ...report.sources.map(
      (source) =>
        `- [${source.title}](${source.url})${source.publisher ? ` — ${source.publisher}` : ""}${source.publicationDate ? ` · ${source.publicationDate}` : ""}`,
    ),
    ...report.limitations.map((item) => `- ${item}`),
    "",
  ];
  return lines.join("\n");
}

function SectionHeading({
  number,
  title,
  note,
}: {
  number: string;
  title: string;
  note?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div><span>{number}</span><h3>{title}</h3></div>
      {note && <p>{note}</p>}
    </div>
  );
}

function CatalystColumn({
  title,
  items,
}: {
  title: string;
  items: Array<{ timing: string; event: string; investorRelevance: string }>;
}) {
  return (
    <div className="catalyst-column">
      <h4>{title}</h4>
      {items.map((item) => (
        <article key={`${title}-${item.event}`}>
          <time>{item.timing}</time>
          <strong>{item.event}</strong>
          <p>{item.investorRelevance}</p>
        </article>
      ))}
    </div>
  );
}

function DataCoveragePanel({
  report,
  locale,
}: {
  report: ResearchReport;
  locale: Locale;
}) {
  const copy = COPY[locale];
  const unresolvedCore = report.metricExtractionAudit.filter(
    (item) => item.tier === 1 && item.applicable && !["found", "derived"].includes(item.status),
  );
  if (
    !report.metricExtractionAudit.length &&
    !report.dataCoverage.metrics.length &&
    !report.dataCoverage.limited
  ) return null;
  return (
    <details className="data-coverage">
      <summary>
        <span>{copy.dataCoverage}</span>
        <small>
          {report.metricCoverage.reportMode === "limited"
            ? copy.limitedCoverage
            : `${Math.round(report.metricCoverage.tier1.coverage * 100)}%`}
        </small>
      </summary>
      <p>{copy.coverageSummary}</p>
      <dl className="coverage-summary-grid">
        <div><dt>{copy.coverageMode}</dt><dd>{report.metricCoverage.reportMode}</dd></div>
        <div><dt>{copy.tierOneCoverage}</dt><dd>{Math.round(report.metricCoverage.tier1.coverage * 100)}%</dd></div>
        <div><dt>{copy.tierTwoCoverage}</dt><dd>{Math.round(report.metricCoverage.tier2.coverage * 100)}%</dd></div>
      </dl>
      {unresolvedCore.length > 0 && (
        <p><b>{copy.missingMetrics}:</b> {unresolvedCore.map((item) => item.metricId).join(", ")}</p>
      )}
      {report.dataCoverage.searchedSources.length > 0 && (
        <p className="coverage-source-order">
          <b>{copy.sourceOrder}:</b> {report.dataCoverage.searchedSources.join(" → ")}
        </p>
      )}
      {report.dataCoverage.notes.map((note) => <p key={note}>{note}</p>)}
      <div className="coverage-list">
        {report.dataCoverage.metrics.map((metric) => (
          <article key={metric.metricId} className={metric.found ? "located" : "unresolved"}>
            <header>
              <div>
                <h4>{metric.displayName[locale]}</h4>
                <span>{metric.status}</span>
              </div>
              {metric.displayValue && <strong>{metric.displayValue}</strong>}
            </header>
            <dl>
              {metric.period && <div><dt>{copy.period}</dt><dd>{metric.period}</dd></div>}
              <div>
                <dt>{copy.sourceBoundary}</dt>
                <dd>
                  {metric.sourceUrl
                    ? <a href={metric.sourceUrl} target="_blank" rel="noreferrer">{metric.sourceDocument} ↗</a>
                    : metric.sourceDocument ?? "—"}
                  {metric.section ? ` · ${metric.section}` : ""}
                  {metric.table ? ` / ${metric.table}` : ""}
                  {metric.row ? ` / ${metric.row}` : ""}
                </dd>
              </div>
              {metric.extractionMethod && (
                <div><dt>{copy.extractionMethod}</dt><dd>{metric.extractionMethod}</dd></div>
              )}
              <div><dt>{copy.confidence}</dt><dd>{(metric.confidence * 100).toFixed(0)}%</dd></div>
              {metric.formula && <div><dt>{copy.formula}</dt><dd>{metric.formula}</dd></div>}
              {metric.reason && <div><dt>{copy.unresolvedReason}</dt><dd>{metric.reason}</dd></div>}
            </dl>
            {metric.rejectedCandidates.length > 0 && (
              <details>
                <summary>{copy.rejectedCandidates} · {metric.rejectedCandidates.length}</summary>
                <ul>
                  {metric.rejectedCandidates.map((candidate, index) => (
                    <li key={`${candidate.rawLabel}-${candidate.value}-${index}`}>
                      <b>{candidate.rawLabel}</b> · {candidate.rawValue} {candidate.unit} · {candidate.rejectionReasons.join("; ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        ))}
      </div>
      {report.metricExtractionAudit.length > 0 && (
        <details className="coverage-technical-audit">
          <summary>{copy.technicalAudit} · {report.metricExtractionAudit.length}</summary>
          <div className="coverage-audit-table-wrap">
            <table>
              <thead><tr><th>Metric</th><th>Status</th><th>Source</th><th>Reason</th></tr></thead>
              <tbody>
                {report.metricExtractionAudit.map((item) => (
                  <tr key={`${item.tier}-${item.metricId}`}>
                    <td>{item.metricId}</td>
                    <td>{item.status}</td>
                    <td>{item.searchedSources.join(" → ") || "—"}</td>
                    <td>{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </details>
  );
}

export function ResearchApp() {
  const [company, setCompany] = useState("SHEL");
  const [locale, setLocale] = useState<Locale>("zh");
  const [localeReady, setLocaleReady] = useState(false);
  const [selectionReady, setSelectionReady] = useState(false);
  const [options, setOptions] = useState<ResearchOptions>(DEFAULT_OPTIONS);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [error, setError] = useState<ResearchErrorState | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshingOutlook, setRefreshingOutlook] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const reportRef = useRef<HTMLElement>(null);
  const lastRequestRef = useRef<{ body: ReturnType<typeof requestBody>; query: string; locale: Locale } | null>(null);
  const copy = COPY[locale];
  const latestPeriod = useMemo(() => report?.periods.at(-1) ?? null, [report]);
  const visiblePeerComparison = useMemo(
    () =>
      report?.peerComparison.filter(
        (peer) => peer.periodEnd && peer.metrics.some((metric) => metric.value !== null),
      ) ?? [],
    [report],
  );
  const visiblePeerMetricIds = useMemo(
    () =>
      new Set(
        visiblePeerComparison.flatMap((peer) =>
          peer.metrics
            .filter((metric) => metric.value !== null)
            .map((metric) => metric.id),
        ),
      ),
    [visiblePeerComparison],
  );
  const hasBiopharmaOperatingCashFlow =
    report?.periods.some((period) => period.operatingCashFlow !== null) ?? false;
  const hasBiopharmaFreeCashFlow =
    report?.periods.some((period) => period.freeCashFlowProxy !== null) ?? false;
  const hasSectorDetail =
    (report?.sectorKpis.some((item) => item.usable) ?? false) ||
    (report?.productMetrics.length ?? 0) > 0 ||
    (report?.pipelineAssets.length ?? 0) > 0;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        if (storedLocale === "zh" || storedLocale === "en") setLocale(storedLocale);
        const saved =
          window.localStorage.getItem(RESEARCH_SELECTION_STORAGE_KEY) ??
          window.localStorage.getItem(LEGACY_RESEARCH_SELECTION_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<SavedResearchSelection>;
          if (typeof parsed.company === "string") setCompany(parsed.company.slice(0, 100));
          if (parsed.options) setOptions({ ...DEFAULT_OPTIONS, ...parsed.options });
        }
      } catch {
        // Defaults remain available when browser storage is unavailable or stale.
      }
      setLocaleReady(true);
      setSelectionReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!localeReady) return;
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Language switching remains available without persistent browser storage.
    }
  }, [locale, localeReady]);

  useEffect(() => {
    if (!selectionReady) return;
    try {
      const selection: SavedResearchSelection = { company, options };
      window.localStorage.setItem(RESEARCH_SELECTION_STORAGE_KEY, JSON.stringify(selection));
    } catch {
      // Retrying in the current page remains available without local storage.
    }
  }, [company, options, selectionReady]);

  function requestBody(query: string, requestedLocale: Locale) {
    const localFixture =
      typeof window !== "undefined" &&
      ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
      new URLSearchParams(window.location.search).get("fixture") === "shell";
    return {
      company: query,
      locale: requestedLocale,
      options,
      ...(localFixture ? { fixture: true } : {}),
    };
  }

  async function loadReport(
    query: string,
    requestedLocale: Locale,
    scrollAfter: boolean,
    preservedBody?: ReturnType<typeof requestBody>,
  ) {
    if (!query || loading) return;
    const body = preservedBody ?? requestBody(query, requestedLocale);
    lastRequestRef.current = { body, query, locale: requestedLocale };
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let payload: { report?: ResearchReport; error?: ResearchErrorState | string } = {};
      try {
        payload = await response.json() as typeof payload;
      } catch {
        throw new Error(COPY[requestedLocale].reportUnavailable);
      }
      if (!response.ok || !payload.report) {
        if (payload.error && typeof payload.error !== "string") {
          setError(payload.error);
          return;
        }
        throw new Error(payload.error || COPY[requestedLocale].reportUnavailable);
      }
      setReport(payload.report);
      if (scrollAfter) {
        requestAnimationFrame(() => {
          document.getElementById("report")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    } catch (caught) {
      setError({
        code: "INTERNAL_PIPELINE_ERROR",
        title: requestedErrorTitle(requestedLocale),
        message: caught instanceof Error ? caught.message : COPY[requestedLocale].reportUnavailable,
      });
    } finally {
      setLoading(false);
    }
  }

  function requestedErrorTitle(requestedLocale: Locale) {
    return requestedLocale === "zh" ? "Ethan 暂时无法完成这项任务。" : "Ethan could not complete that assignment.";
  }

  function retryLastRequest() {
    const saved = lastRequestRef.current;
    if (!saved) return;
    void loadReport(saved.query, saved.locale, false, saved.body);
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    void loadReport(company.trim(), locale, true);
  }

  function switchLocale(nextLocale: Locale) {
    if (nextLocale === locale || loading) return;
    const shouldRefresh = report !== null;
    setLocale(nextLocale);
    setError(null);
    if (shouldRefresh) void loadReport(company.trim(), nextLocale, false);
  }

  function chooseExample(example: (typeof EXAMPLES)[number]) {
    setCompany(example.company);
    setReport(null);
    setError(null);
  }

  function toggleOption(key: keyof ResearchOptions) {
    setOptions((current) => ({ ...current, [key]: !current[key] }));
  }

  async function refreshSectorOutlook() {
    if (!report || refreshingOutlook) return;
    setRefreshingOutlook(true);
    setError(null);
    try {
      const response = await fetch("/api/sector-outlook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: report.sectorOutlook.market,
          subindustry: report.selection.subindustry,
          locale,
          refresh: true,
        }),
      });
      const payload = (await response.json()) as { outlook?: SectorOutlook; error?: string };
      if (!response.ok || !payload.outlook) throw new Error(payload.error || copy.reportUnavailable);
      setReport((current) =>
        current
          ? {
              ...current,
              sectorOutlook: payload.outlook!,
              evidenceCutoff: payload.outlook!.evidenceCutoff,
              sectorLastRefreshedAt: payload.outlook!.lastRefreshedAt,
            }
          : current,
      );
    } catch (caught) {
      setError({
        code: "INTERNAL_PIPELINE_ERROR",
        title: requestedErrorTitle(locale),
        message: caught instanceof Error ? caught.message : copy.reportUnavailable,
      });
    } finally {
      setRefreshingOutlook(false);
    }
  }

  function downloadMarkdown() {
    if (!report) return;
    const blob = new Blob([reportToMarkdown(report, locale)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.company.ticker.toLowerCase()}-sector-research-${locale}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPdf() {
    if (!report || !reportRef.current || exportingPdf) return;
    setExportingPdf(true);
    setError(null);
    try {
      const { exportReportPdf } = await import("./lib/pdf-export");
      await exportReportPdf(reportRef.current, {
        ticker: report.company.ticker,
        researchDate: report.researchDate,
        filename: `${report.company.ticker.toLowerCase()}-sector-research-${locale}.pdf`,
      });
    } catch (caught) {
      setError({
        code: "INTERNAL_PIPELINE_ERROR",
        title: requestedErrorTitle(locale),
        message: caught instanceof Error ? caught.message : copy.reportUnavailable,
      });
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label={copy.brandHome}>
          <span className="brand-mark">F</span>
          <span>FinBro</span>
        </a>
        <div className="header-actions">
          <span className="header-note">{copy.headerNote}</span>
          <div className="locale-toggle" role="group" aria-label={copy.languagePicker}>
            <button type="button" lang="zh-CN" aria-pressed={locale === "zh"} onClick={() => switchLocale("zh")} disabled={loading}>中文</button>
            <button type="button" lang="en" aria-pressed={locale === "en"} onClick={() => switchLocale("en")} disabled={loading}>EN</button>
          </div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-content">
          <div className="hero-intro">
            <div>
              <p className="eyebrow">{copy.heroEyebrow}</p>
              <h1>{copy.heroTitle}</h1>
              <p className="hero-copy">{copy.heroCopy}</p>
              <div className="trust-row" aria-label="Features">
                <span><b>01</b> {copy.featureMarket}</span>
                <span><b>02</b> {copy.featureSector}</span>
                <span><b>03</b> {copy.featureEvidence}</span>
              </div>
            </div>
            <aside className="ethan-card" aria-label={copy.ethanName}>
              <div className="ethan-card-head">
                <span className="ethan-avatar">E</span>
                <div><strong>{copy.ethanName}</strong><span>{copy.ethanStatus}</span></div>
              </div>
              <p>{copy.ethanDetail}</p>
              <div className="ethan-live"><i />{locale === "zh" ? "等待任务" : "Available for assignments"}</div>
            </aside>
          </div>

          <form className="research-form" onSubmit={submit}>
            <div className="assignment-heading">
              <span>01</span>
              <div><strong>{copy.assignmentTitle}</strong><p>{copy.assignmentNote}</p></div>
            </div>
            <div className="selection-grid">
              <label className="ticker-field">
                <span>{copy.ticker}</span>
                <input
                  id="company"
                  name="company"
                  value={company}
                  onChange={(event) => {
                    setCompany(event.target.value);
                    setReport(null);
                    setError(null);
                  }}
                  placeholder={copy.companyPlaceholder}
                  autoComplete="organization"
                  maxLength={100}
                  disabled={loading}
                />
              </label>
            </div>
            <fieldset className="option-row">
              <legend>{copy.options}</legend>
              {([
                ["sectorOutlook", copy.sectorOutlookOption],
                ["peerComparison", copy.peerOption],
                ["valuation", copy.valuationOption],
                ["dueDiligence", copy.dueDiligenceOption],
                ["pdfExport", copy.pdfOption],
              ] as Array<[keyof ResearchOptions, string]>).map(([key, label]) => (
                <label key={key}>
                  <input type="checkbox" checked={options[key]} onChange={() => toggleOption(key)} disabled={loading} />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <div className="form-footer">
              <div className="example-row" aria-label={copy.examplesLabel}>
                <span>{copy.examplesLabel}</span>
                {EXAMPLES.map((example) => (
                  <button type="button" key={example.company} onClick={() => chooseExample(example)}>
                    {example.label[locale]}
                  </button>
                ))}
              </div>
              <button className="generate-button" type="submit" disabled={loading || company.trim().length < 2}>
                {loading ? copy.researching : copy.generate}
              </button>
            </div>
            <p className="assignment-fine-print">{copy.assignmentFinePrint}</p>
          </form>

          {loading && (
            <div className="research-progress" role="status" aria-live="polite">
              <span className="progress-orbit" />
              <div><strong>{copy.progressTitle}</strong><p>{copy.progressSteps}</p></div>
            </div>
          )}
          {error && (
            <section className="error-message research-error" role="alert">
              <div>
                <strong>{error.title}</strong>
                <p>{error.message}</p>
              </div>
              <div className="research-error-actions">
                {error.retryable && (
                  <button type="button" onClick={retryLastRequest} disabled={loading}>
                    {locale === "zh" ? "重试" : "Retry"}
                  </button>
                )}
                {(error.code === "TICKER_NOT_FOUND" || error.code === "AMBIGUOUS_TICKER") && (
                  <button type="button" onClick={() => document.getElementById("company")?.focus()}>
                    {locale === "zh" ? "修改代码" : "Edit ticker"}
                  </button>
                )}
              </div>
              {(error.technicalDiagnostic || error.traceId) && (
                <details>
                  <summary>{locale === "zh" ? "技术详情" : "Technical details"}</summary>
                  <dl>
                    <div><dt>{locale === "zh" ? "错误代码" : "Code"}</dt><dd>{error.code}</dd></div>
                    {error.failedStage && <div><dt>{locale === "zh" ? "失败阶段" : "Failed stage"}</dt><dd>{error.failedStage}</dd></div>}
                    {error.httpStatus !== undefined && error.httpStatus !== null && <div><dt>HTTP</dt><dd>{error.httpStatus}</dd></div>}
                    {error.traceId && <div><dt>Trace ID</dt><dd>{error.traceId}</dd></div>}
                    {error.technicalDiagnostic && <div><dt>{locale === "zh" ? "诊断" : "Diagnostic"}</dt><dd>{error.technicalDiagnostic}</dd></div>}
                  </dl>
                </details>
              )}
            </section>
          )}
        </div>
      </section>

      {report && latestPeriod && (
        <article
          className="report"
          id="report"
          ref={reportRef}
          data-rendering-model={report.renderingModel.web}
        >
          <div data-pdf-block>
            <section className="report-cover">
              <div>
                <p className="eyebrow dark">{copy.reportEyebrow}</p>
                <h2>{report.company.name}</h2>
                <div className="company-meta">
                  <span>{report.company.ticker}</span>
                  <span>{report.company.exchange}</span>
                  <span>{report.sectorPack.sectorLabel}</span>
                  <span>{report.sectorPack.subindustryLabel}</span>
                  <span>CIK {report.company.cik}</span>
                </div>
              </div>
              <dl className="evidence-meta">
                <div><dt>{copy.researchDate}</dt><dd>{report.researchDate}</dd></div>
                <div><dt>{copy.researchWindow}</dt><dd>{report.sectorOutlook.researchWindowStart} — {report.sectorOutlook.researchWindowEnd}</dd></div>
                <div><dt>{copy.sectorRefresh}</dt><dd>{formatTimestamp(report.sectorLastRefreshedAt, locale)} UTC</dd></div>
                <div><dt>{copy.companyRetrieved}</dt><dd>{formatTimestamp(report.companyDataRetrievedAt, locale)} UTC</dd></div>
              </dl>
              <details className="classification-details">
                <summary>{copy.classificationDetails}</summary>
                <dl>
                  <div><dt>{copy.sicCode}</dt><dd>{report.classification.sicCode ?? "—"}</dd></div>
                  <div><dt>{copy.sicDescription}</dt><dd>{report.classification.sicDescription ?? "—"}</dd></div>
                  <div><dt>{copy.detectedSector}</dt><dd>{report.classification.detectedSector}</dd></div>
                  <div><dt>{copy.selectedPack}</dt><dd>{report.classification.selectedPackName}</dd></div>
                  <div><dt>{copy.fallbackLevel}</dt><dd>{report.classification.fallbackLevel}</dd></div>
                  <div><dt>{copy.classificationReason}</dt><dd>{report.classification.classificationReason}</dd></div>
                </dl>
              </details>
            </section>
            <section className="disclosure-banner">
              <div className="disclosure-title">
                <strong>{report.sectorPack.valuationMethod}</strong>
                {report.dataCoverage.limited && (
                  <span className="coverage-chip">{copy.limitedCoverage}</span>
                )}
              </div>
              <p>{copy.footerDescriptor}</p>
              <div className="evidence-key">
                {(Object.keys(EVIDENCE_LABELS[locale]) as EvidenceKind[]).map((key) => (
                  <EvidenceBadge key={key} kind={key} locale={locale} />
                ))}
              </div>
            </section>
          </div>

          <section className="report-section dashboard-section" data-pdf-block>
            <SectionHeading number="01" title={copy.dashboard} />
            <div className="metric-grid">
              {report.dashboard.map((metric) => <MetricCard metric={metric} locale={locale} key={metric.label} />)}
            </div>
          </section>

          {report.sectorOutlook.claims.length > 0 ? (
            <section className="report-section outlook-section" data-pdf-block>
              <SectionHeading number="02" title={copy.outlook} note={copy.outlookNote} />
              <div className="outlook-toolbar">
                <span>{copy.researchWindow}: <strong>{report.sectorOutlook.researchWindowStart} — {report.sectorOutlook.researchWindowEnd}</strong></span>
                <button type="button" onClick={() => void refreshSectorOutlook()} disabled={refreshingOutlook}>
                  {refreshingOutlook ? copy.refreshing : copy.refreshOutlook}
                </button>
              </div>
              {report.sectorOutlook.insufficientEvidence && (
                <p className="limited-recent-evidence">{copy.insufficientEvidence}</p>
              )}
              <div className="outlook-grid">
                {report.sectorOutlook.claims.map((claim) => (
                  <article key={claim.url}>
                    <p>{claim.claim}</p>
                    <strong>{copy.whyMatters}</strong>
                    <p>{claim.whyItMatters}</p>
                    <span className="source-title">{claim.title}</span>
                    <a className="compact-citation" href={claim.url} target="_blank" rel="noreferrer">
                      {claim.publisher} · {claim.publicationDate} · {copy.viewSource} ↗
                    </a>
                  </article>
                ))}
              </div>
            </section>
          ) : report.sectorOutlook.insufficientEvidence ? (
            <p className="limited-recent-evidence" data-pdf-block>{copy.insufficientEvidence}</p>
          ) : null}

          {report.driverExposure.length > 0 && (
            <section className="report-section" data-pdf-block>
              <SectionHeading number="03" title={copy.driverExposure} />
              <div className="table-wrap">
                <table className="driver-table">
                  <thead>
                    <tr><th>{copy.driver}</th><th>{copy.companyExposure}</th><th>{copy.evidence}</th><th>{copy.implication}</th></tr>
                  </thead>
                  <tbody>
                    {report.driverExposure.map((item) => (
                      <tr key={item.driver}>
                        <th>{item.driver}</th>
                        <td>{item.companyExposure}</td>
                        <td>
                          <a className="compact-citation" href={item.evidenceUrl} target="_blank" rel="noreferrer">
                            <strong>{item.evidencePublisher} · {item.evidenceDate} · {copy.viewSource} ↗</strong><br />{item.evidence}
                          </a>
                        </td>
                        <td>{item.investmentImplication}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="report-section split-section" data-pdf-block>
            <SectionHeading number="04" title={copy.businessSegments} />
            <div className="overview-card">
              <EvidenceBadge kind="Reported fact" locale={locale} />
              <h4>{copy.companyBaseline}</h4>
              <p>{report.overview}</p>
              <dl>
                <div><dt>{copy.secIndustry}</dt><dd>{report.company.sicDescription}</dd></div>
                <div><dt>{copy.issuerStatus}</dt><dd>{report.company.filingStatus}</dd></div>
                <div><dt>{copy.latestAnnual}</dt><dd>{report.latestAnnual ? `${report.latestAnnual.form} · ${report.latestAnnual.filed}` : copy.unavailable}</dd></div>
                <div><dt>{copy.latestInterim}</dt><dd>{report.latestInterim ? `${report.latestInterim.form} · ${report.latestInterim.filed}` : copy.unavailable}</dd></div>
              </dl>
            </div>
            <aside className="filing-links">
              <span>{copy.officialFilings}</span>
              {report.latestAnnual && <a href={report.latestAnnual.url} target="_blank" rel="noreferrer">{copy.viewFiling} {report.latestAnnual.form} ↗</a>}
              {report.latestInterim && <a href={report.latestInterim.url} target="_blank" rel="noreferrer">{copy.viewFiling} {report.latestInterim.form} ↗</a>}
              <p>{report.segmentAnalysis}</p>
            </aside>
          </section>

          <section className="report-section" data-pdf-block>
            <SectionHeading
              number="05"
              title={copy.financials}
              note={<><EvidenceBadge kind="Reported fact" locale={locale} /> {copy.financialNote}</>}
            />
            <TrendChart
              periods={report.periods}
              currency={report.currency}
              locale={locale}
              bank={report.sectorPack.id === "banks"}
            />
            <div className="table-wrap has-unit-label">
              <span className="table-unit-label">
                {formatFinancialMixedUnitLabel(
                  report.currency,
                  locale,
                  "billion",
                  report.sectorPack.id === "banks" ? "rates-ratios" : "margins",
                )}
              </span>
              <table className="financial-table">
                <caption>{copy.actualKey}</caption>
                <thead>
                  {report.sectorPack.id === "banks" ? (
                    <tr>
                      <th>{copy.year}</th><th>{copy.netRevenue}</th><th>{copy.netInterestIncome}</th>
                      <th>{copy.deposits}</th><th>{copy.loans}</th><th>{copy.loanGrowth}</th>
                      <th>{copy.creditLossProvision}</th><th>{copy.efficiencyRatio}</th>
                    </tr>
                  ) : report.sectorPack.id === "biopharma" ? (
                    <tr>
                      <th>{copy.year}</th><th>{copy.revenue}</th><th>{copy.grossMargin}</th>
                      <th>{copy.researchAndDevelopment}</th><th>{copy.netIncome}</th>
                      {hasBiopharmaOperatingCashFlow && <th>{copy.operatingCashFlow}</th>}
                      {hasBiopharmaFreeCashFlow && <th>{copy.freeCashFlow}</th>}
                    </tr>
                  ) : report.sectorPack.id === "industrial-machinery" ? (
                    <tr>
                      <th>{copy.year}</th><th>{copy.revenue}</th><th>{copy.operatingMargin}</th>
                      <th>{copy.inventory}</th><th>{copy.workingCapital}</th>
                      <th>{copy.cashCapex}</th><th>{copy.freeCashFlow}</th><th>{copy.fcfConversion}</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>{copy.year}</th><th>{copy.revenue}</th><th>{copy.grossMargin}</th>
                      <th>{copy.netIncome}</th><th>{copy.operatingCashFlow}</th>
                      <th>{copy.cashCapex}</th><th>{copy.freeCashFlow}</th><th>{copy.netMargin}</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {report.periods.map((period) => (
                    <tr key={period.periodEnd}>
                      <th>{shortYear(period.periodEnd)}A</th>
                      {report.sectorPack.id === "banks" ? (
                        <>
                          <td>{formatTableMoney(period.revenue, locale)}</td>
                          <td>{formatTableMoney(period.netInterestIncome, locale)}</td>
                          <td>{formatTableMoney(period.deposits, locale)}</td>
                          <td>{formatTableMoney(period.loans, locale)}</td>
                          <td>{formatPercent(period.loanGrowth, locale)}</td>
                          <td>{formatTableMoney(period.creditLossProvision, locale)}</td>
                          <td>{formatPercent(period.efficiencyRatio, locale)}</td>
                        </>
                      ) : report.sectorPack.id === "biopharma" ? (
                        <>
                          <td>{formatTableMoney(period.revenue, locale)}</td>
                          <td>{formatPercent(period.grossMargin, locale)}</td>
                          <td>{formatTableMoney(period.researchAndDevelopment, locale)}</td>
                          <td>{formatTableMoney(period.netIncome, locale)}</td>
                          {hasBiopharmaOperatingCashFlow && <td>{formatTableMoney(period.operatingCashFlow, locale)}</td>}
                          {hasBiopharmaFreeCashFlow && <td>{formatTableMoney(period.freeCashFlowProxy, locale)}</td>}
                        </>
                      ) : report.sectorPack.id === "industrial-machinery" ? (
                        <>
                          <td>{formatTableMoney(period.revenue, locale)}</td>
                          <td>{formatPercent(period.operatingMargin, locale)}</td>
                          <td>{formatTableMoney(period.inventory, locale)}</td>
                          <td>{formatTableMoney(period.workingCapital, locale)}</td>
                          <td>{formatTableMoney(period.cashCapex, locale)}</td>
                          <td>{formatTableMoney(period.freeCashFlowProxy, locale)}</td>
                          <td>{formatPercent(period.cashConversion, locale)}</td>
                        </>
                      ) : (
                        <>
                          <td>{formatTableMoney(period.revenue, locale)}</td>
                          <td>{formatPercent(period.grossMargin, locale)}</td>
                          <td>{formatTableMoney(period.netIncome, locale)}</td>
                          <td>{formatTableMoney(period.operatingCashFlow, locale)}</td>
                          <td>{formatTableMoney(period.cashCapex, locale)}</td>
                          <td>{formatTableMoney(period.freeCashFlowProxy, locale)}</td>
                          <td>{formatPercent(period.netMargin, locale)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="formula-note">
              <EvidenceBadge kind="Derived calculation" locale={locale} /> {report.cashFlowProxyFormula}
              {report.sectorPack.id === "banks"
                ? `; ${locale === "zh" ? "效率比率 = 非利息费用 ÷ 净收入。" : "Efficiency ratio = noninterest expense / net revenue."}`
                : `; ${locale === "zh" ? "净利率 = 净利润 ÷ 营收；毛利率 = 毛利润 ÷ 营收。" : "Net margin = net income / revenue; gross margin = gross profit / revenue."}`}
            </p>
          </section>

          {hasSectorDetail && (
          <section className="report-section" data-pdf-block>
            <SectionHeading number="06" title={copy.sectorKpis} />
            <div className="kpi-grid">
              {report.sectorKpis.filter((item) => item.usable).map((item) => (
                <article key={item.id}>
                  <div><h4>{item.label}</h4><EvidenceBadge kind={item.classification} locale={locale} /></div>
                  <strong>{item.value}</strong>
                  <p><b>{copy.kpiDefinition}:</b> {item.definition}</p>
                  <p>
                    <b>{copy.sourceBoundary}:</b>{" "}
                    {item.sourceUrl
                      ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceNote} ↗</a>
                      : item.sourceNote}
                  </p>
                  <p><b>{copy.whyMatters}:</b> {item.whyItMatters}</p>
                </article>
              ))}
            </div>
            {report.productMetrics.length > 0 && (
              <div className="report-subsection">
                <h4>{copy.productEconomics}</h4>
                <div className="product-metrics-grid">
                  {report.productMetrics.map((item) => (
                    <article className="product-metric-card" key={`${item.product}-${item.period}`}>
                      <header>
                        <div><h5>{item.product}</h5><span>{item.therapeuticArea}</span></div>
                        <EvidenceBadge kind={item.classification} locale={locale} />
                      </header>
                      <strong>{formatMoney(item.revenue, report.currency, locale)}</strong>
                      <p className="card-period">{item.period}</p>
                      <dl>
                        {item.revenueGrowth !== null && <div><dt>{copy.revenueGrowth}</dt><dd>{formatPercent(item.revenueGrowth, locale)}</dd></div>}
                        {item.revenueShare !== null && <div><dt>{copy.revenueShare}</dt><dd>{formatPercent(item.revenueShare, locale)}</dd></div>}
                        {item.indication.trim() && <div><dt>{copy.indication}</dt><dd>{item.indication}</dd></div>}
                        {item.geography.trim() && <div><dt>{copy.geography}</dt><dd>{item.geography}</dd></div>}
                        {item.volumePrice.trim() && <div><dt>{copy.volumePrice}</dt><dd>{item.volumePrice}</dd></div>}
                        {item.supplyCapacity.trim() && <div><dt>{copy.supplyCapacity}</dt><dd>{item.supplyCapacity}</dd></div>}
                        {item.approvalStatus.trim() && <div><dt>{copy.approvalStatus}</dt><dd>{item.approvalStatus}</dd></div>}
                        {item.patentLifecycle.trim() && <div><dt>{copy.patentLifecycle}</dt><dd>{item.patentLifecycle}</dd></div>}
                        {item.commercialRisks.trim() && <div><dt>{copy.commercialRisks}</dt><dd>{item.commercialRisks}</dd></div>}
                      </dl>
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                        {item.sourceTitle} · {item.sourceDate} ↗
                      </a>
                    </article>
                  ))}
                </div>
              </div>
            )}
            {report.pipelineAssets.length > 0 && (
              <div className="report-subsection">
                <h4>{copy.pipelineAssets}</h4>
                <div className="pipeline-grid">
                  {report.pipelineAssets.map((item) => (
                    <article className="pipeline-card" key={`${item.asset}-${item.indication}`}>
                      <header>
                        <div><h5>{item.asset}</h5><span>{item.stage}</span></div>
                        <EvidenceBadge kind={item.classification} locale={locale} />
                      </header>
                      <p>{item.indication}</p>
                      <dl>
                        {item.latestMilestone.trim() && <div><dt>{copy.latestMilestone}</dt><dd>{item.latestMilestone}</dd></div>}
                        {item.nextMilestone.trim() && <div><dt>{copy.nextMilestone}</dt><dd>{item.nextMilestone}</dd></div>}
                        {item.successProbability.trim() && <div><dt>{copy.successProbability}</dt><dd>{item.successProbability}</dd></div>}
                        {item.launchTiming.trim() && <div><dt>{copy.launchTiming}</dt><dd>{item.launchTiming}</dd></div>}
                        {item.peakSalesAssumption.trim() && <div><dt>{copy.peakSalesAssumption}</dt><dd>{item.peakSalesAssumption}</dd></div>}
                        {item.valuationTreatment.trim() && <div><dt>{copy.valuationTreatment}</dt><dd>{item.valuationTreatment}</dd></div>}
                      </dl>
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                        {item.sourceTitle} · {item.sourceDate} ↗
                      </a>
                    </article>
                  ))}
                </div>
              </div>
            )}
            <DataCoveragePanel report={report} locale={locale} />
            <details className="research-questions">
              <summary>{copy.researchQuestions}</summary>
              <ol>{report.sectorPack.researchQuestions.map((question) => <li key={question}>{question}</li>)}</ol>
            </details>
          </section>
          )}

          {!hasSectorDetail && <DataCoveragePanel report={report} locale={locale} />}

          <section className="report-section analysis-grid-section" data-pdf-block>
            <SectionHeading
              number="07"
              title={
                report.sectorPack.id === "banks"
                  ? copy.bankCapital
                  : report.sectorPack.id === "biopharma"
                    ? copy.biopharmaCapital
                    : copy.cashCapital
              }
            />
            <div className="balance-panel">
              <div className="balance-grid">
                {(report.sectorPack.id === "banks"
                  ? [
                      { label: copy.cash, value: latestPeriod.cash, formatted: formatMoney(latestPeriod.cash, report.currency, locale) },
                      { label: copy.deposits, value: latestPeriod.deposits, formatted: formatMoney(latestPeriod.deposits, report.currency, locale) },
                      { label: copy.loans, value: latestPeriod.loans, formatted: formatMoney(latestPeriod.loans, report.currency, locale) },
                      { label: copy.tangibleBookValue, value: latestPeriod.tangibleBookValue, formatted: formatMoney(latestPeriod.tangibleBookValue, report.currency, locale) },
                      { label: copy.capitalReturns, value: latestPeriod.capitalReturns, formatted: formatMoney(latestPeriod.capitalReturns, report.currency, locale) },
                      { label: copy.efficiencyRatio, value: latestPeriod.efficiencyRatio, formatted: formatPercent(latestPeriod.efficiencyRatio, locale) },
                    ]
                  : report.sectorPack.id === "biopharma"
                    ? [
                        { label: copy.cash, value: latestPeriod.cash, formatted: formatMoney(latestPeriod.cash, report.currency, locale) },
                        { label: copy.researchAndDevelopment, value: latestPeriod.researchAndDevelopment, formatted: formatMoney(latestPeriod.researchAndDevelopment, report.currency, locale) },
                        { label: copy.totalDebt, value: latestPeriod.totalDebt, formatted: formatMoney(latestPeriod.totalDebt, report.currency, locale) },
                        { label: copy.netDebt, value: latestPeriod.netDebt, formatted: formatMoney(latestPeriod.netDebt, report.currency, locale) },
                        { label: copy.cashCapex, value: latestPeriod.cashCapex, formatted: formatMoney(latestPeriod.cashCapex, report.currency, locale) },
                        { label: copy.freeCashFlow, value: latestPeriod.freeCashFlowProxy, formatted: formatMoney(latestPeriod.freeCashFlowProxy, report.currency, locale) },
                      ]
                  : report.sectorPack.id === "industrial-machinery"
                    ? [
                        { label: copy.workingCapital, value: latestPeriod.workingCapital, formatted: formatMoney(latestPeriod.workingCapital, report.currency, locale) },
                        { label: copy.inventory, value: latestPeriod.inventory, formatted: formatMoney(latestPeriod.inventory, report.currency, locale) },
                        { label: copy.cashCapex, value: latestPeriod.cashCapex, formatted: formatMoney(latestPeriod.cashCapex, report.currency, locale) },
                        { label: copy.freeCashFlow, value: latestPeriod.freeCashFlowProxy, formatted: formatMoney(latestPeriod.freeCashFlowProxy, report.currency, locale) },
                        { label: copy.fcfConversion, value: latestPeriod.cashConversion, formatted: formatPercent(latestPeriod.cashConversion, locale) },
                        { label: copy.operatingMargin, value: latestPeriod.operatingMargin, formatted: formatPercent(latestPeriod.operatingMargin, locale) },
                      ]
                  : [
                      { label: copy.cash, value: latestPeriod.cash, formatted: formatMoney(latestPeriod.cash, report.currency, locale) },
                      { label: copy.totalDebt, value: latestPeriod.totalDebt, formatted: formatMoney(latestPeriod.totalDebt, report.currency, locale) },
                      { label: copy.netDebt, value: latestPeriod.netDebt, formatted: formatMoney(latestPeriod.netDebt, report.currency, locale) },
                      { label: copy.inventory, value: latestPeriod.inventory, formatted: formatMoney(latestPeriod.inventory, report.currency, locale) },
                      { label: copy.cashCapex, value: latestPeriod.cashCapex, formatted: formatMoney(latestPeriod.cashCapex, report.currency, locale) },
                      { label: copy.currentRatio, value: latestPeriod.currentRatio, formatted: latestPeriod.currentRatio === null ? "—" : `${latestPeriod.currentRatio.toFixed(2)}x` },
                    ]
                ).filter((item) => item.value !== null).map((item) => (
                  <div key={item.label}><span>{item.label}</span><strong>{item.formatted}</strong></div>
                ))}
              </div>
              <p><EvidenceBadge kind="Derived calculation" locale={locale} /> {report.cashFlowProxyFormula}</p>
            </div>
            <div className="quality-panel">
              <h4>{copy.earningsQuality}</h4>
              <ul>{report.earningsQuality.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </section>

          {visiblePeerComparison.length > 0 && (
            <section className="report-section" data-pdf-block>
              <SectionHeading number="08" title={copy.peerComparison} note={copy.peerNote} />
              <div className="table-wrap">
                <table className="peer-table">
                  <thead>
                    <tr>
                      <th>{copy.peer}</th><th>{copy.rationale}</th><th>{copy.period}</th>
                      {visiblePeerComparison[0].metrics
                        .filter((metric) => visiblePeerMetricIds.has(metric.id))
                        .map((metric) => <th key={metric.id}>{metric.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePeerComparison.map((peer) => (
                      <tr key={peer.ticker}>
                        <th>{peer.ticker}<small>{peer.name}</small></th>
                        <td>{peer.rationale}</td>
                        <td>{peer.periodEnd ?? "—"}</td>
                        {peer.metrics
                          .filter((metric) => visiblePeerMetricIds.has(metric.id))
                          .map((metric) => (
                            <td key={metric.id}>{formatPeerMetric(metric, locale)}</td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {report.investmentDebates.length > 0 && (
            <section className="report-section" data-pdf-block>
              <SectionHeading number="09" title={copy.debates} />
              <div className="debate-grid">
                {report.investmentDebates.map((debate) => (
                  <article key={debate.question}>
                    <h4>{debate.question}</h4>
                    <dl>
                      <div><dt>{copy.evidenceFor}</dt><dd>{debate.evidenceFor}</dd></div>
                      <div><dt>{copy.evidenceAgainst}</dt><dd>{debate.evidenceAgainst}</dd></div>
                      <div><dt>{copy.monitor}</dt><dd>{debate.monitor}</dd></div>
                      {debate.interpretation.trim() && (
                        <div><dt>{copy.investmentInterpretation}</dt><dd>{debate.interpretation}</dd></div>
                      )}
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="report-section" data-pdf-block>
            <SectionHeading number="10" title={copy.catalystsRisks} />
            <div className="filing-watchlist">
              <h4>{copy.filingWatchlist}</h4>
              {report.filingWatchlist.map((item) => (
                <article key={`${item.timing}-${item.event}`}><time>{item.timing}</time><strong>{item.event}</strong><p>{item.investorRelevance}</p></article>
              ))}
            </div>
            <div className="catalyst-grid">
              <CatalystColumn title={copy.operatingCatalysts} items={report.catalysts.operating} />
              <CatalystColumn title={copy.financialCatalysts} items={report.catalysts.financial} />
              <CatalystColumn title={copy.regulatoryCatalysts} items={report.catalysts.regulatory} />
            </div>
            <div className="risk-list">
              <h4>{copy.risks}</h4>
              {report.risks.map((risk) => (
                <article key={risk.title}><h5>{risk.title}</h5><p>{risk.evidence}</p><strong>{copy.thesisBreaker}</strong><p>{risk.thesisBreaker}</p></article>
              ))}
            </div>
          </section>

          <section className="report-section scenario-section" data-pdf-block>
            <SectionHeading
              number="11"
              title={copy.scenariosValuation}
              note={<><EvidenceBadge kind="Analyst assumption" locale={locale} /> {copy.scenarioNote}</>}
            />
            {report.marketValuation && (
              <div className="market-valuation-panel">
                <div className="market-valuation-header">
                  <div><h4>{copy.marketValuation}</h4><time>{copy.asOfDate} {report.marketValuation.asOfDate}</time></div>
                  <a href={report.marketValuation.sourceUrl} target="_blank" rel="noreferrer">
                    {report.marketValuation.sourceTitle} ↗
                  </a>
                </div>
                <dl className="valuation-snapshot-grid">
                  <div><dt>{copy.sharePrice}</dt><dd>{formatPerUnitValue(report.marketValuation.sharePrice, report.currency, locale, "share")}</dd></div>
                  <div><dt>{copy.marketCapitalization}</dt><dd>{formatMoney(report.marketValuation.marketCapitalization, report.currency, locale)}</dd></div>
                  <div><dt>{copy.enterpriseValue}</dt><dd>{formatMoney(report.marketValuation.enterpriseValue, report.currency, locale)}</dd></div>
                  <div><dt>{copy.netDebtAdjustment}</dt><dd>{formatMoney(report.marketValuation.netDebtAdjustment, report.currency, locale)}</dd></div>
                  <div><dt>{copy.dilutedShares}</dt><dd>{formatShareCount(report.marketValuation.dilutedShares, locale)}</dd></div>
                  <div><dt>{copy.currentEvRevenue}</dt><dd>{formatMultiple(report.marketValuation.currentEvRevenue, locale, 1)}</dd></div>
                  <div><dt>{copy.currentPe}</dt><dd>{formatMultiple(report.marketValuation.currentPe, locale, 1)}</dd></div>
                  {report.marketValuation.currentEvEbitda !== null && (
                    <div><dt>{copy.currentEvEbitda}</dt><dd>{formatMultiple(report.marketValuation.currentEvEbitda, locale, 1)}</dd></div>
                  )}
                </dl>
                <div className="valuation-formulas">
                  {report.marketValuation.formulas.map((formula) => <code key={formula}>{formula}</code>)}
                </div>
              </div>
            )}
            {report.scenarios.length ? (
              <div className="scenario-grid">
                {report.scenarios.map((scenario) => (
                  <article className={`scenario-card ${scenario.name.toLowerCase()}`} key={scenario.name}>
                    <div className="scenario-title">
                      <span>{copy[scenario.name.toLowerCase() as "bear" | "base" | "bull"]}</span>
                      <strong>
                        {formatMultiple(
                          scenario.enterpriseValueMultiple,
                          locale,
                          report.sectorPack.id === "banks" ? 2 : 0,
                        )} {scenario.multipleLabel}
                      </strong>
                    </div>
                    <dl>
                      <div>
                        <dt>{report.sectorPack.id === "banks" ? copy.tangibleBookGrowthAssumption : copy.revenueGrowthAssumption}</dt>
                        <dd>{formatPercent(scenario.revenueGrowth, locale)}</dd>
                      </div>
                      {scenario.netMargin !== null && (
                        <div><dt>{copy.netMarginAssumption}</dt><dd>{formatPercent(scenario.netMargin, locale)}</dd></div>
                      )}
                      {report.sectorPack.id !== "banks" && scenario.capexFactor !== null && (
                        <div><dt>{copy.reinvestmentFactor}</dt><dd>{scenario.capexFactor.toFixed(2)}x</dd></div>
                      )}
                      {scenario.projectedFreeCashFlow !== null && (
                        <div><dt>{copy.freeCashFlow}</dt><dd>{formatMoney(scenario.projectedFreeCashFlow, report.currency, locale)}</dd></div>
                      )}
                      {scenario.valuationMetric !== null && (
                        <div><dt>{copy.valuationMetric}</dt><dd>{formatMoney(scenario.valuationMetric, report.currency, locale)}</dd></div>
                      )}
                      {scenario.valuationStartingPoint !== null && (
                        <div><dt>{copy.valuationStartingPoint}</dt><dd>{formatMoney(scenario.valuationStartingPoint, report.currency, locale)}</dd></div>
                      )}
                      {scenario.modelImpliedEnterpriseValue !== null && (
                        <div><dt>{copy.impliedEv}</dt><dd>{formatMoney(scenario.modelImpliedEnterpriseValue, report.currency, locale)}</dd></div>
                      )}
                      {scenario.netDebtAdjustment !== null && (
                        <div><dt>{copy.netDebtAdjustment}</dt><dd>{formatMoney(scenario.netDebtAdjustment, report.currency, locale)}</dd></div>
                      )}
                      {scenario.modelImpliedEquityValue !== null && (
                        <div><dt>{copy.impliedEquityValue}</dt><dd>{formatMoney(scenario.modelImpliedEquityValue, report.currency, locale)}</dd></div>
                      )}
                      {scenario.dilutedShares !== null && (
                        <div><dt>{copy.dilutedShares}</dt><dd>{formatShareCount(scenario.dilutedShares, locale)}</dd></div>
                      )}
                      {scenario.impliedPricePerShare !== null && (
                        <div><dt>{copy.impliedPricePerShare}</dt><dd>{formatPerUnitValue(scenario.impliedPricePerShare, report.currency, locale, "share")}</dd></div>
                      )}
                      {scenario.impliedPriceToEarnings !== null && (
                        <div><dt>{copy.impliedPe}</dt><dd>{formatMultiple(scenario.impliedPriceToEarnings, locale, 1)}</dd></div>
                      )}
                      {scenario.impliedDividendYield !== null && (
                        <div><dt>{copy.impliedDividendYield}</dt><dd>{formatPercent(scenario.impliedDividendYield, locale)}</dd></div>
                      )}
                      {scenario.rotceCostOfEquitySpread !== null && (
                        <div><dt>{copy.rotceCostOfEquity}</dt><dd>{formatPercent(scenario.rotceCostOfEquitySpread, locale)}</dd></div>
                      )}
                    </dl>
                    <p>{scenario.impliedValueLabel}</p>
                    {scenario.impliedPricePerShare !== null && (
                      <strong className="scenario-value">{formatPerUnitValue(scenario.impliedPricePerShare, report.currency, locale, "share")}</strong>
                    )}
                  </article>
                ))}
              </div>
            ) : <p className="module-not-selected">{report.valuationAssessment}</p>}
            <div className="valuation-note">
              <h4>{copy.valuationAssessment}</h4>
              <p>{report.valuationAssessment}</p>
              <code>{report.valuationFormula}</code>
            </div>
          </section>

          <section className="report-section source-section" data-pdf-block>
            <SectionHeading number="12" title={copy.sourcesLimitations} />
            <div className="source-columns">
              <div>
                <h4>{copy.sourceLedger}</h4>
                <ol>
                  {report.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>
                      <small>
                        {source.publisher}
                        {source.publicationDate ? ` · ${copy.publicationDate} ${source.publicationDate}` : ""}
                        {` · ${copy.retrieved} ${formatTimestamp(source.retrievedAt, locale)} UTC`}
                      </small>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h4>{copy.methodology}</h4>
                {report.methodology.map((method) => (
                  <details key={method.name}>
                    <summary>{method.name}</summary>
                    <p>{method.purpose}</p>
                    <ol>{method.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                  </details>
                ))}
                <h4>{copy.limitations}</h4>
                <ul>{report.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </div>
          </section>

          <footer className="report-actions">
            <div><strong>FinBro Equity Research</strong><span>{copy.footerDescriptor}</span></div>
            <div>
              <button type="button" className="secondary-button" onClick={downloadMarkdown}>{copy.downloadMarkdown}</button>
              {report.selection.options.pdfExport && (
                <button type="button" className="primary-button" onClick={() => void downloadPdf()} disabled={exportingPdf}>
                  {exportingPdf ? copy.exportingPdf : copy.exportPdf}
                </button>
              )}
            </div>
          </footer>
        </article>
      )}

      <footer className="site-footer"><span>FinBro</span><p>{copy.siteFooter}</p></footer>
    </main>
  );
}
