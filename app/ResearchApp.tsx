"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  DashboardMetric,
  EvidenceKind,
  FinancialPeriod,
  ResearchReport,
} from "./lib/research-types";

type Locale = "zh" | "en";

const LOCALE_STORAGE_KEY = "scopeline-locale";
const EXAMPLES = ["Shell plc", "Apple", "NVIDIA", "JPMorgan"];

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
    heroEyebrow: "公开申报驱动的机构研究工作台",
    heroTitleLead: "输入一家公司，",
    heroTitleTail: "生成可追溯的尽调报告。",
    heroCopy: "从 SEC 原始申报提取 3–5 年财务，自动拆分事实、计算、假设与解读；不填造缺失值，不输出无依据的目标价。",
    companyInput: "公司名或交易代码",
    companyPlaceholder: "例如：Shell plc 或 SHEL",
    researching: "正在研究…",
    generate: "生成尽调报告",
    examplesLabel: "示例公司",
    tryIt: "试一试",
    progressTitle: "正在锁定发行人并读取官方申报",
    progressSteps: "核对期间与单位 → 标准化报表 → 计算现金流 → 生成论点与情景",
    unavailable: "数据不可用",
    reportUnavailable: "报告暂时无法生成。",
    trustSource: "官方来源",
    trustFormula: "可复核公式",
    trustLimits: "明示限制",
    methodLabel: "研究方法",
    pointTitle: "时点锁定",
    pointCopy: "记录研究日期、申报日期与修订状态。",
    normalizedTitle: "口径统一",
    normalizedCopy: "核对年度、币种、单位与现金流定义。",
    usefulTitle: "投资者视角",
    usefulCopy: "每项发现都说明为什么重要及如何证伪。",
    reportEyebrow: "机构研究快报 · 自动化样本",
    researchDate: "研究日期",
    cutoff: "数据检索截止",
    researchBoundary: "研究边界",
    disclosure: "基于公开 SEC 申报的自动化研究预览；不构成投资建议、评级或目标价。",
    dashboard: "研究仪表板",
    dashboardNote: "最新年度核心信号。颜色表示关注方向，不代表买卖评级。",
    baseline: "公司与申报基线",
    secIndustry: "SEC 行业",
    issuerIdentity: "发行人身份",
    latestAnnual: "最新年报",
    latestInterim: "最新中期/当前报告",
    officialFilings: "官方申报",
    viewAnnual: "查看年报",
    viewUpdate: "查看更新",
    financialPerformance: "三至五年财务表现",
    financialNote: "数值来自标准化 XBRL；比率由页面公式推导。",
    historyCaption: "标准化年度财务历史",
    actualKey: "A = 已报告实际值",
    year: "年度",
    revenue: "营收",
    netIncome: "净利润",
    operatingCashFlow: "经营现金流",
    investingCashFlow: "投资现金流",
    cashCapex: "现金资本开支",
    cashFlowProxy: "现金流代理",
    netMargin: "净利率",
    netMarginFormula: "净利率 = 净利润 ÷ 营收。",
    financialQuality: "现金流、资产负债表与盈利质量",
    resilience: "最新年度财务承压能力",
    cash: "现金",
    totalDebt: "总债务",
    netDebt: "净债务",
    currentRatio: "流动比率",
    netDebtFormula: "净债务 = 标准化总债务 − 现金。该口径可能不同于发行人定义。",
    earningsQuality: "盈利质量观察",
    segmentBoundary: "分部与竞争边界",
    automationBoundary: "什么可以自动化，什么必须回到年报",
    industryContext: "行业背景",
    competitionCopy: "竞争定位需要结合发行人分部披露、市场份额、成本曲线和同业可比口径。当前版本仅给出 SEC 行业分类，不把分类标签伪装成竞争结论。",
    thesis: "投资论点",
    thesisNote: "每条观点同时给出反证和监测变量。",
    counterEvidence: "反证",
    monitor: "监测",
    catalysts: "关键催化剂",
    risks: "风险与破坏条件",
    thesisBreaker: "论点破坏条件",
    scenarios: "情景与估值敏感性",
    scenarioNote: "简化情景，不代表概率预测或目标价。",
    bear: "悲观",
    base: "基准",
    bull: "乐观",
    revenueGrowthAssumption: "收入增长假设",
    netMarginAssumption: "净利率假设",
    reinvestmentFactor: "再投资压力系数",
    impliedEnterpriseValue: "模型隐含企业价值",
    valuationView: "透明估值判断",
    sourcesLimits: "来源与限制",
    sourceLedger: "来源账本",
    retrieved: "检索于",
    currentLimits: "当前限制",
    researchPreview: "ScopeLine 研究预览",
    footerDescriptor: "公开数据 · 原创分析 · 可追溯公式",
    downloadMarkdown: "下载 Markdown",
    printPdf: "打印 / 存为 PDF",
    siteFooter: "自动化公开申报研究，不构成投资建议。",
    chartLabel: "历年营收与经营现金流趋势图",
    markdownTitle: "机构研究快报",
    markdownDisclaimer: "本报告基于公开申报数据自动生成，仅供研究参考，不构成投资建议、评级或目标价。",
    companyOverview: "公司与业务模式",
    historicalFinancials: "历史财务",
    valuationScenarios: "估值与情景",
    formula: "公式",
  },
  en: {
    brandHome: "ScopeLine home",
    languagePicker: "Switch report language",
    heroEyebrow: "Institutional research powered by public filings",
    heroTitleLead: "Enter one company.",
    heroTitleTail: "Get traceable due diligence.",
    heroCopy: "Extract 3–5 years of financials from original SEC filings, with facts, calculations, assumptions, and interpretations kept distinct. No fabricated values or unsupported target prices.",
    companyInput: "Company name or ticker",
    companyPlaceholder: "e.g. Shell plc or SHEL",
    researching: "Researching…",
    generate: "Generate report",
    examplesLabel: "Example companies",
    tryIt: "Try",
    progressTitle: "Resolving the issuer and reading official filings",
    progressSteps: "Check periods and units → normalize statements → calculate cash flow → build thesis and scenarios",
    unavailable: "Data unavailable",
    reportUnavailable: "The report could not be generated right now.",
    trustSource: "Official sources",
    trustFormula: "Auditable formulas",
    trustLimits: "Visible limitations",
    methodLabel: "Research method",
    pointTitle: "Point-in-time",
    pointCopy: "Records the research date, filing dates, and amendment status.",
    normalizedTitle: "Normalized",
    normalizedCopy: "Checks fiscal periods, currencies, units, and cash-flow definitions.",
    usefulTitle: "Investor-focused",
    usefulCopy: "Explains why each finding matters and how it could be disproved.",
    reportEyebrow: "Institutional research brief · automated sample",
    researchDate: "Research date",
    cutoff: "Data retrieved through",
    researchBoundary: "Research boundary",
    disclosure: "Automated research preview based on public SEC filings; not investment advice, a rating, or a price target.",
    dashboard: "Research dashboard",
    dashboardNote: "Core signals from the latest fiscal year. Colors indicate attention areas, not buy or sell ratings.",
    baseline: "Company and filing baseline",
    secIndustry: "SEC industry",
    issuerIdentity: "Issuer status",
    latestAnnual: "Latest annual filing",
    latestInterim: "Latest interim/current filing",
    officialFilings: "Official filings",
    viewAnnual: "View annual filing",
    viewUpdate: "View update",
    financialPerformance: "Three-to-five-year performance",
    financialNote: "Values come from normalized XBRL; ratios are derived using visible formulas.",
    historyCaption: "Normalized annual financial history",
    actualKey: "A = reported actual",
    year: "Year",
    revenue: "Revenue",
    netIncome: "Net income",
    operatingCashFlow: "Operating cash flow",
    investingCashFlow: "Investing cash flow",
    cashCapex: "Cash capex",
    cashFlowProxy: "Cash-flow proxy",
    netMargin: "Net margin",
    netMarginFormula: "Net margin = net income ÷ revenue.",
    financialQuality: "Cash flow, balance sheet, and earnings quality",
    resilience: "Latest-year financial resilience",
    cash: "Cash",
    totalDebt: "Total debt",
    netDebt: "Net debt",
    currentRatio: "Current ratio",
    netDebtFormula: "Net debt = normalized total debt − cash. This definition may differ from the issuer’s measure.",
    earningsQuality: "Earnings-quality observations",
    segmentBoundary: "Segments and competitive boundary",
    automationBoundary: "What can be automated—and what still requires the annual report",
    industryContext: "Industry context",
    competitionCopy: "Competitive positioning requires issuer segment disclosures, market share, cost curves, and comparable peer definitions. This version reports the SEC industry classification without presenting the label as a competitive conclusion.",
    thesis: "Investment thesis",
    thesisNote: "Each view includes counterevidence and a variable to monitor.",
    counterEvidence: "Counterevidence",
    monitor: "Monitor",
    catalysts: "Key catalysts",
    risks: "Risks and thesis breakers",
    thesisBreaker: "Thesis breaker",
    scenarios: "Scenarios and valuation sensitivity",
    scenarioNote: "Simplified scenarios—not probability forecasts or price targets.",
    bear: "Bear",
    base: "Base",
    bull: "Bull",
    revenueGrowthAssumption: "Revenue growth assumption",
    netMarginAssumption: "Net margin assumption",
    reinvestmentFactor: "Reinvestment pressure factor",
    impliedEnterpriseValue: "Model-implied enterprise value",
    valuationView: "Transparent valuation view",
    sourcesLimits: "Sources and limitations",
    sourceLedger: "Source ledger",
    retrieved: "Retrieved",
    currentLimits: "Current limitations",
    researchPreview: "ScopeLine Research Preview",
    footerDescriptor: "Public data · original analysis · traceable formulas",
    downloadMarkdown: "Download Markdown",
    printPdf: "Print / Save as PDF",
    siteFooter: "Automated public-filing research. Not investment advice.",
    chartLabel: "Historical revenue and operating cash flow trend",
    markdownTitle: "Institutional Research Brief",
    markdownDisclaimer: "This report is automatically generated from public filing data for research purposes only. It is not investment advice, a rating, or a price target.",
    companyOverview: "Company and Business Model",
    historicalFinancials: "Historical Financials",
    valuationScenarios: "Valuation and Scenarios",
    formula: "Formula",
  },
} as const;

