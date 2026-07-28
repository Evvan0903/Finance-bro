import type {
  ComparisonValue,
  CreditId,
  IndustryId,
  LocalText,
  ObjectiveId,
  PlanId,
  ProductId,
  RegulatoryLocale,
  RoleId,
  ScenarioAnswerValue,
  ScenarioQuestionId,
} from "./types";

export type LocalizedOption<T extends string> = {
  id: T;
  label: LocalText;
  status?: "Supported" | "Planned";
};

export const INDUSTRY_OPTIONS: LocalizedOption<IndustryId>[] = [
  {
    id: "ev-battery-materials",
    label: { en: "EV Battery Materials", zh: "电动汽车电池材料" },
    status: "Supported",
  },
  {
    id: "battery-cells-modules",
    label: { en: "Battery Cells and Modules", zh: "电芯和电池模组" },
    status: "Planned",
  },
  {
    id: "energy-storage",
    label: { en: "Energy Storage", zh: "储能" },
    status: "Planned",
  },
  {
    id: "critical-minerals",
    label: { en: "Critical Minerals", zh: "关键矿物" },
    status: "Planned",
  },
  {
    id: "automotive-components",
    label: { en: "Automotive Components", zh: "汽车零部件" },
    status: "Planned",
  },
  {
    id: "solar-manufacturing",
    label: { en: "Solar Manufacturing", zh: "太阳能制造" },
    status: "Planned",
  },
  {
    id: "advanced-manufacturing",
    label: { en: "Other Advanced Manufacturing", zh: "其他先进制造" },
    status: "Planned",
  },
];

export const ROLE_OPTIONS: LocalizedOption<RoleId>[] = [
  {
    id: "chinese-material-manufacturer",
    label: { en: "Chinese Material Manufacturer", zh: "中国材料制造商" },
  },
  {
    id: "technology-owner",
    label: { en: "Technology Owner or Licensor", zh: "技术所有者或许可方" },
  },
  {
    id: "us-jv-participant",
    label: {
      en: "U.S. Manufacturing Joint Venture Participant",
      zh: "美国制造合资企业参与方",
    },
  },
  {
    id: "battery-supplier",
    label: {
      en: "Supplier to a U.S. Battery Manufacturer",
      zh: "美国电池制造商供应商",
    },
  },
  {
    id: "storage-supplier",
    label: {
      en: "Supplier to an Energy Storage Project",
      zh: "储能项目供应商",
    },
  },
  {
    id: "manufacturing-investor",
    label: {
      en: "Investor in a U.S. Manufacturing Project",
      zh: "美国制造项目投资者",
    },
  },
];

export const PLAN_OPTIONS: LocalizedOption<PlanId>[] = [
  { id: "us-factory", label: { en: "Build a U.S. Factory", zh: "建设美国工厂" } },
  { id: "us-jv", label: { en: "Form a U.S. Joint Venture", zh: "成立美国合资企业" } },
  {
    id: "license-technology",
    label: { en: "License Technology to a U.S. Company", zh: "向美国公司许可技术" },
  },
  {
    id: "supply-materials",
    label: { en: "Supply Materials to a U.S. Customer", zh: "向美国客户供应材料" },
  },
  {
    id: "localize-supply-chain",
    label: { en: "Localize Part of the Supply Chain", zh: "实现部分供应链本地化" },
  },
  {
    id: "compare-structures",
    label: { en: "Compare Multiple Structures", zh: "比较多种结构" },
  },
];

export const OBJECTIVE_OPTIONS: LocalizedOption<ObjectiveId>[] = [
  {
    id: "reduce-pfe-exposure",
    label: { en: "Reduce potential PFE exposure", zh: "降低潜在 PFE 风险敞口" },
  },
  {
    id: "preserve-customer-readiness",
    label: {
      en: "Preserve downstream customer tax-credit readiness",
      zh: "保持下游客户的税收抵免准备程度",
    },
  },
  {
    id: "compare-equity-licensing",
    label: {
      en: "Compare equity and licensing structures",
      zh: "比较股权与技术许可结构",
    },
  },
  {
    id: "increase-localization",
    label: { en: "Increase U.S. localization", zh: "提高美国本地化程度" },
  },
  {
    id: "prepare-customer-review",
    label: {
      en: "Prepare for customer compliance review",
      zh: "准备客户合规审查",
    },
  },
  {
    id: "identify-requirements",
    label: {
      en: "Identify key regulatory requirements",
      zh: "识别关键监管要求",
    },
  },
];

