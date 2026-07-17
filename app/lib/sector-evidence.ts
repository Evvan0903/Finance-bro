import type { SectorEvidenceSource } from "./sector-types";

export type EvidenceCandidate = SectorEvidenceSource & {
  relevant: boolean;
  accessible: boolean;
};

const RETRIEVAL_DATE = "2026-07-16";
export const MIN_PUBLICATION_DATE = "2025-01-01";

const EVIDENCE_CANDIDATES: EvidenceCandidate[] = [
  {
    id: "eia-steo-july-2026",
    title: "Short-Term Energy Outlook - July 2026",
    publisher: "U.S. Energy Information Administration",
    publicationDate: "2026-07-07",
    retrievalDate: RETRIEVAL_DATE,
    access: "public",
    sector: "energy",
    subindustry: "integrated-oil-gas",
    geography: ["Global", "US"],
    topic: "Oil balance, prices, refining margins, and natural gas",
    url: "https://www.eia.gov/outlooks/steo/report/index.php",
    summary: {
      zh: "EIA 的 2026 年 7 月基准预计，全球原油库存将在 2027 年转向累积，Brent 均价由 2026 年的 82 美元/桶降至 2027 年的 65 美元/桶；短期成品油库存偏低使裂解价差仍具支撑。",
      en: "EIA's July 2026 baseline expects global oil inventories to shift toward builds in 2027 and Brent to average $82/b in 2026 and $65/b in 2027; low near-term product inventories still support crack spreads.",
    },
    researchMethod: {
      zh: "EIA 将能源供需、库存、价格和宏观假设纳入月度短期预测，并公开基准表与前次预测差异。",
      en: "EIA combines energy supply, demand, inventories, prices, and macro assumptions in a monthly short-term forecast with public baseline tables and revisions.",
    },
    investorImplication: {
      zh: "综合能源公司的上游现金流面临中期价格回落风险，而炼化与交易的对冲能力决定盈利韧性。",
      en: "Integrated producers face medium-term upstream price pressure; refining and trading offsets determine earnings resilience.",
    },
    relevant: true,
    accessible: true,
  },
  {
    id: "iea-oil-2025",
    title: "Oil 2025",
    publisher: "International Energy Agency",
    publicationDate: "2025-06-17",
    retrievalDate: RETRIEVAL_DATE,
    access: "public",
    sector: "energy",
    subindustry: "integrated-oil-gas",
    geography: ["Global"],
    topic: "Oil supply, demand, refining, trade, and investment through 2030",
    url: "https://www.iea.org/reports/oil-2025/executive-summary",
    summary: {
      zh: "IEA 认为至 2030 年油市驱动因素正在改变：中国石油需求可能在本十年见顶，美国供应增速放缓，而 OPEC+ 增产与地缘政治使供需和价格路径更不稳定。",
      en: "IEA sees oil-market drivers changing through 2030: Chinese oil demand may peak this decade, U.S. supply growth is slowing, and OPEC+ supply policy plus geopolitics widen the range of price outcomes.",
    },
    researchMethod: {
      zh: "中期框架按燃料、行业和地区预测需求，并结合已规划上游、炼化项目评估供应、产能和贸易。",
      en: "The medium-term framework forecasts demand by fuel, sector, and region and evaluates supply, capacity, and trade using planned upstream and refining projects.",
    },
    investorImplication: {
      zh: "公司价值更依赖低成本资源、项目兑现与资本纪律，而不能只外推单一现货价格。",
      en: "Company value depends increasingly on low-cost resources, project delivery, and capital discipline rather than extrapolating one spot price.",
    },
    relevant: true,
    accessible: true,
  },
  {
    id: "iea-gas-2025",
    title: "Gas 2025",
    publisher: "International Energy Agency",
    publicationDate: "2025-10-27",
    retrievalDate: RETRIEVAL_DATE,
    access: "public",
    sector: "energy",
    subindustry: "integrated-oil-gas",
    geography: ["Global"],
    topic: "LNG capacity, contracts, supply security, and pricing through 2030",
    url: "https://www.iea.org/reports/gas-2025",
    summary: {
      zh: "IEA 预计到 2030 年全球将新增约 3,000 亿立方米/年的 LNG 出口产能，合同趋向更灵活和更多元定价，可能改善供应安全并重塑区域价差。",
      en: "IEA expects roughly 300 bcm per year of LNG export capacity to be added by 2030, with contracts becoming more flexible and pricing more diverse, potentially improving security and reshaping regional spreads.",
    },
    researchMethod: {
      zh: "报告评估全球供需与贸易至 2030 年，并结合 LNG 项目、合同数据库和供应安全情景。",
      en: "The report assesses global supply, demand, and trade through 2030 using LNG projects, a contracts database, and supply-security scenarios.",
    },
    investorImplication: {
      zh: "LNG 组合的合同结构、目的地灵活性和项目成本将比单纯销量增长更能解释回报差异。",
      en: "Contract structure, destination flexibility, and project cost may explain LNG returns better than volume growth alone.",
    },
    relevant: true,
    accessible: true,
  },
  {
    id: "sia-2025-sales",
    title: "Global Annual Semiconductor Sales Increase 25.6% to $791.7 Billion in 2025",
    publisher: "Semiconductor Industry Association",
    publicationDate: "2026-02-06",
    retrievalDate: RETRIEVAL_DATE,
    access: "public",
    sector: "technology",
    subindustry: "semiconductors",
    geography: ["Global", "US"],
    topic: "Semiconductor sales, logic, memory, and regional demand",
    url: "https://www.semiconductors.org/global-annual-semiconductor-sales-increase-25-6-to-791-7-billion-in-2025/",
    summary: {
      zh: "SIA 报告 2025 年全球半导体销售额达到 7,917 亿美元，同比增长 25.6%；逻辑和存储增速领先，2026 年行业销售额预计接近 1 万亿美元。",
      en: "SIA reported 2025 global semiconductor sales of $791.7 billion, up 25.6%, led by logic and memory, with industry sales projected to approach $1 trillion in 2026.",
    },
    researchMethod: {
      zh: "月度销售来自 WSTS，并以三个月移动平均呈现；SIA 同时披露产品与地区年度比较。",
      en: "Monthly sales come from WSTS and are reported as a three-month moving average; SIA also provides annual product and regional comparisons.",
    },
    investorImplication: {
      zh: "强劲总量支持收入，但逻辑与存储领跑意味着必须按终端市场和产品周期判断增长质量。",
      en: "Strong industry growth supports revenue, but logic and memory leadership makes end-market and product-cycle mix essential to judging quality.",
    },
    relevant: true,
    accessible: true,
  },
  {
    id: "semi-300mm-april-2026",
    title: "SEMI Projects Double-Digit Growth in Global 300mm Fab Equipment Spending for 2026 and 2027",
    publisher: "SEMI",
    publicationDate: "2026-04-01",
    retrievalDate: RETRIEVAL_DATE,
    access: "public",
    sector: "technology",
    subindustry: "semiconductors",
    geography: ["Global", "US", "Europe", "International"],
    topic: "300mm capacity, advanced nodes, memory, and AI investment",
    url: "https://www.semi.org/en/semi-press-release/semi-projects-double-digit-growth-in-global-300mm-fab-equipment-spending-for-2026-and-2027",
    summary: {
      zh: "SEMI 预计 2026 年全球 300mm 晶圆厂设备支出增长 18% 至 1,330 亿美元，2027 年再增长 14% 至 1,510 亿美元；AI、先进制程和存储是主要驱动。",
      en: "SEMI expects global 300mm fab equipment spending to rise 18% to $133 billion in 2026 and another 14% to $151 billion in 2027, driven by AI, advanced nodes, and memory.",
    },
    researchMethod: {
      zh: "300mm Fab Outlook 覆盖 404 座设施和产线，本期纳入 198 次更新与 9 个新增项目。",
      en: "The 300mm Fab Outlook covers 404 facilities and lines and incorporates 198 updates plus nine new projects in the current edition.",
    },
    investorImplication: {
      zh: "供给瓶颈可能缓解，但大规模扩产提高了在需求放缓时的库存、利用率和资本周期风险。",
      en: "Supply bottlenecks may ease, but rapid expansion raises inventory, utilization, and capital-cycle risk if demand slows.",
    },
    relevant: true,
    accessible: true,
  },
  {
    id: "bis-ai-chip-controls-may-2025",
    title: "Department of Commerce Announces Rescission of AI Diffusion Rule, Strengthens Chip-Related Export Controls",
    publisher: "U.S. Bureau of Industry and Security",
    publicationDate: "2025-05-13",
    retrievalDate: RETRIEVAL_DATE,
    access: "public",
    sector: "technology",
    subindustry: "semiconductors",
    geography: ["US", "Global", "International"],
    topic: "AI-chip export controls, diversion, and market access",
    url: "https://www.bis.gov/press-release/department-commerce-announces-rescission-biden-era-artificial-intelligence-diffusion-rule-strengthens",
    summary: {
      zh: "美国商务部撤销原 AI 扩散规则，同时加强海外 AI 芯片的风险提示、供应链防转移指导和执法重点；替代规则仍可能改变高端芯片的可服务市场。",
      en: "Commerce rescinded the prior AI Diffusion Rule while strengthening overseas AI-chip risk alerts, supply-chain diversion guidance, and enforcement; replacement rules can still change the serviceable market for advanced chips.",
    },
    researchMethod: {
      zh: "该来源是监管机构公告，记录已采取的政策动作和待发布规则，不是市场预测。",
      en: "This is a regulator announcement documenting policy actions and pending rulemaking, not a market forecast.",
    },
    investorImplication: {
      zh: "收入可达性、产品降规、库存和客户组合可能随许可规则快速变化，应单列监管情景。",
      en: "Revenue access, product redesigns, inventory, and customer mix can change quickly with licensing rules and warrant a separate regulatory scenario.",
    },
    relevant: true,
    accessible: true,
  },
  {
    id: "bis-h200-license-january-2026",
    title: "Department of Commerce Revises License Review Policy for Semiconductors Exported to China",
    publisher: "U.S. Bureau of Industry and Security",
    publicationDate: "2026-01-13",
    retrievalDate: RETRIEVAL_DATE,
    access: "public",
    sector: "technology",
    subindustry: "semiconductors",
    geography: ["US", "International"],
    topic: "Advanced-computing export licensing",
    url: "https://www.bis.gov/sites/default/files/documents/DoC%20Revises%20License%20Review%20Policy%20for%20Semiconductors%20Exports.pdf",
    summary: {
      zh: "BIS 将 Nvidia H200、AMD MI325X 及类似芯片对华出口改为满足安全、产能与合规条件后逐案审查，显示高端产品市场准入取决于许可细节。",
      en: "BIS moved China exports of Nvidia H200, AMD MI325X, and similar chips to case-by-case review subject to security, capacity, and compliance conditions, making market access dependent on licensing details.",
    },
    researchMethod: {
      zh: "监管公告直接列示许可条件、生效时间和适用产品，作为政策事实使用。",
      en: "The regulator notice directly states licensing conditions, effective timing, and covered products and is used as a policy fact.",
    },
    investorImplication: {
      zh: "投资者需要把获批速度、产品结构和美国客户产能保障作为独立收入敏感度。",
      en: "Investors should model approval timing, product mix, and U.S.-customer capacity safeguards as separate revenue sensitivities.",
    },
    relevant: true,
    accessible: true,
  },
];

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function canonicalUrl(value: string) {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

export function screenSectorEvidence(
  candidates: EvidenceCandidate[],
  currentDate = new Date().toISOString().slice(0, 10),
) {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  return candidates.filter((source) => {
    if (!source.accessible || !source.relevant || source.access !== "public") return false;
    if (!validDate(source.publicationDate)) return false;
    if (source.publicationDate < MIN_PUBLICATION_DATE || source.publicationDate > currentDate) return false;
    if (!source.url.startsWith("https://")) return false;

    const url = canonicalUrl(source.url);
    const title = source.title.trim().toLowerCase();
    if (seenUrls.has(url) || seenTitles.has(title)) return false;
    seenUrls.add(url);
    seenTitles.add(title);
    return true;
  });
}

export const CURRENT_SECTOR_EVIDENCE: SectorEvidenceSource[] =
  screenSectorEvidence(EVIDENCE_CANDIDATES);
