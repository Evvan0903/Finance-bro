import { label } from "../copy";
import type { EntityIdentityGraph, InformationGap, NormalizedEvidence, PrivateCompanyClaim, PrivateCompanyInput, PrivateDiligenceReport, ProviderPlanItem } from "../types";

const TITLES = [
  ["01", "Company Snapshot", "公司概览"], ["02", "Business and Products", "业务与产品"],
  ["03", "Ownership and Leadership", "所有权与管理层"], ["04", "Hiring and Growth Signals", "招聘与增长信号"],
  ["05", "Locations and Contact Information", "地点与业务联系方式"], ["06", "Customers and Partners", "客户与合作伙伴"],
  ["07", "Recent Business Activity", "近期业务动态"], ["08", "Key Commercial Signals", "关键商业信号"],
  ["09", "Sources and Information Gaps", "来源与信息缺口"],
] as const;

function unique(values: string[]) { return [...new Set(values.filter(Boolean))]; }
function pageValues(evidence: NormalizedEvidence[], field: string) {
  return unique(evidence.flatMap((item) => Array.isArray(item.normalizedFields[field]) ? item.normalizedFields[field] as string[] : []));
}
function evidenceForTopics(evidence: NormalizedEvidence[], topics: string[]) {
  return evidence.filter((item) => {
    const sourceTopics = item.normalizedFields.searchTopics;
    return Array.isArray(sourceTopics) && sourceTopics.some((topic) => topics.includes(topic));
  });
}
function sourceParagraphs(evidence: NormalizedEvidence[], locale: PrivateCompanyInput["locale"], subject: string) {
  return evidence.slice(0, 2).map((item) => {
    const summary = typeof item.normalizedFields.sourceSummary === "string"
      ? item.normalizedFields.sourceSummary.slice(0, 320)
      : "";
    const provenance = item.companyReported ? "Company-reported original source" : "Independent original source";
    const provenanceZh = item.companyReported ? "公司自述原始来源" : "独立原始来源";
    const date = item.publicationDate ? ` (${item.publicationDate})` : "";
    return label(
      locale,
      `${provenance} reviewed for ${subject}: ${item.sourceTitle}${date}${summary ? ` — ${summary}` : ""}`,
      `${provenanceZh}用于${subject}核查：${item.sourceTitle}${date}${summary ? ` — ${summary}` : ""}`,
    );
  });
}
function evidenceIds(items: NormalizedEvidence[]) { return items.map((item) => item.evidenceId); }
function claimIdsForEvidence(claims: PrivateCompanyClaim[], items: NormalizedEvidence[]) {
  const ids = new Set(evidenceIds(items));
  return claims.filter((claim) => claim.evidenceIds.some((id) => ids.has(id))).map((claim) => claim.claimId);
}
function quickCoverage(evidence: NormalizedEvidence[]) {
  const fields = new Set(evidence.flatMap((item) => Object.keys(item.normalizedFields)));
  const score = ["organizationName", "description", "founders", "executives", "addresses", "phoneNumbers"].filter((key) => fields.has(key)).length;
  return score >= 5 ? "Strong public-source coverage" as const : score >= 3 ? "Moderate public-source coverage" as const : "Limited public-source coverage" as const;
}
function quickSection(index: number, paragraphs: string[], claimIds: string[] = [], evidenceIds: string[] = []) {
  const [number, en, zh] = TITLES[index];
  return { sectionId: number, number, title: { en, zh }, paragraphs: paragraphs.filter(Boolean), claimIds, evidenceIds };
}

