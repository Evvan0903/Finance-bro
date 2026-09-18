import { useMemo } from 'react';
import type { DiligenceLocale, PrivateDiligenceReport } from './lib/private-diligence/types';
import { buildHiringVisualizationData, type HiringVisualizationData } from './lib/private-diligence/reports/claraVisualization';
import { ClaraCountBars } from './ClaraResearchVisualPrimitives';

export function getClaraHiringIntelligence(report: PrivateDiligenceReport) { return report.hiringIntelligence ?? null; }
export function ClaraHiringIntelligence({ report, locale, visualization }: { report: PrivateDiligenceReport; locale: DiligenceLocale; visualization?: HiringVisualizationData }) {
  const data = useMemo(() => visualization ?? buildHiringVisualizationData(report), [report, visualization]);
  const zh = locale === 'zh';
  return <article className="clara-hiring-intelligence clara-visual-card" data-pdf-block aria-label={zh ? '招聘快照' : 'Hiring snapshot'}>
    <header><h3>{zh ? '招聘快照' : 'Hiring Snapshot'}</h3><p>{zh ? '检索时点的公开招聘观察，不代表员工总数或公司增长' : 'Public hiring at retrieval time, not employee headcount or company growth'}</p></header>
    {data.count !== null ? <div className="clara-hiring-intelligence-total"><strong>{data.count}</strong><span>{data.count === 0 ? zh ? '在检查的来源中观察到 0 个公开职位' : '0 public openings observed in the checked sources' : zh ? '已观察到的公开职位' : 'Observed public openings'}</span></div>
      : <p className="clara-visual-empty">{data.status === 'not-researched' ? zh ? '本次未研究招聘情况' : 'Hiring was not researched in this run' : data.status === 'partial' ? zh ? '仅取得部分职位；完整数量不可用' : 'Partial job records; a complete count is unavailable' : zh ? '招聘来源不可用；职位数量未知' : 'Hiring source unavailable; opening count unknown'}</p>}
    <p className="clara-visual-note">{zh ? '快照检索日期' : 'Snapshot retrieved'}: {data.retrievedDates.length ? data.retrievedDates.join(' / ') : zh ? '未记录' : 'Not recorded'}</p>
    {data.jobs.length > 0 && <div className="clara-snapshot-charts">
      <ClaraCountBars title={zh ? '职能' : 'Function'} rows={data.functions} locale={locale} />
      <ClaraCountBars title={zh ? '主要地点' : 'Top observed locations'} rows={data.locations} locale={locale} />
      <ClaraCountBars title={zh ? '远程标注' : 'Remote indication'} rows={data.remote} locale={locale} />
      <ClaraCountBars title={zh ? '职级' : 'Seniority'} rows={data.seniority} locale={locale} />
    </div>}
    {data.jobs.length > 0 && <p className="clara-visual-note">{zh ? '“未注明远程”不等于现场办公，也不代表公司整体远程政策。' : '“Remote not indicated” does not mean on-site and does not establish a company-wide remote policy.'}</p>}
    {data.sources.length > 0 && <ul className="clara-snapshot-sources">{data.sources.map((s, i) => <li key={`${s.url}-${i}`}>{s.url && <a href={s.url} target="_blank" rel="noreferrer">{s.url}</a>} · {s.retrievedAt}</li>)}</ul>}
    {data.jobs.length > 0 && <details className="clara-hiring-jobs"><summary>{zh ? '公开职位明细' : 'Underlying public roles'} ({data.jobs.length})</summary><ul>{data.jobs.map((job, i) => <li key={`${job.id}-${i}`}><span>{job.title}{job.location ? ` · ${job.location}` : ''}</span>{job.url && <a href={job.url} target="_blank" rel="noreferrer" title={job.evidenceIds.join(', ')}>{zh ? '查看职位' : 'View role'}</a>}</li>)}</ul></details>}
    {data.limitations.length > 0 && <details className="clara-field-evidence"><summary>{zh ? '来源限制' : 'Source limitations'}</summary><ul>{data.limitations.map(text => <li key={text}>{text}</li>)}</ul></details>}
  </article>;
}
