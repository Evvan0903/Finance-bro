import { getLegalSource, RULES_VERIFIED_AT } from "./sources";
import type {
  CreditId,
  LegalSourceStatus,
  ProductId,
  RegulatoryRule,
  ThresholdTable,
} from "./types";

const statuteAndNotice = ["PL119-21", "NOTICE-2026-15"];

function entityRule(
  ruleId: string,
  topic: RegulatoryRule["topic"],
  label: RegulatoryRule["label"],
  description: RegulatoryRule["description"],
  triggerOperator: RegulatoryRule["triggerOperator"],
  triggerValue: number | string,
  unit: RegulatoryRule["unit"],
  sourceSections: string[],
  caveats: RegulatoryRule["caveats"],
): RegulatoryRule {
  return {
    ruleId,
    topic,
    label,
    description,
    triggerOperator,
    triggerValue,
    unit,
    applicableYear: "all",
    applicableEvent: { en: "Taxable-year entity status test", zh: "纳税年度实体身份测试" },
    applicableProduct: ["all"],
    applicableCredit: ["45X", "45Y", "48E", "downstream", "not-sure"],
    sourceIds: statuteAndNotice,
    sourceSections,
    ruleStatus: "Enacted",
    effectiveDate: "2025-07-04",
    lastVerifiedAt: RULES_VERIFIED_AT,
    caveats,
  };
}

export const ENTITY_AND_CONTROL_RULES: RegulatoryRule[] = [
  entityRule(
    "entity-single-sfe-25",
    "single-sfe-ownership",
    { en: "Single specified foreign entity ownership", zh: "单一特定外国实体所有权" },
    {
      en: "A single specified foreign entity owning at least 25% is a foreign-influenced-entity trigger.",
      zh: "单一特定外国实体持有至少 25% 构成外国影响实体触发条件。",
    },
    "at-least",
    25,
    "percent",
    ["IRC § 7701(a)(51)(D)(i)(I)(bb)", "Notice 2026-15 § 2.03"],
    {
      en: "Indirect ownership, attribution, and specified-foreign-entity status require separate analysis.",
      zh: "间接所有权、归属规则和特定外国实体身份仍需单独分析。",
    },
  ),
  entityRule(
    "entity-aggregate-sfe-40",
    "aggregate-sfe-ownership",
    { en: "Aggregate specified foreign entity ownership", zh: "特定外国实体合计所有权" },
    {
      en: "Aggregate ownership of at least 40% by one or more specified foreign entities is a trigger.",
      zh: "一个或多个特定外国实体合计持有至少 40% 构成触发条件。",
    },
    "at-least",
    40,
    "percent",
    ["IRC § 7701(a)(51)(D)(i)(I)(cc)", "Notice 2026-15 § 2.03"],
    {
      en: "Aggregation and attribution across direct and indirect holders must be reviewed.",
      zh: "必须审查直接和间接持有人之间的合计与归属。",
    },
  ),
  entityRule(
    "entity-sfe-debt-15",
    "sfe-debt",
    { en: "Debt issued to specified foreign entities", zh: "向特定外国实体发行的债务" },
    {
      en: "At least 15% of entity debt issued in aggregate to one or more specified foreign entities is a trigger.",
      zh: "实体债务中至少 15% 合计发行给一个或多个特定外国实体构成触发条件。",
    },
    "at-least",
    15,
    "percent",
    ["IRC § 7701(a)(51)(D)(i)(I)(dd)", "Notice 2026-15 § 2.03"],
    {
      en: "This V1 screening threshold is scoped to the private/non-public entity test. Publicly traded entities use a distinct debt formulation. Instrument classification, original issuance, related parties, conversion rights, and aggregation require counsel review.",
      zh: "该 V1 筛查阈值仅适用于非公众实体测试。上市实体采用不同的债务表述。工具分类、初始发行、关联方、转换权和合计方式需要专业顾问审查。",
    },
  ),
  entityRule(
    "entity-covered-officer-appointment",
    "covered-officer-appointment",
    { en: "Covered-officer appointment authority", zh: "任命受涵盖高管的权限" },
    {
      en: "Direct authority of a specified foreign entity to appoint a covered officer is a trigger.",
      zh: "特定外国实体直接任命受涵盖高管的权限构成触发条件。",
    },
    "any",
    "Any direct authority",
    "authority",
    ["IRC § 7701(a)(51)(D)(i)(I)(aa)", "Notice 2026-15 § 2.03"],
    {
      en: "Board, senior-officer, veto, nomination, observer, and indirect governance rights require fact-specific review.",
      zh: "董事会、高级管理人员、否决、提名、观察员和间接治理权需要基于事实审查。",
    },
  ),
];

