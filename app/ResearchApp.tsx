"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  DashboardMetric,
  EvidenceKind,
  FinancialPeriod,
  ResearchReport,
} from "./lib/research-types";
import type {
  ResearchMarket,
  ResearchOptions,
  SectorOutlook,
  SupportedSector,
  SupportedSubindustry,
} from "./lib/sector-types";

type Locale = "zh" | "en";

const LOCALE_STORAGE_KEY = "scopeline-locale";
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
  market: ResearchMarket;
  sector: SupportedSector;
  subindustry: SupportedSubindustry;
}> = [
  {
    label: { zh: "SHEL · 能源", en: "SHEL · Energy" },
    company: "SHEL",
    market: "Europe",
    sector: "energy",
    subindustry: "integrated-oil-gas",
  },
  {
    label: { zh: "NVDA · 半导体", en: "NVDA · Semiconductors" },
    company: "NVDA",
    market: "US",
    sector: "technology",
    subindustry: "semiconductors",
  },
];

const EVIDENCE_LABELS: Record<Locale, Record<EvidenceKind, string>> = {
  zh: {
    "Reported fact": "已披露事实",
    "Derived calculation": "推导计算",
    "Analyst assumption": "分析假设",
    Interpretation: "研究解读",
    "Management statement": "管理层陈述",
  },
  en: {
    "Reported fact": "Reported fact",
    "Derived calculation": "Derived calculation",
    "Analyst assumption": "Analyst assumption",
    Interpretation: "Interpretation",
    "Management statement": "Management statement",
  },
};

