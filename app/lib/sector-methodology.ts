import type { SectorMethod, SupportedSubindustry } from "./sector-types";

const METHODS: SectorMethod[] = [
  {
    id: "energy-segment-bridge",
    sector: "energy",
    subindustry: "integrated-oil-gas",
    name: { zh: "综合能源分部桥接", en: "Integrated-energy segment bridge" },
    purpose: { zh: "把上游、LNG、炼化与公司层资本配置分开分析。", en: "Separate upstream, LNG, refining, and corporate capital allocation." },
    steps: [
      { zh: "核对分部定义与重述。", en: "Reconcile segment definitions and recasts." },
      { zh: "桥接产量、实现价格、价差与分部收益。", en: "Bridge production, realizations, spreads, and segment earnings." },
      { zh: "把资本开支、营运资本和税费连接至现金流。", en: "Connect capex, working capital, and taxes to cash flow." },
    ],
  },
  {
    id: "energy-cash-waterfall",
    sector: "energy",
    subindustry: "integrated-oil-gas",
    name: { zh: "现金流与分配瀑布", en: "Cash-flow and distribution waterfall" },
    purpose: { zh: "判断股息和回购是否由 FCF 覆盖。", en: "Test whether dividends and buybacks are covered by FCF." },
    steps: [
      { zh: "FCF = 经营现金流 - 现金资本开支。", en: "FCF = operating cash flow - cash capital expenditure." },
      { zh: "再扣股息、回购与并购，观察净债务变化。", en: "Then deduct dividends, buybacks, and M&A and observe net-debt movement." },
      { zh: "对油、气、LNG 与炼化价差分别做敏感度。", en: "Run separate sensitivities for oil, gas, LNG, and refining spreads." },
    ],
  },
  {
    id: "energy-peer-valuation",
    sector: "energy",
    subindustry: "integrated-oil-gas",
    name: { zh: "周期化同业估值", en: "Cycle-aware peer valuation" },
    purpose: { zh: "避免用单一高点或低点现金流外推。", en: "Avoid extrapolating a single peak or trough cash-flow year." },
    steps: [
      { zh: "统一 FCF、净债务与资本开支口径。", en: "Normalize FCF, net debt, and capex definitions." },
      { zh: "比较 EV/FCF 与资本回报，并披露商品价格基准。", en: "Compare EV/FCF and returns with disclosed commodity benchmarks." },
      { zh: "用下行覆盖和项目组合解释估值差异。", en: "Explain valuation gaps through downside coverage and project mix." },
    ],
  },
  {
    id: "semis-end-market-bridge",
    sector: "technology",
    subindustry: "semiconductors",
    name: { zh: "终端市场增长桥接", en: "End-market growth bridge" },
    purpose: { zh: "区分单位、价格、组合、供给与 AI 建设周期。", en: "Separate units, pricing, mix, supply, and the AI buildout cycle." },
    steps: [
      { zh: "按终端市场重建收入与增速。", en: "Rebuild revenue and growth by end market." },
      { zh: "识别平均售价、产品组合和供给释放贡献。", en: "Identify ASP, mix, and supply-release contributions." },
      { zh: "把订单和客户集中度与最终使用量交叉核对。", en: "Cross-check orders and customer concentration against end utilization." },
    ],
  },
  {
    id: "semis-margin-cycle",
    sector: "technology",
    subindustry: "semiconductors",
    name: { zh: "毛利率与库存周期", en: "Gross-margin and inventory cycle" },
    purpose: { zh: "判断产品周期的盈利质量与库存风险。", en: "Assess product-cycle earnings quality and inventory risk." },
    steps: [
      { zh: "桥接价格、组合、良率、供应成本与减值。", en: "Bridge price, mix, yield, supply cost, and write-downs." },
      { zh: "将库存增速与营收、交期和供给承诺比较。", en: "Compare inventory growth with revenue, lead times, and supply commitments." },
      { zh: "观察毛利率和 FCF 是否同步改善。", en: "Test whether gross margin and FCF improve together." },
    ],
  },
  {
    id: "semis-valuation",
    sector: "technology",
    subindustry: "semiconductors",
    name: { zh: "增长与周期估值", en: "Growth-and-cycle valuation" },
    purpose: { zh: "把高增长与周期、产品和监管风险同时纳入。", en: "Balance high growth against cycle, product, and regulatory risks." },
    steps: [
      { zh: "以 EV/营收做透明情景，并以 FCF 交叉核对。", en: "Use transparent EV/revenue scenarios with an FCF cross-check." },
      { zh: "显式披露收入增速、毛利率、库存与倍数假设。", en: "Disclose revenue growth, gross margin, inventory, and multiple assumptions." },
      { zh: "用产品延期、客户集中和出口限制定义论点破坏条件。", en: "Define thesis breakers around product delay, concentration, and export controls." },
    ],
  },
  {
    id: "banks-earnings-bridge",
    sector: "financials",
    subindustry: "banks",
    name: { zh: "银行盈利桥接", en: "Bank earnings bridge" },
    purpose: { zh: "把净利息收入、费用收入、信用成本和运营费用分开。", en: "Separate net interest income, fee revenue, credit costs, and operating expense." },
    steps: [
      { zh: "桥接生息资产、收益率、融资成本与净息差。", en: "Bridge earning assets, yields, funding cost, and net interest margin." },
      { zh: "按贷款组合分析增长、拖欠、净核销和拨备。", en: "Analyze growth, delinquencies, net charge-offs, and provisions by loan portfolio." },
      { zh: "用效率比率和拨备前利润判断经营杠杆。", en: "Use the efficiency ratio and pre-provision earnings to assess operating leverage." },
    ],
  },
  {
    id: "banks-capital-waterfall",
    sector: "financials",
    subindustry: "banks",
    name: { zh: "资本与流动性瀑布", en: "Capital and liquidity waterfall" },
    purpose: { zh: "判断股息和回购是否受盈利、RWA、压力损失和监管缓冲覆盖。", en: "Test whether earnings, RWA, stress losses, and regulatory buffers cover dividends and buybacks." },
    steps: [
      { zh: "从期初 CET1 加留存收益并扣 RWA 增长和资本扣减。", en: "Bridge beginning CET1 through retained earnings, RWA growth, and capital deductions." },
      { zh: "比较流动资产、存款稳定性、批发融资和未实现损失。", en: "Compare liquid assets, deposit stability, wholesale funding, and unrealized losses." },
      { zh: "将压力期最低 CET1 作为分配约束。", en: "Use trough stressed CET1 as the distribution constraint." },
    ],
  },
  {
    id: "banks-book-value",
    sector: "financials",
    subindustry: "banks",
    name: { zh: "有形账面价值估值", en: "Tangible-book valuation" },
    purpose: { zh: "用盈利能力、资本质量和信用周期解释 P/TBV 差异。", en: "Explain P/TBV differences through profitability, capital quality, and the credit cycle." },
    steps: [
      { zh: "统一普通股权益、商誉和无形资产口径。", en: "Normalize common equity, goodwill, and intangible-asset definitions." },
      { zh: "把 ROE、资本成本和有形账面增长与 P/TBV 情景连接。", en: "Connect ROE, cost of capital, and tangible-book growth to P/TBV scenarios." },
      { zh: "以信用损失和监管资本情景定义下行。", en: "Define downside through credit-loss and regulatory-capital scenarios." },
    ],
  },
  {
    id: "biopharma-commercial-bridge",
    sector: "healthcare",
    subindustry: "biopharma",
    name: { zh: "产品商业化桥接", en: "Product commercialization bridge" },
    purpose: { zh: "把总营收增长拆分为产品、销量、价格、地区和合作收入。", en: "Decompose total growth by product, volume, price, geography, and collaboration revenue." },
    steps: [
      { zh: "从年报产品表重建主要产品收入。", en: "Rebuild major-product revenue from the annual-filing product table." },
      { zh: "计算产品与治疗领域集中度，并保留净收入定义。", en: "Calculate product and therapeutic-area concentration while preserving net-revenue definitions." },
      { zh: "桥接销量、实现价格、渠道、报销和供应约束。", en: "Bridge volume, realized price, channel, reimbursement, and supply constraints." },
    ],
  },
  {
    id: "biopharma-pipeline-gates",
    sector: "healthcare",
    subindustry: "biopharma",
    name: { zh: "管线阶段闸门", en: "Pipeline stage gates" },
    purpose: { zh: "把临床阶段、里程碑、监管状态和概率假设分开。", en: "Separate clinical stage, milestone, regulatory status, and probability assumptions." },
    steps: [
      { zh: "按候选药和适应症记录阶段、试验设计、状态和来源日期。", en: "Record stage, trial design, status, and source date by candidate and indication." },
      { zh: "只把监管机构确认的批准或提交状态作为事实。", en: "Treat only regulator-confirmed approval or submission status as fact." },
      { zh: "成功概率、时间、峰值销售和利润率均作为可见假设。", en: "Keep success probability, timing, peak sales, and margin as visible assumptions." },
    ],
  },
  {
    id: "biopharma-rd-quality",
    sector: "healthcare",
    subindustry: "biopharma",
    name: { zh: "研发质量与周期", en: "R&D quality and cycle" },
    purpose: { zh: "判断研发支出是否转化为高质量里程碑和组合更新。", en: "Assess whether R&D spending converts into high-quality milestones and portfolio renewal." },
    steps: [
      { zh: "比较研发支出、营收、毛利和经营现金流趋势。", en: "Compare R&D expense with revenue, gross profit, and operating cash flow trends." },
      { zh: "跟踪分期成功、入组、项目间隔和终止。", en: "Track phase success, enrollment, inter-trial intervals, and discontinuations." },
      { zh: "区分内生研发、许可、收购和在研资产减值。", en: "Separate internal R&D, licensing, acquisitions, and in-process R&D impairment." },
    ],
  },
  {
    id: "biopharma-lifecycle-valuation",
    sector: "healthcare",
    subindustry: "biopharma",
    name: { zh: "生命周期与估值", en: "Lifecycle and valuation" },
    purpose: { zh: "把现有商业价值与风险调整管线价值分开。", en: "Separate current commercial value from risk-adjusted pipeline value." },
    steps: [
      { zh: "按产品映射收入、专利或数据保护、定价和竞争。", en: "Map revenue, patent or data protection, pricing, and competition by product." },
      { zh: "仅在候选药概率、时间、经济性和成本均可见时计算 rNPV。", en: "Calculate rNPV only when candidate probability, timing, economics, and cost are visible." },
      { zh: "数据不足时使用透明营收情景，并明确不输出伪精确管线价值。", en: "When data are insufficient, use transparent revenue scenarios and do not publish false-precision pipeline value." },
    ],
  },
];

export function getSectorMethods(subindustry: SupportedSubindustry) {
  return METHODS.filter((method) => method.subindustry === subindustry);
}
