import type { ProposedParameter, StructureTemplate } from "./types";

const refs = ["PL119-21", "NOTICE-2026-15"];
const text = (en: string, zh: string) => ({ en, zh });

function entityParameters(
  single: "Below 25%" | "0%",
  aggregate: "Below 40%" | "0%",
  debt: "Below 15%" | "0%",
): ProposedParameter[] {
  return [
    {
      parameter: text("Proposed ownership by one potential SFE", "单一潜在特定外国实体的拟议所有权"),
      proposedValue: text(single, single === "0%" ? "0%" : "低于 25%"),
      legalTrigger: text("At least 25% is a statutory trigger", "至少 25% 为法定触发条件"),
      whyItMatters: text("Entity-level foreign-influenced-entity analysis", "实体层面的外国影响实体分析"),
      referenceSourceIds: refs,
    },
    {
      parameter: text("Proposed aggregate potential SFE ownership", "所有潜在特定外国实体的拟议合计所有权"),
      proposedValue: text(aggregate, aggregate === "0%" ? "0%" : "低于 40%"),
      legalTrigger: text("At least 40% is a statutory trigger", "至少 40% 为法定触发条件"),
      whyItMatters: text("Aggregate ownership and attribution analysis", "合计所有权和归属分析"),
      referenceSourceIds: refs,
    },
    {
      parameter: text("Proposed SFE debt", "拟议特定外国实体债务"),
      proposedValue: text(debt, debt === "0%" ? "0%" : "低于 15%"),
      legalTrigger: text("At least 15% is a statutory trigger for the V1 private-entity scenario", "在 V1 非公众实体场景中，至少 15% 为法定触发条件"),
      whyItMatters: text("Debt-financing and instrument classification analysis", "债务融资和工具分类分析"),
      referenceSourceIds: refs,
    },
    {
      parameter: text("Direct SFE authority to appoint covered officers", "特定外国实体直接任命受涵盖高管的权限"),
      proposedValue: text("None", "无"),
      legalTrigger: text("Any direct authority may trigger the test", "任何直接权限均可能触发测试"),
      whyItMatters: text("Governance and appointment-right analysis", "治理和任命权分析"),
      referenceSourceIds: refs,
    },
  ];
}