const controlFactors: Array<{
  ruleId: string;
  topic: RegulatoryRule["topic"];
  label: RegulatoryRule["label"];
  description: RegulatoryRule["description"];
  section: string;
  triggerValue?: string;
}> = [
  {
    ruleId: "control-supplier-direction",
    topic: "supplier-direction",
    label: { en: "Supplier-direction rights", zh: "供应商指示权" },
    description: { en: "A counterparty right to specify or direct component, subcomponent, or critical-mineral sources is a listed effective-control factor.", zh: "交易对手指定或指示部件、子部件或关键矿物来源的权利属于有效控制列举因素。" },
    section: "IRC § 7701(a)(51)(D)(ii)(III)(aa)(AA)",
  },
  {
    ruleId: "control-production-operation",
    topic: "production-direction",
    label: { en: "Production or facility direction", zh: "生产或设施指示权" },
    description: { en: "A right to direct a facility, storage asset, or production unit is a listed effective-control factor.", zh: "指示设施、储能资产或生产单元的权利属于有效控制列举因素。" },
    section: "IRC § 7701(a)(51)(D)(ii)(III)(aa)(BB)",
  },
  {
    ruleId: "control-output-customers",
    topic: "output-restriction",
    label: { en: "Output or customer restrictions", zh: "产量或客户限制" },
    description: { en: "Rights that determine production quantity, timing, purchasers, or use of output may indicate effective control.", zh: "决定生产数量、时间、购买方或产出用途的权利可能表明存在有效控制。" },
    section: "IRC § 7701(a)(51)(D)(ii)(I)",
  },
  {
    ruleId: "control-critical-data",
    topic: "critical-data-restriction",
    label: { en: "Critical production or energy data restrictions", zh: "关键生产或能源数据限制" },
    description: { en: "Restrictions on access to critical production or energy data may indicate effective control.", zh: "限制访问关键生产或能源数据可能表明存在有效控制。" },
    section: "IRC § 7701(a)(51)(D)(ii)(I)",
  },
  {
    ruleId: "control-exclusive-equipment",
    topic: "exclusive-equipment-rights",
    label: { en: "Exclusive equipment operation or maintenance", zh: "独家设备运营或维护权" },
    description: { en: "Exclusive authority to operate, maintain, or repair necessary equipment may indicate effective control.", zh: "独家运营、维护或维修必要设备的权限可能表明存在有效控制。" },
    section: "IRC § 7701(a)(51)(D)(ii)(I)",
  },
  {
    ruleId: "control-ip-utilization",
    topic: "effective-control",
    label: { en: "Restrictions on licensed intellectual property", zh: "对许可知识产权使用的限制" },
    description: { en: "A contractual right limiting use of intellectual property is a listed effective-control factor.", zh: "限制知识产权使用的合同权利属于有效控制列举因素。" },
    section: "IRC § 7701(a)(51)(D)(ii)(III)(aa)(CC)",
  },
  {
    ruleId: "control-royalty-ten-years",
    topic: "royalty-duration",
    label: { en: "Royalty or related payments beyond ten years", zh: "超过十年的特许权使用费或相关付款" },
    description: { en: "A right to royalties or related payments beyond the tenth year is a listed licensing factor.", zh: "获得超过协议第十年的特许权使用费或相关付款的权利属于许可列举因素。" },
    section: "IRC § 7701(a)(51)(D)(ii)(III)(aa)(DD)",
    triggerValue: "Beyond the tenth year",
  },
  {
    ruleId: "control-services-two-years",
    topic: "service-duration",
    label: { en: "Required services longer than two years", zh: "超过两年的强制服务" },
    description: { en: "A right to direct or require a service agreement longer than two years is a listed licensing factor.", zh: "指示或要求签订超过两年服务协议的权利属于许可列举因素。" },
    section: "IRC § 7701(a)(51)(D)(ii)(III)(aa)(EE)",
    triggerValue: "Longer than two years",
  },
  {
    ruleId: "control-complete-knowhow",
    topic: "technical-data-transfer",
    label: { en: "Complete technical data and know-how transfer", zh: "完整技术数据和专有知识转移" },
    description: { en: "Failure to provide all data, information, and know-how needed for independent production is a listed licensing factor.", zh: "未提供独立生产所需的全部数据、信息和专有知识属于许可列举因素。" },
    section: "IRC § 7701(a)(51)(D)(ii)(III)(aa)(FF)",
  },
  {
    ruleId: "control-license-after-enactment",
    topic: "licensing-date",
    label: { en: "Agreement entered into or modified on or after July 4, 2025", zh: "于 2025 年 7 月 4 日或之后签订或修改的协议" },
    description: { en: "The agreement date is a listed licensing factor under the current statutory framework.", zh: "在现行法定框架下，协议日期属于许可列举因素。" },
    section: "IRC § 7701(a)(51)(D)(ii)(III)(aa)(GG)",
    triggerValue: "On or after July 4, 2025",
  },
];

