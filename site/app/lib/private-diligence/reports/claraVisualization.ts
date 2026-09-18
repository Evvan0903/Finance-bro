import type { PrivateDiligenceReport, PrivateCompanyClaim, NormalizedEvidence } from '../types';

export type CoverageStatus = 'supported' | 'partial' | 'conflicting' | 'searched-not-found' | 'source-unavailable' | 'not-researched';
export type Attribution = 'company-reported' | 'independently-reported' | 'official-record' | 'unverified';
export type VisualSource = { evidenceId: string; url: string | null; title: string; excerpt: string | null; attribution: Attribution };
export type VisualField = { key: string; value: string | number; source: VisualSource };
export type FundingObservation = {
  id: string; kind: 'financing' | 'cumulative' | 'offering' | 'unclassified'; fields: VisualField[];
  date: string | null; dateMeaning: string | null; publishedAt: string | null;
  round: string | null; conflicting: boolean; latestDated: boolean; limitations: string[];
};
export type FundingTimelineData = { financings: FundingObservation[]; cumulative: FundingObservation[]; offerings: FundingObservation[]; unclassified: FundingObservation[]; omittedFields: number };
export type BarDatum = { label: string; count: number };
export type HiringVisualizationData = {
  status: 'success' | 'zero' | 'partial' | 'unavailable' | 'not-researched'; count: number | null;
  retrievedDates: string[]; functions: BarDatum[]; locations: BarDatum[]; seniority: BarDatum[]; remote: BarDatum[];
  sources: { url: string | null; retrievedAt: string }[];
  jobs: { id: string; title: string; location: string | null; url: string | null; evidenceIds: string[] }[];
  limitations: string[];
};
export type RecentDevelopment = {
  id: string; claimIds: string[]; evidenceIds: string[]; eventType: 'acquisition' | 'development';
  description: string; eventDate: null; publishedAt: string | null; sources: VisualSource[]; conflicting: boolean;
};
export type CoverageDatum = {
  id: 'identity' | 'products' | 'leadership' | 'funding' | 'hiring' | 'recent'; status: CoverageStatus;
  evidenceIds: string[]; claimIds: string[]; gaps: string[]; limitations: string[];
};

