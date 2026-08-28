import { useMemo } from "react";
import {
  buildQuickReportVisualizations,
  type QuickCoverageId,
  type QuickEvidenceQualityId,
  type QuickTimelineItem,
} from "./lib/private-diligence/reports/quickReportPresentation";
import type { DiligenceLocale, PrivateDiligenceReport } from "./lib/private-diligence/types";

const COPY = {
  en: {
    visualSummary: "Research Dashboard",
    visualSummaryNote: "Coverage shows where usable evidence exists; it is not a confidence score",
    researchCoverage: "Research Coverage",
    covered: "Covered",
    limited: "Limited data",
    evidence: "evidence",
    claims: "claims",
    evidenceQuality: "Evidence Quality",
    evidenceQualityNote: "Distribution of actual claims by evidence status",
    noClaims: "No reportable claims were produced from the available evidence",
    hiring: "Hiring Intelligence",
    roleLinks: "Public role pages observed",
    hiringBasis: "Counted from distinct public ATS role URLs at the research date",
    noHiring: "No structured ATS role data was available for visualization",
    department: "Department / function",
    location: "Location",
    arrangement: "Work arrangement",
    seniority: "Seniority",
    unavailableBreakdown: "No reliable role attributes were extracted",
    timeline: "Recent Activity Timeline",
    timelineNote: "Only original-page evidence is shown; undated items remain undated",
    noTimeline: "No evidence-backed recent activity was identified",
    dateUnavailable: "Date not disclosed",
    source: "Source",
  },
  zh: {
    visualSummary: "研究仪表板",
    visualSummaryNote: "覆盖度表示哪些领域存在可用证据，并不代表置信度",
    researchCoverage: "研究覆盖度",
    covered: "已有覆盖",
    limited: "数据有限",
    evidence: "条证据",
    claims: "项主张",
    evidenceQuality: "证据质量",
    evidenceQualityNote: "按证据状态统计实际主张的分布",
    noClaims: "现有证据未形成可报告的主张",
    hiring: "招聘情报",
    roleLinks: "已观察到的公开职位页面",
    hiringBasis: "按研究日期时点的不同公开 ATS 职位 URL 统计",
    noHiring: "没有可用于可视化的结构化 ATS 职位数据",
    department: "部门 / 职能",
    location: "地点",
    arrangement: "工作方式",
    seniority: "职级",
    unavailableBreakdown: "未提取到可靠的职位属性",
    timeline: "近期活动时间线",
    timelineNote: "仅展示原始页面证据；无日期内容不会被补造日期",
    noTimeline: "未识别到有证据支持的近期活动",
    dateUnavailable: "未披露日期",
    source: "来源",
  },
} as const;

const COVERAGE_LABELS: Record<QuickCoverageId, { en: string; zh: string }> = {
  overview: { en: "Company overview", zh: "公司概览" },
  productsServices: { en: "Products / services", zh: "产品 / 服务" },
  leadership: { en: "Leadership", zh: "管理层" },
  hiring: { en: "Hiring", zh: "招聘" },
  customers: { en: "Customers", zh: "客户" },
  partners: { en: "Partners", zh: "合作伙伴" },
  recentActivity: { en: "Recent activity", zh: "近期活动" },
  fundingAcquisitions: { en: "Funding / acquisitions", zh: "融资 / 收购" },
};

const QUALITY_LABELS: Record<QuickEvidenceQualityId, { en: string; zh: string }> = {
  verified: { en: "Verified", zh: "已验证" },
  externallySupported: { en: "Externally Supported", zh: "外部证据支持" },
  partiallyVerified: { en: "Partially Verified", zh: "部分验证" },
  managementReported: { en: "Management Reported", zh: "公司自行披露" },
  unverified: { en: "Unverified", zh: "未验证" },
  inconsistent: { en: "Inconsistent", zh: "信息不一致" },
};

const EVENT_LABELS: Record<QuickTimelineItem["eventType"], { en: string; zh: string }> = {
  product: { en: "Product", zh: "产品" },
  partnership: { en: "Partnership", zh: "合作" },
  customer: { en: "Customer", zh: "客户" },
  hiring: { en: "Hiring signal", zh: "招聘信号" },
  leadership: { en: "Leadership", zh: "管理层" },
  fundingAcquisition: { en: "Funding / acquisition", zh: "融资 / 收购" },
  other: { en: "Business activity", zh: "业务动态" },
};

const QUALITY_COLORS: Record<QuickEvidenceQualityId, string> = {
  verified: "#0055FF",
  externallySupported: "#2D7CFF",
  partiallyVerified: "#75A7FF",
  managementReported: "#A9C7FF",
  unverified: "#D7DFEA",
  inconsistent: "#C56A6A",
};

