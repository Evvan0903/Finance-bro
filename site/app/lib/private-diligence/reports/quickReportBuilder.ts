import type {
  DiligenceLocale,
  EntityIdentityGraph,
  InformationGap,
  NormalizedEvidence,
  PrivateCompanyClaim,
  PrivateCompanyInput,
  PrivateDiligenceReport,
  ProviderPlanItem,
  ReportSection,
} from "../types";

const TITLES = [
  ["01", "Company Snapshot", "公司概览"], ["02", "Business and Products", "业务与产品"],
  ["03", "Ownership and Leadership", "所有权与管理层"], ["04", "Hiring and Growth Signals", "招聘与增长信号"],
  ["05", "Locations and Contact Information", "地点与业务联系方式"], ["06", "Customers and Partners", "客户与合作伙伴"],
  ["07", "Recent Business Activity", "近期业务动态"], ["08", "Key Commercial Signals", "关键商业信号"],
  ["09", "Sources and Information Gaps", "来源与信息缺口"],
] as const;

type LocalizedText = { en: string; zh: string };
type GapDefinition = {
  category: string;
  title: LocalizedText;
  reason: LocalizedText;
  recommendedEvidence: LocalizedText;
};

const pair = (en: string, zh: string): LocalizedText => ({ en, zh });
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const localized = (items: LocalizedText[], locale: DiligenceLocale) => items.map((item) => item[locale]);

function pageValues(evidence: NormalizedEvidence[], field: string) {
  return unique(evidence.flatMap((item) => Array.isArray(item.normalizedFields[field]) ? item.normalizedFields[field] as string[] : []));
}

function evidenceForTopics(evidence: NormalizedEvidence[], topics: string[]) {
  return evidence.filter((item) => {
    const sourceTopics = item.normalizedFields.searchTopics;
    return Array.isArray(sourceTopics) && sourceTopics.some((topic) => topics.includes(topic));
  });
}

