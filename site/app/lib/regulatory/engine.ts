import { SCENARIO_QUESTION_COPY } from "./copy";
import { ENTITY_AND_CONTROL_RULES, EFFECTIVE_CONTROL_RULES, getMacrRule, registryHasPendingRules } from "./rules";
import { dynamicScenarioQuestions, identifiedUncertaintyIds } from "./scenario";
import { validateRegulatoryScenario } from "./schema";
import { LEGAL_SOURCES, RULES_VERIFIED_AT } from "./sources";
import { STRUCTURE_TEMPLATES } from "./structures";
import type {
  LegalSource,
  ProposedStructure,
  RegulatoryLocale,
  RegulatoryProposalReport,
  RegulatoryRule,
  RegulatoryScenario,
  RiskFactor,
  StructureComparison,
  StructureTemplate,
} from "./types";

const t = (locale: RegulatoryLocale, en: string, zh: string) => locale === "zh" ? zh : en;

const QUESTION_TO_RULE_TOPICS: Partial<Record<string, RegulatoryRule["topic"][]>> = {
  "sfe-equity": ["single-sfe-ownership"],
  "multiple-sfe-equity": ["aggregate-sfe-ownership"],
  "appointment-right": ["covered-officer-appointment"],
  "sfe-debt": ["sfe-debt"],
  "sfe-license": ["effective-control", "licensing-date"],
  "supplier-direction": ["supplier-direction"],
  "production-direction": ["production-direction"],
  "quantity-timing": ["output-restriction"],
  "customer-output-restriction": ["output-restriction"],
  "exclusive-equipment-rights": ["exclusive-equipment-rights"],
  "royalty-over-ten-years": ["royalty-duration"],
  "services-over-two-years": ["service-duration"],
  "complete-technical-transfer": ["technical-data-transfer"],
};

function selectedControlRules(scenario: RegulatoryScenario) {
  const topics = new Set<RegulatoryRule["topic"]>();
  for (const answer of scenario.answers) {
    if (answer.value !== "no") {
      for (const topic of QUESTION_TO_RULE_TOPICS[answer.questionId] ?? []) topics.add(topic);
    }
  }
  if (scenario.plan === "license-technology") {
    ["supplier-direction", "production-direction", "effective-control", "royalty-duration",
      "service-duration", "technical-data-transfer", "licensing-date"].forEach((topic) =>
      topics.add(topic as RegulatoryRule["topic"]),
    );
  }
  return EFFECTIVE_CONTROL_RULES.filter((rule) => topics.has(rule.topic));
}

function riskFactorsFor(
  template: StructureTemplate,
  scenario: RegulatoryScenario,
): RiskFactor[] {
  const factors: RiskFactor[] = [];
  const answer = (id: string) => scenario.answers.find((item) => item.questionId === id)?.value;
  if (template.structureId === "minority-jv" && answer("sfe-equity") !== "no") {
    factors.push({
      factorId: "ownership-review",
      label: { en: "Ownership, attribution, governance, and debt require combined review", zh: "所有权、归属、治理和债务需要合并审查" },
      severity: "Higher",
      sourceIds: ["PL119-21", "NOTICE-2026-15"],
    });
  }
  if (template.structureId === "technology-license") {
    factors.push({
      factorId: "licensing-review",
      label: { en: "Each listed licensing factor may be independently determinative", zh: "每项列举许可因素均可能单独具有决定性" },
      severity: "Further review required",
      sourceIds: ["PL119-21", "NOTICE-2026-15"],
    });
  }
  if (answer("pfe-materials") !== "no") {
    factors.push({
      factorId: "material-sourcing",
      label: { en: "PFE-attributable materials may reduce the applicable MACR", zh: "PFE 应占材料可能降低适用 MACR" },
      severity: answer("pfe-materials") === "yes" ? "Higher" : "Further review required",
      sourceIds: ["PL119-21", "NOTICE-2026-15"],
    });
  }
  return factors;
}

function structureOrder(plan: RegulatoryScenario["plan"]) {
  if (plan === "us-jv") return ["minority-jv", "us-controlled", "technology-license"];
  if (plan === "license-technology") return ["technology-license", "us-controlled", "minority-jv"];
  return ["us-controlled", "minority-jv", "technology-license"];
}

