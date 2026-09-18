import { useMemo } from 'react';
import { ClaraHiringIntelligence } from './ClaraHiringIntelligence';
import { ClaraFundingTimeline } from './ClaraFundingTimeline';
import { ClaraVisualSource } from './ClaraResearchVisualPrimitives';
import { buildClaraVisualizationData, type CoverageDatum, type CoverageStatus } from './lib/private-diligence/reports/claraVisualization';
import type { DiligenceLocale, PrivateDiligenceReport } from './lib/private-diligence/types';

const STATUS: Record<CoverageStatus, [string, string]> = {
  supported: ['Supported', '有证据支持'], partial: ['Partial', '部分支持'], conflicting: ['Conflicting', '存在冲突'],
  'searched-not-found': ['Searched — Not Found', '已搜索 — 未找到'], 'source-unavailable': ['Source Unavailable', '来源不可用'], 'not-researched': ['Not Researched', '未研究'],
};
const SECTIONS: Record<CoverageDatum['id'], [string, string]> = { identity: ['Company Identity', '公司身份'], products: ['Products / Services', '产品 / 服务'], leadership: ['Leadership', '主要人员'], funding: ['Funding', '融资'], hiring: ['Hiring', '招聘'], recent: ['Recent Developments', '近期动态'] };

export function ClaraQuickReportVisuals({ report, locale }: { report: PrivateDiligenceReport; locale: DiligenceLocale }) {
  const data = useMemo(() => buildClaraVisualizationData(report), [report]);
  const zh = locale === 'zh';
  return <section className="clara-visual-dashboard clara-visual-phase-one" aria-labelledby="clara-visual-dashboard-title">
    <header className="clara-visual-dashboard-header"><div><span>CLARA · RESEARCH BRIEF</span><h2 id="clara-visual-dashboard-title">{zh ? '研究速览' : 'Research at a Glance'}</h2></div><p>{zh ? '仅展示本次报告已有的证据；未知项保持未知' : 'Evidence already in this report; unknowns remain unknown'}</p></header>
    <ClaraFundingTimeline data={data.funding} locale={locale} />
    <ClaraHiringIntelligence report={report} locale={locale} visualization={data.hiring} />
    <article className="clara-visual-card clara-activity-card" aria-label={zh ? '近期动态' : 'Recent developments'}>
      <header><h3>{zh ? '近期动态' : 'Recent Developments'}</h3><p>{zh ? '按来源发布时间排列；发布时间不等于事件日期' : 'Ordered by source publication, which is not the event date'}</p></header>
      {data.recent.length ? <ol className="clara-development-list">{data.recent.map(item => <li key={item.id} data-pdf-block>
        <div className="clara-development-meta"><span>{item.eventType === 'acquisition' ? zh ? '收购' : 'Acquisition' : zh ? '业务动态' : 'Company development'}</span><span>{zh ? '事件日期未知' : 'Event date unknown'}</span>{item.publishedAt && <span>{zh ? '来源发布' : 'Source published'}: <time dateTime={item.publishedAt}>{item.publishedAt}</time></span>}</div>
        {item.conflicting && <p className="clara-visual-warning">{zh ? '⚠ 来源存在冲突' : '⚠ Conflicting evidence'}</p>}
        <p>{item.description}</p>{item.sources.map(source => <ClaraVisualSource key={source.evidenceId} source={source} locale={locale} />)}
      </li>)}</ol> : <p className="clara-visual-empty">{zh ? '本次研究未识别到有证据支持的近期动态。' : 'No supported recent developments were identified in this research run.'}</p>}
    </article>
    <article className="clara-visual-card" aria-label={zh ? '研究覆盖' : 'Research coverage'}>
      <header><h3>{zh ? '研究覆盖' : 'Research Coverage'}</h3><p>{zh ? '显示研究状态，不是投资评分或置信度；证据数量不等于质量' : 'Research status, not an investment or confidence score. Evidence counts are not quality scores.'}</p></header>
      <div className="clara-research-coverage">{data.coverage.map(item => <details key={item.id}>
        <summary><span>{SECTIONS[item.id][zh ? 1 : 0]}</span><span className="clara-status-chip" data-status={item.status}>{STATUS[item.status][zh ? 1 : 0]}</span></summary>
        <p>{item.evidenceIds.length} {zh ? '条关联证据' : 'linked evidence records'} · {item.claimIds.length} {zh ? '项主张' : 'claims'} · {item.gaps.length} {zh ? '项已记录缺口' : 'recorded gaps'}</p>
        {item.id === 'identity' && item.status === 'partial' && <p>{zh ? '用户已确认研究目标；法律主体核验仍不完整。' : 'The research target is confirmed; legal identity verification remains incomplete.'}</p>}
        {[...item.gaps, ...item.limitations].length > 0 && <ul>{[...new Set([...item.gaps, ...item.limitations])].map(text => <li key={text}>{text}</li>)}</ul>}
        {item.evidenceIds.length > 0 && <p className="clara-visual-note">{item.evidenceIds.join(' · ')}</p>}
      </details>)}</div>
    </article>
  </section>;
}
