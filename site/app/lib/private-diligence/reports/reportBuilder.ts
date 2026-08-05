import { CLARA_SECTION_TITLES, label } from "../copy";
import type {
  BusinessModelProfile,
  ConflictRecord,
  DueDiligenceQuestion,
  EntityIdentityGraph,
  InformationGap,
  NormalizedEvidence,
  PrivateCompanyClaim,
  PrivateCompanyInput,
  PrivateDiligenceReport,
  ProviderPlanItem,
  RiskFinding,
} from "../types";

function section(
  index: number,
  paragraphs: string[],
  claimIds: string[] = [],
  evidenceIds: string[] = [],
) {
  const [number, en, zh] = CLARA_SECTION_TITLES[index];
  return { sectionId: number, number, title: { en, zh }, paragraphs: paragraphs.filter(Boolean), claimIds, evidenceIds };
}

function money(value: unknown) {
  return typeof value === "number" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) : String(value ?? "Unknown");
}

function buildBusinessModel(claims: PrivateCompanyClaim[]) : BusinessModelProfile {
  const values = (type: string) => claims.filter((claim) => claim.claimType === type)
    .map((claim) => String(claim.normalizedValue)).filter(Boolean);
  const descriptions = values("description");
  return {
    products: [...new Set(values("product"))],
    services: [],
    customerTypes: [],
    industryVerticals: [],
    revenueModel: null,
    pricingModel: null,
    salesMotion: null,
    deliveryModel: descriptions[0] ?? null,
    recurringRevenueStatus: null,
    geographicExposure: [],
    valueChainPosition: null,
    keyPartners: [],
    keySuppliers: [],
    capitalIntensity: null,
    operatingDependencies: [],
    businessModelEvidenceIds: claims.filter((claim) => ["description", "product"].includes(claim.claimType)).flatMap((claim) => claim.evidenceIds),
  };
}

function coverage(evidence: NormalizedEvidence[], graph: EntityIdentityGraph): PrivateDiligenceReport["coverageStatus"] {
  if (graph.identityConfidence === "Low") return "Insufficient entity resolution";
  const final = evidence.filter((item) => item.verificationEligibility === "finalEvidence").length;
  const supporting = evidence.filter((item) => item.verificationEligibility === "supportingEvidence").length;
  return final >= 4 && supporting >= 3 ? "Strong public-source coverage"
    : final >= 1 && supporting >= 1 ? "Moderate public-source coverage"
      : "Limited public-source coverage";
}

