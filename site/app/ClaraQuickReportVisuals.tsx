import { useMemo } from 'react';
import { ClaraHiringIntelligence } from './ClaraHiringIntelligence';
import { ClaraFundingTimeline } from './ClaraFundingTimeline';
import { ClaraVisualSource } from './ClaraResearchVisualPrimitives';
import { composeAdaptiveReport, reportModuleTitle, type FactualItem } from './lib/private-diligence/reports/adaptiveReportComposer';
import { visualSourceUrl, type CoverageStatus } from './lib/private-diligence/reports/claraVisualization';
import type { DiligenceLocale, PrivateDiligenceReport } from './lib/private-diligence/types';
const STATUS: Record<CoverageStatus, [string, string]> = { supported: ['Supported', '有证据支持'], partial: ['Partial', '部分支持'], conflicting: ['Conflicting', '存在冲突'], 'searched-not-found': ['Searched — Not Found', '已搜索 — 未找到'], 'source-unavailable': ['Source Unavailable', '来源不可用'], 'not-researched': ['Not Researched', '未研究'] };
const COVERAGE: Record<string, [string, string]> = { identity: ['Identity', '身份'], products: ['Products', '产品'], leadership: ['Leadership', '主要人员'], funding: ['Funding', '融资'], hiring: ['Hiring', '招聘'], recent: ['Recent', '近期动态'], customers: ['Customers', '客户'], partnerships: ['Partnerships', '合作'], pricing: ['Pricing', '定价'], security: ['Security / Compliance', '安全 / 合规'], legal_entity: ['Legal entity', '法律实体'], sec_filings: ['SEC filings', 'SEC 申报'], government_activity: ['Government', '政府'] };
function Sources({ item, locale }: { item: FactualItem; locale: DiligenceLocale }) {
  return <details className="clara-item-sources"><summary>{locale === 'zh' ? '证据' : 'Evidence'} ({item.sources.length})</summary>{item.sources.slice(0, 3).map(source => <ClaraVisualSource key={`${source.evidenceId}:${source.url ?? ""}:${source.recordId ?? ""}`} source={source} locale={locale} />)}{item.sources.length > 3 && <details><summary>{locale === 'zh' ? '全部支持记录' : 'All supporting records'} ({item.sources.length - 3})</summary>{item.sources.slice(3).map(source => <ClaraVisualSource key={`${source.evidenceId}:${source.url ?? ""}:${source.recordId ?? ""}`} source={source} locale={locale} />)}</details>}</details>;
}
export function ClaraQuickReportVisuals({ report, locale }: { report: PrivateDiligenceReport; locale: DiligenceLocale }) {
  const composition = useMemo(() => composeAdaptiveReport(report), [report]);
  const zh = locale === 'zh';
  const visible = composition.modules.filter(module => !['hidden', 'status_only'].includes(module.mode));
  if (!visible.length && !composition.keyFindings.length) return null;
  return <section className="clara-visual-dashboard clara-adaptive-report" aria-label={zh ? '研究发现' : 'Research findings'}>
    {composition.keyFindings.length > 0 && <section className="clara-key-findings" aria-labelledby="clara-key-findings-title" data-pdf-block>
      <header><span>CLARA · RESEARCH BRIEF</span><h2 id="clara-key-findings-title">{reportModuleTitle('findings', locale)}</h2></header>
      <ul>{composition.keyFindings.map(item => <li key={item.id}><span className="clara-finding-domain">{reportModuleTitle(item.domain, locale)}</span><p>{item.text}</p><Sources item={item} locale={locale} /></li>)}</ul>
    </section>}
    <div className="clara-adaptive-grid">{visible.map(module => {
      const attrs = { 'data-module': module.id, 'data-presentation': module.mode };
      if (module.id === 'funding') return <div className={module.mode === 'visualization' || module.mode === 'full' ? 'clara-module-wide' : ''} key={module.id} {...attrs}><ClaraFundingTimeline data={composition.data.funding} locale={locale} mode={module.mode} /></div>;
      if (module.id === 'hiring') return <div className={module.mode === 'visualization' ? 'clara-module-wide' : ''} key={module.id} {...attrs}><ClaraHiringIntelligence report={report} locale={locale} visualization={composition.data.hiring} mode={module.mode} careersUrl={composition.careersUrl} /></div>;
      if (module.id === 'recent') return <article key={module.id} {...attrs} className={`clara-visual-card clara-activity-card${module.mode === 'visualization' ? ' clara-module-wide' : ''}`}>
        <header><h3>{reportModuleTitle('recent', locale)}</h3></header>
        <ol className={module.mode === 'visualization' ? 'clara-development-list' : 'clara-compact-facts'}>{composition.data.recent.map(item => <li key={item.id} data-pdf-block>{item.conflicting && <p className="clara-visual-warning">{zh ? '来源存在冲突' : 'Conflicting source evidence'}</p>}<p>{item.description}</p>{item.publishedAt && <small>{zh ? '来源发布' : 'Source published'}: <time dateTime={item.publishedAt}>{item.publishedAt}</time> · {zh ? '事件日期尚未确立' : 'Event date not established'}</small>}<Sources item={{ id: item.id, text: item.description, claimIds: item.claimIds, sources: item.sources }} locale={locale} /></li>)}</ol>
      </article>;
      const items = composition.items[module.id as keyof typeof composition.items];
      if (!items?.length) return null;
      return <article key={module.id} {...attrs} className={`clara-visual-card${module.id === 'overview' ? ' clara-module-wide' : ''}`} data-pdf-block><header><h3>{reportModuleTitle(module.id, locale)}</h3></header><ul className="clara-compact-facts">{items.slice(0, 4).map(item => <li key={item.id}><p>{item.text}</p>{item.historical && <small className="clara-status-chip">{zh ? '历史职位' : 'Historical role'}</small>}<Sources item={item} locale={locale} /></li>)}</ul>{items.length > 4 && <details className="clara-additional-records"><summary>{zh ? '更多有来源支持的记录' : 'More sourced records'} ({items.length - 4})</summary><ul className="clara-compact-facts">{items.slice(4).map(item => <li key={item.id}><p>{item.text}</p>{item.historical && <small>{zh ? '历史职位' : 'Historical role'}</small>}<Sources item={item} locale={locale} /></li>)}</ul></details>}</article>;
    })}</div>
  </section>;
}
export function ClaraResearchFooter({ report, locale }: { report: PrivateDiligenceReport; locale: DiligenceLocale }) {
  const composition = useMemo(() => composeAdaptiveReport(report), [report]);
  const zh = locale === 'zh';
  const extra = (report.adaptiveResearch?.coverage ?? []).filter(c => ['customers', 'partnerships', 'pricing', 'security'].includes(c.topic)).map(c => ({ id: c.topic, status: (['company-reported', 'independently-reported'].includes(c.status) ? 'supported' : c.status) as CoverageStatus }));
  const targetRows = (report.adaptiveResearch?.targets ?? []).filter(target => ['legal_entity', 'sec_filings', 'government_activity'].includes(target.targetId)).map(target => ({ id: target.targetId, status: ({ supported: 'supported', not_researched: 'not-researched', source_unavailable: 'source-unavailable', searched_not_found: 'searched-not-found', entity_unresolved: 'partial', discovered: 'partial', stopped: 'partial' } as const)[target.status] }));
  const limitations = [...new Set([...composition.data.coverage.flatMap(c => [...c.gaps, ...c.limitations]), ...(report.methodologyLimitationsByLocale?.[locale] ?? report.methodologyLimitations ?? [])])];
  return <footer className="clara-research-footer">
    <h2>{reportModuleTitle('coverage', locale)}</h2>
    <dl className="clara-compact-coverage">{[...composition.data.coverage, ...extra, ...targetRows].map(item => <div key={item.id}><dt>{COVERAGE[item.id]?.[zh ? 1 : 0] ?? item.id}</dt><dd data-status={item.status}>{STATUS[item.status]?.[zh ? 1 : 0] ?? item.status}</dd></div>)}</dl>
    <p className="clara-visual-note">{zh ? '未开展专项研究：所有权 · 收入 · 知识产权 · 诉讼。缺少证据不代表不存在。' : 'Not researched in depth: ownership · revenue · IP · litigation. Missing evidence is not evidence of absence.'}</p>
    {limitations.length > 0 && <details><summary>{zh ? '研究限制' : 'Research limitations'} ({limitations.length})</summary><ul>{limitations.map(text => <li key={text}>{text}</li>)}</ul></details>}
    {report.references.length > 0 && <details className="clara-source-register"><summary>{zh ? '证据与来源' : 'Evidence and Sources'} ({report.references.length})</summary><ol className="clara-reference-list">{report.references.map(reference => {
      const page = report.evidence.find(e => e.evidenceId === reference.evidenceId); const url = visualSourceUrl(reference.sourceUrl);
      const attribution = page?.officialRecord ? zh ? '官方记录' : 'Official record' : page?.companyReported ? zh ? '公司自行披露' : 'Company-reported' : zh ? '独立来源' : 'Independent source';
      return <li key={reference.evidenceId}>{url ? <a href={url} target="_blank" rel="noreferrer">{reference.sourceTitle}</a> : reference.sourceTitle}<span>{attribution} · {reference.publicationDate ?? reference.retrievedAt.slice(0, 10)}</span></li>;
    })}</ol></details>}
  </footer>;
}