export const PRODUCT_OPTIONS: LocalizedOption<ProductId>[] = [
  {
    id: "cathode-active-material",
    label: { en: "Cathode Active Material", zh: "正极活性材料" },
  },
  {
    id: "anode-active-material",
    label: { en: "Anode Active Material", zh: "负极活性材料" },
  },
  { id: "battery-cell", label: { en: "Battery Cell", zh: "电芯" } },
  { id: "battery-module", label: { en: "Battery Module", zh: "电池模组" } },
  {
    id: "energy-storage-technology",
    label: { en: "Energy Storage Technology", zh: "储能技术" },
  },
  {
    id: "applicable-critical-mineral",
    label: { en: "Applicable Critical Mineral", zh: "适用关键矿物" },
  },
  {
    id: "other-battery-component",
    label: {
      en: "Other Qualifying Battery Component",
      zh: "其他符合条件的电池组件",
    },
  },
  { id: "not-sure", label: { en: "Not Sure", zh: "不确定" } },
];

export const CREDIT_OPTIONS: LocalizedOption<CreditId>[] = [
  {
    id: "45X",
    label: {
      en: "Section 45X Advanced Manufacturing Production Credit",
      zh: "Section 45X 先进制造生产税收抵免",
    },
  },
  {
    id: "48E",
    label: {
      en: "Section 48E Clean Electricity Investment Credit",
      zh: "Section 48E 清洁电力投资税收抵免",
    },
  },
  {
    id: "45Y",
    label: {
      en: "Section 45Y Clean Electricity Production Credit",
      zh: "Section 45Y 清洁电力生产税收抵免",
    },
  },
  {
    id: "downstream",
    label: {
      en: "Downstream customer credit eligibility",
      zh: "下游客户税收抵免资格",
    },
  },
  { id: "not-sure", label: { en: "Not Sure", zh: "不确定" } },
];

export const ANSWER_OPTIONS: LocalizedOption<ScenarioAnswerValue>[] = [
  { id: "yes", label: { en: "Yes", zh: "是" } },
  { id: "no", label: { en: "No", zh: "否" } },
  { id: "not-sure", label: { en: "Not Sure", zh: "不确定" } },
];

export const TARGET_YEAR_OPTIONS = Array.from(
  { length: 10 },
  (_, index) => 2026 + index,
);

export const SCENARIO_QUESTION_COPY: Record<ScenarioQuestionId, LocalText> = {
  "sfe-equity": {
    en: "Will a Chinese or other potential SFE own equity in the U.S. entity",
    zh: "中国或其他潜在 SFE 是否会持有美国实体的股权",
  },
  "multiple-sfe-equity": {
    en: "Will multiple Chinese or other potential SFE investors own equity in the U.S. entity",
    zh: "多个中国或其他潜在 SFE 投资者是否会持有美国实体的股权",
  },
  "appointment-right": {
    en: "Will a Chinese or other potential SFE have authority to appoint a director or senior officer",
    zh: "中国或其他潜在 SFE 是否有权任命董事或高级管理人员",
  },
  "sfe-debt": {
    en: "Will a Chinese or other potential SFE provide shareholder loans, convertible debt, or other debt financing",
    zh: "中国或其他潜在 SFE 是否会提供股东贷款、可转换债务或其他债务融资",
  },
  "sfe-license": {
    en: "Will the U.S. entity use technology licensed from a Chinese or other potential SFE",
    zh: "美国实体是否会使用由中国或其他潜在 SFE 许可的技术",
  },
  "supplier-direction": {
    en: "Will the technology provider select or direct suppliers",
    zh: "技术提供方是否会选择或指示供应商",
  },
  "production-direction": {
    en: "Will the technology provider direct production operations",
    zh: "技术提供方是否会指导生产运营",
  },
  "quantity-timing": {
    en: "Will the technology provider determine production volume or timing",
    zh: "技术提供方是否会决定生产数量或时间安排",
  },
  "customer-output-restriction": {
    en: "Will the technology provider restrict customers or use of production output",
    zh: "技术提供方是否会限制客户或生产产出的使用",
  },
  "exclusive-equipment-rights": {
    en: "Will the technology provider retain exclusive equipment operation, repair, or maintenance rights",
    zh: "技术提供方是否会保留设备操作、维修或维护的专有权利",
  },
  "royalty-over-ten-years": {
    en: "Will royalty or related payments continue beyond ten years",
    zh: "特许权使用费或相关付款是否会持续超过十年",
  },
  "services-over-two-years": {
    en: "Will required technical services continue beyond two years",
    zh: "强制性技术服务是否会持续超过两年",
  },
  "complete-technical-transfer": {
    en: "Will the U.S. operator receive all technical data, information, and know-how needed to operate independently",
    zh: "美国运营方是否会获得独立运营所需的全部技术数据、信息和专有知识",
  },
  "pfe-materials": {
    en: "Will key materials continue to be mined, produced, or manufactured by potential PFEs",
    zh: "关键材料是否仍将由潜在 PFE 开采、生产或制造",
  },
  "substantial-us-manufacturing": {
    en: "Will substantial manufacturing occur in the United States",
    zh: "是否会在美国开展实质性制造活动",
  },
  "customer-credit-claim": {
    en: "Does a downstream customer expect to claim a federal energy tax credit",
    zh: "下游客户是否预计申请联邦能源税收抵免",
  },
};

