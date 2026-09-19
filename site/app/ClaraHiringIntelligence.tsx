import { useMemo } from 'react';
import type { DiligenceLocale, PrivateDiligenceReport } from './lib/private-diligence/types';
import type { PresentationMode } from './lib/private-diligence/reports/adaptiveReportComposer';
import { buildHiringVisualizationData, type HiringVisualizationData } from './lib/private-diligence/reports/claraVisualization';
import { ClaraCountBars } from './ClaraResearchVisualPrimitives';

export function getClaraHiringIntelligence(report: PrivateDiligenceReport) { return report.hiringIntelligence ?? null; }
export function ClaraHiringIntelligence({ report, locale, visualization, mode, careersUrl }: { report: PrivateDiligenceReport; locale: DiligenceLocale; visualization?: HiringVisualizationData; mode?: PresentationMode; careersUrl?: string | null }) {
  const data = useMemo(() => visualization ?? buildHiringVisualizationData(report), [report, visualization]);
  const zh = locale === 'zh';
  const chart = mode ? mode === 'visualization' : data.jobs.length >= 8;
  if (!data.jobs.length && data.count === null && !careersUrl) return null;
  const metrics = data.roleAnalysis.metrics;
  const titles = { leadership: zh ? '领导级岗位' : 'Leadership roles', aiMl: zh ? 'AI / ML 岗位' : 'AI / ML roles', financeLeadership: zh ? '财务领导岗位' : 'Finance leadership', securityCompliance: zh ? '安全 / 合规岗位' : 'Security / compliance' };
  return <article className="clara-hiring-intelligence clara-visual-card" data-pdf-block aria-label={zh ? '招聘快照' : 'Hiring snapshot'}>
    <header><h3>{zh ? '招聘快照' : 'Hiring Snapshot'}</h3><p>{zh ? '检索时点的公开招聘观察，不代表员工总数或公司增长' : 'Observed public openings at retrieval time, not employee headcount or company growth'}</p></header>
    {data.count !== null ? <div className="clara-hiring-intelligence-total"><strong>{data.count}</strong><span>{data.count === 0 ? zh ? '在检查的来源中观察到 0 个公开职位' : '0 public openings observed in the checked sources' : zh ? '已观察到的公开职位' : 'Observed public openings'}</span></div>
      : data.jobs.length > 0 ? <p className="clara-visual-note">{zh ? '部分职位快照；完整数量不可用' : 'Partial posting snapshot; complete count unavailable'}</p> : <p>{zh ? '已识别公司招聘页面，当前职位快照不可用。' : 'Company careers source identified; a current posting snapshot is unavailable.'}</p>}
    {data.retrievedDates.length > 0 && <p className="clara-visual-note">{zh ? '快照检索' : 'Snapshot retrieved'}: {data.retrievedDates.join(' / ')}</p>}
    {Object.values(metrics).some(count => count > 0) && <div className="clara-hiring-metrics">{(Object.keys(titles) as Array<keyof typeof titles>).filter(key => metrics[key] > 0).map(key => <div key={key}><strong>{metrics[key]}</strong><span>{titles[key]}</span></div>)}</div>}
    {chart && <div className="clara-snapshot-charts">
      {data.functions.some(row => !['Unknown', 'Other'].includes(row.label)) && <ClaraCountBars title={zh ? '职能分布' : 'Observed function distribution'} rows={data.functions} locale={locale} />}
      {data.jobs.filter(job => job.location).length >= 5 && data.locations.filter(row => row.label !== 'Unknown').length >= 2 && <ClaraCountBars title={zh ? '主要招聘地点' : 'Observed locations'} rows={data.locations} locale={locale} />}
    </div>}
    {data.notableJobs.length > 0 && <><h4>{zh ? '值得关注的公开职位' : 'Notable observed openings'}</h4><ul className="clara-hiring-notable">{data.notableJobs.map(job => <li key={job.id}><div><strong>{job.title}</strong>{job.location && <small>{job.location}</small>}<small>{job.reasons.join(' · ')}</small></div>{job.url && <a href={job.url} target="_blank" rel="noreferrer" title={job.evidenceIds.join(', ')}>{zh ? '原始职位' : 'Original posting'}</a>}</li>)}</ul></>}
    {careersUrl && <p className="clara-visual-note"><a href={careersUrl} target="_blank" rel="noreferrer">{zh ? '公司招聘来源' : 'Company careers source'}</a></p>}
    {(data.sources.length > 0 || data.jobs.length > 0) && <details className="clara-hiring-jobs"><summary>{zh ? '快照来源与全部职位' : 'Snapshot sources & all postings'} ({data.jobs.length})</summary><ul className="clara-snapshot-sources">{data.sources.map((source, index) => <li key={`${source.url}-${index}`}>{source.url && <a href={source.url} target="_blank" rel="noreferrer">{zh ? '招聘来源' : 'Careers source'} {index + 1}</a>} · {source.retrievedAt}</li>)}</ul><ul>{data.jobs.map((job, index) => <li key={`${job.id}-${index}`}><span>{job.title}{job.location ? ` · ${job.location}` : ''}</span>{job.url && <a href={job.url} target="_blank" rel="noreferrer" title={job.evidenceIds.join(', ')}>{zh ? '查看职位' : 'View role'}</a>}</li>)}</ul></details>}
    {data.limitations.length > 0 && <details className="clara-field-evidence"><summary>{zh ? '来源限制' : 'Source limitations'}</summary><ul>{data.limitations.map(text => <li key={text}>{text}</li>)}</ul></details>}
  </article>;
}