const COPY = {
  zh: {
    brandHome: "ScopeLine 首页",
    languagePicker: "切换报告语言",
    headerNote: "行业情报 · 申报证据",
    heroEyebrow: "行业感知型公开市场研究",
    heroTitle: "一键生成公开信息尽调",
    heroCopy: "行业情报、申报支持的分析和透明估值，一套流程完成。",
    featureMarket: "自动市场分析",
    featureSector: "行业感知研究",
    featureEvidence: "证据链接洞察",
    market: "市场",
    sector: "行业",
    subindustry: "子行业",
    ticker: "公司名或交易代码",
    companyPlaceholder: "例如：SHEL 或 NVDA",
    energy: "能源",
    technology: "科技",
    integrated: "综合石油与天然气",
    semiconductors: "半导体",
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
    generate: "生成行业感知研究",
    researching: "正在生成…",
    examplesLabel: "已验证示例",
    progressTitle: "正在连接行业证据与公司申报",
    progressSteps: "筛选近期证据 → 标准化 SEC 报表 → 加载行业 KPI → 构建估值与论点",
    reportUnavailable: "报告暂时无法生成。",
    researchDate: "研究日期",
    evidenceCutoff: "行业证据截止",
    sectorRefresh: "行业最近刷新",
    companyRetrieved: "公司数据检索",
    refreshOutlook: "仅刷新行业展望",
    refreshing: "刷新中…",
    reportEyebrow: "ScopeLine 行业研究快报",
    actualKey: "A = 已报告实际值",
    unavailable: "数据不可用",
    notDisclosed: "未披露",
    dashboard: "研究仪表板",
    outlook: "当前行业展望",
    outlookNote: "每项市场判断显示发布机构和原始发布日期。",
    insufficientEvidence: "2025–2026 年近期行业研究证据不足。",
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
    grossMargin: "毛利率",
    netIncome: "净利润",
    operatingCashFlow: "经营现金流",
    cashCapex: "现金资本开支",
    freeCashFlow: "自由现金流",
    netMargin: "净利率",
    sectorKpis: "行业 KPI",
    kpiDefinition: "定义",
    sourceBoundary: "来源 / 数据边界",
    limitedCoverage: "数据覆盖有限",
    dataCoverage: "数据覆盖",
    coverageSummary: "指标提取与拒绝候选的审计记录",
    sourceOrder: "检索顺序",
    extractionMethod: "提取方法",
    confidence: "置信度",
    rejectedCandidates: "拒绝候选",
    formula: "公式",
    unresolvedReason: "未解决原因",
    researchQuestions: "分析师问题清单",
    cashCapital: "现金流与资本配置",
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
    netMarginAssumption: "净利率假设",
    reinvestmentFactor: "资本开支系数",
    valuationMetric: "估值指标",
    impliedEv: "模型隐含企业价值",
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
    footerDescriptor: "近期行业证据 · SEC 实际值 · 透明公式",
    siteFooter: "公开信息自动化研究，不构成投资建议、评级或目标价。",
    markdownTitle: "行业感知机构研究快报",
  },
  en: {
    brandHome: "ScopeLine home",
    languagePicker: "Switch report language",
    headerNote: "Sector intelligence · filing evidence",
    heroEyebrow: "Sector-aware public-equity research",
    heroTitle: "One Click to Public-Side Due Diligence",
    heroCopy: "Sector intelligence, filing-backed analysis, and transparent valuation in one workflow.",
    featureMarket: "Auto Market Analysis",
    featureSector: "Sector-Aware Research",
    featureEvidence: "Evidence-Linked Insights",
    market: "Market",
    sector: "Sector",
    subindustry: "Subindustry",
    ticker: "Company name or ticker",
    companyPlaceholder: "e.g. SHEL or NVDA",
    energy: "Energy",
    technology: "Technology",
    integrated: "Integrated Oil & Gas",
    semiconductors: "Semiconductors",
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
    generate: "Generate Sector-Aware Research",
    researching: "Researching…",
    examplesLabel: "Validated examples",
    progressTitle: "Connecting sector evidence with company filings",
    progressSteps: "Screen recent evidence → normalize SEC statements → load sector KPIs → build valuation and thesis",
    reportUnavailable: "The report could not be generated right now.",
    researchDate: "Research date",
    evidenceCutoff: "Sector evidence cutoff",
    sectorRefresh: "Last sector refresh",
    companyRetrieved: "Company data retrieved",
    refreshOutlook: "Refresh sector outlook only",
    refreshing: "Refreshing…",
    reportEyebrow: "ScopeLine sector research brief",
    actualKey: "A = reported actual",
    unavailable: "Data unavailable",
    notDisclosed: "Not disclosed",
    dashboard: "Research dashboard",
    outlook: "Current sector outlook",
    outlookNote: "Every market claim shows its publisher and original publication date.",
    insufficientEvidence: "Insufficient recent sector research available for 2025–2026.",
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
    grossMargin: "Gross margin",
    netIncome: "Net income",
    operatingCashFlow: "Operating cash flow",
    cashCapex: "Cash capex",
    freeCashFlow: "Free cash flow",
    netMargin: "Net margin",
    sectorKpis: "Sector KPIs",
    kpiDefinition: "Definition",
    sourceBoundary: "Source / data boundary",
    limitedCoverage: "Limited data coverage",
    dataCoverage: "Data Coverage",
    coverageSummary: "Audit trail for extracted metrics and rejected candidates",
    sourceOrder: "Search order",
    extractionMethod: "Extraction method",
    confidence: "Confidence",
    rejectedCandidates: "Rejected candidates",
    formula: "Formula",
    unresolvedReason: "Unresolved reason",
    researchQuestions: "Analyst question set",
    cashCapital: "Cash flow and capital allocation",
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
    netMarginAssumption: "Net margin assumption",
    reinvestmentFactor: "Capex factor",
    valuationMetric: "Valuation metric",
    impliedEv: "Model-implied enterprise value",
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
    footerDescriptor: "Recent sector evidence · SEC actuals · transparent formulas",
    siteFooter: "Automated public-information research. Not investment advice, a rating, or a price target.",
    markdownTitle: "Sector-Aware Institutional Research Brief",
  },
} as const;

