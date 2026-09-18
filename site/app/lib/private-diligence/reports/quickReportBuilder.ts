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
function uniqueEvidence(items: NormalizedEvidence[]) {
  return [...new Map(items.map((item) => [item.evidenceId, item])).values()];
}
function claimIdsForEvidence(claims: PrivateCompanyClaim[], items: NormalizedEvidence[]) {
  const ids = new Set(evidenceIds(items));
  return claims.filter((claim) => claim.evidenceIds.some((id) => ids.has(id))).map((claim) => claim.claimId);
}

function evidenceForClaims(evidence: NormalizedEvidence[], claims: PrivateCompanyClaim[]) {
  const ids = new Set(claims.flatMap((claim) => claim.evidenceIds));
  return evidence.filter((item) => ids.has(item.evidenceId));
}

function quickCoverage(evidence: NormalizedEvidence[], claims: PrivateCompanyClaim[], hasHiringFacts: boolean) {
  const hasField = (field: string) => evidence.some((item) => {
    const value = item.normalizedFields[field];
    return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== "";
  });
  const hasClaim = (...types: string[]) => claims.some((claim) => types.includes(claim.claimType));
  const score = [
    hasClaim("legalName") || hasField("organizationName"),
    hasClaim("description"),
    hasClaim("product", "service"),
    hasClaim("founder", "executive", "executiveRole", "formerExecutiveRole"),
    hasField("addresses") || hasField("phoneNumbers"),
    hasHiringFacts,
  ].filter(Boolean).length;
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
  adaptiveResearch?: import("../research/types").AdaptiveResearch;
  fundingResearch?: import("../funding/types").FundingResearch;
  conflicts?: import("../types").ConflictRecord[];
  researchId: string; input: PrivateCompanyInput; graph: EntityIdentityGraph; providerPlan: ProviderPlanItem[];
  evidence: NormalizedEvidence[]; claims: PrivateCompanyClaim[]; informationGaps: InformationGap[]; generatedAt: string;
  hiringIntelligence?: import("../hiring/types").HiringActivityResult | null;
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
  const people = unique([...pageValues(evidence, "founders"), ...pageValues(evidence, "executives")]);
  const links = pageValues(evidence, "links");
  const atsLinks = links.filter((link) => /greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com/i.test(link));
  const overviewEvidence = evidenceForTopics(evidence, ["overviewProducts"]);
  const leadershipEvidence = evidenceForTopics(evidence, ["leadership"]);
  const hiringEvidence = evidenceForTopics(evidence, ["hiring"]);
  const hiring = args.hiringIntelligence ?? null;
  const businessClaims = claims.filter((item) => ["product", "service"].includes(item.claimType));
  const currentRoleClaims = claims.filter((item) => item.claimType === "executiveRole");
  const formerRoleClaims = claims.filter((item) => item.claimType === "formerExecutiveRole");
  const leadershipClaims = claims.filter((item) => ["founder", "executive", "executiveRole", "formerExecutiveRole"].includes(item.claimType));
  const relationshipClaims = claims.filter((item) => ["customer", "partner"].includes(item.claimType));
  const activityClaims = claims.filter((item) => ["businessActivity", "acquisition", "offeringAmount", "amountSold", "firstSaleDate"].includes(item.claimType));
  const businessEvidence = uniqueEvidence([...overviewEvidence, ...evidenceForClaims(evidence, businessClaims)]);
  const supportedLeadershipEvidence = uniqueEvidence([...leadershipEvidence, ...evidenceForClaims(evidence, leadershipClaims)]);
  const relationshipEvidence = evidenceForClaims(evidence, relationshipClaims);
  const activityEvidence = evidenceForClaims(evidence, activityClaims);
  const coverage = quickCoverage(evidence, claims, Boolean(hiring?.summary.totalOpenRoles));
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
      ...sourceParagraphs(businessEvidence, pair("business and products", "业务与产品")),
      pair("Company website descriptions are Management Reported unless independently corroborated. Pricing and revenue mix were not identified", "公司网站描述属于公司自行披露，除非获得独立印证。尚未识别定价或收入结构"),
    ], locale, unique([...claims.filter((item) => ["description", "product", "service"].includes(item.claimType)).map((item) => item.claimId), ...claimIdsForEvidence(claims, businessEvidence)]), evidenceIds(businessEvidence)),
    quickSection(2, [
      ...(people.length ? [pair(`Publicly identified founders or executives: ${people.join(", ")}`, `公开识别的创始人或高管：${people.join("、")}`)] : []),
      ...(currentRoleClaims.length ? [pair(`Executive roles stated by reviewed sources, as of their publication/retrieval dates: ${currentRoleClaims.map((claim) => String(claim.normalizedValue)).join(", ")}`, `已审查来源在其发布／检索时点陈述的高管职位：${currentRoleClaims.map((claim) => String(claim.normalizedValue)).join("、")}`)] : []),
      ...(formerRoleClaims.length ? [pair(`Historical executive roles explicitly stated by reviewed sources: ${formerRoleClaims.map((claim) => String(claim.normalizedValue)).join(", ")}`, `已审查来源明确陈述的历史高管职位：${formerRoleClaims.map((claim) => String(claim.normalizedValue)).join("、")}`)] : []),
      ...sourceParagraphs(supportedLeadershipEvidence, pair("leadership", "管理层")),
      pair("Ownership is unverified. A founder, CEO, or executive is not treated as an owner without separate supporting evidence", "所有权尚未验证。创始人、CEO 或高管在没有独立支持证据时不会被视为所有者"),
    ], locale, unique([...leadershipClaims.map((item) => item.claimId), ...claimIdsForEvidence(claims, supportedLeadershipEvidence)]), evidenceIds(supportedLeadershipEvidence)),
    quickSection(3, [
      ...(hiring?.status === "success_with_jobs"
        ? [pair(
          `${hiring.summary.totalOpenRoles} public open roles were observed through ${hiring.adapter ?? "a careers source"} on ${hiring.summary.sources[0]?.retrievedAt.slice(0, 10) ?? "the research date"}. This is a point-in-time observation, not a historical hiring trend or employee-growth measure`,
          `通过 ${hiring.adapter ?? "招聘来源"} 于 ${hiring.summary.sources[0]?.retrievedAt.slice(0, 10) ?? "研究日期"} 观察到 ${hiring.summary.totalOpenRoles} 个公开开放职位。这只是时点观察，不代表历史招聘趋势或员工增长`,
        )]
        : atsLinks.length ? [pair(`Public ATS links were found on the company website, but a current normalized role count is unavailable. Source examples: ${atsLinks.slice(0, 3).join("; ")}`, `公司网站含公开 ATS 链接，但当前标准化职位数量不可用。来源示例：${atsLinks.slice(0, 3).join("；")}`), pair("Links are discovery evidence, not a verified count of open positions or a hiring trend", "链接属于发现证据，不等于经过核验的开放职位数量或招聘趋势")]
          : [pair("No current public job-opening feed was identified from the reviewed pages", "在已审查页面中未识别当前公开职位列表")]),
      ...sourceParagraphs(hiringEvidence, pair("hiring", "招聘")),
    ], locale, claimIdsForEvidence(claims, hiringEvidence), evidenceIds(hiringEvidence)),
    quickSection(4, [
      ...(addresses.length ? [pair(`Public business locations: ${addresses.join("; ")}`, `公开业务地点：${addresses.join("；")}`)] : []),
      ...(phoneNumbers.length ? [pair(`Public business phone: ${phoneNumbers.join(", ")}`, `公开业务电话：${phoneNumbers.join("、")}`)] : []),
      pair(`Website: ${graph.domains[0] ? `https://${graph.domains[0]}` : "Not identified"}`, `网站：${graph.domains[0] ? `https://${graph.domains[0]}` : "未识别"}`),
      pair("Only public business contact channels are included; personal emails, mobile numbers, and residential addresses are excluded", "仅包含公开业务联系渠道；个人邮箱、手机号码和住宅地址均已排除"),
    ], locale),
    quickSection(5, [
      ...(relationshipClaims.length
        ? sourceParagraphs(relationshipEvidence, pair("customers and partners", "客户与合作伙伴"))
        : [pair("No attributable customer or partner fact was established from the reviewed original pages", "已审查的原始页面未能建立可归属的客户或合作伙伴事实")]),
      pair("No customer or partner relationship is presented as confirmed unless supported by the company and/or counterparty. Search-discovered pages remain review leads until the original page supplies attributable evidence", "除非得到公司和/或交易对手支持，否则客户或合作关系不会标示为已确认。搜索发现页面只有在原始页面提供可归属证据后才会用于分析"),
    ], locale, relationshipClaims.map((item) => item.claimId), evidenceIds(relationshipEvidence)),
    quickSection(6, [
      ...(activityClaims.length
        ? sourceParagraphs(activityEvidence, pair("recent business activity", "近期业务动态"))
        : [pair("No attributable dated business activity was established from the reviewed original pages", "已审查的原始页面未能建立可归属且有日期的业务动态")]),
      pair("Recent activity is limited to dated or retrieved original-page evidence in the source register. No unsupported event timeline is generated", "近期活动仅限来源登记册中有日期或检索记录的原始页面证据。不会生成无依据的事件时间线"),
    ], locale, activityClaims.map((item) => item.claimId), evidenceIds(activityEvidence)),
    quickSection(7, [
      ...(atsLinks.length ? [pair("Attention item: public careers infrastructure is visible; current role counts are based only on distinct public role links", "关注项：公开招聘基础设施可见；当前职位数量仅按不同的公开职位链接统计")] : []),
      pair("Attention item: ownership, revenue, and relationship coverage remain incomplete in public sources", "关注项：公开来源中的所有权、收入和关系覆盖仍不完整"),
      pair("These are evidence-linked commercial signals, not investment recommendations or management-quality judgments", "这些是与证据关联的商业信号，不构成投资建议或管理质量判断"),
    ], locale),
    quickSection(8, gaps.map((gap) => pair(`${gap.title.en} — ${gap.reason.en}`, `${gap.title.zh}——${gap.reason.zh}`)), locale, [], evidence.map((item) => item.evidenceId)),
  ];
  if (args.adaptiveResearch) {
    // Material statements link to individual evidence; missing topics remain explicit.
    for (const [topic,index] of [["overview",0],["products",1],["people",2],["recent",6]] as const) {
      const sourced = claims.filter(c=>c.researchFact?.topic===topic);
      if (!sourced.length) continue;
      const paragraphs = sourced.map(c => {
        const prefix = c.companyReported ? pair("Company-reported", "公司自行披露") : pair("Independently reported", "独立来源报道");
        const date = c.period ? ` (${c.period})` : "";
        return pair(`${prefix.en}${date}: ${c.statement}`, `${prefix.zh}${date}：${c.statement}`);
      });
      if (topic === "overview") paragraphs.unshift(pair(`User-confirmed target: ${graph.canonicalName}; ${graph.domains[0]}`, `用户确认目标：${graph.canonicalName}；${graph.domains[0]}`));
      if (topic === "people") paragraphs.push(pair("Roles are stated as of the source; ownership is not inferred.", "职位仅代表来源陈述；不据此推断所有权。"));
      sections[index] = quickSection(index, paragraphs, locale, sourced.map(c=>c.claimId), unique(sourced.flatMap(c=>c.evidenceIds)));
    }
    const coverage = args.adaptiveResearch.coverage.map(c=>pair(`${c.topic}: ${c.status}`, `${({overview:"公司概览",products:"产品与服务",people:"主要人员",recent:"近期动态"} as Record<string,string>)[c.topic] ?? c.topic}：${({"partial":"部分支持／仍有待核验信息","company-reported":"公司自行披露","independently-reported":"独立来源报道","conflicting":"存在冲突","searched-not-found":"已搜索但未找到可接受证据","source-unavailable":"来源不可用","not-researched":"未完成该项研究"} as Record<string,string>)[c.status]}`));
    coverage.push(pair("Ownership, revenue, IP and litigation were not researched. Missing public evidence is not evidence of absence.", "未开展股权、收入、知识产权及诉讼专项研究。缺少公开证据不代表不存在。"));
    sections[8] = quickSection(8,coverage,locale,[],evidence.map(e=>e.evidenceId));
  }
  if (args.fundingResearch) {
    const funding = args.fundingResearch;
    const paragraphs = [
      `Announcements: ${funding.announcementStatus}; SEC: ${funding.secStatus}. Bounded public-source research, not complete funding history.`,
      ...funding.events.flatMap((event) => [
        ...Object.entries(event.fields).map(([key, field]) => `${key}: ${field.value} — ${field.sourceUrl} (${field.locator}; retrieved ${field.retrievedAt}). Supporting excerpt: ${field.excerpt}`),
        ...event.limitations,
      ]), ...funding.gaps, ...new Set(funding.limitations),
    ];
    sections.push({ sectionId: "funding", number: "10", title: { en: "Funding research", zh: "融资研究" }, paragraphs,
      paragraphsByLocale: { en: paragraphs, zh: paragraphs },
      claimIds: claims.filter((claim) => claim.fundingEventId).map((claim) => claim.claimId),
      evidenceIds: unique(funding.events.flatMap((event) => Object.values(event.fields).map((field) => field.evidenceId))),
    });
  }
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
    coverageStatus: coverage, providerPlan: args.providerPlan, evidence, claims, conflicts: args.conflicts ?? [], risks: [],
    fundingResearch: args.fundingResearch, adaptiveResearch:args.adaptiveResearch,
    informationGaps: (args.adaptiveResearch ? gaps.filter(g=>g.category!=="hiring" || !["success_with_jobs","success_zero_jobs"].includes(hiring?.status ?? "")) : gaps).map((gap, index) => ({ gapId: `quick-gap-${index + 1}`, category: gap.category, missingInformation: gap.title.en, whyItMatters: gap.reason.en, affectedClaims: [], affectedSections: ["09"], priority: "Medium", recommendedEvidence: [gap.recommendedEvidence.en], publicSearchCoverage: "Quick public-source workflow" })),
    questions: [], relationships: [],
    businessModel: { products, services, customerTypes: [], industryVerticals: [], revenueModel: null, pricingModel: null, salesMotion: null, deliveryModel: null, recurringRevenueStatus: null, geographicExposure: [], valueChainPosition: null, keyPartners: [], keySuppliers: [], capitalIntensity: null, operatingDependencies: [], businessModelEvidenceIds: evidence.map((item) => item.evidenceId) },
    sections, references,
    disclosure: disclosureByLocale[locale], disclosureByLocale,
    methodologyLimitations: methodologyLimitationsByLocale[locale], methodologyLimitationsByLocale,
    hiringIntelligence: args.hiringIntelligence ?? null,
  };
}