export const EFFECTIVE_CONTROL_RULES: RegulatoryRule[] = controlFactors.map((factor) => ({
  ruleId: factor.ruleId,
  topic: factor.topic,
  label: factor.label,
  description: factor.description,
  triggerOperator: "listed-factor",
  triggerValue: factor.triggerValue ?? "Listed contractual or operational factor",
  unit: "factor",
  applicableYear: "all",
  applicableEvent: { en: "Contractual or operational control analysis", zh: "合同或运营控制分析" },
  applicableProduct: ["all"],
  applicableCredit: ["45X", "45Y", "48E", "downstream", "not-sure"],
  sourceIds: statuteAndNotice,
  sourceSections: [factor.section, "Notice 2026-15 § 2.03"],
  ruleStatus: "Enacted",
  effectiveDate: "2025-07-04",
  lastVerifiedAt: RULES_VERIFIED_AT,
  caveats: {
    en: "A listed factor does not by itself resolve the full analysis; related contracts, parties, retained rights, and actual operations require review.",
    zh: "单一列举因素不能自行完成全部分析；关联合同、各方、保留权利和实际运营仍需审查。",
  },
}));

type MacrTableSeed = {
  tableId: string;
  label: ThresholdTable["label"];
  topic: RegulatoryRule["topic"];
  credit: CreditId[];
  products: ProductId[];
  event: ThresholdTable["event"];
  values: Array<[number, number, number]>;
  section: string;
  caveat: RegulatoryRule["caveats"];
};

const MACR_SEEDS: MacrTableSeed[] = [
  {
    tableId: "45x-battery-components",
    label: { en: "45X Qualifying Battery Components", zh: "45X 合格电池部件" },
    topic: "45x-battery-macr",
    credit: ["45X"],
    products: ["cathode-active-material", "anode-active-material", "battery-cell", "battery-module", "other-battery-component"],
    event: { en: "Component sale year", zh: "部件销售年度" },
    values: [[2026, 2026, 60], [2027, 2027, 65], [2028, 2028, 70], [2029, 2029, 80], [2030, 2035, 85]],
    section: "IRC § 7701(a)(52)(C)(i)",
    caveat: { en: "Product qualification and cost classification require separate analysis; the threshold does not calculate actual eligibility.", zh: "产品资格和成本分类需要单独分析；该阈值不构成实际资格计算。" },
  },
  {
    tableId: "45x-critical-minerals",
    label: { en: "45X Applicable Critical Minerals", zh: "45X 适用关键矿物" },
    topic: "45x-mineral-macr",
    credit: ["45X"],
    products: ["applicable-critical-mineral"],
    event: { en: "Mineral sale year", zh: "矿物销售年度" },
    values: [[2026, 2029, 0], [2030, 2030, 25], [2031, 2031, 30], [2032, 2032, 40], [2033, 2035, 50]],
    section: "IRC § 7701(a)(52)(C)(ii)",
    caveat: { en: "Treasury is directed to issue mineral-specific adjusted thresholds by December 31, 2027; current official guidance must be rechecked before reliance.", zh: "财政部须在 2027 年 12 月 31 日前发布矿物特定调整阈值；依赖前必须重新核对最新官方指南。" },
  },
  {
    tableId: "45y-48e-qualified-facilities",
    label: { en: "45Y or 48E Qualified Facilities", zh: "45Y 或 48E 合格设施" },
    topic: "45y-facility-macr",
    credit: ["45Y", "48E"],
    products: ["cathode-active-material", "anode-active-material", "battery-cell", "battery-module", "other-battery-component", "not-sure"],
    event: { en: "Construction-begin year", zh: "开工年度" },
    values: [[2026, 2026, 40], [2027, 2027, 45], [2028, 2028, 50], [2029, 2029, 55], [2030, 2035, 60]],
    section: "IRC § 7701(a)(52)(B)(i)",
    caveat: { en: "Whether the property is a qualified facility and when construction begins require separate program-specific analysis.", zh: "财产是否属于合格设施以及开工时间需要按具体项目单独分析。" },
  },
  {
    tableId: "48e-energy-storage",
    label: { en: "48E Energy Storage Technology", zh: "48E 储能技术" },
    topic: "48e-storage-macr",
    credit: ["48E"],
    products: ["energy-storage-technology"],
    event: { en: "Construction-begin year", zh: "开工年度" },
    values: [[2026, 2026, 55], [2027, 2027, 60], [2028, 2028, 65], [2029, 2029, 70], [2030, 2035, 75]],
    section: "IRC § 7701(a)(52)(B)(ii)",
    caveat: { en: "Energy-storage classification and construction-begin facts require separate review.", zh: "储能分类和开工事实需要单独审查。" },
  },
];