function proposedStructures(
  scenario: RegulatoryScenario,
  locale: RegulatoryLocale,
): ProposedStructure[] {
  const order = structureOrder(scenario.plan);
  return order.map((structureId, index) => {
    const template = STRUCTURE_TEMPLATES.find((item) => item.structureId === structureId)!;
    const notes = [];
    if (scenario.answers.some((answer) => answer.value === "not-sure")) {
      notes.push({
        en: "One or more scenario facts remain uncertain and require verification.",
        zh: "一个或多个情景事实仍不确定，需要核验。",
      });
    }
    if (scenario.plan === "license-technology" && structureId === "technology-license") {
      notes.push({
        en: "This option matches the selected plan but remains a very-high-priority legal review.",
        zh: "该方案与所选计划相符，但仍属于极高优先级法律审查事项。",
      });
    }
    if (locale === "zh" && notes.length === 0) {
      notes.push({ en: "Parameters require professional review.", zh: "相关参数需要专业审查。" });
    }
    return {
      ...template,
      rank: index + 1,
      scenarioNotes: notes,
      riskFactors: riskFactorsFor(template, scenario),
    };
  });
}

export function defaultStructureComparison(): StructureComparison[] {
  const row = (
    en: string,
    zh: string,
    a: StructureComparison["values"]["minority-jv"],
    b: StructureComparison["values"]["us-controlled"],
    c: StructureComparison["values"]["technology-license"],
  ): StructureComparison => ({
    dimension: { en, zh },
    values: { "minority-jv": a, "us-controlled": b, "technology-license": c },
  });
  return [
    row("Single-SFE equity exposure", "单一 SFE 股权风险", "Medium", "Lower", "Lower"),
    row("Aggregate-SFE equity exposure", "SFE 合计股权风险", "Medium", "Lower", "Lower"),
    row("Debt exposure", "债务风险", "Medium", "Lower", "Lower"),
    row("Covered-officer appointment exposure", "受涵盖高管任命权风险", "Depends on facts", "Lower", "Lower"),
    row("Contractual effective-control risk", "合同有效控制风险", "Higher", "Medium", "Higher"),
    row("Technology-transfer burden", "技术转移负担", "Medium", "Higher", "Higher"),
    row("U.S. operational independence", "美国运营独立性", "Depends on facts", "Higher", "Depends on facts"),
    row("Supply-chain localization burden", "供应链本地化负担", "Medium", "Higher", "Medium"),
    row("Customer tax-credit readiness", "客户税收抵免准备程度", "Depends on facts", "Depends on facts", "Further review required"),
    row("Documentation burden", "文件准备负担", "Higher", "Medium", "Higher"),
    row("Implementation cost", "实施成本", "Higher", "Higher", "Medium"),
    row("Time to launch", "启动时间", "Medium", "Higher", "Lower"),
    row("Professional-review priority", "专业审查优先级", "Higher", "Medium", "Further review required"),
  ];
}

function isStale(asOf: string, verifiedAt: string, maximumDays = 180) {
  const elapsed = new Date(asOf).getTime() - new Date(verifiedAt).getTime();
  return elapsed > maximumDays * 86_400_000;
}

function sourceIdsForScenario(scenario: RegulatoryScenario, rules: RegulatoryRule[]) {
  const ids = new Set<string>(["PL119-21", "NOTICE-2026-15", "IRS-PFE-PAGE", "IR-2026-23"]);
  for (const rule of rules) rule.sourceIds.forEach((id) => ids.add(id));
  if (scenario.credit === "45X") ids.add("FORM-7207-2025");
  if (scenario.credit === "48E") ids.add("FORM-3468-2025");
  if (scenario.credit === "45Y") ids.add("FORM-7211-2025");
  if (scenario.credit === "not-sure" || scenario.credit === "downstream") {
    ["FORM-3468-2025", "FORM-7207-2025", "FORM-7211-2025"].forEach((id) => ids.add(id));
  }
  return [...ids];
}