function sourceParagraphs(evidence: NormalizedEvidence[], subject: LocalizedText) {
  return evidence.slice(0, 2).map((item) => {
    const summary = typeof item.normalizedFields.sourceSummary === "string"
      ? item.normalizedFields.sourceSummary.slice(0, 320)
      : "";
    const date = item.publicationDate ? ` (${item.publicationDate})` : "";
    return pair(
      `${item.companyReported ? "Company-reported original source" : "Independent original source"} reviewed for ${subject.en}: ${item.sourceTitle}${date}${summary ? ` — ${summary}` : ""}`,
      `${item.companyReported ? "公司自行披露的原始来源" : "独立原始来源"}用于${subject.zh}核查：${item.sourceTitle}${date}${summary ? ` — ${summary}` : ""}`,
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

function quickSection(index: number, paragraphs: LocalizedText[], locale: DiligenceLocale, claimIds: string[] = [], linkedEvidenceIds: string[] = []): ReportSection {
  const [number, en, zh] = TITLES[index];
  return {
    sectionId: number,
    number,
    title: { en, zh },
    paragraphs: localized(paragraphs, locale),
    paragraphsByLocale: { en: localized(paragraphs, "en"), zh: localized(paragraphs, "zh") },
    claimIds,
    evidenceIds: linkedEvidenceIds,
  };
}

function gapDefinitions(hasAtsLinks: boolean): GapDefinition[] {
  return [
    {
      category: "ownership",
      title: pair("Ownership not publicly verified", "所有权尚未通过公开来源核验"),
      reason: pair("Public ownership information was not supported by reviewed evidence", "已审查证据未能支持公开所有权信息"),
      recommendedEvidence: pair("Company-authorized capitalization or ownership records", "公司授权的股权结构或所有权记录"),
    },
    {
      category: "revenue",
      title: pair("Revenue not publicly disclosed", "收入尚未公开披露"),
      reason: pair("Quick mode does not estimate private-company revenue", "快速模式不会估算私营公司收入"),
      recommendedEvidence: pair("Company-authorized financial statements", "公司授权的财务报表"),
    },
    {
      category: "customers",
      title: pair("Customer relationships not independently confirmed", "客户关系尚未获得独立确认"),
      reason: pair("Company logos or statements alone are not treated as confirmed relationships", "仅有公司徽标或公司声明不足以确认客户关系"),
      recommendedEvidence: pair("Counterparty confirmation or attributable transaction evidence", "交易对手确认或可归属的交易证据"),
    },
    {
      category: "hiring",
      title: pair(hasAtsLinks ? "Current job openings require direct ATS verification" : "Current hiring activity was not identified", hasAtsLinks ? "当前开放职位仍需直接核验 ATS" : "未识别当前招聘活动"),
      reason: pair("A public job link is an observed snapshot, not a verified hiring trend", "公开职位链接只是观察时点快照，并非经过验证的招聘趋势"),
      recommendedEvidence: pair("Direct ATS role records with current status", "包含当前状态的 ATS 直接职位记录"),
    },
    {
      category: "litigation",
      title: pair("Litigation coverage not included in Quick mode", "快速模式不包含诉讼检索"),
      reason: pair("This workflow is not complete due diligence", "本工作流并非完整尽职调查"),
      recommendedEvidence: pair("Jurisdiction-specific court and legal-record searches", "按司法辖区检索法院和法律记录"),
    },
  ];
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
  const gaps = gapDefinitions(atsLinks.length > 0);
  const researchPurpose = input.quickResearchPurpose ?? "General Research";
  const researchPurposeZh = ({
    Competitor: "竞争对手研究", "Potential Customer": "潜在客户研究", Vendor: "供应商研究",
    Partner: "合作伙伴研究", "Sales Prospect": "销售线索研究", "General Research": "通用调查",
  } as const)[researchPurpose];
  const sections = [
    quickSection(0, [
      graph.identityVerificationStatus === "unverified"
        ? pair(`User-selected research target: ${graph.canonicalName} (identity not yet publicly verified)`, `用户选择的调查目标：${graph.canonicalName}（身份尚未通过公开来源核验）`)
        : pair(`Identified company: ${graph.canonicalName}`, `已识别公司：${graph.canonicalName}`),
      pair(`Website: ${graph.domains[0] ?? "Not identified"}; public-source coverage: ${coverage}`, `网站：${graph.domains[0] ?? "未识别"}；公开来源覆盖：${coverage === "Strong public-source coverage" ? "公开来源覆盖较强" : coverage === "Moderate public-source coverage" ? "公开来源覆盖中等" : "公开来源覆盖有限"}`),
      pair(`Research purpose: ${researchPurpose}`, `研究目的：${researchPurposeZh}`),
      ...sourceParagraphs(overviewEvidence, pair("company overview", "公司概览")),
    ], locale, claims.map((item) => item.claimId), unique([...evidenceIds(overviewEvidence), ...evidence.map((item) => item.evidenceId)])),
    quickSection(1, [
      ...(companyProducts.length ? [pair(`Products identified on company-controlled sources: ${companyProducts.join(", ")}`, `公司控制来源中识别的产品：${companyProducts.join("、")}`)] : []),
      ...(independentlyReportedProducts.length ? [pair(`Products reported by independent original sources: ${independentlyReportedProducts.join(", ")}`, `独立原始来源报道的产品：${independentlyReportedProducts.join("、")}`)] : []),
      ...(companyServices.length ? [pair(`Services identified on company-controlled sources: ${companyServices.join(", ")}`, `公司控制来源中识别的服务：${companyServices.join("、")}`)] : []),
      ...(independentlyReportedServices.length ? [pair(`Services reported by independent original sources: ${independentlyReportedServices.join(", ")}`, `独立原始来源报道的服务：${independentlyReportedServices.join("、")}`)] : []),
      ...sourceParagraphs(overviewEvidence, pair("business and products", "业务与产品")),
      pair("Company website descriptions are Management Reported unless independently corroborated. Pricing and revenue mix were not identified", "公司网站描述属于公司自行披露，除非获得独立印证。尚未识别定价或收入结构"),
    ], locale, unique([...claims.filter((item) => ["description", "product"].includes(item.claimType)).map((item) => item.claimId), ...claimIdsForEvidence(claims, overviewEvidence)]), evidenceIds(overviewEvidence)),
    quickSection(2, [
      ...(people.length ? [pair(`Publicly identified founders or executives: ${people.join(", ")}`, `公开识别的创始人或高管：${people.join("、")}`)] : []),
      ...sourceParagraphs(leadershipEvidence, pair("leadership", "管理层")),
      pair("Ownership is unverified. A founder, CEO, or executive is not treated as an owner without separate supporting evidence", "所有权尚未验证。创始人、CEO 或高管在没有独立支持证据时不会被视为所有者"),
    ], locale, claimIdsForEvidence(claims, leadershipEvidence), evidenceIds(leadershipEvidence)),
    quickSection(3, [
      ...(atsLinks.length ? [pair(`Public ATS role links observed: ${atsLinks.join("; ")}`, `已观察到的公开 ATS 职位链接：${atsLinks.join("；")}`), pair("Current role links are a point-in-time snapshot, not a historical hiring trend", "当前职位链接仅为时点快照，并非历史招聘趋势")] : [pair("No current public job-opening feed was identified from the reviewed pages", "在已审查页面中未识别当前公开职位列表")]),
      ...sourceParagraphs(hiringEvidence, pair("hiring", "招聘")),
    ], locale, claimIdsForEvidence(claims, hiringEvidence), evidenceIds(hiringEvidence)),
    quickSection(4, [
      ...(addresses.length ? [pair(`Public business locations: ${addresses.join("; ")}`, `公开业务地点：${addresses.join("；")}`)] : []),
      ...(phoneNumbers.length ? [pair(`Public business phone: ${phoneNumbers.join(", ")}`, `公开业务电话：${phoneNumbers.join("、")}`)] : []),
      pair(`Website: ${graph.domains[0] ? `https://${graph.domains[0]}` : "Not identified"}`, `网站：${graph.domains[0] ? `https://${graph.domains[0]}` : "未识别"}`),
      pair("Only public business contact channels are included; personal emails, mobile numbers, and residential addresses are excluded", "仅包含公开业务联系渠道；个人邮箱、手机号码和住宅地址均已排除"),
    ], locale),
    quickSection(5, [
      ...sourceParagraphs(relationshipEvidence, pair("customers and partners", "客户与合作伙伴")),
      pair("No customer or partner relationship is presented as confirmed unless supported by the company and/or counterparty. Search-discovered pages remain review leads until the original page supplies attributable evidence", "除非得到公司和/或交易对手支持，否则客户或合作关系不会标示为已确认。搜索发现页面只有在原始页面提供可归属证据后才会用于分析"),
    ], locale, claimIdsForEvidence(claims, relationshipEvidence), evidenceIds(relationshipEvidence)),
    quickSection(6, [
      ...sourceParagraphs(activityEvidence, pair("recent business activity", "近期业务动态")),
      pair("Recent activity is limited to dated or retrieved original-page evidence in the source register. No unsupported event timeline is generated", "近期活动仅限来源登记册中有日期或检索记录的原始页面证据。不会生成无依据的事件时间线"),
    ], locale, claimIdsForEvidence(claims, activityEvidence), evidenceIds(activityEvidence)),
    quickSection(7, [
      ...(atsLinks.length ? [pair("Attention item: public careers infrastructure is visible; current role counts are based only on distinct public role links", "关注项：公开招聘基础设施可见；当前职位数量仅按不同的公开职位链接统计")] : []),
      pair("Attention item: ownership, revenue, and relationship coverage remain incomplete in public sources", "关注项：公开来源中的所有权、收入和关系覆盖仍不完整"),
      pair("These are evidence-linked commercial signals, not investment recommendations or management-quality judgments", "这些是与证据关联的商业信号，不构成投资建议或管理质量判断"),
    ], locale),
    quickSection(8, gaps.map((gap) => pair(`${gap.title.en} — ${gap.reason.en}`, `${gap.title.zh}——${gap.reason.zh}`)), locale, [], evidence.map((item) => item.evidenceId)),
  ];
  const references = evidence.map((item, index) => ({ number: index + 1, evidenceId: item.evidenceId, sourceTitle: item.sourceTitle, sourceUrl: item.sourceUrl, publicationDate: item.publicationDate, retrievedAt: item.retrievedAt, sourceTier: item.sourceTier }));
  const disclosureByLocale = pair(
    "This Quick Company Intelligence brief uses publicly accessible business information. It is not complete due diligence, a credit assessment, a valuation, or an investment recommendation",
    "本快速企业调查简报使用公开可获取的商业信息。它不是完整尽调、信用评估、估值或投资建议",
  );
  const methodologyLimitationsByLocale = {
    en: ["Public-source availability is incomplete and point-in-time.", "Company-controlled content remains Management Reported unless independently corroborated.", "Quick mode excludes private-contact discovery, complete ownership, litigation, financial, and investment analysis."],
    zh: ["公开来源覆盖并不完整，且仅反映特定时点。", "公司控制的内容属于公司自行披露，除非获得独立印证。", "快速模式不包含私人联系方式搜寻、完整所有权、诉讼、财务和投资分析。"],
  };
  return {
    reportId: `clara-quick-${args.researchId}`, researchId: args.researchId, reportVersion: "clara-quick-v1", generatedAt: args.generatedAt, locale, input, entity: graph,
    coverageStatus: coverage, providerPlan: args.providerPlan, evidence, claims, conflicts: [], risks: [],
    informationGaps: gaps.map((gap, index) => ({ gapId: `quick-gap-${index + 1}`, category: gap.category, missingInformation: gap.title.en, whyItMatters: gap.reason.en, affectedClaims: [], affectedSections: ["09"], priority: "Medium", recommendedEvidence: [gap.recommendedEvidence.en], publicSearchCoverage: "Quick public-source workflow" })),
    questions: [], relationships: [],
    businessModel: { products, services, customerTypes: [], industryVerticals: [], revenueModel: null, pricingModel: null, salesMotion: null, deliveryModel: null, recurringRevenueStatus: null, geographicExposure: [], valueChainPosition: null, keyPartners: [], keySuppliers: [], capitalIntensity: null, operatingDependencies: [], businessModelEvidenceIds: evidence.map((item) => item.evidenceId) },
    sections, references,
    disclosure: disclosureByLocale[locale], disclosureByLocale,
    methodologyLimitations: methodologyLimitationsByLocale[locale], methodologyLimitationsByLocale,
  };
}
