"use client";

import { FormEvent, useMemo, useState } from "react";
import type {
  DashboardMetric,
  EvidenceKind,
  FinancialPeriod,
  ResearchReport,
} from "./lib/research-types";

const EXAMPLES = ["Shell plc", "Apple", "NVIDIA", "JPMorgan"];

const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  "Reported fact": "已披露事实",
  "Derived calculation": "推导计算",
  "Analyst assumption": "分析假设",
  Interpretation: "研究解读",
  "Management statement": "管理层陈述",
};

function formatMoney(value: number | null, currency: string) {
  if (value === null || !Number.isFinite(value)) return "Data unavailable";
  const absolute = Math.abs(value);
  const divisor = absolute >= 1e9 ? 1e9 : absolute >= 1e6 ? 1e6 : absolute >= 1e3 ? 1e3 : 1;
  const suffix = divisor === 1e9 ? "bn" : divisor === 1e6 ? "m" : divisor === 1e3 ? "k" : "";
  return `${currency} ${(value / divisor).toLocaleString("zh-CN", {
    maximumFractionDigits: 1,
  })}${suffix}`;
}

function formatPercent(value: number | null) {
  return value === null || !Number.isFinite(value)
    ? "Data unavailable"
    : `${(value * 100).toFixed(1)}%`;
}

function shortYear(periodEnd: string) {
  return periodEnd.slice(0, 4);
}

function EvidenceBadge({ kind }: { kind: EvidenceKind }) {
  const className = kind.toLowerCase().replaceAll(" ", "-");
  return <span className={`evidence-badge ${className}`}>{EVIDENCE_LABELS[kind]}</span>;
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  return (
    <article className={`metric-card ${metric.tone}`}>
      <div className="metric-topline">
        <span>{metric.label}</span>
        <EvidenceBadge kind={metric.classification} />
      </div>
      <strong>{metric.value}</strong>
      <p>{metric.detail}</p>
    </article>
  );
}