export function generateRegulatoryProposal(
  scenario: RegulatoryScenario,
  locale: RegulatoryLocale,
  asOf = new Date().toISOString().slice(0, 10),
): RegulatoryProposalReport {
  const validation = validateRegulatoryScenario(scenario);
  if (!validation.success) throw new Error(validation.errors.join("; "));
  const controlRules = selectedControlRules(scenario);
  const macrRule =
    scenario.product && scenario.credit && scenario.year
      ? getMacrRule(scenario.product, scenario.credit, scenario.year)
      : null;
  const applicableRules = [...ENTITY_AND_CONTROL_RULES, ...controlRules, ...(macrRule ? [macrRule] : [])];
  const sourceIds = sourceIdsForScenario(scenario, applicableRules);
  const references = sourceIds
    .map((sourceId) => LEGAL_SOURCES.find((source) => source.sourceId === sourceId))
    .filter((source): source is LegalSource => Boolean(source))
    .map((source, index) => ({ number: index + 1, source }));
  const uncertaintyIds = identifiedUncertaintyIds(scenario);
  const uncertainties = uncertaintyIds.map((id) =>
    id in SCENARIO_QUESTION_COPY
      ? SCENARIO_QUESTION_COPY[id as keyof typeof SCENARIO_QUESTION_COPY][locale]
      : t(locale, "Credit program or product classification requires confirmation", "税收抵免项目或产品分类需要确认"),
  );
  if (!macrRule) {
    uncertainties.push(t(
      locale,
      "No single MACR table can be selected until the credit program and product classification are confirmed.",
      "在确认税收抵免项目和产品分类前，无法选择单一 MACR 表格。",
    ));
  }
  const pending = registryHasPendingRules(applicableRules);
  const stale = isStale(asOf, RULES_VERIFIED_AT);
  const definitiveBlocked = pending || stale;
  const structures = proposedStructures(scenario, locale);

  const proposedDirection = [
    t(
      locale,
      "Based on the selected scenario, the U.S.-controlled manufacturing structure presents fewer identified entity-level PFE triggers than the minority-equity and technology-licensing alternatives.",
      "根据所选情景，与少数股权和技术许可方案相比，美国控制制造结构显示出的实体层面 PFE 触发因素较少。",
    ),
    t(
      locale,
      "The minority-equity structure may remain a planning option only where ownership, aggregate ownership, debt, appointment authority, attribution, and contractual-control factors are fully addressed.",
      "只有在所有权、合计所有权、债务、任命权、归属和合同控制因素均得到充分处理时，少数股权结构才可能继续作为规划选项。",
    ),
    t(
      locale,
      "The technology-licensing alternative requires heightened review because current law and interim guidance identify several licensing and operational-control features as potential effective-control factors.",
      "技术许可方案需要加强审查，因为现行法律和临时指南将多项许可和运营控制特征列为潜在有效控制因素。",
    ),
    definitiveBlocked
      ? t(locale, "Current-source verification is required before any definitive recommendation.", "在提出任何明确建议前，需要核验当前来源。")
      : t(locale, "This is a proposed structure direction for professional review, not a compliance or eligibility determination.", "这是供专业审阅的结构建议方向，不是合规或资格认定。"),
  ];

  return {
    reportId: `nora-pfe-${asOf}-${scenario.year}`,
    generatedAt: asOf,
    locale,
    scenario,
    applicableRules,
    applicableMacrRule: macrRule,
    structures,
    comparison: defaultStructureComparison(),
    proposedDirection,
    uncertainties,
    informationNeeded: [
      t(locale, "Complete direct and indirect ownership data and attribution analysis", "完整的直接和间接所有权数据及归属分析"),
      t(locale, "Shareholder, governance, covered-officer appointment, and veto rights", "股东、治理、受涵盖高管任命和否决权"),
      t(locale, "Debt-financing instruments, original issuance facts, conversion rights, and related parties", "债务融资工具、初始发行事实、转换权和关联方"),
      t(locale, "Licensing, service, production-control, supplier-selection, and equipment-right terms", "许可、服务、生产控制、供应商选择和设备权利条款"),
      t(locale, "Technology-transfer completeness and independent operating capability", "技术转移完整性和独立运营能力"),
      t(locale, "Product classification, production and sale dates, and construction-begin date", "产品分类、生产和销售日期以及开工日期"),
      t(locale, "Direct material costs and PFE-attributable direct material costs", "直接材料成本和 PFE 应占直接材料成本"),
      t(locale, "Supplier identities, current official-list screening, and certifications", "供应商身份、当前官方名单筛查和证明"),
      t(locale, "Downstream customer credit program and filing position", "下游客户税收抵免项目和申报立场"),
    ],
    professionalQuestions: [
      { audience: { en: "U.S. tax counsel", zh: "美国税务律师" }, question: { en: "Which 45X, 45Y, or 48E rules apply to the selected product, project, and year?", zh: "哪些 45X、45Y 或 48E 规则适用于所选产品、项目和年份？" }, sourceIds: ["PL119-21", "NOTICE-2026-15"] },
      { audience: { en: "Corporate counsel", zh: "公司律师" }, question: { en: "How do direct and indirect ownership, attribution, appointment rights, and debt rules apply to the proposed entity?", zh: "直接和间接所有权、归属、任命权和债务规则如何适用于拟议实体？" }, sourceIds: ["PL119-21"] },
      { audience: { en: "Trade or regulatory counsel", zh: "贸易或监管律师" }, question: { en: "Do current DOD, DHS, or incorporated statutory entity lists identify any investor, supplier, licensor, or affiliate?", zh: "当前 DOD、DHS 或法定纳入名单是否识别任何投资者、供应商、许可方或关联方？" }, sourceIds: ["PL119-21"] },
      { audience: { en: "CPA or tax adviser", zh: "注册会计师或税务顾问" }, question: { en: "What verified cost data and records are required to calculate and substantiate the applicable MACR?", zh: "计算和证明适用 MACR 需要哪些经核验的成本数据和记录？" }, sourceIds: ["NOTICE-2026-15"] },
      { audience: { en: "Downstream customer tax team", zh: "下游客户税务团队" }, question: { en: "Which credit is expected to be claimed and what supplier evidence is required for the customer's position?", zh: "预计申请哪项抵免，客户立场需要哪些供应商证据？" }, sourceIds: ["IRS-PFE-PAGE"] },
      { audience: { en: "Legal and tax counsel", zh: "法律与税务顾问" }, question: { en: "Has newer Treasury or IRS guidance modified the current interim rules or reliance periods?", zh: "更新的财政部或 IRS 指南是否修改了当前临时规则或依赖期？" }, sourceIds: ["NOTICE-2026-15", "IR-2026-23"] },
    ],
    references,
    sourceCoverage: {
      status: definitiveBlocked ? "Current-source verification required" : "Current",
      rulesLastVerified: RULES_VERIFIED_AT,
      officialSourcesReviewed: LEGAL_SOURCES.length,
      interimOrProposedGuidance: ["Notice 2026-15 (Interim Guidance)"],
      potentiallySupersedingGuidance: [],
      unresolvedGaps: [
        t(locale, "Entity-specific matching against dynamic DOD and DHS lists was not performed", "未对动态 DOD 和 DHS 名单进行实体特定匹配"),
        t(locale, "Forthcoming proposed regulations and updated safe-harbor tables may change the analysis", "后续拟议法规和更新的安全港表格可能改变分析"),
      ],
    },
    disclaimer: [
      t(locale, "FinBro identifies potential regulatory and tax-credit considerations using user-selected scenarios and referenced public guidance.", "FinBro 根据用户选择的情景和所引用的公开指南，识别潜在监管与税收抵免考虑事项。"),
      t(locale, "FinBro does not provide legal or tax advice, guarantee compliance, determine final credit eligibility, or replace qualified legal, tax, audit, or regulatory professionals.", "FinBro 不提供法律或税务建议，不保证合规，不认定最终税收抵免资格，也不能替代合格的法律、税务、审计或监管专业人士。"),
    ],
  };
}

export function referencedSourceNumbers(report: RegulatoryProposalReport, sourceIds: string[]) {
  return report.references
    .filter((reference) => sourceIds.includes(reference.source.sourceId))
    .map((reference) => reference.number);
}

export function scenarioQuestionsAreComplete(scenario: RegulatoryScenario) {
  return dynamicScenarioQuestions(scenario).every((questionId) =>
    scenario.answers.some((answer) => answer.questionId === questionId),
  );
}

