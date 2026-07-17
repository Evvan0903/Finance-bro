import {
  ingestSectorResearch,
  SECTOR_RESEARCH_START_DATE,
  type SectorResearchCandidate,
} from "./sector-learning-pipeline";

export type EvidenceCandidate = SectorResearchCandidate;

const RETRIEVAL_DATE = "2026-07-16";
export const MIN_PUBLICATION_DATE = SECTOR_RESEARCH_START_DATE;

const EVIDENCE_CANDIDATES: EvidenceCandidate[] = [
  {
    id: "eia-steo-july-2026",
    title: "Short-Term Energy Outlook - July 2026",
    publisher: "U.S. Energy Information Administration",
    publicationDate: "2026-07-07",
    retrievalDate: RETRIEVAL_DATE,
    sourceType: "government-outlook",
    access: "public",
    sector: "energy",
    subindustry: "integrated-oil-gas",
    geography: ["Global", "US"],
    topic: "Oil balance, prices, refining margins, and natural gas",
    url: "https://www.eia.gov/outlooks/steo/report/index.php",
    currentEvidence: {
      zh: "EIA 的 2026 年 7 月基准预计，全球原油库存将在 2027 年转向累积，Brent 均价由 2026 年的 82 美元/桶降至 2027 年的 65 美元/桶；短期成品油库存偏低使裂解价差仍具支撑。",
      en: "EIA's July 2026 baseline expects global oil inventories to shift toward builds in 2027 and Brent to average $82/b in 2026 and $65/b in 2027; low near-term product inventories still support crack spreads.",
    },
    generalizedMethods: [{
      zh: "把能源供需、库存、价格和宏观假设纳入月度短期预测，并比较基准表与前次预测差异。",
      en: "Combine energy supply, demand, inventories, prices, and macro assumptions in a monthly forecast and compare baseline tables with prior revisions.",
    }],
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
    sourceType: "industry-outlook",
    access: "public",
    sector: "energy",
    subindustry: "integrated-oil-gas",
    geography: ["Global"],
    topic: "Oil supply, demand, refining, trade, and investment through 2030",
    url: "https://www.iea.org/reports/oil-2025/executive-summary",
    currentEvidence: {
      zh: "IEA 认为至 2030 年油市驱动因素正在改变：中国石油需求可能在本十年见顶，美国供应增速放缓，而 OPEC+ 增产与地缘政治使供需和价格路径更不稳定。",
      en: "IEA sees oil-market drivers changing through 2030: Chinese oil demand may peak this decade, U.S. supply growth is slowing, and OPEC+ supply policy plus geopolitics widen the range of price outcomes.",
    },
    generalizedMethods: [{
      zh: "按燃料、行业和地区预测需求，并结合已规划上游及炼化项目评估供应、产能和贸易。",
      en: "Forecast demand by fuel, sector, and region, then evaluate supply, capacity, and trade using planned upstream and refining projects.",
    }],
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
    sourceType: "industry-outlook",
    access: "public",
    sector: "energy",
    subindustry: "integrated-oil-gas",
    geography: ["Global"],
    topic: "LNG capacity, contracts, supply security, and pricing through 2030",
    url: "https://www.iea.org/reports/gas-2025",
    currentEvidence: {
      zh: "IEA 预计到 2030 年全球将新增约 3,000 亿立方米/年的 LNG 出口产能，合同趋向更灵活和更多元定价，可能改善供应安全并重塑区域价差。",
      en: "IEA expects roughly 300 bcm per year of LNG export capacity to be added by 2030, with contracts becoming more flexible and pricing more diverse, potentially improving security and reshaping regional spreads.",
    },
    generalizedMethods: [{
      zh: "结合 LNG 项目、合同数据库和供应安全情景，评估中期全球供需与贸易。",
      en: "Assess medium-term global supply, demand, and trade using LNG projects, contract data, and supply-security scenarios.",
    }],
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
    sourceType: "industry-statistics",
    access: "public",
    sector: "technology",
    subindustry: "semiconductors",
    geography: ["Global", "US"],
    topic: "Semiconductor sales, logic, memory, and regional demand",
    url: "https://www.semiconductors.org/global-annual-semiconductor-sales-increase-25-6-to-791-7-billion-in-2025/",
    currentEvidence: {
      zh: "SIA 报告 2025 年全球半导体销售额达到 7,917 亿美元，同比增长 25.6%；逻辑和存储增速领先，2026 年行业销售额预计接近 1 万亿美元。",
      en: "SIA reported 2025 global semiconductor sales of $791.7 billion, up 25.6%, led by logic and memory, with industry sales projected to approach $1 trillion in 2026.",
    },
    generalizedMethods: [{
      zh: "用三个月移动平均观察月度销售，并按产品和地区比较年度增速以区分结构与总量。",
      en: "Use three-month moving averages for monthly sales and compare annual growth by product and geography to separate mix from aggregate growth.",
    }],
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
    sourceType: "industry-outlook",
    access: "public",
    sector: "technology",
    subindustry: "semiconductors",
    geography: ["Global", "US", "Europe", "International"],
    topic: "300mm capacity, advanced nodes, memory, and AI investment",
    url: "https://www.semi.org/en/semi-press-release/semi-projects-double-digit-growth-in-global-300mm-fab-equipment-spending-for-2026-and-2027",
    currentEvidence: {
      zh: "SEMI 预计 2026 年全球 300mm 晶圆厂设备支出增长 18% 至 1,330 亿美元，2027 年再增长 14% 至 1,510 亿美元；AI、先进制程和存储是主要驱动。",
      en: "SEMI expects global 300mm fab equipment spending to rise 18% to $133 billion in 2026 and another 14% to $151 billion in 2027, driven by AI, advanced nodes, and memory.",
    },
    generalizedMethods: [{
      zh: "用逐厂项目数据库跟踪新增项目、修订和设备支出，将产能建设映射至制程、存储与终端需求。",
      en: "Track additions, revisions, and equipment spending in a facility-level project database and map capacity buildout to nodes, memory, and end demand.",
    }],
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
    sourceType: "regulatory-action",
    access: "public",
    sector: "technology",
    subindustry: "semiconductors",
    geography: ["US", "Global", "International"],
    topic: "AI-chip export controls, diversion, and market access",
    url: "https://www.bis.gov/press-release/department-commerce-announces-rescission-biden-era-artificial-intelligence-diffusion-rule-strengthens",
    currentEvidence: {
      zh: "美国商务部撤销原 AI 扩散规则，同时加强海外 AI 芯片的风险提示、供应链防转移指导和执法重点；替代规则仍可能改变高端芯片的可服务市场。",
      en: "Commerce rescinded the prior AI Diffusion Rule while strengthening overseas AI-chip risk alerts, supply-chain diversion guidance, and enforcement; replacement rules can still change the serviceable market for advanced chips.",
    },
    generalizedMethods: [{
      zh: "把监管机构公告作为政策事实，区分已生效动作、待发布规则与市场预测。",
      en: "Use regulator announcements as policy facts and distinguish effective actions and pending rules from market forecasts.",
    }],
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
    sourceType: "regulatory-action",
    access: "public",
    sector: "technology",
    subindustry: "semiconductors",
    geography: ["US", "International"],
    topic: "Advanced-computing export licensing",
    url: "https://www.bis.gov/sites/default/files/documents/DoC%20Revises%20License%20Review%20Policy%20for%20Semiconductors%20Exports.pdf",
    currentEvidence: {
      zh: "BIS 将 Nvidia H200、AMD MI325X 及类似芯片对华出口改为满足安全、产能与合规条件后逐案审查，显示高端产品市场准入取决于许可细节。",
      en: "BIS moved China exports of Nvidia H200, AMD MI325X, and similar chips to case-by-case review subject to security, capacity, and compliance conditions, making market access dependent on licensing details.",
    },
    generalizedMethods: [{
      zh: "直接从监管公告记录许可条件、生效时间和适用产品，再将审批速度与产品结构作为独立敏感度。",
      en: "Record licensing conditions, effective timing, and covered products directly from the regulator, then model approval timing and product mix as separate sensitivities.",
    }],
    investorImplication: {
      zh: "投资者需要把获批速度、产品结构和美国客户产能保障作为独立收入敏感度。",
      en: "Investors should model approval timing, product mix, and U.S.-customer capacity safeguards as separate revenue sensitivities.",
    },
    relevant: true,
    accessible: true,
  },
  {
    id: "fdic-qbp-q1-2026",
    title: "Quarterly Banking Profile - Q1 2026",
    publisher: "Federal Deposit Insurance Corporation",
    publicationDate: "2026-05-27",
    retrievalDate: RETRIEVAL_DATE,
    sourceType: "industry-statistics",
    access: "public",
    sector: "financials",
    subindustry: "banks",
    geography: ["US"],
    topic: "Bank earnings, net interest margin, deposits, loans, capital, liquidity, and credit quality",
    url: "https://www.fdic.gov/quarterly-banking-profile/quarterly-banking-profile-q1-2026",
    currentEvidence: {
      zh: "FDIC 报告 2026 年第一季度行业净息差环比下降 8 个基点至 3.31%，国内存款增长 2.1%，贷款环比增长 1.6%；资本和流动性仍然强健，但部分商业地产与消费组合拖欠率偏高。",
      en: "The FDIC reported that first-quarter 2026 industry net interest margin fell 8 basis points sequentially to 3.31%, domestic deposits grew 2.1%, and loans grew 1.6%; capital and liquidity remained strong while some CRE and consumer delinquencies stayed elevated.",
    },
    generalizedMethods: [{
      zh: "用监管报表构建净息差、存贷款增长、资产质量、资本和流动性的季度同业基准，并保留口径变化说明。",
      en: "Build quarterly peer benchmarks for margin, deposit and loan growth, asset quality, capital, and liquidity from regulatory reports while retaining definition-change notes.",
    }],
    investorImplication: {
      zh: "个股超额收益需要区分行业利差回落与自身存款成本、贷款组合和信用表现。",
      en: "Company outperformance requires separating industry margin pressure from issuer-specific deposit cost, loan mix, and credit performance.",
    },
    relevant: true,
    accessible: true,
  },
  {
    id: "occ-sarp-spring-2026",
    title: "Semiannual Risk Perspective, Spring 2026",
    publisher: "Office of the Comptroller of the Currency",
    publicationDate: "2026-05-07",
    retrievalDate: RETRIEVAL_DATE,
    sourceType: "regulatory-action",
    access: "public",
    sector: "financials",
    subindustry: "banks",
    geography: ["US"],
    topic: "Bank credit, market, operational, compliance, liquidity, and technology risk",
    url: "https://www.occ.treas.gov/publications-and-resources/publications/semiannual-risk-perspective/files/semiannual-risk-perspective-spring-2026.html",
    currentEvidence: {
      zh: "OCC 认为 2025 年银行盈利受贷款增长和融资成本下降支持，资本与流动性处于历史高位；商业地产再融资、私人信贷、部分消费拖欠、网络安全与欺诈仍需监测。",
      en: "The OCC said 2025 bank earnings benefited from loan growth and lower funding costs while capital and liquidity remained high by historical standards; CRE refinancing, private credit, selected consumer delinquencies, cyber risk, and fraud require monitoring.",
    },
    generalizedMethods: [{
      zh: "把信用、市场、操作和合规风险分开评估，并用资本、流动性和盈利缓冲判断各风险能否被吸收。",
      en: "Assess credit, market, operational, and compliance risks separately, then test whether capital, liquidity, and earnings buffers can absorb them.",
    }],
    investorImplication: {
      zh: "低损失率不能替代组合级压力测试；资本回报必须在信用正常化和操作风险成本后评估。",
      en: "Low current loss rates do not replace portfolio stress tests; capital returns should be judged after credit normalization and operational-risk costs.",
    },
    relevant: true,
    accessible: true,
  },
  {
    id: "fed-stress-test-2025",
    title: "2025 Federal Reserve Supervisory Stress Test Results",
    publisher: "Board of Governors of the Federal Reserve System",
    publicationDate: "2025-06-27",
    retrievalDate: RETRIEVAL_DATE,
    sourceType: "government-outlook",
    access: "public",
    sector: "financials",
    subindustry: "banks",
    geography: ["US"],
    topic: "Large-bank stress losses, pre-provision net revenue, CET1, and capital resilience",
    url: "https://www.federalreserve.gov/publications/2025-june-dodd-frank-act-stress-test-introduction.htm",
    currentEvidence: {
      zh: "美联储 2025 年压力测试显示 22 家大型银行可吸收近 5,500 亿美元损失并继续放贷；严重不利情景下汇总 CET1 比率由 13.4% 降至最低 11.6%。",
      en: "The Federal Reserve's 2025 stress test found that 22 large banks could absorb nearly $550 billion of losses and continue lending; aggregate CET1 fell from 13.4% to a projected minimum of 11.6% in the severely adverse scenario.",
    },
    generalizedMethods: [{
      zh: "在统一严重衰退情景下预测损失、拨备前净收入、费用和资本路径，并以最低 CET1 而非期末资本判断脆弱性。",
      en: "Project losses, pre-provision net revenue, expenses, and capital under a common severe recession and assess resilience using minimum rather than ending CET1.",
    }],
    investorImplication: {
      zh: "估值和分配能力应以压力期最低资本、信用损失和盈利缓冲为约束，而不能只看当前 CET1。",
      en: "Valuation and distributions should be constrained by trough stress capital, credit losses, and earnings buffers rather than current CET1 alone.",
    },
    relevant: true,
    accessible: true,
  },
];

export function screenSectorEvidence(
  candidates: EvidenceCandidate[],
  currentDate = new Date().toISOString().slice(0, 10),
) {
  return ingestSectorResearch(candidates, currentDate).sources;
}

export const SECTOR_LEARNING_CORPUS =
  ingestSectorResearch(EVIDENCE_CANDIDATES);

export const CURRENT_SECTOR_EVIDENCE =
  SECTOR_LEARNING_CORPUS.sources;