export function buildQuickCompanyIntelligenceReport(args: {
  researchId: string; input: PrivateCompanyInput; graph: EntityIdentityGraph; providerPlan: ProviderPlanItem[];
  evidence: NormalizedEvidence[]; claims: PrivateCompanyClaim[]; informationGaps: InformationGap[]; generatedAt: string;
}): PrivateDiligenceReport {
  const { input, graph, evidence, claims } = args;
  const locale = input.locale;
  const companyEvidence = evidence.filter((item) => item.companyReported);
  const independentEvidence = evidence.filter((item) => item.independentlyPublished);
  const companyProducts = pageValues(companyEvidence, "products");
  const independentlyReportedProducts = pageValues(independentEvidence, "products").filter((item) => !companyProducts.includes(item));
  const products = unique([...companyProducts, ...independentlyReportedProducts]);
  const companyServices = pageValues(companyEvidence, "services");
  const independentlyReportedServices = pageValues(independentEvidence, "services").filter((item) => !companyServices.includes(item));
  const services = unique([...companyServices, ...independentlyReportedServices]);
  const addresses = unique([...graph.addresses, ...pageValues(evidence, "addresses")]);
  const phoneNumbers = unique([...graph.phoneNumbers, ...pageValues(evidence, "phoneNumbers")]);
  const people = unique([...graph.founders, ...graph.executives, ...pageValues(evidence, "founders"), ...pageValues(evidence, "executives")]);
  const links = pageValues(evidence, "links");
  const atsLinks = links.filter((link) => /greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com/i.test(link));
  const overviewEvidence = evidenceForTopics(evidence, ["overviewProducts"]);
  const leadershipEvidence = evidenceForTopics(evidence, ["leadership"]);
  const relationshipEvidence = evidenceForTopics(evidence, ["customersPartners"]);
  const hiringEvidence = evidenceForTopics(evidence, ["hiring"]);
  const activityEvidence = evidenceForTopics(evidence, ["recentActivity", "fundingAcquisitions"]);
  const coverage = quickCoverage(evidence);
  const gaps = [
    ["ownership", "Ownership not publicly verified", "Public ownership information was not supported by reviewed evidence"],
    ["revenue", "Revenue not publicly disclosed", "Quick mode does not estimate private-company revenue"],
    ["customers", "Customer relationships not independently confirmed", "Company logos or statements alone are not treated as confirmed relationships"],
    ["hiring", atsLinks.length ? "Current job openings require ATS retrieval" : "Current hiring activity was not identified", "A website careers link is not a verified count of open roles"],
    ["litigation", "Litigation coverage not included in Quick mode", "This workflow is not complete due diligence"],
  ];
  const sections = [
    quickSection(0, [
      graph.identityVerificationStatus === "unverified"
        ? label(locale, `User-selected research target: ${graph.canonicalName} (identity not yet publicly verified)`, `用户选择的调查目标：${graph.canonicalName}（身份尚未通过公开来源核验）`)
        : label(locale, `Identified company: ${graph.canonicalName}`, `已识别公司：${graph.canonicalName}`),
      label(locale, `Website: ${graph.domains[0] ?? "Not identified"}; public-source coverage: ${coverage}`, `网站：${graph.domains[0] ?? "未识别"}；公开来源覆盖：${coverage}`),
      label(locale, `Research purpose: ${input.quickResearchPurpose ?? "General Research"}`, `研究目的：${input.quickResearchPurpose ?? "通用调查"}`),
      ...sourceParagraphs(overviewEvidence, locale, locale === "zh" ? "公司概览" : "company overview"),
    ], claims.map((item) => item.claimId), unique([...evidenceIds(overviewEvidence), ...evidence.map((item) => item.evidenceId)])),
    quickSection(1, [
      ...(companyProducts.length ? [label(locale, `Products identified on company-controlled sources: ${companyProducts.join(", ")}`, `公司控制来源中识别的产品：${companyProducts.join("、")}`)] : []),
      ...(independentlyReportedProducts.length ? [label(locale, `Products reported by independent original sources: ${independentlyReportedProducts.join(", ")}`, `独立原始来源报道的产品：${independentlyReportedProducts.join("、")}`)] : []),
      ...(companyServices.length ? [label(locale, `Services identified on company-controlled sources: ${companyServices.join(", ")}`, `公司控制来源中识别的服务：${companyServices.join("、")}`)] : []),
      ...(independentlyReportedServices.length ? [label(locale, `Services reported by independent original sources: ${independentlyReportedServices.join(", ")}`, `独立原始来源报道的服务：${independentlyReportedServices.join("、")}`)] : []),
      ...sourceParagraphs(overviewEvidence, locale, locale === "zh" ? "业务与产品" : "business and products"),
      label(locale, "Company website descriptions are Company Reported unless independently corroborated. Pricing and revenue mix were not identified", "公司网站描述均为公司自述，除非有独立印证。未识别定价或收入结构"),
    ], unique([...claims.filter((item) => ["description", "product"].includes(item.claimType)).map((item) => item.claimId), ...claimIdsForEvidence(claims, overviewEvidence)]), evidenceIds(overviewEvidence)),
    quickSection(2, [
      ...(people.length ? [label(locale, `Publicly identified founders or executives: ${people.join(", ")}`, `公开识别的创始人或高管：${people.join("、")}`)] : []),
      ...sourceParagraphs(leadershipEvidence, locale, locale === "zh" ? "管理层" : "leadership"),
      label(locale, "Ownership not publicly verified. A founder, CEO, or executive is not treated as an owner without separate supporting evidence", "所有权尚未公开验证。创始人、CEO 或高管在没有独立支持证据时不视为所有者"),
    ], claimIdsForEvidence(claims, leadershipEvidence), evidenceIds(leadershipEvidence)),
    quickSection(3, [
      ...(atsLinks.length ? [label(locale, `Public ATS links identified: ${atsLinks.join("; ")}`, `已识别公开 ATS 链接：${atsLinks.join("；")}`), label(locale, "Current hiring links are an observed snapshot, not a historical hiring trend", "当前招聘链接仅为观察到的快照，并非历史招聘趋势")] : [label(locale, "No current public job-opening feed was identified from the reviewed company pages", "在已审查公司页面中未识别当前公开职位列表")]),
      ...sourceParagraphs(hiringEvidence, locale, locale === "zh" ? "招聘" : "hiring"),
    ], claimIdsForEvidence(claims, hiringEvidence), evidenceIds(hiringEvidence)),
    quickSection(4, [
      ...(addresses.length ? [label(locale, `Public business locations: ${addresses.join("; ")}`, `公开业务地点：${addresses.join("；")}`)] : []),
      ...(phoneNumbers.length ? [label(locale, `Public business phone: ${phoneNumbers.join(", ")}`, `公开业务电话：${phoneNumbers.join("、")}`)] : []),
      label(locale, `Website: ${graph.domains[0] ? `https://${graph.domains[0]}` : "Not identified"}`, `网站：${graph.domains[0] ? `https://${graph.domains[0]}` : "未识别"}`),
      label(locale, "Only public business contact channels are included; personal emails, mobile numbers, and residential addresses are excluded", "仅包含公开业务联系渠道；个人邮箱、手机号码和住宅地址均已排除"),
    ]),
    quickSection(5, [
      ...sourceParagraphs(relationshipEvidence, locale, locale === "zh" ? "客户与合作伙伴" : "customers and partners"),
      label(locale, "No customer or partner relationship is presented as confirmed unless supported by the company and/or counterparty. Search-discovered pages are review leads until the original page supplies attributable evidence", "除非得到公司和/或交易对手支持，否则客户或合作关系不会标示为已确认。搜索发现页面只有在原始页面提供可归属证据后才用于报告"),
    ], claimIdsForEvidence(claims, relationshipEvidence), evidenceIds(relationshipEvidence)),
    quickSection(6, [
      ...sourceParagraphs(activityEvidence, locale, locale === "zh" ? "近期业务动态" : "recent business activity"),
      label(locale, "Recent activity is limited to dated or retrieved original-page evidence in the source register. No unsupported event timeline is generated", "近期活动仅限来源登记册中有日期或检索时间的原始页面证据。不生成无依据的事件时间线"),
    ], claimIdsForEvidence(claims, activityEvidence), evidenceIds(activityEvidence)),
    quickSection(7, [
      ...(atsLinks.length ? [label(locale, "Attention item: public careers infrastructure is visible; current role counts need direct ATS retrieval", "关注项：公开招聘基础设施可见；当前职位数量需要直接 ATS 获取")]: []),
      label(locale, "Attention item: ownership, revenue, and relationship coverage remain incomplete in public sources", "关注项：所有权、收入与关系覆盖在公开来源中仍不完整"),
      label(locale, "These are evidence-linked commercial signals, not investment recommendations or management-quality judgments", "这些是证据关联的商业信号，不构成投资建议或管理质量判断"),
    ]),
    quickSection(8, gaps.map(([, title, reason]) => label(locale, `${title} — ${reason}`, `${title}——${reason}`)), [], evidence.map((item) => item.evidenceId)),
  ];
  const references = evidence.map((item, index) => ({ number: index + 1, evidenceId: item.evidenceId, sourceTitle: item.sourceTitle, sourceUrl: item.sourceUrl, publicationDate: item.publicationDate, retrievedAt: item.retrievedAt, sourceTier: item.sourceTier }));
  return {
    reportId: `clara-quick-${args.researchId}`, researchId: args.researchId, reportVersion: "clara-quick-v1", generatedAt: args.generatedAt, locale, input, entity: graph,
    coverageStatus: coverage, providerPlan: args.providerPlan, evidence, claims, conflicts: [], risks: [], informationGaps: gaps.map(([category, missingInformation, whyItMatters], index) => ({ gapId: `quick-gap-${index + 1}`, category, missingInformation, whyItMatters, affectedClaims: [], affectedSections: ["09"], priority: "Medium", recommendedEvidence: ["Additional public or company-authorized evidence"], publicSearchCoverage: "Quick public-source workflow" })), questions: [], relationships: [],
    businessModel: { products, services, customerTypes: [], industryVerticals: [], revenueModel: null, pricingModel: null, salesMotion: null, deliveryModel: null, recurringRevenueStatus: null, geographicExposure: [], valueChainPosition: null, keyPartners: [], keySuppliers: [], capitalIntensity: null, operatingDependencies: [], businessModelEvidenceIds: evidence.map((item) => item.evidenceId) },
    sections, references,
    disclosure: label(locale, "This Quick Company Intelligence brief uses publicly accessible business information. It is not complete due diligence, a credit assessment, a valuation, or an investment recommendation", "本快速企业调查简报使用公开可获取的商业信息。它不是完整尽调、信用评估、估值或投资建议"),
    methodologyLimitations: ["Public-source availability is incomplete and point-in-time.", "Company-controlled content remains Company Reported unless independently corroborated.", "Quick mode excludes private-contact discovery, complete ownership, litigation, financial, and investment analysis."],
  };
}
