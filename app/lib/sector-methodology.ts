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
];

export function getSectorMethods(subindustry: SupportedSubindustry) {
  return METHODS.filter((method) => method.subindustry === subindustry);
}