export const STRUCTURE_TEMPLATES: StructureTemplate[] = [
  {
    structureId: "minority-jv",
    name: text("Minority Equity U.S. Joint Venture", "少数股权美国合资企业"),
    description: text(
      "A U.S. operating company with potential SFE participation held below the listed entity-level screening parameters and without proposed appointment, supplier-selection, production-control, or SFE debt rights.",
      "美国运营公司可由潜在特定外国实体参与，但拟议持股低于列明的实体层面筛查参数，且不设置任命、供应商选择、生产控制或特定外国实体债务权利。",
    ),
    parameters: [
      ...entityParameters("Below 25%", "Below 40%", "Below 15%"),
      {
        parameter: text("U.S. operating control", "美国运营控制"),
        proposedValue: text("Held by the independently operated U.S. entity", "由独立运营的美国实体持有"),
        legalTrigger: text("Contractual and operational rights may create effective control", "合同和运营权可能构成有效控制"),
        whyItMatters: text("Substance and operating-independence analysis", "实质和运营独立性分析"),
        referenceSourceIds: refs,
      },
      {
        parameter: text("SFE supplier-selection and production-control rights", "特定外国实体的供应商选择和生产控制权"),
        proposedValue: text("None proposed", "拟议不设置"),
        legalTrigger: text("Supplier and production direction are listed control factors", "供应商和生产指示属于列举控制因素"),
        whyItMatters: text("Contractual effective-control analysis", "合同有效控制分析"),
        referenceSourceIds: refs,
      },
    ],
    considerations: [
      text("Minority ownership alone does not eliminate PFE risk", "少数股权本身不能消除 PFE 风险"),
      text("Indirect ownership, attribution, debt, governance, and contractual rights require separate review", "间接所有权、归属、债务、治理和合同权利需要单独审查"),
      text("The U.S. entity must possess genuine operating independence", "美国实体必须具备真实的运营独立性"),
      text("Technology and sourcing arrangements require separate assessment", "技术和采购安排需要单独评估"),
    ],
    riskLabel: text("High professional-review priority", "高优先级专业审查"),
    sourceIds: refs,
  },
  {
    structureId: "us-controlled",
    name: text("U.S.-Controlled Manufacturing Without SFE Equity", "无特定外国实体股权的美国控制制造"),
    description: text(
      "An independently controlled U.S. manufacturer with no proposed SFE equity, appointment rights, or debt financing and with U.S. control over procurement, production, customers, and output.",
      "由美国独立控制的制造商，不拟设置特定外国实体股权、任命权或债务融资，并由美国实体控制采购、生产、客户和产出。",
    ),
    parameters: [
      ...entityParameters("0%", "0%", "0%"),
      {
        parameter: text("U.S. control over procurement, production, customers, and output", "美国实体对采购、生产、客户和产出的控制"),
        proposedValue: text("Independent U.S. control", "美国实体独立控制"),
        legalTrigger: text("Operational and contractual direction may create effective control", "运营和合同指示可能构成有效控制"),
        whyItMatters: text("Operating-independence analysis", "运营独立性分析"),
        referenceSourceIds: refs,
      },
      {
        parameter: text("Mandatory long-term SFE service agreement", "强制性长期特定外国实体服务协议"),
        proposedValue: text("None proposed", "拟议不设置"),
        legalTrigger: text("Required services longer than two years are a listed licensing factor", "超过两年的强制服务属于许可列举因素"),
        whyItMatters: text("Contractual effective-control analysis", "合同有效控制分析"),
        referenceSourceIds: refs,
      },
    ],
    considerations: [
      text("Zero equity does not eliminate technology or supply-chain risk", "零股权不能消除技术或供应链风险"),
      text("Licensing arrangements may still create effective-control issues", "许可安排仍可能产生有效控制问题"),
      text("PFE-origin material costs may still affect MACR", "PFE 来源材料成本仍可能影响 MACR"),
      text("Actual operational independence must be supported by facts", "实际运营独立性必须有事实支持"),
    ],
    riskLabel: text(
      "Lower identified entity-level exposure with remaining contractual and sourcing review",
      "已识别的实体层面敞口较低，但仍需合同和采购审查",
    ),
    sourceIds: refs,
  },
  {
    structureId: "technology-license",
    name: text("Technology Licensing With Independent U.S. Operation", "技术许可与美国独立运营"),
    description: text(
      "A U.S. licensee receives the data and know-how required to operate independently, without proposed SFE equity, appointment, debt, supplier, production, output, or exclusive-equipment rights.",
      "美国被许可方获得独立运营所需的数据和专有知识，不拟设置特定外国实体股权、任命、债务、供应商、生产、产出或独家设备权利。",
    ),
    parameters: [
      ...entityParameters("0%", "0%", "0%"),
      {
        parameter: text("Complete technical data, information, and know-how", "完整技术数据、信息和专有知识"),
        proposedValue: text("Required", "必须提供"),
        legalTrigger: text("Incomplete transfer is a listed licensing factor", "转移不完整属于许可列举因素"),
        whyItMatters: text("Independent-production capability", "独立生产能力"),
        referenceSourceIds: refs,
      },
      {
        parameter: text("SFE supplier, production, quantity, customer, output, or equipment rights", "特定外国实体的供应商、生产、数量、客户、产出或设备权利"),
        proposedValue: text("None proposed", "拟议不设置"),
        legalTrigger: text("These rights are listed or relevant effective-control factors", "这些权利属于列举或相关有效控制因素"),
        whyItMatters: text("Contractual and operational independence", "合同和运营独立性"),
        referenceSourceIds: refs,
      },
      {
        parameter: text("Required technical-service duration", "强制技术服务期限"),
        proposedValue: text("No more than 2 years as a screening parameter", "以不超过 2 年作为筛查参数"),
        legalTrigger: text("Longer than 2 years is a listed licensing factor", "超过 2 年属于许可列举因素"),
        whyItMatters: text("Continuing-dependence analysis", "持续依赖分析"),
        referenceSourceIds: refs,
      },
      {
        parameter: text("Royalty or related-payment term", "特许权使用费或相关付款期限"),
        proposedValue: text("No payments beyond the tenth year as a screening parameter", "以第十年后无付款作为筛查参数"),
        legalTrigger: text("Payments beyond the tenth year are a listed factor", "第十年后的付款属于列举因素"),
        whyItMatters: text("Licensing effective-control analysis", "许可有效控制分析"),
        referenceSourceIds: refs,
      },
    ],
    considerations: [
      text("Technology-licensing arrangements require heightened legal review", "技术许可安排需要加强法律审查"),
      text("Each listed licensing factor may be independently determinative under the current interim guidance", "根据现行临时指南，每项列举许可因素均可能单独具有决定性"),
      text("Independent U.S. operating capability must be supported by actual facts", "美国独立运营能力必须由实际事实支持"),
      text("Agreements entered into or modified on or after July 4, 2025 require specific review", "于 2025 年 7 月 4 日或之后签订或修改的协议需要专项审查"),
    ],
    riskLabel: text("Very high professional-review priority", "极高优先级专业审查"),
    sourceIds: refs,
  },
];

