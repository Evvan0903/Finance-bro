import { adaptiveReportSections } from './adaptiveReportComposer';
import type { ClaimStatus, DiligenceLocale, NormalizedEvidence, PrivateDiligenceReport } from "../types";

export type QuickCoverageId =
  | "overview" | "productsServices" | "leadership" | "hiring"
  | "customers" | "partners" | "recentActivity" | "fundingAcquisitions";

export type QuickEvidenceQualityId =
  | "verified" | "externallySupported" | "partiallyVerified"
  | "managementReported" | "unverified" | "inconsistent";

export type QuickCoverageDatum = {
  id: QuickCoverageId;
  covered: boolean;
  claimCount: number;
  evidenceCount: number;
};

export type QuickEvidenceQualityDatum = { id: QuickEvidenceQualityId; count: number };
export type QuickHiringBreakdown = { label: string; count: number };
export type QuickHiringData = {
  observedRoleLinks: number;
  roleUrls: string[];
  departments: QuickHiringBreakdown[];
  locations: QuickHiringBreakdown[];
  workArrangements: QuickHiringBreakdown[];
  seniority: QuickHiringBreakdown[];
};

export type QuickTimelineItem = {
  evidenceId: string;
  date: string | null;
  eventType: "product" | "partnership" | "customer" | "hiring" | "leadership" | "fundingAcquisition" | "other";
  description: string;
  sourceTitle: string;
  sourceUrl: string;
  evidenceStatus: QuickEvidenceQualityId;
};

export type QuickReportVisualizations = {
  coverage: QuickCoverageDatum[];
  evidenceQuality: QuickEvidenceQualityDatum[];
  hiring: QuickHiringData;
  timeline: QuickTimelineItem[];
};

const COVERAGE_ORDER: QuickCoverageId[] = [
  "overview", "productsServices", "leadership", "hiring",
  "customers", "partners", "recentActivity", "fundingAcquisitions",
];
const QUALITY_ORDER: QuickEvidenceQualityId[] = [
  "verified", "externallySupported", "partiallyVerified",
  "managementReported", "unverified", "inconsistent",
];

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

function stringValues(evidence: NormalizedEvidence[], field: string) {
  return evidence.flatMap((item) => {
    const value = item.normalizedFields[field];
    return Array.isArray(value) ? value : typeof value === "string" && value.trim() ? [value] : [];
  });
}

function evidenceTopics(evidence: NormalizedEvidence) {
  const value = evidence.normalizedFields.searchTopics;
  return Array.isArray(value) ? value : [];
}

function hasField(evidence: NormalizedEvidence, fields: string[]) {
  return fields.some((field) => {
    const value = evidence.normalizedFields[field];
    return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== "";
  });
}

function qualityId(status: ClaimStatus): QuickEvidenceQualityId {
  if (status === "Verified") return "verified";
  if (status === "Corroborated") return "externallySupported";
  if (status === "PubliclyReported") return "partiallyVerified";
  if (status === "CompanyReported") return "managementReported";
  if (status === "Conflicting") return "inconsistent";
  return "unverified";
}

function evidenceQuality(evidence: NormalizedEvidence): QuickEvidenceQualityId {
  if (evidence.officialRecord) return "verified";
  if (evidence.companyReported && evidence.independentlyPublished) return "externallySupported";
  if (evidence.companyReported) return "managementReported";
  if (evidence.independentlyPublished && evidence.entityMatchConfidence !== "Low") return "partiallyVerified";
  return "unverified";
}