export function buildPrivateDiligenceReport(args: {
  researchId: string;
  input: PrivateCompanyInput;
  graph: EntityIdentityGraph;
  providerPlan: ProviderPlanItem[];
  evidence: NormalizedEvidence[];
  claims: PrivateCompanyClaim[];
  conflicts: ConflictRecord[];
  risks: RiskFinding[];
  informationGaps: InformationGap[];
  questions: DueDiligenceQuestion[];
  generatedAt: string;
}): PrivateDiligenceReport {
  const { input, graph, claims, evidence, conflicts, risks, informationGaps, questions } = args;
  const locale = input.locale;
  const claimIds = (types: string[]) => claims.filter((claim) => types.includes(claim.claimType)).map((claim) => claim.claimId);
  const evidenceIds = (types: string[]) => claims.filter((claim) => types.includes(claim.claimType)).flatMap((claim) => claim.evidenceIds);
  const legal = claims.filter((claim) => ["legalName", "jurisdiction"].includes(claim.claimType));
  const founders = claims.filter((claim) => ["founder", "executive"].includes(claim.claimType));
  const financing = claims.filter((claim) => ["offeringAmount", "amountSold", "firstSaleDate", "numberOfInvestors"].includes(claim.claimType));
  const awards = claims.filter((claim) => claim.claimType.startsWith("award"));
  const businessModel = buildBusinessModel(claims);
  const references = evidence
    .filter((item) => item.verificationEligibility !== "excluded" && item.verificationEligibility !== "leadOnly")
    .map((item, index) => ({
      number: index + 1,
      evidenceId: item.evidenceId,
      sourceTitle: item.sourceTitle,
      sourceUrl: item.sourceUrl,
      publicationDate: item.publicationDate,
      retrievedAt: item.retrievedAt,
      sourceTier: item.sourceTier,
    }));
  const sections = [
    section(0, [
      label(locale, `Target identity: ${graph.canonicalName} (${graph.identityConfidence} confidence)`, `目标身份：${graph.canonicalName}（${graph.identityConfidence} 置信度）`),
      label(locale, `Evidence coverage: ${coverage(evidence, graph)}`, `证据覆盖：${coverage(evidence, graph)}`),
      label(locale, `${claims.filter((claim) => claim.status === "Verified" || claim.status === "Corroborated").length} claims were verified or corroborated; ${conflicts.length} conflicts and ${informationGaps.filter((gap) => gap.priority === "Critical").length} critical information gaps remain`, `${claims.filter((claim) => claim.status === "Verified" || claim.status === "Corroborated").length} 项 Claim 已验证或交叉印证；仍有 ${conflicts.length} 项冲突和 ${informationGaps.filter((gap) => gap.priority === "Critical").length} 项关键缺口`),
    ], claims.map((claim) => claim.claimId), evidence.map((item) => item.evidenceId)),
    section(1, [
      label(locale, `Canonical company: ${graph.canonicalName}`, `规范公司名称：${graph.canonicalName}`),
      label(locale, `Identity basis: ${graph.legalNames.join("; ")}; domains ${graph.domains.join("; ") || "not verified"}; jurisdictions ${graph.registrationJurisdictions.join("; ") || "not verified"}`, `身份依据：${graph.legalNames.join("；")}；域名 ${graph.domains.join("；") || "未验证"}；注册辖区 ${graph.registrationJurisdictions.join("；") || "未验证"}`),
      ...graph.identityLimitations,
    ], claimIds(["legalName"]), evidenceIds(["legalName"])),
    legal.length ? section(2, legal.map((claim) => `${claim.statement} — ${claim.status}`), legal.map((claim) => claim.claimId), legal.flatMap((claim) => claim.evidenceIds)) : null,
    businessModel.products.length || businessModel.deliveryModel ? section(3, [
      ...(businessModel.deliveryModel ? [businessModel.deliveryModel] : []),
      ...(businessModel.products.length ? [label(locale, `Products identified: ${businessModel.products.join(", ")}`, `已识别产品：${businessModel.products.join("、")}`)] : []),
      label(locale, "Pricing, margins, revenue mix, and recurring-revenue status remain unknown unless explicitly evidenced", "除非有明确证据，否则定价、利润率、收入组合和经常性收入状态仍属未知"),
    ], claimIds(["description", "product"]), evidenceIds(["description", "product"])) : null,
    founders.length ? section(4, founders.map((claim) => `${claim.statement} — ${claim.status}`), founders.map((claim) => claim.claimId), founders.flatMap((claim) => claim.evidenceIds)) : null,
    financing.length ? section(5, financing.map((claim) => claim.unit === "USD" ? `${claim.statement}: ${money(claim.normalizedValue)} — ${claim.status}` : `${claim.statement}: ${claim.normalizedValue} — ${claim.status}`), financing.map((claim) => claim.claimId), financing.flatMap((claim) => claim.evidenceIds)) : null,
    section(6, [label(locale, "Operating Footprint Indicators were reviewed; no exact revenue or employee estimate is produced in Clara V1", "已审查运营足迹指标；Clara V1 不生成精确收入或员工人数估计")]),
    null,
    awards.length ? section(8, awards.map((claim) => claim.unit === "USD" ? `${claim.statement}: ${money(claim.normalizedValue)} — ${claim.status}` : `${claim.statement}: ${claim.normalizedValue} — ${claim.status}`), awards.map((claim) => claim.claimId), awards.flatMap((claim) => claim.evidenceIds)) : null,
    null, null,
    section(11, [label(locale, "No verified litigation records were identified in the sources reviewed; Clara V1 does not provide complete litigation coverage", "在已审查来源中未识别出经验证的诉讼记录；Clara V1 不提供完整诉讼覆盖")]),
    input.industry ? section(12, [label(locale, `Industry context supplied for research planning: ${input.industry}. Government proxies are not treated as company TAM or revenue`, `研究规划所用行业背景：${input.industry}。政府代理指标不被视为公司 TAM 或收入`)]): null,
    null,
    risks.length ? section(14, risks.map((risk) => `${risk.severity} · ${risk.title}: ${risk.description}`), risks.flatMap((risk) => risk.claimIds), risks.flatMap((risk) => risk.evidenceIds)) : null,
    conflicts.length ? section(15, conflicts.map((conflict) => `${conflict.claimType}: ${conflict.values.join(" versus ")} · ${conflict.resolutionStatus}`), [], conflicts.flatMap((conflict) => conflict.evidenceIds)) : null,
    section(16, informationGaps.map((gap) => `${gap.priority} · ${gap.missingInformation} — ${gap.whyItMatters}`)),
    section(17, questions.map((question) => `${question.priority} · ${question.question} — ${question.reason}`)),
    section(18, [
      label(locale, "Claims require linked public evidence. Official records, Company Reported statements, independent sources, and lead-only sources remain distinct", "所有 Claim 必须关联公开证据。官方记录、公司报告、独立来源和仅线索来源保持区分"),
      label(locale, "Weak entity matches are excluded from final evidence, and credible conflicts are preserved rather than silently resolved", "弱实体匹配不进入最终证据，可信冲突会被保留而非静默解决"),
      label(locale, "No complete legal, financial, tax, cybersecurity, ownership, litigation, valuation, fraud, or investment conclusion is provided", "本报告不提供完整法律、财务、税务、网络安全、所有权、诉讼、估值、欺诈或投资结论"),
    ]),
    section(19, references.map((reference) => `[${reference.number}] Tier ${reference.sourceTier} · ${reference.sourceTitle} · ${reference.sourceUrl}`), [], references.map((reference) => reference.evidenceId)),
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  return {
    reportId: `clara-${args.researchId}`,
    researchId: args.researchId,
    reportVersion: "clara-v1",
    generatedAt: args.generatedAt,
    locale,
    input,
    entity: graph,
    coverageStatus: coverage(evidence, graph),
    providerPlan: args.providerPlan,
    evidence,
    claims,
    conflicts,
    risks,
    informationGaps,
    questions,
    relationships: [],
    businessModel,
    sections,
    references,
    disclosure: label(locale,
      "This report is based solely on publicly accessible information and does not replace financial, legal, tax, operational, cybersecurity, or management due diligence",
      "本报告仅基于公开可获取的信息，不能替代财务、法律、税务、运营、网络安全或管理层尽职调查",
    ),
    methodologyLimitations: [
      "Public-source coverage is incomplete and point-in-time.",
      "Company-controlled website statements remain Company Reported unless independently corroborated.",
      "Absence of public information is an information gap, not evidence of misconduct or the absence of an event.",
      "Document-room diligence and uploaded-document review are outside Clara V1.",
    ],
  };
}