const unique = <T,>(values: T[]) => [...new Set(values)];
const supported = new Set(['Verified', 'Corroborated', 'CompanyReported', 'PubliclyReported', 'Conflicting']);
const eligible = (e: NormalizedEvidence, report: PrivateDiligenceReport) => (!e.verification || e.verification.status==='verified') && e.entityId === report.entity.entityId && ['finalEvidence', 'supportingEvidence'].includes(e.verificationEligibility);
export function visualSourceUrl(value: string): string | null {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function date(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null;
  const day = value.slice(0, 10), parsed = new Date(day + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day ? day : null;
}
function source(e: NormalizedEvidence, excerpt: string | null = null, url = e.sourceUrl): VisualSource {
  return { evidenceId: e.evidenceId, url: visualSourceUrl(url), title: e.sourceTitle, excerpt,
    attribution: e.companyReported ? 'company-reported' : e.officialRecord ? 'official-record' : e.independentlyPublished ? 'independently-reported' : 'unverified' };
}
function indexEvidence(report: PrivateDiligenceReport) {
  return new Map(report.evidence.filter(e => eligible(e, report)).map(e => [e.evidenceId, e]));
}
function usableClaims(report: PrivateDiligenceReport) {
  const evidence = indexEvidence(report);
  return report.claims.filter(c => (!c.verification || c.verification.status==='verified') && c.entityId === report.entity.entityId && supported.has(c.status) && c.evidenceIds.some(id => evidence.has(id)));
}
function isConflicting(report: PrivateDiligenceReport, claims: PrivateCompanyClaim[], ids: string[], matchesType = (type: string) => claims.some(c => c.claimType === type)) {
  return claims.some(c => c.status === 'Conflicting' || c.conflictingEvidenceIds.length > 0) ||
    (report.conflicts ?? []).some(c => matchesType(c.claimType) && c.resolutionStatus !== 'supersededByNewerOfficialRecord' && c.evidenceIds.some(id => ids.includes(id)));
}

/** Projection only: distinct source statements remain distinct. No round/event merging or financial inference. */
export function buildFundingTimelineData(report: PrivateDiligenceReport): FundingTimelineData {
  const evidence = indexEvidence(report), observations: FundingObservation[] = [];
  let omittedFields = 0;
  for (const event of report.fundingResearch?.events ?? []) {
    if (event.entityId !== report.entity.entityId || event.verification && event.verification.status!=='verified') continue;
    const fields = Object.entries(event.fields).flatMap(([key, field]): VisualField[] => {
      if(field.verification && field.verification.status!=='verified')return [];
      const page = evidence.get(field.evidenceId);
      if (!page || !field.excerpt || (typeof field.value === 'number' && !Number.isFinite(field.value))) { omittedFields++; return []; }
      return [{ key, value: field.value, source: source(page, field.excerpt, field.sourceUrl) }];
    });
    if (!fields.some(f => ['amount', 'valuation', 'roundLabel', 'offeringAmount', 'amountSold'].includes(f.key))) continue;
    const field = (key: string) => fields.find(f => f.key === key);
    const ids = fields.map(f => f.source.evidenceId);
    const claims = report.claims.filter(c => c.fundingEventId === event.eventId);
    const datedField = ['eventDate', 'firstSaleDate', 'filingDate'].map(key => field(key)).find(f => f && date(f.value));
    const rawFields = Object.values(event.fields).filter(f => ids.includes(f.evidenceId));
    const published = unique(rawFields.map(f => date(f.publicationDate)).filter((d): d is string => Boolean(d)));
    observations.push({ id: event.eventId,
      kind: event.sourceKind === 'formD' ? 'offering' : field('amountMeaning')?.value === 'cumulative' ? 'cumulative'
        : field('roundLabel') || field('amountMeaning')?.value === 'current_round' ? 'financing' : 'unclassified',
      fields, date: datedField ? date(datedField.value) : null,
      dateMeaning: datedField?.key === 'firstSaleDate' ? 'first_sale' : datedField?.key === 'filingDate' ? 'filing' : datedField ? String(field('dateMeaning')?.value ?? 'event') : null,
      publishedAt: published.length === 1 ? published[0] : null,
      round: typeof field('roundLabel')?.value === 'string' ? String(field('roundLabel')!.value) : null,
      conflicting: isConflicting(report, claims, ids, type => type.startsWith('funding.') || ['offeringAmount', 'amountSold', 'firstSaleDate'].includes(type)), latestDated: false, limitations: [...event.limitations],
    });
  }
  observations.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.id.localeCompare(b.id));
  const financings = observations.filter(e => e.kind === 'financing');
  // Unknown dates never acquire chronological order from round labels or retrieval timestamps.
  const latest = financings.find(e => e.date && e.round && !e.conflicting);
  if (latest && financings.filter(e => e.date === latest.date).length === 1 && !financings.some(e => e.date && e.date > latest.date!)) latest.latestDated = true;
  return { financings, cumulative: observations.filter(e => e.kind === 'cumulative'), offerings: observations.filter(e => e.kind === 'offering'), unclassified: observations.filter(e => e.kind === 'unclassified'), omittedFields };
}

function counts(labels: string[]): BarDatum[] {
  const counts = new Map<string, number>();
  labels.forEach(label => counts.set(label, (counts.get(label) ?? 0) + 1));
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
export function buildHiringVisualizationData(report: PrivateDiligenceReport): HiringVisualizationData {
  const result = report.hiringIntelligence;
  const empty: HiringVisualizationData = { status: 'not-researched', count: null, retrievedDates: [], functions: [], locations: [], seniority: [], remote: [], sources: [], jobs: [], limitations: [] };
  if (!result) return empty;
  if(result.verification && result.verification.status!=='verified') return {...empty,status:result.verification.status==='rejected'?'unavailable':'partial',limitations:result.verification.reasonCodes};
  if (result.companyId !== report.entity.entityId) return { ...empty, status: 'unavailable' };
  const success = ['success_with_jobs', 'success_zero_jobs'].includes(result.status);
  const partial = result.status === 'partial';
  const jobs = success || partial ? result.jobs.filter(j => j.companyId === report.entity.entityId) : [];
  const consistent = result.summary.totalOpenRoles === jobs.length && (result.status !== 'success_zero_jobs' || jobs.length === 0);
  const sources = result.summary.sources.map(s => ({ url: visualSourceUrl(s.sourceUrl), retrievedAt: s.retrievedAt }));
  const evidence = report.evidence.filter(e => eligible(e, report));
  const locations = counts(jobs.map(j => j.location?.trim() || 'Unknown'));
  return { status: success && consistent ? jobs.length ? 'success' : 'zero' : partial || (success && !consistent) ? 'partial' : 'unavailable',
    count: success && consistent ? result.summary.totalOpenRoles : null,
    retrievedDates: unique([...sources.map(s => date(s.retrievedAt)), ...jobs.map(j => date(j.retrievedAt))].filter((d): d is string => Boolean(d))).sort(),
    functions: counts(jobs.map(j => j.function ?? 'Unknown')), seniority: counts(jobs.map(j => j.seniority ?? 'Unknown')),
    locations: locations.length > 6 ? [...locations.slice(0, 5), { label: 'Other locations', count: locations.slice(5).reduce((n, r) => n + r.count, 0) }] : locations,
    // Existing adapters may set false simply because “remote” was absent. Do not label it on-site.
    remote: counts(jobs.map(j => j.remote === true ? 'Remote indicated' : j.remote === false ? 'Remote not indicated' : 'Unknown')),
    sources, jobs: jobs.map(j => ({ id: j.id, title: j.title, location: j.location ?? null, url: visualSourceUrl(j.sourceUrl), evidenceIds: evidence.filter(e => e.normalizedFields.jobId === j.id || e.sourceUrl === j.sourceUrl).map(e => e.evidenceId) })),
    limitations: unique([...result.limitations, ...result.summary.limitations, ...result.failures.map(f => f.reason), ...(!consistent && success ? ['Stored role count and normalized jobs differ; total is unavailable.'] : [])]),
  };
}

export function buildRecentDevelopmentTimelineData(report: PrivateDiligenceReport): RecentDevelopment[] {
  const evidence = indexEvidence(report);
  return usableClaims(report).filter(c => ['research.recent', 'businessActivity', 'acquisition'].includes(c.claimType)).flatMap(c => {
    const description = c.researchFact?.value ?? (typeof c.normalizedValue === 'string' ? c.normalizedValue : null);
    if (!description?.trim()) return [];
    const pages = c.evidenceIds.flatMap(id => evidence.has(id) ? [evidence.get(id)!] : []);
    const dates = unique(pages.map(p => date(p.publicationDate)).filter((d): d is string => Boolean(d)));
    return [{ id: c.claimId, claimIds: [c.claimId], evidenceIds: pages.map(e => e.evidenceId), eventType: c.claimType === 'acquisition' ? 'acquisition' as const : 'development' as const,
      description, eventDate: null, publishedAt: dates.length === 1 ? dates[0] : null,
      sources: pages.map(p => source(p, c.researchFact?.evidenceId === p.evidenceId ? c.researchFact.excerpt : null)), conflicting: isConflicting(report, [c], pages.map(p => p.evidenceId)) }];
  }).sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') || a.id.localeCompare(b.id));
}

const categories: Record<CoverageDatum['id'], string[]> = {
  identity: ['legalName'], products: ['product', 'service', 'research.products'], leadership: ['founder', 'executive', 'executiveRole', 'research.people'],
  funding: ['funding.', 'offeringAmount', 'amountSold', 'firstSaleDate'], hiring: ['job', 'hiring'], recent: ['businessActivity', 'acquisition', 'research.recent'],
};
export function buildResearchCoverageData(report: PrivateDiligenceReport): CoverageDatum[] {
  const evidence = indexEvidence(report), claims = usableClaims(report), funding = buildFundingTimelineData(report), hiring = buildHiringVisualizationData(report);
  return (Object.keys(categories) as CoverageDatum['id'][]).map(id => {
    const matches = (type: string) => categories[id].some(t => t.endsWith('.') ? type.startsWith(t) : type === t);
    const selected = claims.filter(c => matches(c.claimType));
    const allSelected = report.claims.filter(c => c.entityId === report.entity.entityId && matches(c.claimType));
    const ids = unique(allSelected.flatMap(c => c.evidenceIds).filter(id => evidence.has(id)));
    const gaps = (report.informationGaps ?? []).filter(g => g.category.toLowerCase() === id || g.affectedClaims.some(cid => allSelected.some(c => c.claimId === cid))).map(g => g.missingInformation);
    const limitations = unique(selected.flatMap(c => c.limitations));
    const adaptive = report.adaptiveResearch?.coverage.find(c => c.topic === ({ products: 'products', leadership: 'people', recent: 'recent' } as Record<string, string>)[id]);
    let status: CoverageStatus = selected.length ? 'supported' : allSelected.length ? 'partial' : 'not-researched';
    if (adaptive) status = ['company-reported', 'independently-reported'].includes(adaptive.status) ? selected.length ? 'supported' : 'partial' : adaptive.status as CoverageStatus;
    if (selected.length && ['searched-not-found', 'source-unavailable', 'not-researched'].includes(status)) status = 'partial';
    if (id === 'identity') {
      status = report.entity.identityVerificationStatus === 'verified' ? 'supported' : report.entity.targetSelectionStatus === 'userSelected' ? 'partial' : 'not-researched';
      limitations.push(...(report.entity.identityLimitations ?? []));
    }
    if (id === 'funding' && report.fundingResearch) {
      const f = report.fundingResearch, hasData = funding.financings.length + funding.offerings.length + funding.cumulative.length + funding.unclassified.length > 0;
      const states = [f.announcementStatus, f.secStatus];
      const unavailable = states.some(s => s === 'inaccessible' || s === 'budget_exhausted');
      const incomplete = states.some(s => s === 'partial' || s === 'issuer_unresolved');
      gaps.push(...f.gaps); limitations.push(...f.limitations);
      // One empty search must not conceal a failed or unresolved parallel path.
      status = hasData ? f.gaps.length || unavailable || incomplete ? 'partial' : 'supported'
        : unavailable ? 'source-unavailable' : incomplete ? 'partial'
        : states.includes('no_information') ? 'searched-not-found'
        : states.every(s => s === 'not_performed') ? 'not-researched' : 'partial';
      ids.push(...[...funding.financings, ...funding.cumulative, ...funding.offerings, ...funding.unclassified].flatMap(e => e.fields.map(f => f.source.evidenceId)));
    }
    if (id === 'hiring') {
      status = hiring.status === 'success' || hiring.status === 'zero' ? 'supported' : hiring.status === 'unavailable' ? 'source-unavailable' : hiring.status === 'partial' ? 'partial' : 'not-researched';
      ids.push(...hiring.jobs.flatMap(j => j.evidenceIds)); limitations.push(...hiring.limitations);
    }
    if (gaps.length && status === 'supported') status = 'partial';
    const domain = ({identity:'identity',leadership:'leadership',funding:'funding',hiring:'hiring',recent:'recent'} as Record<string,string>)[id];
    if(report.verification?.findings.some(f=>f.domain===domain&&f.verification.status==='unverified') && !['source-unavailable','conflicting'].includes(status))status='partial';
    if (isConflicting(report, allSelected, ids, matches) || adaptive?.status === 'conflicting') status = 'conflicting';
    return { id, status, evidenceIds: unique(ids), claimIds: allSelected.map(c => c.claimId), gaps: unique(gaps), limitations: unique(limitations) };
  });
}

export function buildClaraVisualizationData(report: PrivateDiligenceReport) {
  return { funding: buildFundingTimelineData(report), hiring: buildHiringVisualizationData(report), recent: buildRecentDevelopmentTimelineData(report), coverage: buildResearchCoverageData(report) };
}