export const THRESHOLD_TABLES: ThresholdTable[] = [];
export const MACR_RULES: RegulatoryRule[] = [];

for (const seed of MACR_SEEDS) {
  const values = seed.values.map(([fromYear, toYear, percentage]) => {
    const ruleId = `${seed.tableId}-${fromYear}${toYear === fromYear ? "" : `-${toYear}`}`;
    MACR_RULES.push({
      ruleId,
      topic: seed.topic,
      label: seed.label,
      description: {
        en: `${percentage}% minimum material assistance cost ratio for ${seed.label.en.toLowerCase()}.`,
        zh: `${seed.label.zh}的最低实质协助成本比率为 ${percentage}%。`,
      },
      triggerOperator: "at-least",
      triggerValue: percentage,
      unit: "percent",
      applicableYear: fromYear === toYear ? fromYear : toYear >= 2035 ? `${fromYear}+` as "2030+" | "2033+" : fromYear,
      applicableEvent: seed.event,
      applicableProduct: seed.products,
      applicableCredit: seed.credit,
      sourceIds: statuteAndNotice,
      sourceSections: [seed.section, "Notice 2026-15 §§ 3–4"],
      ruleStatus: "Enacted",
      effectiveDate: "2026-01-01",
      lastVerifiedAt: RULES_VERIFIED_AT,
      caveats: seed.caveat,
    });
    return { fromYear, toYear, percentage, ruleId };
  });
  THRESHOLD_TABLES.push({
    tableId: seed.tableId,
    label: seed.label,
    credit: seed.credit,
    products: seed.products,
    event: seed.event,
    values,
  });
}

export const REGULATORY_RULES: RegulatoryRule[] = [
  ...ENTITY_AND_CONTROL_RULES,
  ...EFFECTIVE_CONTROL_RULES,
  ...MACR_RULES,
];

export function getRule(ruleId: string) {
  return REGULATORY_RULES.find((rule) => rule.ruleId === ruleId) ?? null;
}

export function getRuleByTopic(topic: RegulatoryRule["topic"]) {
  return REGULATORY_RULES.filter((rule) => rule.topic === topic);
}

export function getMacrRule(product: ProductId, credit: CreditId, year: number) {
  const candidateTables = THRESHOLD_TABLES.filter(
    (table) => table.credit.includes(credit) && table.products.includes(product),
  );
  const preferred = candidateTables.find((table) =>
    product === "energy-storage-technology"
      ? table.tableId === "48e-energy-storage"
      : table.tableId !== "48e-energy-storage",
  ) ?? candidateTables[0];
  const value = preferred?.values.find((entry) => year >= entry.fromYear && year <= entry.toYear);
  return value ? getRule(value.ruleId) : null;
}

export function validateRuleRegistry() {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const rule of REGULATORY_RULES) {
    if (ids.has(rule.ruleId)) errors.push(`Duplicate rule: ${rule.ruleId}`);
    ids.add(rule.ruleId);
    if (!rule.sourceIds.length) errors.push(`Rule has no source: ${rule.ruleId}`);
    if (!rule.sourceSections.length) errors.push(`Rule has no source section: ${rule.ruleId}`);
    for (const sourceId of rule.sourceIds) {
      if (!getLegalSource(sourceId)) errors.push(`Unknown source ${sourceId} on ${rule.ruleId}`);
    }
  }
  return errors;
}

export function registryHasPendingRules(rules: RegulatoryRule[]) {
  const pendingStatuses: LegalSourceStatus[] = ["Pending Verification", "Superseded", "Withdrawn"];
  return rules.some((rule) => pendingStatuses.includes(rule.ruleStatus));
}