export const RESULT_SECTION_TITLES = [
  { number: "01", en: "User Scenario", zh: "用户情景" },
  {
    number: "02",
    en: "Potentially Applicable Federal Programs",
    zh: "可能适用的联邦项目",
  },
  { number: "03", en: "Key Regulatory Issues", zh: "关键监管问题" },
  { number: "04", en: "Proposed Structures", zh: "建议结构" },
  {
    number: "05",
    en: "Proposed Structure Parameters",
    zh: "建议结构参数",
  },
  {
    number: "06",
    en: "Applicable Entity and Control Thresholds",
    zh: "适用的实体与控制阈值",
  },
  {
    number: "07",
    en: "Applicable MACR Thresholds",
    zh: "适用的 MACR 阈值",
  },
  { number: "08", en: "Structure Comparison", zh: "结构比较" },
  { number: "09", en: "Proposed Direction", zh: "建议方向" },
  {
    number: "10",
    en: "Information Needed for Actual Eligibility Analysis",
    zh: "实际资格分析所需信息",
  },
  {
    number: "11",
    en: "Questions for Legal and Tax Counsel",
    zh: "供法律与税务顾问审阅的问题",
  },
  {
    number: "12",
    en: "Methodology and Limitations",
    zh: "方法与局限",
  },
  { number: "13", en: "References", zh: "参考资料" },
] as const;

export const COMPARISON_LABELS: Record<
  RegulatoryLocale,
  Record<ComparisonValue, string>
> = {
  en: {
    Lower: "Lower",
    Medium: "Medium",
    Higher: "Higher",
    "Depends on facts": "Depends on facts",
    "Not applicable": "Not applicable",
    "Further review required": "Further review required",
  },
  zh: {
    Lower: "较低",
    Medium: "中等",
    Higher: "较高",
    "Depends on facts": "取决于具体事实",
    "Not applicable": "不适用",
    "Further review required": "需要进一步审查",
  },
};