function formatMoney(value: number | null, currency: string, locale: Locale) {
  if (value === null || !Number.isFinite(value)) return COPY[locale].unavailable;
  return `${currency} ${new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

function formatPercent(value: number | null, locale: Locale) {
  return value === null || !Number.isFinite(value)
    ? COPY[locale].unavailable
    : `${(value * 100).toFixed(1)}%`;
}

function shortYear(periodEnd: string) {
  return periodEnd.slice(0, 4);
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

function TrendChart({ periods, currency, locale }: { periods: FinancialPeriod[]; currency: string; locale: Locale }) {
  const copy = COPY[locale];
  const maxRevenue = Math.max(...periods.map((period) => Math.abs(period.revenue ?? 0)), 1);
  const maxCash = Math.max(...periods.map((period) => Math.abs(period.operatingCashFlow ?? 0)), 1);

  return (
    <div className="trend-chart" role="img" aria-label={copy.chartLabel}>
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
                style={{ height: `${Math.max(4, (Math.abs(period.revenue ?? 0) / maxRevenue) * 100)}%` }}
                title={`${copy.revenue} ${formatMoney(period.revenue, currency, locale)}`}
              />
              <div
                className="bar cash-bar"
                style={{ height: `${Math.max(4, (Math.abs(period.operatingCashFlow ?? 0) / maxCash) * 82)}%` }}
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
  const isZh = locale === "zh";
  const lines = [
    `# ${report.company.name} — ${copy.markdownTitle}`,
    "",
    isZh
      ? `**代码：** ${report.company.ticker}  \n**研究日期：** ${report.researchDate}  \n**数据截止：** ${report.cutoff}`
      : `**Ticker:** ${report.company.ticker}  \n**Research date:** ${report.researchDate}  \n**Data cutoff:** ${report.cutoff}`,
    "",
    `> ${copy.markdownDisclaimer}`,
    "",
    `## ${copy.dashboard}`,
    "",
    ...report.dashboard.map((item) => `- **${item.label}: ${item.value}** — ${item.detail} (${EVIDENCE_LABELS[locale][item.classification]})`),
    "",
    `## ${copy.companyOverview}`,
    "",
    report.overview,
    "",
    `## ${copy.historicalFinancials}`,
    "",
    `| ${copy.year} | ${copy.revenue} | ${copy.netIncome} | ${copy.operatingCashFlow} | ${copy.investingCashFlow} | ${copy.cashCapex} | ${copy.cashFlowProxy} |`,
    "|---|---:|---:|---:|---:|---:|---:|",
    ...report.periods.map((period) =>
      `| ${shortYear(period.periodEnd)} | ${formatMoney(period.revenue, report.currency, locale)} | ${formatMoney(period.netIncome, report.currency, locale)} | ${formatMoney(period.operatingCashFlow, report.currency, locale)} | ${formatMoney(period.investingCashFlow, report.currency, locale)} | ${formatMoney(period.cashCapex, report.currency, locale)} | ${formatMoney(period.freeCashFlowProxy, report.currency, locale)} |`,
    ),
    "",
    `## ${copy.thesis}`,
    "",
    ...report.thesis.map((item, index) => `${index + 1}. **${item.title}** — ${item.view}\n   - ${copy.counterEvidence}: ${item.counterEvidence}\n   - ${copy.monitor}: ${item.monitor}`),
    "",
    `## ${copy.risks}`,
    "",
    ...report.risks.map((item) => `- **${item.title}** — ${item.evidence}\n  - ${copy.thesisBreaker}: ${item.thesisBreaker}`),
    "",
    `## ${copy.valuationScenarios}`,
    "",
    report.valuationAssessment,
    "",
    `${copy.formula}: ${report.valuationFormula}`,
    "",
    `## ${copy.sourcesLimits}`,
    "",
    ...report.sources.map((source) => `- [${source.title}](${source.url}), ${copy.retrieved.toLowerCase()} ${source.retrievedAt}`),
    ...report.limitations.map((item) => `- ${item}`),
    "",
  ];
  return lines.join("\n");
}