function TrendChart({ periods, currency }: { periods: FinancialPeriod[]; currency: string }) {
  const maxRevenue = Math.max(...periods.map((period) => Math.abs(period.revenue ?? 0)), 1);
  const maxCash = Math.max(
    ...periods.map((period) => Math.abs(period.operatingCashFlow ?? 0)),
    1,
  );

  return (
    <div className="trend-chart" aria-label="历年营收与经营现金流趋势图">
      <div className="chart-legend">
        <span><i className="legend-revenue" />营收</span>
        <span><i className="legend-cash" />经营现金流</span>
      </div>
      <div className="chart-grid">
        {periods.map((period) => (
          <div className="chart-column" key={period.periodEnd}>
            <div className="bar-stage">
              <div
                className="bar revenue-bar"
                style={{ height: `${Math.max(4, (Math.abs(period.revenue ?? 0) / maxRevenue) * 100)}%` }}
                title={`营收 ${formatMoney(period.revenue, currency)}`}
              />
              <div
                className="bar cash-bar"
                style={{ height: `${Math.max(4, (Math.abs(period.operatingCashFlow ?? 0) / maxCash) * 82)}%` }}
                title={`经营现金流 ${formatMoney(period.operatingCashFlow, currency)}`}
              />
            </div>
            <span>{shortYear(period.periodEnd)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function reportToMarkdown(report: ResearchReport) {
  const lines = [
    `# ${report.company.name} — 机构研究快报`,
    "",
    `**代码：** ${report.company.ticker}  \n**研究日期：** ${report.researchDate}  \n**数据截止：** ${report.cutoff}`,
    "",
    "> 本报告基于公开申报数据自动生成，仅供研究参考，不构成投资建议、评级或目标价。",
    "",
    "## 研究仪表板",
    "",
    ...report.dashboard.map((item) => `- **${item.label}：${item.value}** — ${item.detail}（${EVIDENCE_LABELS[item.classification]}）`),
    "",
    "## 公司与业务模式",
    "",
    report.overview,
    "",
    "## 历史财务",
    "",
    `| 年度 | 营收 | 净利润 | 经营现金流 | 投资现金流 | 现金资本开支 | 现金流代理 |`,
    `|---|---:|---:|---:|---:|---:|`,
    ...report.periods.map((period) =>
      `| ${shortYear(period.periodEnd)} | ${formatMoney(period.revenue, report.currency)} | ${formatMoney(period.netIncome, report.currency)} | ${formatMoney(period.operatingCashFlow, report.currency)} | ${formatMoney(period.investingCashFlow, report.currency)} | ${formatMoney(period.cashCapex, report.currency)} | ${formatMoney(period.freeCashFlowProxy, report.currency)} |`,
    ),
    "",
    "## 投资论点",
    "",
    ...report.thesis.map((item, index) => `${index + 1}. **${item.title}** — ${item.view}\n   - 反证：${item.counterEvidence}\n   - 监测：${item.monitor}`),
    "",
    "## 关键风险",
    "",
    ...report.risks.map((item) => `- **${item.title}** — ${item.evidence}\n  - 破坏条件：${item.thesisBreaker}`),
    "",
    "## 估值与情景",
    "",
    report.valuationAssessment,
    "",
    `公式：${report.valuationFormula}`,
    "",
    "## 来源与限制",
    "",
    ...report.sources.map((source) => `- [${source.title}](${source.url})，检索于 ${source.retrievedAt}`),
    ...report.limitations.map((item) => `- ${item}`),
    "",
  ];
  return lines.join("\n");
}

export function ResearchApp() {
  const [company, setCompany] = useState("Shell plc");
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const latestPeriod = useMemo(() => report?.periods.at(-1) ?? null, [report]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const query = company.trim();
    if (!query || loading) return;
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: query }),
      });
      const payload = (await response.json()) as { report?: ResearchReport; error?: string };
      if (!response.ok || !payload.report) {
        throw new Error(payload.error || "报告暂时无法生成。");
      }
      setReport(payload.report);
      requestAnimationFrame(() => {
        document.getElementById("report")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "报告暂时无法生成。");
    } finally {
      setLoading(false);
    }
  }

  function chooseExample(value: string) {
    setCompany(value);
    setError("");
  }

  function downloadMarkdown() {
    if (!report) return;
    const blob = new Blob([reportToMarkdown(report)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.company.ticker.toLowerCase()}-institutional-research.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="ScopeLine 首页">
          <span className="brand-mark">S</span>
          <span>ScopeLine</span>
        </a>
        <span className="header-note">SEC-first · point-in-time</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="hero-content">
          <p className="eyebrow">公开申报驱动的机构研究工作台</p>
          <h1>输入一家公司，<br />生成可追溯的尽调报告。</h1>
          <p className="hero-copy">
            从 SEC 原始申报提取 3–5 年财务，自动拆分事实、计算、假设与解读；
            不填造缺失值，不输出无依据的目标价。
          </p>

          <form className="search-shell" onSubmit={submit}>
            <label htmlFor="company">公司名或交易代码</label>
            <div className="search-row">
              <input
                id="company"
                name="company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="例如：Shell plc 或 SHEL"
                autoComplete="organization"
                maxLength={100}
                disabled={loading}
              />
              <button type="submit" disabled={loading || company.trim().length < 2}>
                {loading ? "正在研究…" : "生成尽调报告"}
              </button>
            </div>
            <div className="example-row" aria-label="示例公司">
              <span>试一试</span>
              {EXAMPLES.map((example) => (
                <button type="button" key={example} onClick={() => chooseExample(example)}>
                  {example}
                </button>
              ))}
            </div>
          </form>

          {loading && (
            <div className="research-progress" role="status" aria-live="polite">
              <span className="progress-orbit" />
              <div>
                <strong>正在锁定发行人并读取官方申报</strong>
                <p>核对期间与单位 → 标准化报表 → 计算现金流 → 生成论点与情景</p>
              </div>
            </div>
          )}
          {error && <p className="error-message" role="alert">{error}</p>}

          <div className="trust-row">
            <span><b>01</b> 官方来源</span>
            <span><b>02</b> 可复核公式</span>
            <span><b>03</b> 明示限制</span>
          </div>
        </div>
      </section>

      {!report && !loading && (
        <section className="method-strip" aria-label="研究方法">
          <div>
            <span>POINT-IN-TIME</span>
            <strong>时点锁定</strong>
            <p>记录研究日期、申报日期与修订状态。</p>
          </div>
          <div>
            <span>NORMALIZED</span>
            <strong>口径统一</strong>
            <p>核对年度、币种、单位与现金流定义。</p>
          </div>
          <div>
            <span>DECISION-USEFUL</span>
            <strong>投资者视角</strong>
            <p>每项发现都说明为什么重要及如何证伪。</p>
          </div>
        </section>
      )}

      {report && latestPeriod && (
        <article className="report" id="report">
          <section className="report-cover">
            <div>
              <p className="eyebrow dark">机构研究快报 · 自动化样本</p>
              <h2>{report.company.name}</h2>
              <div className="company-meta">
                <span>{report.company.ticker}</span>
                <span>{report.company.exchange}</span>
                <span>CIK {report.company.cik}</span>
                <span>FY {report.company.fiscalYearEnd}</span>
              </div>
            </div>
            <div className="report-date">
              <span>研究日期</span>
              <strong>{report.researchDate}</strong>
              <small>数据检索截止 {new Date(report.cutoff).toLocaleString("zh-CN", { timeZone: "UTC" })} UTC</small>
            </div>
          </section>

          <section className="disclosure-banner">
            <strong>研究边界</strong>
            <p>基于公开 SEC 申报的自动化研究预览；不构成投资建议、评级或目标价。</p>
            <div className="evidence-key">
              {Object.keys(EVIDENCE_LABELS).map((key) => (
                <EvidenceBadge key={key} kind={key as EvidenceKind} />
              ))}
            </div>
          </section>

          <section className="report-section dashboard-section">
            <div className="section-heading">
              <div><span>01</span><h3>研究仪表板</h3></div>
              <p>最新年度核心信号。颜色表示关注方向，不代表买卖评级。</p>
            </div>
            <div className="metric-grid">
              {report.dashboard.map((metric) => <MetricCard metric={metric} key={metric.label} />)}
            </div>
          </section>

          <section className="report-section split-section">
            <div className="section-heading">
              <div><span>02</span><h3>公司与申报基线</h3></div>
            </div>
            <div className="overview-card">
              <EvidenceBadge kind="Reported fact" />
              <p>{report.overview}</p>
              <dl>
                <div><dt>SEC 行业</dt><dd>{report.company.sicDescription}</dd></div>
                <div><dt>发行人身份</dt><dd>{report.company.filingStatus}</dd></div>
                <div><dt>最新年报</dt><dd>{report.latestAnnual ? `${report.latestAnnual.form} · ${report.latestAnnual.filed}` : "Data unavailable"}</dd></div>
                <div><dt>最新中期/当前报告</dt><dd>{report.latestInterim ? `${report.latestInterim.form} · ${report.latestInterim.filed}` : "Data unavailable"}</dd></div>
              </dl>
            </div>
            <aside className="filing-links">
              <span>官方申报</span>
              {report.latestAnnual && <a href={report.latestAnnual.url} target="_blank" rel="noreferrer">查看 {report.latestAnnual.form} 年报 ↗</a>}
              {report.latestInterim && <a href={report.latestInterim.url} target="_blank" rel="noreferrer">查看 {report.latestInterim.form} 更新 ↗</a>}
              {!report.latestAnnual && !report.latestInterim && <p>Data unavailable</p>}
            </aside>
          </section>

          <section className="report-section">
            <div className="section-heading">
              <div><span>03</span><h3>三至五年财务表现</h3></div>
              <p><EvidenceBadge kind="Reported fact" /> 数值来自标准化 XBRL；比率由页面公式推导。</p>
            </div>
            <TrendChart periods={report.periods} currency={report.currency} />
            <div className="table-wrap">
              <table>
                <caption>标准化年度财务历史（币种：{report.currency}；A = 已报告实际值）</caption>
                <thead><tr><th scope="col">年度</th><th scope="col">营收</th><th scope="col">净利润</th><th scope="col">经营现金流</th><th scope="col">投资现金流</th><th scope="col">现金资本开支</th><th scope="col">现金流代理</th><th scope="col">净利率</th></tr></thead>
                <tbody>
                  {report.periods.map((period) => (
                    <tr key={period.periodEnd}>
                      <th scope="row">{shortYear(period.periodEnd)}A</th>
                      <td>{formatMoney(period.revenue, report.currency)}</td>
                      <td>{formatMoney(period.netIncome, report.currency)}</td>
                      <td>{formatMoney(period.operatingCashFlow, report.currency)}</td>
                      <td>{formatMoney(period.investingCashFlow, report.currency)}</td>
                      <td>{formatMoney(period.cashCapex, report.currency)}</td>
                      <td>{formatMoney(period.freeCashFlowProxy, report.currency)}</td>
                      <td>{formatPercent(period.netMargin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="formula-note"><EvidenceBadge kind="Derived calculation" /> {report.cashFlowProxyFormula}；净利率 = 净利润 ÷ 营收。</p>
          </section>

          <section className="report-section analysis-grid-section">
            <div className="section-heading full-width">
              <div><span>04</span><h3>现金流、资产负债表与盈利质量</h3></div>
            </div>
            <div className="balance-panel">
              <h4>最新年度财务承压能力</h4>
              <div className="balance-grid">
                <div><span>现金</span><strong>{formatMoney(latestPeriod.cash, report.currency)}</strong></div>
                <div><span>总债务</span><strong>{formatMoney(latestPeriod.totalDebt, report.currency)}</strong></div>
                <div><span>净债务</span><strong>{formatMoney(latestPeriod.netDebt, report.currency)}</strong></div>
                <div><span>流动比率</span><strong>{latestPeriod.currentRatio === null ? "Data unavailable" : `${latestPeriod.currentRatio.toFixed(2)}x`}</strong></div>
              </div>
              <p><EvidenceBadge kind="Derived calculation" /> 净债务 = 标准化总债务 − 现金。该口径可能不同于发行人定义。</p>
            </div>
            <div className="quality-panel">
              <h4>盈利质量观察</h4>
              <ul>
                {report.earningsQuality.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </section>

          <section className="report-section split-section">
            <div className="section-heading full-width">
              <div><span>05</span><h3>分部与竞争边界</h3></div>
            </div>
            <div className="boundary-card">
              <EvidenceBadge kind="Interpretation" />
              <h4>什么可以自动化，什么必须回到年报</h4>
              <p>{report.segmentAnalysis}</p>
            </div>
            <div className="industry-card">
              <span className="micro-label">INDUSTRY CONTEXT</span>
              <h4>{report.company.sicDescription}</h4>
              <p>竞争定位需要结合发行人分部披露、市场份额、成本曲线和同业可比口径。当前版本仅给出 SEC 行业分类，不把分类标签伪装成竞争结论。</p>
            </div>
          </section>

          <section className="report-section">
            <div className="section-heading">
              <div><span>06</span><h3>投资论点</h3></div>
              <p>每条观点同时给出反证和监测变量。</p>
            </div>
            <div className="thesis-list">
              {report.thesis.map((item, index) => (
                <article key={item.title} className="thesis-card">
                  <span className="thesis-index">0{index + 1}</span>
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.view}</p>
                    <dl>
                      <div><dt>反证</dt><dd>{item.counterEvidence}</dd></div>
                      <div><dt>监测</dt><dd>{item.monitor}</dd></div>
                    </dl>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="report-section two-column-section">
            <div>
              <div className="section-heading compact"><div><span>07</span><h3>关键催化剂</h3></div></div>
              <div className="timeline">
                {report.catalysts.map((item) => (
                  <article key={`${item.timing}-${item.event}`}>
                    <time>{item.timing}</time>
                    <h4>{item.event}</h4>
                    <p>{item.investorRelevance}</p>
                  </article>
                ))}
              </div>
            </div>
            <div>
              <div className="section-heading compact"><div><span>08</span><h3>风险与破坏条件</h3></div></div>
              <div className="risk-list">
                {report.risks.map((item) => (
                  <article key={item.title}>
                    <h4>{item.title}</h4>
                    <p>{item.evidence}</p>
                    <strong>THESIS BREAKER</strong>
                    <p>{item.thesisBreaker}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="report-section scenario-section">
            <div className="section-heading">
              <div><span>09</span><h3>情景与估值敏感性</h3></div>
              <p><EvidenceBadge kind="Analyst assumption" /> 简化情景，不代表概率预测或目标价。</p>
            </div>
            <div className="scenario-grid">
              {report.scenarios.map((scenario) => (
                <article className={`scenario-card ${scenario.name.toLowerCase()}`} key={scenario.name}>
                  <div className="scenario-title">
                    <span>{scenario.name}</span>
                    <strong>{scenario.enterpriseValueMultiple.toFixed(0)}x</strong>
                  </div>
                  <dl>
                    <div><dt>收入增长假设</dt><dd>{formatPercent(scenario.revenueGrowth)}</dd></div>
                    <div><dt>净利率假设</dt><dd>{formatPercent(scenario.netMargin)}</dd></div>
                    <div><dt>再投资压力系数</dt><dd>{scenario.capexFactor.toFixed(2)}x</dd></div>
                    <div><dt>现金流代理</dt><dd>{formatMoney(scenario.projectedFreeCashFlow, report.currency)}</dd></div>
                  </dl>
                  <p>模型隐含企业价值</p>
                  <strong className="scenario-value">{formatMoney(scenario.modelImpliedEnterpriseValue, report.currency)}</strong>
                </article>
              ))}
            </div>
            <div className="valuation-note">
              <h4>透明估值判断</h4>
              <p>{report.valuationAssessment}</p>
              <code>{report.valuationFormula}</code>
            </div>
          </section>

          <section className="report-section source-section">
            <div className="section-heading"><div><span>10</span><h3>来源与限制</h3></div></div>
            <div className="source-columns">
              <div>
                <h4>来源账本</h4>
                <ol>
                  {report.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>
                      <small>检索于 {source.retrievedAt}</small>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h4>当前限制</h4>
                <ul>
                  {report.limitations.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
          </section>

          <footer className="report-actions">
            <div>
              <strong>ScopeLine Research Preview</strong>
              <span>公开数据 · 原创分析 · 可追溯公式</span>
            </div>
            <div>
              <button type="button" className="secondary-button" onClick={downloadMarkdown}>下载 Markdown</button>
              <button type="button" className="primary-button" onClick={() => window.print()}>打印 / 存为 PDF</button>
            </div>
          </footer>
        </article>
      )}

      <footer className="site-footer">
        <span>ScopeLine</span>
        <p>Automated public-filing research. Not investment advice.</p>
      </footer>
    </main>
  );
}