function counts(values: string[]): QuickHiringBreakdown[] {
  const output = new Map<string, number>();
  for (const value of values.map((item) => item.trim()).filter(Boolean)) output.set(value, (output.get(value) ?? 0) + 1);
  return [...output].map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function isRoleUrl(value: string) {
  try {
    const url = new URL(value);
    return /(?:greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com)$/i.test(url.hostname)
      && /(?:\/jobs?\/|\/job\/|jobid=|job\/)/i.test(`${url.pathname}${url.search}`);
  } catch {
    return false;
  }
}

function eventType(evidence: NormalizedEvidence): QuickTimelineItem["eventType"] {
  const text = `${evidence.sourceTitle} ${String(evidence.normalizedFields.sourceSummary ?? "")}`.toLowerCase();
  if (/\b(raised|funding round|fundraise|financing round|acquired|acquisition of|merger with)\b/.test(text)) return "fundingAcquisition";
  if (/\b(partnered with|partnership with|strategic partnership|collaboration with|collaborated with)\b/.test(text)) return "partnership";
  if (/\b(selected by|customer announcement|new customer|contract awarded|awarded a contract)\b/.test(text)) return "customer";
  if (/\b(hiring for|now hiring|open roles?|recruiting for)\b/.test(text)) return "hiring";
  if (/\b(appointed|named [^.!]{0,60} as|joins? as|leadership change)\b/.test(text)) return "leadership";
  if (/\b(launched|launches|launch announced|announced [^.!]{0,80}(?:product|service|platform)|released|unveiled|introduced)\b/.test(text)) return "product";
  return "other";
}

function buildCoverage(report: PrivateDiligenceReport): QuickCoverageDatum[] {
  const predicates: Record<QuickCoverageId, (item: NormalizedEvidence) => boolean> = {
    overview: (item) => hasField(item, ["organizationName", "description"]),
    productsServices: (item) => hasField(item, ["products", "services"]),
    leadership: (item) => hasField(item, ["founders", "executives"]),
    hiring: (item) => hasField(item, ["jobTitle"]) || stringValues([item], "links").some(isRoleUrl),
    customers: (item) => hasField(item, ["customers"]),
    partners: (item) => hasField(item, ["partners"]),
    recentActivity: (item) => hasField(item, ["businessActivity"]),
    fundingAcquisitions: (item) => Boolean(item.fundingEvents?.length) || hasField(item, ["offeringAmount", "amountSold", "acquisition"]),
  };
  const claimTypes: Record<QuickCoverageId, string[]> = {
    overview: ["legalName", "description", "research.overview"], productsServices: ["product", "service", "research.products"],
    leadership: ["founder", "executive", "executiveRole", "formerExecutiveRole", "research.people"], hiring: ["job", "hiring"],
    customers: ["customer"], partners: ["partner"], recentActivity: ["businessActivity", "research.recent"],
    fundingAcquisitions: ["offeringAmount", "amountSold", "firstSaleDate", "acquisition", "funding.amount", "funding.valuation", "funding.roundLabel"],
  };
  return COVERAGE_ORDER.map((id) => {
    const matchingClaims = report.claims.filter((claim) => claimTypes[id].includes(claim.claimType));
    const ids = new Set(matchingClaims.flatMap(c=>c.evidenceIds));
    const matchingEvidence = report.evidence.filter(e=>predicates[id](e) || ids.has(e.evidenceId));
    const hiringObserved = id === "hiring" && Boolean(report.hiringIntelligence && ["success_with_jobs", "success_zero_jobs"].includes(report.hiringIntelligence.status));
    if (id === "hiring" && report.hiringIntelligence) return { id, covered: hiringObserved || report.hiringIntelligence.jobs.length > 0, claimCount: matchingClaims.length, evidenceCount: matchingEvidence.length };
    return { id, covered: matchingEvidence.length > 0 || matchingClaims.length > 0 || hiringObserved, claimCount: matchingClaims.length, evidenceCount: matchingEvidence.length };
  });
}

function buildEvidenceQuality(report: PrivateDiligenceReport): QuickEvidenceQualityDatum[] {
  const countById = new Map<QuickEvidenceQualityId, number>(QUALITY_ORDER.map((id) => [id, 0]));
  for (const claim of report.claims) {
    const id = qualityId(claim.status);
    countById.set(id, (countById.get(id) ?? 0) + 1);
  }
  return QUALITY_ORDER.map((id) => ({ id, count: countById.get(id) ?? 0 }));
}

function buildHiring(report: PrivateDiligenceReport): QuickHiringData {
  const roleUrls = unique(stringValues(report.evidence, "links").filter(isRoleUrl));
  return {
    observedRoleLinks: roleUrls.length,
    roleUrls,
    departments: counts(stringValues(report.evidence, "jobDepartments")),
    locations: counts(stringValues(report.evidence, "jobLocations")),
    workArrangements: counts(stringValues(report.evidence, "jobWorkArrangements")),
    seniority: counts(stringValues(report.evidence, "jobSeniorities")),
  };
}

function buildTimeline(report: PrivateDiligenceReport): QuickTimelineItem[] {
  if (report.adaptiveResearch) {
    const items = report.claims.filter(c=>c.researchFact?.topic==="recent" && c.researchFact.publicationDate).map(c=>{
      const fact=c.researchFact!;
      const source=report.evidence.find(e=>e.evidenceId===fact.evidenceId)!;
      return {evidenceId:fact.evidenceId,date:fact.publicationDate,eventType:source?eventType(source):"other" as const,description:fact.value,sourceTitle:source?.sourceTitle ?? "Original source",sourceUrl:fact.sourceUrl,evidenceStatus:qualityId(c.status)};
    });
    return [...new Map(items.map(item=>[item.evidenceId,item])).values()].sort((a,b)=>(b.date??"").localeCompare(a.date??""));
  }
  const eventEvidenceIds = new Set(report.claims
    .filter((claim) => ["businessActivity", "acquisition", "offeringAmount", "amountSold", "firstSaleDate"].includes(claim.claimType))
    .flatMap((claim) => claim.evidenceIds));
  return report.evidence.filter((item) => {
    const topics = evidenceTopics(item);
    return eventEvidenceIds.has(item.evidenceId) &&
      (topics.includes("recentActivity") || topics.includes("fundingAcquisitions")) && eventType(item) !== "other";
  }).map((item) => {
    const linkedClaims = report.claims.filter((claim) => claim.evidenceIds.includes(item.evidenceId));
    const status = linkedClaims.length ? qualityId(linkedClaims[0].status) : evidenceQuality(item);
    return {
      evidenceId: item.evidenceId,
      date: item.publicationDate,
      eventType: eventType(item),
      description: typeof item.normalizedFields.sourceSummary === "string" && item.normalizedFields.sourceSummary.trim()
        ? item.normalizedFields.sourceSummary.slice(0, 280)
        : item.sourceTitle,
      sourceTitle: item.sourceTitle,
      sourceUrl: item.sourceUrl,
      evidenceStatus: status,
    };
  }).sort((left, right) => {
    if (left.date && right.date) return right.date.localeCompare(left.date) || left.sourceTitle.localeCompare(right.sourceTitle);
    if (left.date) return -1;
    if (right.date) return 1;
    return left.sourceTitle.localeCompare(right.sourceTitle);
  });
}

export function buildQuickReportVisualizations(report: PrivateDiligenceReport): QuickReportVisualizations {
  return {
    coverage: buildCoverage(report),
    evidenceQuality: buildEvidenceQuality(report),
    hiring: buildHiring(report),
    timeline: buildTimeline(report),
  };
}

export function quickReportParagraphs(report: PrivateDiligenceReport, locale: DiligenceLocale) {
  const sections = report.presentation ? [...adaptiveReportSections(report), ...report.sections.filter(section => section.sectionId === 'unverified')] : report.sections;
  return sections.map((section) => ({
    sectionId: section.sectionId,
    title: section.title[locale],
    paragraphs: section.paragraphsByLocale?.[locale] ?? section.paragraphs,
    claimIds: section.claimIds,
    evidenceIds: section.evidenceIds,
  }));
}

export function quickReportDisclosure(report: PrivateDiligenceReport, locale: DiligenceLocale) {
  return report.disclosureByLocale?.[locale] ?? report.disclosure;
}