export function ResearchApp() {
  const [company, setCompany] = useState("Shell plc");
  const [locale, setLocale] = useState<Locale>("zh");
  const [localeReady, setLocaleReady] = useState(false);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const copy = COPY[locale];

  const latestPeriod = useMemo(() => report?.periods.at(-1) ?? null, [report]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        if (storedLocale === "zh" || storedLocale === "en") setLocale(storedLocale);
      } catch {
        // Default to Chinese when browser storage is unavailable.
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
      // Language switching remains available when browser storage is blocked.
    }
  }, [locale, localeReady]);

  async function loadReport(query: string, requestedLocale: Locale, scrollAfter: boolean) {
    if (!query || loading) return;
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: query, locale: requestedLocale }),
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

  function chooseExample(value: string) {
    setCompany(value);
    setError("");
  }

  function downloadMarkdown() {
    if (!report) return;
    const blob = new Blob([reportToMarkdown(report, locale)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.company.ticker.toLowerCase()}-institutional-research-${locale}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label={copy.brandHome}>
          <span className="brand-mark">S</span>
          <span>ScopeLine</span>
        </a>
        <div className="header-actions">
          <span className="header-note">SEC-first · point-in-time</span>
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
          <h1>{copy.heroTitleLead}<br />{copy.heroTitleTail}</h1>
          <p className="hero-copy">{copy.heroCopy}</p>

          <form className="search-shell" onSubmit={submit}>
            <label htmlFor="company">{copy.companyInput}</label>
            <div className="search-row">
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
              <button type="submit" disabled={loading || company.trim().length < 2}>
                {loading ? copy.researching : copy.generate}
              </button>
            </div>
            <div className="example-row" aria-label={copy.examplesLabel}>
              <span>{copy.tryIt}</span>
              {EXAMPLES.map((example) => (
                <button type="button" key={example} onClick={() => chooseExample(example)}>{example}</button>
              ))}
            </div>
          </form>

          {loading && (
            <div className="research-progress" role="status" aria-live="polite">
              <span className="progress-orbit" />
              <div>
                <strong>{copy.progressTitle}</strong>
                <p>{copy.progressSteps}</p>
              </div>
            </div>
          )}
          {error && <p className="error-message" role="alert">{error}</p>}

          <div className="trust-row">
            <span><b>01</b> {copy.trustSource}</span>
            <span><b>02</b> {copy.trustFormula}</span>
            <span><b>03</b> {copy.trustLimits}</span>
          </div>
        </div>
      </section>

      {!report && !loading && (
        <section className="method-strip" aria-label={copy.methodLabel}>
          <div><span>POINT-IN-TIME</span><strong>{copy.pointTitle}</strong><p>{copy.pointCopy}</p></div>
          <div><span>NORMALIZED</span><strong>{copy.normalizedTitle}</strong><p>{copy.normalizedCopy}</p></div>
          <div><span>DECISION-USEFUL</span><strong>{copy.usefulTitle}</strong><p>{copy.usefulCopy}</p></div>
        </section>
      )}

      {report && latestPeriod && (
        <article className="report" id="report">
          <section className="report-cover">
            <div>
              <p className="eyebrow dark">{copy.reportEyebrow}</p>
              <h2>{report.company.name}</h2>
              <div className="company-meta">
                <span>{report.company.ticker}</span><span>{report.company.exchange}</span><span>CIK {report.company.cik}</span><span>FY {report.company.fiscalYearEnd}</span>
              </div>
            </div>
            <div className="report-date">
              <span>{copy.researchDate}</span>
              <strong>{report.researchDate}</strong>
              <small>{copy.cutoff} {new Date(report.cutoff).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { timeZone: "UTC" })} UTC</small>
            </div>
          </section>

          <section className="disclosure-banner">
            <strong>{copy.researchBoundary}</strong>
            <p>{copy.disclosure}</p>
            <div className="evidence-key">
              {(Object.keys(EVIDENCE_LABELS[locale]) as EvidenceKind[]).map((key) => <EvidenceBadge key={key} kind={key} locale={locale} />)}
            </div>
          </section>

          <section className="report-section dashboard-section">
            <div className="section-heading"><div><span>01</span><h3>{copy.dashboard}</h3></div><p>{copy.dashboardNote}</p></div>
            <div className="metric-grid">{report.dashboard.map((metric) => <MetricCard metric={metric} locale={locale} key={metric.label} />)}</div>
          </section>

          <section className="report-section split-section">
            <div className="section-heading"><div><span>02</span><h3>{copy.baseline}</h3></div></div>
            <div className="overview-card">
              <EvidenceBadge kind="Reported fact" locale={locale} />
              <p>{report.overview}</p>
              <dl>
                <div><dt>{copy.secIndustry}</dt><dd>{report.company.sicDescription}</dd></div>
                <div><dt>{copy.issuerIdentity}</dt><dd>{report.company.filingStatus}</dd></div>
                <div><dt>{copy.latestAnnual}</dt><dd>{report.latestAnnual ? `${report.latestAnnual.form} · ${report.latestAnnual.filed}` : copy.unavailable}</dd></div>
                <div><dt>{copy.latestInterim}</dt><dd>{report.latestInterim ? `${report.latestInterim.form} · ${report.latestInterim.filed}` : copy.unavailable}</dd></div>
              </dl>
            </div>
            <aside className="filing-links">
              <span>{copy.officialFilings}</span>
              {report.latestAnnual && <a href={report.latestAnnual.url} target="_blank" rel="noreferrer">{copy.viewAnnual} {report.latestAnnual.form} ↗</a>}
              {report.latestInterim && <a href={report.latestInterim.url} target="_blank" rel="noreferrer">{copy.viewUpdate} {report.latestInterim.form} ↗</a>}
              {!report.latestAnnual && !report.latestInterim && <p>{copy.unavailable}</p>}
            </aside>
          </section>

          <section className="report-section">
            <div className="section-heading"><div><span>03</span><h3>{copy.financialPerformance}</h3></div><p><EvidenceBadge kind="Reported fact" locale={locale} /> {copy.financialNote}</p></div>
            <TrendChart periods={report.periods} currency={report.currency} locale={locale} />
            <div className="table-wrap">
              <table>
                <caption>{copy.historyCaption} ({locale === "zh" ? "币种" : "currency"}: {report.currency}; {copy.actualKey})</caption>
                <thead><tr><th scope="col">{copy.year}</th><th scope="col">{copy.revenue}</th><th scope="col">{copy.netIncome}</th><th scope="col">{copy.operatingCashFlow}</th><th scope="col">{copy.investingCashFlow}</th><th scope="col">{copy.cashCapex}</th><th scope="col">{copy.cashFlowProxy}</th><th scope="col">{copy.netMargin}</th></tr></thead>
                <tbody>
                  {report.periods.map((period) => (
                    <tr key={period.periodEnd}>
                      <th scope="row">{shortYear(period.periodEnd)}A</th>
                      <td>{formatMoney(period.revenue, report.currency, locale)}</td>
                      <td>{formatMoney(period.netIncome, report.currency, locale)}</td>
                      <td>{formatMoney(period.operatingCashFlow, report.currency, locale)}</td>
                      <td>{formatMoney(period.investingCashFlow, report.currency, locale)}</td>
                      <td>{formatMoney(period.cashCapex, report.currency, locale)}</td>
                      <td>{formatMoney(period.freeCashFlowProxy, report.currency, locale)}</td>
                      <td>{formatPercent(period.netMargin, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="formula-note"><EvidenceBadge kind="Derived calculation" locale={locale} /> {report.cashFlowProxyFormula}; {copy.netMarginFormula}</p>
          </section>

          <section className="report-section analysis-grid-section">
            <div className="section-heading full-width"><div><span>04</span><h3>{copy.financialQuality}</h3></div></div>
            <div className="balance-panel">
              <h4>{copy.resilience}</h4>
              <div className="balance-grid">
                <div><span>{copy.cash}</span><strong>{formatMoney(latestPeriod.cash, report.currency, locale)}</strong></div>
                <div><span>{copy.totalDebt}</span><strong>{formatMoney(latestPeriod.totalDebt, report.currency, locale)}</strong></div>
                <div><span>{copy.netDebt}</span><strong>{formatMoney(latestPeriod.netDebt, report.currency, locale)}</strong></div>
                <div><span>{copy.currentRatio}</span><strong>{latestPeriod.currentRatio === null ? copy.unavailable : `${latestPeriod.currentRatio.toFixed(2)}x`}</strong></div>
              </div>
              <p><EvidenceBadge kind="Derived calculation" locale={locale} /> {copy.netDebtFormula}</p>
            </div>
            <div className="quality-panel"><h4>{copy.earningsQuality}</h4><ul>{report.earningsQuality.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </section>

          <section className="report-section split-section">
            <div className="section-heading full-width"><div><span>05</span><h3>{copy.segmentBoundary}</h3></div></div>
            <div className="boundary-card"><EvidenceBadge kind="Interpretation" locale={locale} /><h4>{copy.automationBoundary}</h4><p>{report.segmentAnalysis}</p></div>
            <div className="industry-card"><span className="micro-label">{copy.industryContext}</span><h4>{report.company.sicDescription}</h4><p>{copy.competitionCopy}</p></div>
          </section>

          <section className="report-section">
            <div className="section-heading"><div><span>06</span><h3>{copy.thesis}</h3></div><p>{copy.thesisNote}</p></div>
            <div className="thesis-list">
              {report.thesis.map((item, index) => (
                <article key={item.title} className="thesis-card"><span className="thesis-index">0{index + 1}</span><div><h4>{item.title}</h4><p>{item.view}</p><dl><div><dt>{copy.counterEvidence}</dt><dd>{item.counterEvidence}</dd></div><div><dt>{copy.monitor}</dt><dd>{item.monitor}</dd></div></dl></div></article>
              ))}
            </div>
          </section>

          <section className="report-section two-column-section">
            <div><div className="section-heading compact"><div><span>07</span><h3>{copy.catalysts}</h3></div></div><div className="timeline">{report.catalysts.map((item) => <article key={`${item.timing}-${item.event}`}><time>{item.timing}</time><h4>{item.event}</h4><p>{item.investorRelevance}</p></article>)}</div></div>
            <div><div className="section-heading compact"><div><span>08</span><h3>{copy.risks}</h3></div></div><div className="risk-list">{report.risks.map((item) => <article key={item.title}><h4>{item.title}</h4><p>{item.evidence}</p><strong>{copy.thesisBreaker}</strong><p>{item.thesisBreaker}</p></article>)}</div></div>
          </section>

          <section className="report-section scenario-section">
            <div className="section-heading"><div><span>09</span><h3>{copy.scenarios}</h3></div><p><EvidenceBadge kind="Analyst assumption" locale={locale} /> {copy.scenarioNote}</p></div>
            <div className="scenario-grid">
              {report.scenarios.map((scenario) => (
                <article className={`scenario-card ${scenario.name.toLowerCase()}`} key={scenario.name}>
                  <div className="scenario-title"><span>{copy[scenario.name.toLowerCase() as "bear" | "base" | "bull"]}</span><strong>{scenario.enterpriseValueMultiple.toFixed(0)}x</strong></div>
                  <dl>
                    <div><dt>{copy.revenueGrowthAssumption}</dt><dd>{formatPercent(scenario.revenueGrowth, locale)}</dd></div>
                    <div><dt>{copy.netMarginAssumption}</dt><dd>{formatPercent(scenario.netMargin, locale)}</dd></div>
                    <div><dt>{copy.reinvestmentFactor}</dt><dd>{scenario.capexFactor.toFixed(2)}x</dd></div>
                    <div><dt>{copy.cashFlowProxy}</dt><dd>{formatMoney(scenario.projectedFreeCashFlow, report.currency, locale)}</dd></div>
                  </dl>
                  <p>{copy.impliedEnterpriseValue}</p>
                  <strong className="scenario-value">{formatMoney(scenario.modelImpliedEnterpriseValue, report.currency, locale)}</strong>
                </article>
              ))}
            </div>
            <div className="valuation-note"><h4>{copy.valuationView}</h4><p>{report.valuationAssessment}</p><code>{report.valuationFormula}</code></div>
          </section>

          <section className="report-section source-section">
            <div className="section-heading"><div><span>10</span><h3>{copy.sourcesLimits}</h3></div></div>
            <div className="source-columns">
              <div><h4>{copy.sourceLedger}</h4><ol>{report.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a><small>{copy.retrieved} {source.retrievedAt}</small></li>)}</ol></div>
              <div><h4>{copy.currentLimits}</h4><ul>{report.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
          </section>

          <footer className="report-actions">
            <div><strong>{copy.researchPreview}</strong><span>{copy.footerDescriptor}</span></div>
            <div><button type="button" className="secondary-button" onClick={downloadMarkdown}>{copy.downloadMarkdown}</button><button type="button" className="primary-button" onClick={() => window.print()}>{copy.printPdf}</button></div>
          </footer>
        </article>
      )}

      <footer className="site-footer"><span>ScopeLine</span><p>{copy.siteFooter}</p></footer>
    </main>
  );
}