export const NORA_COPY = {
  en: {
    languagePicker: "Switch workflow language",
    brandHome: "Return to the FinBro team workspace",
    headerName: "Nora",
    headerTitle: "Regulatory & Compliance Analyst",
    workflowName: "U.S. Battery Supply Chain PFE Analysis",
    heroTitle: "What are you planning",
    heroSubheading:
      "Explore possible structures, applicable thresholds, and official references for a U.S. battery-supply-chain strategy",
    productDescription:
      "Explore possible U.S. investment, licensing, manufacturing, and supply-chain structures based on current official PFE rules and federal energy-credit guidance",
    workflowType: "Scenario-Based Regulatory Strategy Assistant",
    stepLabel: "Step",
    ofLabel: "of",
    status: {
      supported: "Supported",
      planned: "Planned",
      inDevelopment: "In Development",
      current: "Current",
      pendingVerification: "Pending Verification",
      currentSourceVerificationRequired: "Current-source verification required",
      highReviewPriority: "High legal-review priority",
    },
    steps: {
      industry: "Select your industry",
      role: "What is your role in the U.S. supply chain",
      plan: "What are you planning",
      objective: "What is your primary objective",
      product: "What product is involved",
      credit: "Which federal credit is relevant",
      year: "Select the relevant year",
      questions: "Answer the scenario questions",
      review: "Review scenario",
      generate: "Generate proposed structures",
    },
    yearContext: {
      sale: "Component or mineral sale year",
      construction: "Construction-begin year",
      transaction: "Planned transaction year",
    },
    buttons: {
      back: "Back",
      next: "Continue",
      review: "Review scenario",
      generate: "Ask Nora to propose possible structures",
      startOver: "Start over",
      editScenario: "Edit scenario",
      downloadPdf: "Download PDF",
      downloadingPdf: "Preparing PDF",
      downloadMarkdown: "Download Markdown",
      print: "Print report",
      openOfficialSource: "Open official source ↗",
      returnHome: "Return to the FinBro team",
    },
    loading: [
      "Nora is checking which rule applies to the selected year",
      "Nora is separating ownership risk from contractual control",
      "Nora is matching the product to the correct MACR table",
      "Nora is checking whether the cited guidance is still current",
      "Nora is building three structures for comparison",
    ],
    validation: {
      required: "Select an option before continuing.",
      answerAll: "Answer each displayed question before continuing.",
      unsupported:
        "This industry is Planned and cannot generate a completed regulatory proposal in this version.",
      invalidScenario:
        "The scenario could not be validated. Review the selected answers and try again.",
    },
    reviewLabels: {
      industry: "Industry",
      role: "Company role",
      plan: "Business plan",
      objective: "Primary objective",
      product: "Product category",
      credit: "Relevant credit",
      year: "Target year",
      responses: "User responses",
      uncertainties: "Identified uncertainties",
    },
    tableLabels: {
      parameter: "Parameter",
      proposedValue: "Proposed value",
      legalTrigger: "Legal trigger or consideration",
      whyItMatters: "Why it matters",
      referenceNumber: "Reference number",
      topic: "Topic",
      currentTrigger: "Current trigger or threshold",
      relevantEvent: "Relevant event",
      applicableYear: "Applicable year",
      percentage: "Percentage",
      ruleStatus: "Rule status",
      lastVerified: "Last verified",
      reference: "Reference",
      structure: "Structure",
      dimension: "Comparison dimension",
      program: "Applicable program",
      productOrProject: "Applicable product or project",
    },
    reportLabels: {
      generatedAt: "Generated",
      proposedStructureForReview: "Proposed structure for professional review",
      screeningParameter: "Screening parameter",
      legalThreshold: "Legal threshold",
      keyConsiderations: "Key considerations",
      riskLabel: "Professional-review priority",
      potentialPrograms: "Relevant official authorities identified for this scenario",
      formula: "Informational formula",
      sourceCoverage: "Source coverage status",
      rulesLastVerified: "Rules last verified",
      officialSourcesReviewed: "Official sources reviewed",
      interimGuidance: "Interim or proposed guidance identified",
      supersedingGuidance: "Potentially superseding guidance found",
      sourceGaps: "Unresolved source gaps",
      publicationDate: "Publication or enactment date",
      effectiveDate: "Effective date",
      issuingAuthority: "Issuing authority",
      sourceType: "Source type",
      relevantSections: "Relevant sections",
      relevance: "Why this source matters",
      actualDetermination: "No actual PFE status or tax-credit eligibility determination has been made.",
    },
    comparisonDimensions: {
      singleEquity: "Single-SFE equity exposure",
      aggregateEquity: "Aggregate-SFE equity exposure",
      debt: "Debt exposure",
      appointment: "Covered-officer appointment exposure",
      contractualControl: "Contractual effective-control risk",
      technologyTransfer: "Technology-transfer burden",
      operationalIndependence: "U.S. operational independence",
      localization: "Supply-chain localization burden",
      customerReadiness: "Customer tax-credit readiness",
      documentation: "Documentation burden",
      implementationCost: "Implementation cost",
      timeToLaunch: "Time to launch",
      reviewPriority: "Professional-review priority",
    },
    informational: {
      proposedValuesNote:
        "Proposed values are planning parameters for professional review and are not legal safe harbors.",
      screeningFiguresNote:
        "These figures are screening parameters and not statutory safe harbors.",
      licensingWarning:
        "Current law and interim guidance identify multiple technology-licensing and contractual-control features as potential effective-control factors.",
      notSureCredit:
        "The selected credit is uncertain. The report identifies programs that may be relevant without asserting that a particular credit applies.",
      mineralThresholdCaveat:
        "Treasury is directed to issue adjusted mineral-specific thresholds. Newer official guidance must be checked before relying on the generic table.",
      macrDataCaveat:
        "No MACR percentage has been calculated because direct material or manufactured-product cost inputs were not collected.",
      methodology:
        "The proposal engine applies structured scenario answers to a versioned regulatory rule registry, selects deterministic structure templates, and attaches official-source references.",
      limitations:
        "This workflow does not collect ownership records, agreements, cost data, supplier certifications, or other documents required for an actual legal or tax-credit determination.",
      freshness:
        "Rules labeled as interim, pending, stale, or affected by unresolved source gaps require current-source verification before a definitive recommendation.",
    },
    disclaimer: [
      "FinBro identifies potential regulatory and tax-credit considerations using user-selected scenarios and referenced public guidance.",
      "FinBro does not provide legal or tax advice, guarantee compliance, determine final credit eligibility, or replace qualified legal, tax, audit, or regulatory professionals.",
    ],
    footer: "Generated with FinBro · Evidence-backed regulatory research",
    footerSecondary: "Research workflow assisted by Nora",
  },
  zh: {
    languagePicker: "切换工作流语言",
    brandHome: "返回 FinBro 团队工作台",
    headerName: "Nora",
    headerTitle: "监管与合规分析师",
    workflowName: "美国电池供应链 PFE 分析",
    heroTitle: "你计划采用什么方式",
    heroSubheading: "探索美国电池供应链战略的可行结构、适用阈值和官方参考资料",
    productDescription:
      "根据当前官方 PFE 规则和联邦能源税收抵免指南，探索可能的美国投资、技术许可、制造和供应链结构",
    workflowType: "情景式监管策略助手",
    stepLabel: "步骤",
    ofLabel: "共",
    status: {
      supported: "已支持",
      planned: "计划中",
      inDevelopment: "开发中",
      current: "当前有效",
      pendingVerification: "待核验",
      currentSourceVerificationRequired: "需要核验当前来源",
      highReviewPriority: "法律审查高优先级",
    },
    steps: {
      industry: "选择你的行业",
      role: "你在美国供应链中扮演什么角色",
      plan: "你计划采用什么方式",
      objective: "你的主要目标是什么",
      product: "涉及什么产品",
      credit: "涉及哪项联邦税收抵免",
      year: "选择相关年份",
      questions: "回答情景问题",
      review: "审阅情景",
      generate: "生成建议结构",
    },
    yearContext: {
      sale: "组件或矿物销售年份",
      construction: "开工年份",
      transaction: "计划交易年份",
    },
    buttons: {
      back: "返回",
      next: "继续",
      review: "审阅情景",
      generate: "请 Nora 提出可能的结构",
      startOver: "重新开始",
      editScenario: "编辑情景",
      downloadPdf: "下载 PDF",
      downloadingPdf: "正在准备 PDF",
      downloadMarkdown: "下载 Markdown",
      print: "打印报告",
      openOfficialSource: "打开官方来源 ↗",
      returnHome: "返回 FinBro 团队",
    },
    loading: [
      "Nora 正在核对所选年份适用的规则",
      "Nora 正在区分所有权风险与合同控制",
      "Nora 正在将产品匹配到正确的 MACR 表格",
      "Nora 正在核对引用指南是否仍然有效",
      "Nora 正在构建三种结构进行比较",
    ],
    validation: {
      required: "请先选择一个选项。",
      answerAll: "请回答所有显示的问题后再继续。",
      unsupported: "该行业仍在计划中，本版本无法生成完整的监管建议。",
      invalidScenario: "情景未通过验证，请检查所选答案后重试。",
    },
    reviewLabels: {
      industry: "行业",
      role: "公司角色",
      plan: "业务计划",
      objective: "主要目标",
      product: "产品类别",
      credit: "相关税收抵免",
      year: "目标年份",
      responses: "用户回答",
      uncertainties: "已识别的不确定事项",
    },
    tableLabels: {
      parameter: "参数",
      proposedValue: "建议值",
      legalTrigger: "法律触发条件或考虑因素",
      whyItMatters: "为何重要",
      referenceNumber: "参考编号",
      topic: "主题",
      currentTrigger: "当前触发条件或阈值",
      relevantEvent: "相关事件",
      applicableYear: "适用年份",
      percentage: "百分比",
      ruleStatus: "规则状态",
      lastVerified: "最后核验日期",
      reference: "参考资料",
      structure: "结构",
      dimension: "比较维度",
      program: "适用项目",
      productOrProject: "适用产品或项目",
    },
    reportLabels: {
      generatedAt: "生成时间",
      proposedStructureForReview: "供专业审阅的建议结构",
      screeningParameter: "筛查参数",
      legalThreshold: "法律阈值",
      keyConsiderations: "主要考虑事项",
      riskLabel: "专业审查优先级",
      potentialPrograms: "已识别与该情景相关的官方权威文件",
      formula: "信息性公式",
      sourceCoverage: "来源覆盖状态",
      rulesLastVerified: "规则最后核验日期",
      officialSourcesReviewed: "已审阅的官方来源",
      interimGuidance: "已识别的临时或拟议指南",
      supersedingGuidance: "发现的潜在替代性指南",
      sourceGaps: "尚未解决的来源缺口",
      publicationDate: "发布或颁布日期",
      effectiveDate: "生效日期",
      issuingAuthority: "发布机构",
      sourceType: "来源类型",
      relevantSections: "相关章节",
      relevance: "该来源的重要性",
      actualDetermination: "本报告未对实际 PFE 身份或税收抵免资格作出认定。",
    },
    comparisonDimensions: {
      singleEquity: "单一 SFE 股权风险",
      aggregateEquity: "SFE 合计股权风险",
      debt: "债务风险",
      appointment: "受涵盖管理人员任命权风险",
      contractualControl: "合同有效控制风险",
      technologyTransfer: "技术转移负担",
      operationalIndependence: "美国运营独立性",
      localization: "供应链本地化负担",
      customerReadiness: "客户税收抵免准备程度",
      documentation: "文件准备负担",
      implementationCost: "实施成本",
      timeToLaunch: "启动时间",
      reviewPriority: "专业审查优先级",
    },
    informational: {
      proposedValuesNote: "建议值仅为专业审阅所用的规划参数，并非法律安全港。",
      screeningFiguresNote: "这些数值是筛查参数，并非法定安全港。",
      licensingWarning: "现行法律和临时指南将多项技术许可与合同控制特征列为潜在有效控制因素。",
      notSureCredit: "所选税收抵免尚不确定。本报告会识别可能相关的项目，但不会断言某项特定抵免适用。",
      mineralThresholdCaveat:
        "财政部被要求发布按矿物调整的阈值。在依赖通用表格前，必须核对更新的官方指南。",
      macrDataCaveat:
        "由于未收集直接材料或制成品成本数据，本报告未计算实际 MACR 百分比。",
      methodology:
        "建议引擎将结构化情景答案应用于版本化监管规则库，确定性选择结构模板，并附加官方来源参考。",
      limitations:
        "本工作流不收集实际法律或税收抵免认定所需的所有权记录、协议、成本数据、供应商证明或其他文件。",
      freshness:
        "标记为临时、待核验、过期或存在未解决来源缺口的规则，在提出明确建议前必须进行当前来源核验。",
    },
    disclaimer: [
      "FinBro 根据用户选择的情景和所引用的公开指南，识别潜在监管与税收抵免考虑事项。",
      "FinBro 不提供法律或税务建议，不保证合规，不认定最终税收抵免资格，也不能替代合格的法律、税务、审计或监管专业人士。",
    ],
    footer: "由 FinBro 生成 · 有依据的监管研究",
    footerSecondary: "研究工作流由 Nora 协助完成",
  },
} as const;

export function localizeOption<T extends string>(
  option: LocalizedOption<T>,
  locale: RegulatoryLocale,
) {
  return option.label[locale];
}

export function localizeQuestion(
  questionId: ScenarioQuestionId,
  locale: RegulatoryLocale,
) {
  return SCENARIO_QUESTION_COPY[questionId][locale];
}
