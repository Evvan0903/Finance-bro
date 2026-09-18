import type { BarDatum, VisualSource } from './lib/private-diligence/reports/claraVisualization';
import type { DiligenceLocale } from './lib/private-diligence/types';

const ATTRIBUTION = {
  'company-reported': ['Company-reported', '公司自行披露'],
  'independently-reported': ['Independently reported', '独立来源报道'],
  'official-record': ['Official record', '官方记录'],
  unverified: ['Unverified', '未验证'],
};
export function ClaraVisualSource({ source, locale }: { source: VisualSource; locale: DiligenceLocale }) {
  const zh = locale === 'zh';
  return <div className="clara-visual-source">
    <span>{ATTRIBUTION[source.attribution][zh ? 1 : 0]}</span>{' · '}
    {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : <span>{zh ? '来源链接不可用' : 'Source link unavailable'}</span>}
    <details><summary>{zh ? '查看证据' : 'View evidence'}</summary>
      {source.excerpt && <blockquote>{source.excerpt}</blockquote>}<small>{source.evidenceId}</small>
    </details>
  </div>;
}
const LABELS: Record<string, string> = { Engineering: '工程', Product: '产品', 'Data / AI': '数据 / AI', Sales: '销售', Marketing: '市场', Finance: '财务', Operations: '运营', 'HR / People': '人力资源', 'Legal / Compliance': '法务 / 合规', 'Customer Success': '客户成功', Security: '安全', Other: '其他', Unknown: '未知', 'Other locations': '其他地点', 'Remote indicated': '注明远程', 'Remote not indicated': '未注明远程', Intern: '实习', Entry: '初级', Mid: '中级', Senior: '高级', Lead: '主管', Manager: '经理', Director: '总监', VP: '副总裁', Executive: '高管' };
export function ClaraCountBars({ title, rows, locale }: { title: string; rows: BarDatum[]; locale: DiligenceLocale }) {
  const max = Math.max(1, ...rows.map(r => r.count));
  return <div className="clara-count-chart"><h4>{title}</h4>{rows.length ? <ul>{rows.map(row => <li key={row.label}>
    <div><span>{locale === 'zh' ? LABELS[row.label] ?? row.label : row.label}</span><strong>{row.count}</strong></div>
    <div className="clara-count-track" aria-hidden="true"><span style={{ width: `${row.count / max * 100}%` }} /></div>
  </li>)}</ul> : <p className="clara-visual-note">{locale === 'zh' ? '暂无结构化分类' : 'No structured classifications available'}</p>}</div>;
}