function formatMoney(value: number | null, currency: string, locale: Locale) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${currency} ${new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

function formatPercent(value: number | null, locale: Locale) {
  return value === null || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value);
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
}: {
  periods: FinancialPeriod[];
  currency: string;
  locale: Locale;
}) {
  const copy = COPY[locale];
  const maxRevenue = Math.max(...periods.map((period) => Math.abs(period.revenue ?? 0)), 1);
  const maxCash = Math.max(...periods.map((period) => Math.abs(period.operatingCashFlow ?? 0)), 1);
  return (
    <div className="trend-chart" role="img" aria-label={`${copy.revenue} / ${copy.operatingCashFlow}`}>
      <div className="chart-legend">
        <span><i className="legend-revenue" />{copy.revenue}</span>
        <span><i className="legend-cash" />{copy.operatingCashFlow}</span>
      </div>
      <div className="chart-grid">
        {periods.map((period) => (
          <div className="chart-column" key={period.periodEnd}>
            <div className="bar-stage">
              <div
                className="bar revenue-bar"
                style={{ height: `${Math.max(5, (Math.abs(period.revenue ?? 0) / maxRevenue) * 100)}%` }}
                title={`${copy.revenue} ${formatMoney(period.revenue, currency, locale)}`}
              />
              <div
                className="bar cash-bar"
                style={{ height: `${Math.max(5, (Math.abs(period.operatingCashFlow ?? 0) / maxCash) * 82)}%` }}
                title={`${copy.operatingCashFlow} ${formatMoney(period.operatingCashFlow, currency, locale)}`}
              />
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
  const lines = [
    `# ${report.company.name} — ${copy.markdownTitle}`,
    "",
    `**${copy.researchDate}:** ${report.researchDate}  `,
    `**${copy.evidenceCutoff}:** ${report.evidenceCutoff}  `,
    `**${copy.companyRetrieved}:** ${report.companyDataRetrievedAt}`,
    "",
    `## 1. ${copy.dashboard}`,
    ...report.dashboard.map((item) => `- **${item.label}: ${item.value}** — ${item.detail}`),
    "",
    `## 2. ${copy.outlook}`,
    ...report.sectorOutlook.claims.map(
      (claim) => `- ${claim.claim} — [${claim.publisher} · ${claim.publicationDate}](${claim.url})\n  - ${copy.whyMatters}: ${claim.whyItMatters}`,
    ),
    "",
    `## 3. ${copy.driverExposure}`,
    ...report.driverExposure.map(
      (item) => `- **${item.driver}** — ${item.companyExposure}\n  - ${item.evidencePublisher} · ${item.evidenceDate}: ${item.evidence}\n  - ${copy.implication}: ${item.investmentImplication}`,
    ),
    "",
    `## 4. ${copy.businessSegments}`,
    report.overview,
    "",
    report.segmentAnalysis,
    "",
    `## 5. ${copy.financials}`,
    `| ${copy.year} | ${copy.revenue} | ${copy.netIncome} | ${copy.operatingCashFlow} | ${copy.cashCapex} | ${copy.freeCashFlow} |`,
    "|---|---:|---:|---:|---:|---:|",
    ...report.periods.map(
      (period) =>
        `| ${shortYear(period.periodEnd)}A | ${formatMoney(period.revenue, report.currency, locale)} | ${formatMoney(period.netIncome, report.currency, locale)} | ${formatMoney(period.operatingCashFlow, report.currency, locale)} | ${formatMoney(period.cashCapex, report.currency, locale)} | ${formatMoney(period.freeCashFlowProxy, report.currency, locale)} |`,
    ),
    "",
    `## 6. ${copy.sectorKpis}`,
    ...report.sectorKpis.map(
      (item) => `- **${item.label}: ${item.value}** — ${item.definition}\n  - ${item.sourceNote}\n  - ${copy.whyMatters}: ${item.whyItMatters}`,
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
    `## 7. ${copy.cashCapital}`,
    ...report.earningsQuality.map((item) => `- ${item}`),
    "",
    `## 8. ${copy.peerComparison}`,
    ...report.peerComparison.map(
      (item) => `- **${item.ticker}** — ${item.rationale}; ${copy.revenueGrowth} ${formatPercent(item.revenueGrowth, locale)}; ${copy.netMargin} ${formatPercent(item.netMargin, locale)}; ${copy.fcfMargin} ${formatPercent(item.freeCashFlowMargin, locale)}`,
    ),
    "",
    `## 9. ${copy.debates}`,
    ...report.investmentDebates.map(
      (item) => `- **${item.question}**\n  - ${copy.evidenceFor}: ${item.evidenceFor}\n  - ${copy.evidenceAgainst}: ${item.evidenceAgainst}\n  - ${copy.monitor}: ${item.monitor}`,
    ),
    "",
    `## 10. ${copy.catalystsRisks}`,
    ...report.risks.map(
      (item) => `- **${item.title}** — ${item.evidence}\n  - ${copy.thesisBreaker}: ${item.thesisBreaker}`,
    ),
    "",
    `## 11. ${copy.scenariosValuation}`,
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
  if (!report.dataCoverage.metrics.length && !report.dataCoverage.limited) return null;
  return (
    <details className="data-coverage">
      <summary>
        <span>{copy.dataCoverage}</span>
        <small>
          {report.dataCoverage.metrics.length
            ? `${report.dataCoverage.metrics.filter((metric) => metric.found).length}/${report.dataCoverage.metrics.length}`
            : copy.limitedCoverage}
        </small>
      </summary>
      <p>{copy.coverageSummary}</p>
      <p className="coverage-source-order">
        <b>{copy.sourceOrder}:</b> {report.dataCoverage.searchedSources.join(" → ")}
      </p>
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
    </details>
  );
}

export function ResearchApp() {
  const [company, setCompany] = useState("SHEL");
  const [locale, setLocale] = useState<Locale>("zh");
  const [localeReady, setLocaleReady] = useState(false);
  const [market, setMarket] = useState<ResearchMarket>("Europe");
  const [sector, setSector] = useState<SupportedSector>("energy");
  const [subindustry, setSubindustry] =
    useState<SupportedSubindustry>("integrated-oil-gas");
  const [options, setOptions] = useState<ResearchOptions>(DEFAULT_OPTIONS);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshingOutlook, setRefreshingOutlook] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const reportRef = useRef<HTMLElement>(null);
  const copy = COPY[locale];
  const latestPeriod = useMemo(() => report?.periods.at(-1) ?? null, [report]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        if (storedLocale === "zh" || storedLocale === "en") setLocale(storedLocale);
      } catch {
        // Chinese remains the SSR default when browser storage is unavailable.
      }
      setLocaleReady(true);
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

  function requestBody(query: string, requestedLocale: Locale) {
    return {
      company: query,
      locale: requestedLocale,
      market,
      sector,
      subindustry,
      options,
    };
  }

  async function loadReport(query: string, requestedLocale: Locale, scrollAfter: boolean) {
    if (!query || loading) return;
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody(query, requestedLocale)),
      });
      const payload = (await response.json()) as { report?: ResearchReport; error?: string };
      if (!response.ok || !payload.report) {
        throw new Error(payload.error || COPY[requestedLocale].reportUnavailable);
      }
      setReport(payload.report);
      if (scrollAfter) {
        requestAnimationFrame(() => {
          document.getElementById("report")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : COPY[requestedLocale].reportUnavailable);
    } finally {
      setLoading(false);
    }
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    void loadReport(company.trim(), locale, true);
  }

  function switchLocale(nextLocale: Locale) {
    if (nextLocale === locale || loading) return;
    const shouldRefresh = report !== null;
    setLocale(nextLocale);
    setError("");
    if (shouldRefresh) void loadReport(company.trim(), nextLocale, false);
  }

  function changeSector(next: SupportedSector) {
    setSector(next);
    setSubindustry(next === "energy" ? "integrated-oil-gas" : "semiconductors");
    setReport(null);
    setError("");
  }

  function chooseExample(example: (typeof EXAMPLES)[number]) {
    setCompany(example.company);
    setMarket(example.market);
    setSector(example.sector);
    setSubindustry(example.subindustry);
    setReport(null);
    setError("");
  }

  function toggleOption(key: keyof ResearchOptions) {
    setOptions((current) => ({ ...current, [key]: !current[key] }));
  }

  async function refreshSectorOutlook() {
    if (!report || refreshingOutlook) return;
    setRefreshingOutlook(true);
    setError("");
    try {
      const response = await fetch("/api/sector-outlook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market, subindustry, locale, refresh: true }),
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
      setError(caught instanceof Error ? caught.message : copy.reportUnavailable);
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
    setError("");
    try {
      const { exportReportPdf } = await import("./lib/pdf-export");
      await exportReportPdf(reportRef.current, {
        ticker: report.company.ticker,
        researchDate: report.researchDate,
        filename: `${report.company.ticker.toLowerCase()}-sector-research-${locale}.pdf`,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.reportUnavailable);
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label={copy.brandHome}>
          <span className="brand-mark">S</span>
          <span>ScopeLine</span>
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
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="hero-content">
          <p className="eyebrow">{copy.heroEyebrow}</p>
          <h1>{copy.heroTitle}</h1>
          <p className="hero-copy">{copy.heroCopy}</p>
          <div className="trust-row" aria-label="Features">
            <span><b>01</b> {copy.featureMarket}</span>
            <span><b>02</b> {copy.featureSector}</span>
            <span><b>03</b> {copy.featureEvidence}</span>
          </div>

          <form className="research-form" onSubmit={submit}>
            <div className="selection-grid">
              <label>
                <span>{copy.market}</span>
                <select value={market} onChange={(event) => setMarket(event.target.value as ResearchMarket)} disabled={loading}>
                  <option value="US">{copy.us}</option>
                  <option value="Europe">{copy.europe}</option>
                  <option value="Global">{copy.global}</option>
                </select>
              </label>
              <label>
                <span>{copy.sector}</span>
                <select value={sector} onChange={(event) => changeSector(event.target.value as SupportedSector)} disabled={loading}>
                  <option value="energy">{copy.energy}</option>
                  <option value="technology">{copy.technology}</option>
                  <option disabled>{copy.financialSector} · {copy.comingSoon}</option>
                  <option disabled>{copy.healthcare} · {copy.comingSoon}</option>
                  <option disabled>{copy.industrials} · {copy.comingSoon}</option>
                  <option disabled>{copy.consumer} · {copy.comingSoon}</option>
                </select>
              </label>
              <label>
                <span>{copy.subindustry}</span>
                <select value={subindustry} onChange={(event) => setSubindustry(event.target.value as SupportedSubindustry)} disabled={loading}>
                  {sector === "energy"
                    ? <option value="integrated-oil-gas">{copy.integrated}</option>
                    : <option value="semiconductors">{copy.semiconductors}</option>}
                </select>
              </label>
              <label className="ticker-field">
                <span>{copy.ticker}</span>
                <input
                  id="company"
                  name="company"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
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
          </form>

          {loading && (
            <div className="research-progress" role="status" aria-live="polite">
              <span className="progress-orbit" />
              <div><strong>{copy.progressTitle}</strong><p>{copy.progressSteps}</p></div>
            </div>
          )}
          {error && <p className="error-message" role="alert">{error}</p>}
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
                <div><dt>{copy.evidenceCutoff}</dt><dd>{report.evidenceCutoff}</dd></div>
                <div><dt>{copy.sectorRefresh}</dt><dd>{formatTimestamp(report.sectorLastRefreshedAt, locale)} UTC</dd></div>
                <div><dt>{copy.companyRetrieved}</dt><dd>{formatTimestamp(report.companyDataRetrievedAt, locale)} UTC</dd></div>
              </dl>
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

          <section className="report-section outlook-section" data-pdf-block>
            <SectionHeading number="02" title={copy.outlook} note={copy.outlookNote} />
            <div className="outlook-toolbar">
              <span>{copy.evidenceCutoff}: <strong>{report.evidenceCutoff}</strong></span>
              <button type="button" onClick={() => void refreshSectorOutlook()} disabled={refreshingOutlook}>
                {refreshingOutlook ? copy.refreshing : copy.refreshOutlook}
              </button>
            </div>
            {report.sectorOutlook.insufficientEvidence && (
              <p className="insufficient-evidence">{copy.insufficientEvidence}</p>
            )}
            <div className="outlook-grid">
              {report.sectorOutlook.claims.map((claim) => (
                <article key={claim.url}>
                  <span className="source-stamp">{claim.publisher} · {claim.publicationDate}</span>
                  <p>{claim.claim}</p>
                  <strong>{copy.whyMatters}</strong>
                  <p>{claim.whyItMatters}</p>
                  <a href={claim.url} target="_blank" rel="noreferrer">{claim.title} ↗</a>
                </article>
              ))}
            </div>
          </section>

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
                        {item.evidenceUrl
                          ? <a href={item.evidenceUrl} target="_blank" rel="noreferrer"><strong>{item.evidencePublisher} · {item.evidenceDate}</strong><br />{item.evidence}</a>
                          : item.evidence}
                      </td>
                      <td>{item.investmentImplication}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

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
            <TrendChart periods={report.periods} currency={report.currency} locale={locale} />
            <div className="table-wrap">
              <table className="financial-table">
                <caption>{copy.actualKey} · {report.currency}</caption>
                <thead>
                  <tr>
                    <th>{copy.year}</th><th>{copy.revenue}</th><th>{copy.grossMargin}</th>
                    <th>{copy.netIncome}</th><th>{copy.operatingCashFlow}</th>
                    <th>{copy.cashCapex}</th><th>{copy.freeCashFlow}</th><th>{copy.netMargin}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.periods.map((period) => (
                    <tr key={period.periodEnd}>
                      <th>{shortYear(period.periodEnd)}A</th>
                      <td>{formatMoney(period.revenue, report.currency, locale)}</td>
                      <td>{formatPercent(period.grossMargin, locale)}</td>
                      <td>{formatMoney(period.netIncome, report.currency, locale)}</td>
                      <td>{formatMoney(period.operatingCashFlow, report.currency, locale)}</td>
                      <td>{formatMoney(period.cashCapex, report.currency, locale)}</td>
                      <td>{formatMoney(period.freeCashFlowProxy, report.currency, locale)}</td>
                      <td>{formatPercent(period.netMargin, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="formula-note"><EvidenceBadge kind="Derived calculation" locale={locale} /> {report.cashFlowProxyFormula}; {locale === "zh" ? "净利率 = 净利润 ÷ 营收；毛利率 = 毛利润 ÷ 营收。" : "Net margin = net income / revenue; gross margin = gross profit / revenue."}</p>
          </section>

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
            <DataCoveragePanel report={report} locale={locale} />
            <details className="research-questions">
              <summary>{copy.researchQuestions}</summary>
              <ol>{report.sectorPack.researchQuestions.map((question) => <li key={question}>{question}</li>)}</ol>
            </details>
          </section>

          <section className="report-section analysis-grid-section" data-pdf-block>
            <SectionHeading number="07" title={copy.cashCapital} />
            <div className="balance-panel">
              <div className="balance-grid">
                {[
                  { label: copy.cash, value: latestPeriod.cash, formatted: formatMoney(latestPeriod.cash, report.currency, locale) },
                  { label: copy.totalDebt, value: latestPeriod.totalDebt, formatted: formatMoney(latestPeriod.totalDebt, report.currency, locale) },
                  { label: copy.netDebt, value: latestPeriod.netDebt, formatted: formatMoney(latestPeriod.netDebt, report.currency, locale) },
                  { label: copy.inventory, value: latestPeriod.inventory, formatted: formatMoney(latestPeriod.inventory, report.currency, locale) },
                  { label: copy.cashCapex, value: latestPeriod.cashCapex, formatted: formatMoney(latestPeriod.cashCapex, report.currency, locale) },
                  { label: copy.currentRatio, value: latestPeriod.currentRatio, formatted: latestPeriod.currentRatio === null ? "—" : `${latestPeriod.currentRatio.toFixed(2)}x` },
                ].filter((item) => item.value !== null).map((item) => (
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

          <section className="report-section" data-pdf-block>
            <SectionHeading number="08" title={copy.peerComparison} note={copy.peerNote} />
            {report.peerComparison.length ? (
              <div className="table-wrap">
                <table className="peer-table">
                  <thead><tr><th>{copy.peer}</th><th>{copy.rationale}</th><th>{copy.period}</th><th>{copy.revenueGrowth}</th><th>{copy.netMargin}</th><th>{copy.fcfMargin}</th></tr></thead>
                  <tbody>
                    {report.peerComparison.map((peer) => (
                      <tr key={peer.ticker}>
                        <th>{peer.ticker}<small>{peer.name}</small></th>
                        <td>{peer.rationale}</td>
                        <td>{peer.periodEnd ?? "—"}</td>
                        <td>{formatPercent(peer.revenueGrowth, locale)}</td>
                        <td>{formatPercent(peer.netMargin, locale)}</td>
                        <td>{formatPercent(peer.freeCashFlowMargin, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="module-not-selected">{locale === "zh" ? "本次未选择同业比较。" : "Peer comparison was not selected."}</p>}
          </section>

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
                  </dl>
                </article>
              ))}
            </div>
          </section>

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
            {report.scenarios.length ? (
              <div className="scenario-grid">
                {report.scenarios.map((scenario) => (
                  <article className={`scenario-card ${scenario.name.toLowerCase()}`} key={scenario.name}>
                    <div className="scenario-title">
                      <span>{copy[scenario.name.toLowerCase() as "bear" | "base" | "bull"]}</span>
                      <strong>{scenario.enterpriseValueMultiple.toFixed(0)}x {scenario.multipleLabel}</strong>
                    </div>
                    <dl>
                      <div><dt>{copy.revenueGrowthAssumption}</dt><dd>{formatPercent(scenario.revenueGrowth, locale)}</dd></div>
                      <div><dt>{copy.netMarginAssumption}</dt><dd>{formatPercent(scenario.netMargin, locale)}</dd></div>
                      <div><dt>{copy.reinvestmentFactor}</dt><dd>{scenario.capexFactor.toFixed(2)}x</dd></div>
                      <div><dt>{copy.freeCashFlow}</dt><dd>{formatMoney(scenario.projectedFreeCashFlow, report.currency, locale)}</dd></div>
                      <div><dt>{copy.valuationMetric}</dt><dd>{formatMoney(scenario.valuationMetric, report.currency, locale)}</dd></div>
                    </dl>
                    <p>{copy.impliedEv}</p>
                    <strong className="scenario-value">{formatMoney(scenario.modelImpliedEnterpriseValue, report.currency, locale)}</strong>
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
            <div><strong>ScopeLine Research</strong><span>{copy.footerDescriptor}</span></div>
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

      <footer className="site-footer"><span>ScopeLine</span><p>{copy.siteFooter}</p></footer>
    </main>
  );
}
