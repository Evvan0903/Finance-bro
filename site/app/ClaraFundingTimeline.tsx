import type { FundingObservation, FundingTimelineData } from './lib/private-diligence/reports/claraVisualization';
import type { DiligenceLocale } from './lib/private-diligence/types';
import { ClaraVisualSource } from './ClaraResearchVisualPrimitives';

const FIELDS: Record<string, [string, string]> = {
  roundLabel: ['Round', '轮次'], amount: ['Amount', '金额'], currency: ['Currency', '币种'], amountMeaning: ['Amount meaning', '金额口径'],
  valuation: ['Valuation', '估值'], valuationCurrency: ['Valuation currency', '估值币种'], valuationBasis: ['Valuation basis', '估值口径'], financingType: ['Financing type', '融资类型'],
  eventStatus: ['Event status', '事件状态'], eventDate: ['Event date', '事件日期'], dateMeaning: ['Date meaning', '日期口径'],
  offeringAmount: ['Offering total (USD)', '发行总额（USD）'], amountSold: ['Amount sold (USD)', '已售金额（USD）'], firstSaleDate: ['First sale date', '首次出售日期'], filingDate: ['Filing date', '申报日期'],
};
const VALUES: Record<string, [string, string]> = { current_round: ['Current round amount', '该轮金额'], cumulative: ['Cumulative funding', '累计融资'], offering_total: ['Offering total', '发行总额'], amount_sold: ['Amount sold', '已售金额'], pre_money: ['Pre-money', '投前'], post_money: ['Post-money', '投后'], unspecified: ['Unspecified', '未说明'], unknown: ['Unknown', '未知'], announced: ['Announced', '已公告'], planned: ['Planned', '计划中'], closed: ['Closed', '已完成'], equity: ['Equity', '股权'], debt: ['Debt', '债务'], mixed: ['Mixed', '混合'], lead: ['Lead', '领投'], participant: ['Participant', '参与'], first_sale: ['First sale', '首次出售'], filing: ['Filed', '申报'], announcement: ['Announced', '公告'], closing: ['Closed', '完成'], event: ['Event date', '事件日期'] };
function fieldLabel(key: string, zh: boolean) {
  if (/^investorRole\d+$/.test(key)) return `${zh ? '投资人角色' : 'Investor role'} ${key.replace('investorRole', '')}`;
  if (/^investor\d+$/.test(key)) return `${zh ? '投资人' : 'Investor'} ${key.replace('investor', '')}`;
  return FIELDS[key]?.[zh ? 1 : 0] ?? key;
}
function display(value: string | number, zh: boolean) {
  return typeof value === 'number' ? value.toLocaleString(zh ? 'zh-CN' : 'en-US', { maximumFractionDigits: 10 }) : VALUES[value]?.[zh ? 1 : 0] ?? value;
}
function Observation({ item, locale }: { item: FundingObservation; locale: DiligenceLocale }) {
  const zh = locale === 'zh';
  return <li className={`clara-funding-observation${item.conflicting ? ' is-conflicting' : ''}`} data-pdf-block>
    <div className="clara-funding-date"><i aria-hidden="true" />{item.date ? <span>{VALUES[item.dateMeaning ?? 'event']?.[zh ? 1 : 0] ?? item.dateMeaning} · <time dateTime={item.date}>{item.date}</time></span> : <span>{zh ? '事件日期未知' : 'Event date unknown'}</span>}</div>
    <h4>{item.kind === 'offering' ? 'SEC Form D / D-A' : item.kind === 'cumulative' ? zh ? '累计融资披露' : 'Cumulative funding observation' : item.round ?? (zh ? '融资披露' : 'Financing observation')}</h4>
    {item.latestDated && <span className="clara-status-chip" data-status="supported">{zh ? '最新已知日期的轮次披露' : 'Latest dated round observation'}</span>}
    {item.conflicting && <p className="clara-visual-warning">{zh ? '⚠ 来源存在冲突，数值尚未解决' : '⚠ Conflicting evidence; values remain unresolved'}</p>}
    {item.publishedAt && <p className="clara-visual-note">{zh ? '来源发布' : 'Source published'}: <time dateTime={item.publishedAt}>{item.publishedAt}</time></p>}
    <dl>{item.fields.filter(f => ['amount', 'offeringAmount', 'amountSold', 'valuation'].includes(f.key)).map(f => <div className="clara-funding-value" key={f.key}><dt>{fieldLabel(f.key, zh)}</dt><dd>{display(f.value, zh)}<small>{f.key === 'amount' || f.key === 'valuation' ? String(item.fields.find(c => c.key === (f.key === 'amount' ? 'currency' : 'valuationCurrency'))?.value ?? (zh ? '币种未知' : 'Currency unknown')) : 'USD'}</small></dd></div>)}</dl>
    {!item.fields.some(f => f.key === 'valuation') && <p className="clara-visual-note">{zh ? '估值未知' : 'Valuation unknown'}</p>}
    {!item.fields.some(f => f.key === 'valuationBasis') && <p className="clara-visual-note">{zh ? '估值口径未知' : 'Valuation basis unknown'}</p>}
    <dl className="clara-funding-attributes">{item.fields.filter(f => ['financingType', 'amountMeaning', 'eventStatus', 'valuationBasis'].includes(f.key) || /^investor\d+$/.test(f.key)).map(f => <div key={f.key}><dt>{fieldLabel(f.key, zh)}</dt><dd>{display(f.value, zh)}</dd></div>)}</dl>
    <details className="clara-field-evidence"><summary>{zh ? '字段与来源' : 'Fields & sources'} ({item.fields.length})</summary>{item.fields.map(f => <div key={f.key}><strong>{fieldLabel(f.key, zh)}: {display(f.value, zh)}</strong><ClaraVisualSource source={f.source} locale={locale} /></div>)}
      {item.limitations.map(text => <p key={text}>{text}</p>)}
    </details>
  </li>;
}
export function ClaraFundingTimeline({ data, locale }: { data: FundingTimelineData; locale: DiligenceLocale }) {
  const zh = locale === 'zh';
  const groups = [
    { id: 'financings', title: zh ? '融资轮次披露' : 'Financing observations', items: data.financings },
    { id: 'cumulative', title: zh ? '累计融资（非单轮融资）' : 'Cumulative funding — separate from rounds', items: data.cumulative },
    { id: 'offerings', title: zh ? '发行申报（不代表已完成融资）' : 'Offering filings — not completed financing', items: data.offerings },
    { id: 'unclassified', title: zh ? '金额口径未明确的披露' : 'Observations with unspecified amount meaning', items: data.unclassified },
  ];
  return <article className="clara-visual-card clara-funding-timeline" aria-label={zh ? '融资时间线' : 'Funding timeline'}>
    <header><h3>{zh ? '融资时间线' : 'Funding Timeline'}</h3><p>{zh ? '独立保留来源披露；不推断当前融资阶段' : 'Source observations; no current funding stage inferred'}</p></header>
    {!groups.some(g => g.items.length) && <p className="clara-visual-empty">{zh ? '本次研究未识别到有证据支持的融资记录。' : 'No supported financing records were identified in this research run.'}</p>}
    {groups.filter(g => g.items.length).map(group => <section key={group.id}><h4 className="clara-timeline-group-title">{group.title}</h4><ol className="clara-funding-rail">{group.items.map(item => <Observation key={item.id} item={item} locale={locale} />)}</ol></section>)}
    {groups.some(g => g.items.length) && <p className="clara-visual-note">{zh ? '仅对已知事件日期排序；无日期记录不推断顺序。卡片间距不代表时间间隔。同一轮的不同来源不会自动合并或相加。' : 'Only known event dates establish order; undated records remain unordered. Spacing is not elapsed time. Source statements are not automatically merged or summed.'}</p>}
    {data.omittedFields > 0 && <p className="clara-visual-warning">{zh ? '部分字段缺少可关联的报告证据，未用于图示。' : 'Some fields lack linked report evidence and were excluded from the visualization.'}</p>}
  </article>;
}