function Breakdown({ title, rows, locale }: {
  title: string;
  rows: Array<{ label: string; count: number }>;
  locale: DiligenceLocale;
}) {
  if (!rows.length) return null;
  return <div className="clara-hiring-breakdown"><h4>{title}</h4>{rows.map((row) => (
    <div key={row.label}><span>{row.label}</span><strong>{row.count.toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</strong></div>
  ))}</div>;
}

export function ClaraQuickReportVisuals({ report, locale }: { report: PrivateDiligenceReport; locale: DiligenceLocale }) {
  const data = useMemo(() => buildQuickReportVisualizations(report), [report]);
  const copy = COPY[locale];
  const totalClaims = data.evidenceQuality.reduce((sum, item) => sum + item.count, 0);
  const hasHiringBreakdown = [data.hiring.departments, data.hiring.locations, data.hiring.workArrangements, data.hiring.seniority].some((rows) => rows.length > 0);
  return (
    <section className="clara-visual-dashboard" data-pdf-block aria-labelledby="clara-visual-dashboard-title">
      <header className="clara-visual-dashboard-header">
        <div><span>DATA</span><h2 id="clara-visual-dashboard-title">{copy.visualSummary}</h2></div>
        <p>{copy.visualSummaryNote}</p>
      </header>
      <div className="clara-visual-grid">
        <article className="clara-visual-card">
          <header><h3>{copy.researchCoverage}</h3><p>{copy.visualSummaryNote}</p></header>
          <div className="clara-coverage-list">
            {data.coverage.map((item) => {
              const label = COVERAGE_LABELS[item.id][locale];
              const status = item.covered ? copy.covered : copy.limited;
              return <div className="clara-coverage-row" key={item.id} title={`${label}: ${status}; ${item.evidenceCount} ${copy.evidence}; ${item.claimCount} ${copy.claims}`}>
                <div><span>{label}</span><small>{status}</small></div>
                <div className="clara-coverage-track" role="img" aria-label={`${label}: ${status}`}><span style={{ width: item.covered ? "100%" : "0%" }} /></div>
              </div>;
            })}
          </div>
        </article>
        <article className="clara-visual-card">
          <header><h3>{copy.evidenceQuality}</h3><p>{copy.evidenceQualityNote}</p></header>
          {totalClaims ? <>
            <div className="clara-quality-bar" role="img" aria-label={`${copy.evidenceQuality}: ${totalClaims}`}>
              {data.evidenceQuality.filter((item) => item.count > 0).map((item) => <span key={item.id} style={{ width: `${(item.count / totalClaims) * 100}%`, background: QUALITY_COLORS[item.id] }} title={`${QUALITY_LABELS[item.id][locale]}: ${item.count}`} />)}
            </div>
            <div className="clara-quality-legend">{data.evidenceQuality.map((item) => <div key={item.id}><i style={{ background: QUALITY_COLORS[item.id] }} /><span>{QUALITY_LABELS[item.id][locale]}</span><strong>{item.count}</strong></div>)}</div>
          </> : <p className="clara-visual-empty">{copy.noClaims}</p>}
        </article>
      </div>
      <article className="clara-visual-card clara-hiring-card">
        <header><h3>{copy.hiring}</h3><p>{copy.hiringBasis}</p></header>
        {data.hiring.observedRoleLinks > 0 || hasHiringBreakdown ? <>
          <div className="clara-hiring-total"><strong>{data.hiring.observedRoleLinks.toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</strong><span>{copy.roleLinks}</span></div>
          <div className="clara-hiring-breakdowns">
            <Breakdown title={copy.department} rows={data.hiring.departments} locale={locale} />
            <Breakdown title={copy.location} rows={data.hiring.locations} locale={locale} />
            <Breakdown title={copy.arrangement} rows={data.hiring.workArrangements} locale={locale} />
            <Breakdown title={copy.seniority} rows={data.hiring.seniority} locale={locale} />
          </div>
          {!hasHiringBreakdown && <p className="clara-visual-empty compact">{copy.unavailableBreakdown}</p>}
        </> : <p className="clara-visual-empty">{copy.noHiring}</p>}
      </article>
      <article className="clara-visual-card clara-activity-card">
        <header><h3>{copy.timeline}</h3><p>{copy.timelineNote}</p></header>
        {data.timeline.length ? <div className="clara-activity-timeline">{data.timeline.map((item) => <article key={item.evidenceId}>
          <div><time dateTime={item.date ?? undefined}>{item.date ?? copy.dateUnavailable}</time><span>{EVENT_LABELS[item.eventType][locale]}</span><span>{QUALITY_LABELS[item.evidenceStatus][locale]}</span></div>
          <p>{item.description}</p>
          <a href={item.sourceUrl} target="_blank" rel="noreferrer">{copy.source}: {item.sourceTitle}</a>
        </article>)}</div> : <p className="clara-visual-empty">{copy.noTimeline}</p>}
      </article>
    </section>
  );
}
