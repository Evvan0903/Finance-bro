import { classifyKeyRoleTitle } from '../hiring/core';
import type { DiligenceLocale, PrivateDiligenceReport, ReportSection } from '../types';
import { buildClaraVisualizationData, visualSourceUrl, type FundingObservation, type FundingTimelineData, type HiringVisualizationData, type RecentDevelopment, type VisualSource } from './claraVisualization';

export type PresentationMode = 'visualization' | 'full' | 'compact' | 'status_only' | 'hidden';
export type ReportModuleId = 'overview' | 'funding' | 'hiring' | 'recent' | 'products' | 'people' | 'relationships' | 'pricing' | 'security' | 'government';
export type FactualItem = { id: string; text: string; claimIds: string[]; sources: VisualSource[]; historical?: boolean };
export type ModulePresentation = { id: ReportModuleId; mode: PresentationMode; recordCount: number; reason: string };
export type KeyFinding = FactualItem & { domain: ReportModuleId; supportingJobIds?: string[]; supportingEvidenceIds?: string[] };
export type ReportPresentation = { version: 1; title: string; modules: ModulePresentation[]; keyFindings: KeyFinding[] };
const unique = <T,>(values: T[]) => [...new Set(values)];
const sourceKey = (source: VisualSource) => `${source.evidenceId}\u0000${source.url ?? ''}\u0000${source.recordId ?? ''}`;
const norm = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const legacySupported = new Set(['Verified', 'Corroborated', 'CompanyReported', 'PubliclyReported']);
export function confirmedCompanyTitle(report: PrivateDiligenceReport) {
  return report.entity.confirmedDisplayName?.trim() || report.entity.canonicalName;
}
/** Presentation quality only: excluded copy remains in the approved claim/audit registry. */
export function rankOverviewItems(items: FactualItem[], companyName: string): FactualItem[] {
  const isPromotion = (text: string) => /[?？]/.test(text)
    || /(?:^|[.!]\s+)(?:apply|join|sign up|start|get started|try|discover|explore|unlock|boost|grow|build|accelerate|simplify|transform|take control|learn|cultivate|see|read|browse|book|schedule)\b/i.test(text)
    || /\b(?:apply in|sign up|join [\d,]+|get started|book a demo|start (?:your |a )?free|try (?:it |us )?for free)\b/i.test(text)
    || /\b(?:everything you|all you need|built for (?:you|your)|your (?:business|money|team)|the future of)\b/i.test(text)
    || /\b(?:we[’']re|we are) (?:always )?looking for\b/i.test(text)
    || /(?:立即申请|立即注册|免费试用|预约演示|马上加入)/.test(text);
  const score = (item: FactualItem) => {
    const text = item.text, words = norm(text).split(' ').length;
    return (norm(text).includes(norm(companyName)) ? 3 : 0)
      + (/\b(?:is an?|provides?|offers?|develops?|operates?|founded|headquartered|serves?|specializes?|platform for|software for|company that)\b/i.test(text) ? 5 : 0)
      + (/\b(?:not a bank|subsidiary|incorporated|founded in|headquartered in)\b/i.test(text) ? 2 : 0)
      + (words >= 8 && words <= 70 ? 2 : 0) + (item.sources.some(source => source.excerpt) ? 1 : 0);
  };
  return items.filter(item => !isPromotion(item.text)).sort((a, b) => score(b) - score(a));
}
export function legalRelationshipLabel(value: string, locale: DiligenceLocale) {
  const labels: Record<string, [string, string]> = {
    legal_entity: ['Legal entity', '法律实体'], primaryOperatingEntity: ['Primary operating company', '主要经营主体'],
    primary_operating_entity: ['Primary operating company', '主要经营主体'], parent: ['Parent company', '母公司'],
    subsidiary: ['Subsidiary', '子公司'], lendingEntity: ['Lending entity', '贷款业务实体'], lending: ['Lending entity', '贷款业务实体'],
    advisoryEntity: ['Advisory entity', '顾问业务实体'], advisory: ['Advisory entity', '顾问业务实体'],
    fundOrSpv: ['Fund / SPV', '基金 / 特殊目的实体'], fundSpv: ['Fund / SPV', '基金 / 特殊目的实体'], unknown: ['Relationship unresolved', '关联尚未确认'],
  };
  return labels[value]?.[locale === 'zh' ? 1 : 0] ?? (locale === 'zh' ? '主体关联' : value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' '));
}
function richFundingObservation(events: FundingObservation[]) {
  const field = (event: FundingObservation, key: string) => event.fields.find(field => field.key === key);
  const metric = (event: FundingObservation, key: string, currency?: string) => typeof field(event, key)?.value === 'number' && (!currency || Boolean(field(event, currency)?.value));
  const score = (event: FundingObservation) => (event.date ? 3 : 0) + (event.round ? 1 : 0)
    + (metric(event, 'amount', 'currency') ? 7 : 0) + (metric(event, 'valuation', 'valuationCurrency') ? 4 : 0)
    + (metric(event, 'amountSold') ? 6 : 0) + (metric(event, 'offeringAmount') ? 3 : 0);
  return events.filter(event => !event.conflicting && (event.date || metric(event, 'amount', 'currency') || metric(event, 'valuation', 'valuationCurrency') || metric(event, 'amountSold') || metric(event, 'offeringAmount')))
    .sort((a, b) => score(b) - score(a) || (b.date ?? '').localeCompare(a.date ?? ''))[0];
}
function decision(id: ReportModuleId, count: number, rich: boolean, attempted: boolean, reason: string): ModulePresentation {
  return { id, mode: count ? rich ? 'visualization' : 'compact' : attempted ? 'status_only' : 'hidden', recordCount: count, reason };
}
export function chooseFundingPresentation(data: FundingTimelineData, attempted = false): ModulePresentation {
  const all = [...data.financings, ...data.cumulative, ...data.offerings, ...data.unclassified];
  // Several statements about one round, or amendments of one offering, do not manufacture a timeline.
  const meaningful = unique(data.financings.filter(e => e.date && !e.conflicting).map(e => `${e.date}:${norm(e.round ?? '')}`));
  const result = decision('funding', all.length, meaningful.length >= 3, attempted, meaningful.length >= 3 ? 'three_distinct_dated_financing_observations' : all.length ? 'supported_financing_summary' : 'no_supported_financing_records');
  if (all.length >= 3 && result.mode === 'compact') result.mode = 'full';
  return result;
}
export function chooseHiringPresentation(data: HiringVisualizationData, careersUrl?: string | null): ModulePresentation {
  if (data.jobs.length) return decision('hiring', data.jobs.length, data.jobs.length >= 8 && data.functions.some(row => !['Unknown', 'Other'].includes(row.label)), true, data.jobs.length >= 8 ? 'structured_posting_distribution' : 'few_observed_postings');
  if (careersUrl || data.status === 'zero') return { id: 'hiring', mode: 'compact', recordCount: 0, reason: careersUrl ? 'confirmed_careers_source_only' : 'successful_zero_snapshot' };
  return decision('hiring', 0, false, data.status !== 'not-researched', 'no_supported_postings');
}
export function chooseRecentDevelopmentsPresentation(items: RecentDevelopment[], attempted = false) {
  return decision('recent', items.length, items.length >= 3 && items.filter(item => item.publishedAt).length >= 3, attempted, items.length >= 3 ? 'dated_source_developments' : 'sparse_source_developments');
}
export function choosePeoplePresentation(items: FactualItem[], attempted = false): ModulePresentation {
  return { ...decision('people', items.length, false, attempted, 'source_attributed_people'), mode: items.length >= 4 ? 'full' : items.length ? 'compact' : attempted ? 'status_only' : 'hidden' };
}
export function chooseRelationshipPresentation(items: FactualItem[], attempted = false): ModulePresentation {
  return { ...decision('relationships', items.length, false, attempted, 'attributable_relationship_statements'), mode: items.length >= 4 ? 'full' : items.length ? 'compact' : attempted ? 'status_only' : 'hidden' };
}
export function supportedReportItems(report: PrivateDiligenceReport, types: string[]): FactualItem[] {
  const evidence = new Map(report.evidence.filter(e => e.entityId === report.entity.entityId && (!e.verification || e.verification.status === 'verified') && ['supportingEvidence', 'finalEvidence'].includes(e.verificationEligibility)).map(e => [e.evidenceId, e]));
  const claims = report.claims.filter(c => c.entityId === report.entity.entityId && types.includes(c.claimType) && (c.verification ? c.verification.status === 'verified' : legacySupported.has(c.status)) && !c.conflictingEvidenceIds?.length);
  const items = claims.flatMap((claim): FactualItem[] => {
    const sources = claim.evidenceIds.flatMap(id => {
      const page = evidence.get(id); if (!page) return [];
      const audited = report.verification?.findings.find(finding => finding.claimId === claim.claimId && finding.entityId === report.entity.entityId && finding.verification.status === 'verified')?.sources.find(source => source.evidenceId === id && source.excerpt.trim());
      const structured = report.structuredRecords?.find(record => record.claimIds.includes(claim.claimId) && record.entityId === report.entity.entityId && record.verification.status === 'verified')?.sources.find(source => source.evidenceId === id && source.excerpt.trim());
      const candidate = page.factCandidates?.find(candidate => candidate.value === claim.normalizedValue && candidate.excerpt);
      const excerpt = claim.researchFact?.evidenceId === id ? claim.researchFact.excerpt : audited?.excerpt ?? structured?.excerpt ?? candidate?.excerpt ?? null;
      return [{ evidenceId: id, title: page.sourceTitle, url: visualSourceUrl(page.sourceUrl), excerpt, attribution: page.companyReported ? 'company-reported' as const : page.officialRecord ? 'official-record' as const : page.independentlyPublished ? 'independently-reported' as const : 'unverified' as const }];
    });
    const value = claim.researchFact?.value ?? (['award', 'awardAgency', 'awardAmount'].includes(claim.claimType) ? claim.statement : typeof claim.normalizedValue === 'string' ? claim.normalizedValue : null);
    if (!value?.trim() || !sources.length) return [];
    return [{ id: claim.claimId, text: value.trim(), claimIds: [claim.claimId], sources, historical: claim.claimType === 'formerExecutiveRole' || report.verification?.findings.some(f => f.claimId === claim.claimId && f.temporalContext === 'historical') }];
  });
  const dedup = new Map<string, FactualItem>();
  for (const item of items) { const key = norm(item.text); const previous = dedup.get(key); if (previous) { previous.claimIds = unique([...previous.claimIds, ...item.claimIds]); previous.sources = [...new Map([...previous.sources, ...item.sources].map(source => [sourceKey(source), source])).values()]; } else dedup.set(key, item); }
  return [...dedup.values()];
}
export function supportedLegalEntities(report: PrivateDiligenceReport) {
  const claims = supportedReportItems(report, ['legalName']).filter(item => norm(item.text) !== norm(confirmedCompanyTitle(report)));
  const candidates = report.verification?.findings.filter(f => f.entityId === report.entity.entityId && f.domain === 'identity' && f.label.startsWith('Legal entity relationship:') && f.verification.status !== 'rejected' && f.sources.length && typeof f.value === 'string') ?? [];
  return [...new Map([...claims.map(item => ({ name: item.text, status: 'verified' as const, relationship: 'legal_entity', sourceUrl: item.sources[0]?.url ?? null })), ...candidates.map(f => ({ name: String(f.value), status: f.verification.status, relationship: f.label.replace('Legal entity relationship: ', ''), sourceUrl: visualSourceUrl(f.sources[0].sourceUrl) }))].filter(item => norm(item.name) !== norm(confirmedCompanyTitle(report))).map(item => [norm(item.name), item])).values()];
}
function attempted(report: PrivateDiligenceReport, topics: string[]) {
  return Boolean(report.adaptiveResearch?.coverage.some(c => topics.includes(c.topic) && c.status !== 'not-researched'));
}
export function composeAdaptiveReport(report: PrivateDiligenceReport) {
  const data = buildClaraVisualizationData(report);
  const items = {
    overview: supportedReportItems(report, ['description', 'research.overview']),
    products: supportedReportItems(report, ['product', 'service', 'research.products']),
    people: supportedReportItems(report, ['founder', 'executive', 'executiveRole', 'formerExecutiveRole', 'research.people']),
    relationships: supportedReportItems(report, ['customer', 'partner', 'research.customers', 'research.partnerships']),
    pricing: supportedReportItems(report, ['research.pricing', 'pricing']),
    security: supportedReportItems(report, ['research.security', 'certification']),
    government: supportedReportItems(report, ['award', 'awardAgency', 'awardAmount']),
  };
  for (const record of report.structuredRecords ?? []) {
    if (record.entityId !== report.entity.entityId || record.verification.status !== 'verified') continue;
    const domain = record.kind === 'product' ? 'products' : record.kind === 'person_role' ? 'people' : ['customer_evidence', 'partnership_evidence'].includes(record.kind) ? 'relationships' : record.kind === 'source_observation' ? record.topic : null;
    if (!domain || !(domain in items)) continue;
    const sources: VisualSource[] = record.sources.filter(source => source.excerpt && report.evidence.some(e => e.evidenceId === source.evidenceId && e.entityId === report.entity.entityId && (!e.verification || e.verification.status === 'verified'))).map(source => {
      const page = report.evidence.find(e => e.evidenceId === source.evidenceId)!;
      return { evidenceId: source.evidenceId, url: visualSourceUrl(source.sourceUrl), title: source.title, excerpt: source.excerpt, attribution: page.companyReported ? 'company-reported' : page.officialRecord ? 'official-record' : 'independently-reported' };
    });
    if (!sources.length) continue;
    const list = items[domain as keyof typeof items];
    const existing = list.findIndex(item => item.claimIds.some(id => record.claimIds.includes(id)) || norm(item.text) === norm(record.statement));
    const item: FactualItem = { id: record.recordId, text: record.statement, claimIds: record.claimIds, sources, historical: record.kind === 'person_role' && record.temporalContext === 'historical' };
    if (existing >= 0) list[existing] = item; else list.push(item);
  }
  items.overview = rankOverviewItems(items.overview, confirmedCompanyTitle(report));
  const source = report.hiringIntelligence?.selectedSource;
  // This is only a source link. It must never imply a posting count or successful retrieval.
  const careersUrl = source && ['linked_from_website', 'confirmed_source'].includes(source.discoveryMethod) && report.hiringIntelligence?.verification?.status !== 'rejected' ? visualSourceUrl(source.url) : null;
  const modules: ModulePresentation[] = [
    decision('overview', items.overview.length, false, attempted(report, ['overview']), 'supported_company_description'),
    chooseFundingPresentation(data.funding, Boolean(report.fundingResearch && [report.fundingResearch.announcementStatus, report.fundingResearch.secStatus].some(s => s !== 'not_performed'))),
    chooseHiringPresentation(data.hiring, careersUrl),
    chooseRecentDevelopmentsPresentation(data.recent, attempted(report, ['recent'])),
    decision('products', items.products.length, false, attempted(report, ['products']), 'supported_product_records'),
    choosePeoplePresentation(items.people, attempted(report, ['people'])),
    chooseRelationshipPresentation(items.relationships, attempted(report, ['customers', 'partnerships'])),
    decision('pricing', items.pricing.length, false, attempted(report, ['pricing']), 'explicit_public_pricing'),
    decision('security', items.security.length, false, attempted(report, ['security']), 'supported_compliance_statements'),
    decision('government', items.government.length, false, Boolean(report.adaptiveResearch?.targets?.some(target => target.targetId === 'government_activity' && target.status !== 'not_researched')), 'verified_official_award_statements'),
  ];
  const keyFindings: KeyFinding[] = [];
  const funding = richFundingObservation([...data.funding.financings, ...data.funding.cumulative, ...data.funding.offerings]);
  if (funding) {
    const field = (key: string) => funding.fields.find(f => f.key === key);
    const amount = field(funding.kind === 'offering' ? field('amountSold') ? 'amountSold' : 'offeringAmount' : 'amount');
    const label = funding.kind === 'offering' ? field('amountSold') ? 'Form D amount sold' : 'Form D offering total' : funding.kind === 'cumulative' ? 'Reported cumulative funding' : funding.round ?? 'Financing disclosure';
    const currency = funding.kind === 'offering' ? 'USD' : field('currency')?.value;
    const value = (value: string | number) => typeof value === 'number' ? value.toLocaleString('en-US') : value;
    const valuation = field('valuation'), valuationCurrency = field('valuationCurrency');
    const dateLabel = ({ first_sale: 'first sale', filing: 'filed', announcement: 'announced', closing: 'closed', event: 'event date' } as Record<string, string>)[funding.dateMeaning ?? 'event'] ?? 'event date';
    const text = `${label}${amount ? ` · ${currency ?? 'currency not established'} ${value(amount.value)}` : ''}${valuation && valuationCurrency ? ` · reported valuation ${valuationCurrency.value} ${value(valuation.value)}` : ''}${funding.date ? ` · ${dateLabel} ${funding.date}` : ''}`;
    // One evidence record can contain an original filing and separately sourced submissions metadata.
    // Preserve that URL boundary and put the displayed amount's original document first.
    const sourceFields = [...(amount ? [amount] : []), ...(valuation ? [valuation] : []), ...funding.fields];
    const sources = [...new Map(sourceFields.map(field => [sourceKey(field.source), field.source])).values()].map(source => ({ ...source,
      excerpt: unique(sourceFields.filter(field => sourceKey(field.source) === sourceKey(source)).map(field => field.source.excerpt).filter((text): text is string => Boolean(text))).join('\n…\n') || null }));
    keyFindings.push({ id: `funding:${funding.id}`, domain: 'funding', text, claimIds: report.claims.filter(c => c.fundingEventId === funding.id).map(c => c.claimId), sources });
  }
  const hiringFinding = (id: string, text: string, jobs: HiringVisualizationData['jobs']): KeyFinding => ({
    id, domain: 'hiring', text, claimIds: [], supportingJobIds: jobs.map(job => job.id), supportingEvidenceIds: unique(jobs.flatMap(job => job.evidenceIds)),
    // Sources reference the actual persisted job record when no normalized evidence copy exists.
    // No synthetic evidence ID or arbitrary representative posting stands in for an aggregate.
    sources: jobs.map(job => ({ evidenceId: job.evidenceIds[0] ?? '', recordId: job.id, url: job.url, title: job.title, excerpt: job.title, attribution: 'company-reported' })),
  });
  if (data.hiring.count !== null && data.hiring.count > 0 && data.hiring.jobs.length === data.hiring.count) keyFindings.push(hiringFinding('hiring:count', `${data.hiring.count} public openings observed at retrieval time`, data.hiring.jobs));
  const hiringRole = data.hiring.roleAnalysis;
  for (const [key, category, text] of [['financeLeadership', 'finance_leadership', 'senior finance leadership opening(s) observed'], ['aiMl', 'ai_ml', 'AI / ML opening(s) observed']] as const) {
    const count = hiringRole.metrics[key];
    const jobs = data.hiring.jobs.filter(job => classifyKeyRoleTitle(job.title).includes(category));
    if (count > 0 && jobs.length === count) keyFindings.push(hiringFinding(`hiring:${key}`, `${count} ${text}`, jobs));
  }
  for (const event of data.recent.filter(event => !event.conflicting).slice(0, 2)) keyFindings.push({ id: event.id, domain: 'recent', text: event.description, claimIds: event.claimIds, sources: event.sources });
  for (const id of ['security', 'pricing', 'overview', 'products', 'relationships', 'people'] as const) {
    const item = items[id].find(item => !item.historical && item.text.length <= 350 && !/^By\s/i.test(item.text) && !/[?？]/.test(item.text) && (id !== 'people' || /\b(?:founder|co-founder|chief|CEO|CFO|CTO|COO|CISO|president|executive|director|head of|VP|vice president|board member)\b|创始人|首席|总裁|董事/i.test(item.text)));
    if (item) keyFindings.push({ ...item, domain: id });
  }
  const selected: KeyFinding[] = [];
  for (const finding of keyFindings) {
    const words = new Set(norm(finding.text).split(' '));
    const duplicate = selected.some(previous => previous.claimIds.some(id => finding.claimIds.includes(id)) || norm(previous.text) === norm(finding.text) || (() => { const other = new Set(norm(previous.text).split(' ')); const common = [...words].filter(word => other.has(word)).length; return words.size >= 8 && other.size >= 8 && common / Math.min(words.size, other.size) >= .85; })());
    if (!duplicate) selected.push(finding);
    if (selected.length === 6) break;
  }
  const presentation: ReportPresentation = { version: 1, title: confirmedCompanyTitle(report), modules, keyFindings: selected };
  return { ...presentation, data, items, careersUrl, legalEntities: supportedLegalEntities(report) };
}
const TITLES: Record<ReportModuleId | 'findings' | 'coverage', [string, string]> = { findings: ['Key Findings', '关键发现'], overview: ['Company Overview', '公司概览'], funding: ['Financing', '融资'], hiring: ['Observed Hiring', '招聘观察'], recent: ['Recent Developments', '近期动态'], products: ['Products / Business', '产品与业务'], people: ['Leadership / Key People', '主要人员'], relationships: ['Customers / Partnerships', '客户与合作伙伴'], pricing: ['Public Pricing', '公开定价'], security: ['Security / Compliance', '安全与合规'], government: ['Government Records', '政府记录'], coverage: ['Research Coverage / Limitations', '研究覆盖与限制'] };
export const reportModuleTitle = (id: keyof typeof TITLES, locale: DiligenceLocale) => TITLES[id][locale === 'zh' ? 1 : 0];
/** Export shares the same density decisions as the browser; no fixed empty category paragraphs. */
export function adaptiveReportSections(report: PrivateDiligenceReport): ReportSection[] {
  const composition = composeAdaptiveReport(report);
  const section = (id: keyof typeof TITLES, lines: string[], ids: string[] = [], evidenceIds: string[] = []): ReportSection => ({ sectionId: id, number: '', title: { en: TITLES[id][0], zh: TITLES[id][1] }, paragraphs: lines, paragraphsByLocale: { en: lines, zh: lines.map(line => line.replace(' (historical role)', '（历史职位）').replace('Observed public openings at retrieval time:', '检索时点观察到的公开职位：').replace('count unavailable', '数量不可用').replace('Careers source:', '招聘来源：')) }, claimIds: ids, evidenceIds });
  const lines = (items: FactualItem[]) => items.map(item => `${item.text}${item.historical ? ' (historical role)' : ''} — ${(item.id.startsWith('hiring:') ? item.sources.slice(0, 3) : item.sources).map(source => source.url).filter(Boolean).join('; ')}${item.id.startsWith('hiring:') && item.sources.length > 3 ? ` (+${item.sources.length - 3} additional linked job records in the report)` : ''}`);
  const sections = composition.keyFindings.length ? [section('findings', lines(composition.keyFindings), composition.keyFindings.flatMap(f => f.claimIds), unique(composition.keyFindings.flatMap(f => f.sources.map(s => s.evidenceId)).filter(Boolean)))] : [];
  for (const panel of composition.modules.filter(m => !['hidden', 'status_only'].includes(m.mode))) {
    if (panel.id in composition.items) { const items = composition.items[panel.id as keyof typeof composition.items]; sections.push(section(panel.id, lines(items), items.flatMap(i => i.claimIds), unique(items.flatMap(i => i.sources.map(s => s.evidenceId))))); }
    else if (panel.id === 'funding') { const events = [...composition.data.funding.financings, ...composition.data.funding.cumulative, ...composition.data.funding.offerings, ...composition.data.funding.unclassified]; sections.push(section('funding', events.map(e => `${e.kind}: ${e.fields.map(f => `${f.key}: ${f.value} [${f.source.url}]`).join('; ')}`), [], unique(events.flatMap(e => e.fields.map(f => f.source.evidenceId))))); }
    else if (panel.id === 'hiring') sections.push(section('hiring', [`Observed public openings at retrieval time: ${composition.data.hiring.count ?? 'count unavailable'}`, ...composition.data.hiring.notableJobs.map(j => `${j.title}${j.location ? ` · ${j.location}` : ''} — ${j.url ?? 'Source unavailable'}`), ...(composition.careersUrl ? [`Careers source: ${composition.careersUrl}`] : [])]));
    else if (panel.id === 'recent') sections.push(section('recent', composition.data.recent.map(e => `${e.description}${e.publishedAt ? ` (source published ${e.publishedAt}; event date not established)` : ''} — ${e.sources.map(s => s.url).filter(Boolean).join('; ')}`), composition.data.recent.flatMap(e => e.claimIds), composition.data.recent.flatMap(e => e.evidenceIds)));
  }
  const coverage = section('coverage', [...composition.data.coverage.map(c => `${c.id}: ${c.status}`), ...(report.methodologyLimitations ?? [])]);
  const labels: Record<string, string> = { identity: '身份', products: '产品', leadership: '主要人员', funding: '融资', hiring: '招聘', recent: '近期动态', customers: '客户', partnerships: '合作关系', pricing: '定价', security: '安全与合规', legal_entity: '法律实体', sec_filings: 'SEC 申报', government_activity: '政府记录' };
  const statuses: Record<string, string> = { supported: '有证据支持', partial: '部分支持', conflicting: '存在冲突', 'source-unavailable': '来源不可用', 'searched-not-found': '已搜索但未找到', 'not-researched': '未研究' };
  coverage.paragraphsByLocale = { en: coverage.paragraphs, zh: [...composition.data.coverage.map(c => `${labels[c.id] ?? c.id}：${statuses[c.status] ?? c.status}`), ...(report.methodologyLimitationsByLocale?.zh ?? report.methodologyLimitations ?? [])] };
  sections.push(coverage);
  return sections;
}
