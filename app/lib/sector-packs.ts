import type { SectorPack, SupportedSubindustry } from "./sector-types";

const energyPack: SectorPack = {
  id: "integrated-oil-gas",
  sector: "energy",
  sectorLabel: { zh: "能源", en: "Energy" },
  subindustryLabel: { zh: "综合石油与天然气", en: "Integrated Oil & Gas" },
  sicCodes: ["1311", "2911"],
  coreKpis: [
    {
      id: "production",
      label: { zh: "油气产量", en: "Production" },
      description: { zh: "权益口径产量及油气结构。", en: "Equity production and oil/gas mix." },
      availability: "notStandardized",
    },
    {
      id: "realized-prices",
      label: { zh: "实现价格", en: "Realized prices" },
      description: { zh: "相对基准油气价格的实现水平。", en: "Realizations versus oil and gas benchmarks." },
      availability: "notStandardized",
    },
    {
      id: "lng",
      label: { zh: "LNG 销量", en: "LNG volumes" },
      description: { zh: "液化量、销量和合同组合。", en: "Liquefaction, sales volumes, and contract mix." },
      availability: "notStandardized",
    },
    {
      id: "refining-margin",
      label: { zh: "炼化利润率", en: "Refining margins" },
      description: { zh: "炼厂利用率、价差与单位利润。", en: "Utilization, cracks, and unit margins." },
      availability: "notStandardized",
    },
    {
      id: "segment-earnings",
      label: { zh: "分部收益", en: "Segment earnings" },
      description: { zh: "管理层分部调整后收益及合并核对。", en: "Management segment adjusted earnings and consolidated reconciliation." },
      availability: "notStandardized",
    },
    {
      id: "cash-capex",
      label: { zh: "现金资本开支", en: "Cash capex" },
      description: { zh: "标准化申报中的现金购置固定资产。", en: "Cash purchases of property and equipment in standardized filings." },
      availability: "cashCapex",
    },
    {
      id: "fcf",
      label: { zh: "自由现金流", en: "Free cash flow" },
      description: { zh: "经营现金流减现金资本开支。", en: "Operating cash flow less cash capital expenditure." },
      availability: "freeCashFlow",
    },
    {
      id: "net-debt",
      label: { zh: "净债务", en: "Net debt" },
      description: { zh: "标准化债务减现金。", en: "Normalized debt less cash." },
      availability: "netDebt",
    },
    {
      id: "dividends",
      label: { zh: "现金股息", en: "Dividends" },
      description: { zh: "向母公司股东支付的现金股息。", en: "Cash dividends paid to parent-company shareholders." },
      availability: "notStandardized",
    },
    {
      id: "share-buybacks",
      label: { zh: "股票回购", en: "Share buybacks" },
      description: { zh: "用于收购或赎回发行人股份的现金。", en: "Cash used to acquire or redeem the issuer's shares." },
      availability: "notStandardized",
    },
    {
      id: "commodity-sensitivity",
      label: { zh: "商品价格敏感度", en: "Commodity sensitivity" },
      description: { zh: "油、气、LNG 与炼化价差对现金流的影响。", en: "Cash-flow exposure to oil, gas, LNG, and refining spreads." },
      availability: "notStandardized",
    },
    {
      id: "major-projects",
      label: { zh: "重大项目", en: "Major projects" },
      description: { zh: "投产时间、爬坡、预算及回报。", en: "Start-up timing, ramp, budget, and returns." },
      availability: "notStandardized",
    },
  ],
  researchQuestions: [
    { zh: "产量增长来自新项目还是高基数资产的自然递减？", en: "Is production growth driven by new projects or offset by base decline?" },
    { zh: "实现价格、炼化价差与 LNG 组合如何传导至经营现金流？", en: "How do realizations, refining spreads, and the LNG portfolio translate into operating cash flow?" },
    { zh: "资本开支中维护、增长与低碳项目各占多少？", en: "How much capital expenditure is maintenance, growth, or low-carbon investment?" },
    { zh: "股息和回购在下行情景中是否仍由自由现金流覆盖？", en: "Are dividends and buybacks covered by free cash flow in a downside case?" },
    { zh: "哪些重大项目的进度、成本或监管许可可能改变中期现金流？", en: "Which major-project schedules, costs, or permits could change medium-term cash flow?" },
  ],
  marketDrivers: [
    {
      id: "oil-balance",
      name: { zh: "全球原油供需与库存", en: "Global oil balance and inventories" },
      companyExposure: { zh: "上游实现价格、交易和营运资本。", en: "Upstream realizations, trading, and working capital." },
      implication: { zh: "库存累积通常压低价格与上游现金流，但下游价差可能部分对冲。", en: "Inventory builds generally pressure prices and upstream cash flow, partly offset by downstream spreads." },
      query: "global oil supply demand inventories Brent price upstream realizations",
    },
    {
      id: "lng-cycle",
      name: { zh: "LNG 供应扩张与合同结构", en: "LNG supply expansion and contract structure" },
      companyExposure: { zh: "液化、贸易、长期合同及目的地灵活性。", en: "Liquefaction, trading, long-term contracts, and destination flexibility." },
      implication: { zh: "新增产能可能压低现货溢价，同时提升组合优化的重要性。", en: "New capacity can compress spot premia while increasing the value of portfolio optimization." },
      query: "LNG supply capacity contracts pricing flexibility gas market",
    },
    {
      id: "refining-cycle",
      name: { zh: "炼化价差与利用率", en: "Refining cracks and utilization" },
      companyExposure: { zh: "炼厂利润、库存和产品需求。", en: "Refinery earnings, inventories, and product demand." },
      implication: { zh: "高价差可缓冲上游走弱，但持续性取决于库存与供应中断。", en: "Strong cracks can cushion upstream weakness, but durability depends on inventories and outages." },
      query: "refining margins crack spreads utilization product inventories",
    },
    {
      id: "capital-discipline",
      name: { zh: "资本纪律与股东分配", en: "Capital discipline and distributions" },
      companyExposure: { zh: "项目制资本开支、净债务、股息与回购。", en: "Project capex, net debt, dividends, and buybacks." },
      implication: { zh: "周期高点的资本纪律决定下行时的分配韧性。", en: "Peak-cycle capital discipline determines distribution resilience in a downturn." },
      query: "oil investment capex free cash flow net debt dividends buybacks",
    },
  ],
  peers: [
    { ticker: "XOM", cik: "0000034088", name: "Exxon Mobil", rationale: { zh: "全球综合能源与 LNG 可比。", en: "Global integrated energy and LNG comparator." } },
    { ticker: "CVX", cik: "0000093410", name: "Chevron", rationale: { zh: "上游与资本分配可比。", en: "Upstream and capital-allocation comparator." } },
    { ticker: "BP", cik: "0000313807", name: "BP", rationale: { zh: "欧洲综合能源转型可比。", en: "European integrated-energy transition comparator." } },
    { ticker: "TTE", cik: "0000879764", name: "TotalEnergies", rationale: { zh: "LNG 与综合能源组合可比。", en: "LNG and integrated portfolio comparator." } },
  ],
  valuation: {
    method: { zh: "情景 EV / 自由现金流", en: "Scenario EV / free cash flow" },
    formula: { zh: "模型隐含企业价值 = 情景自由现金流 × 假设 EV/FCF 倍数", en: "Model-implied enterprise value = scenario free cash flow × assumed EV/FCF multiple" },
    multipleLabel: "EV / FCF",
    multiples: { bear: 5, base: 7, bull: 9 },
    metric: "freeCashFlow",
    fallback: {
      method: {
        zh: "FCF 不可计算时使用情景 EV / 经营现金流",
        en: "Scenario EV / operating cash flow when FCF is unavailable",
      },
      formula: {
        zh: "模型隐含企业价值 = 情景经营现金流 × 假设 EV/经营现金流倍数；不把经营现金流称为 FCF",
        en: "Model-implied enterprise value = scenario operating cash flow × assumed EV/operating-cash-flow multiple; operating cash flow is not presented as FCF",
      },
      multipleLabel: "EV / OCF",
      multiples: { bear: 4, base: 6, bull: 8 },
      metric: "operatingCashFlow",
    },
  },
  risks: [
    { zh: "油气与炼化价格同步下跌。", en: "A synchronized decline in oil, gas, and refining prices." },
    { zh: "重大项目延误、超支或储量表现不及预期。", en: "Major-project delay, cost overrun, or reservoir underperformance." },
    { zh: "资本开支和分配在低价环境下推高净债务。", en: "Capex and distributions increase net debt in a low-price environment." },
    { zh: "碳政策、甲烷规则、诉讼或许可限制资产价值。", en: "Carbon policy, methane rules, litigation, or permitting constrain asset value." },
  ],
  catalysts: {
    operating: [
      { zh: "重大项目投产或爬坡快于计划。", en: "Major-project start-up or ramp ahead of plan." },
      { zh: "产量、LNG 销量或炼厂利用率改善。", en: "Improved production, LNG volumes, or refinery utilization." },
    ],
    financial: [
      { zh: "资本开支下降带动自由现金流拐点。", en: "A free-cash-flow inflection as capital expenditure declines." },
      { zh: "净债务下降支持股息或回购。", en: "Lower net debt supports dividends or buybacks." },
    ],
    regulatory: [
      { zh: "重大项目获得最终许可或税制明确。", en: "Final project approval or greater fiscal certainty." },
      { zh: "LNG、甲烷或碳政策发生实质变化。", en: "A material change in LNG, methane, or carbon policy." },
    ],
  },
  reportGuidance: [
    { zh: "将上游、LNG、炼化和资本配置分别讨论，避免只看合并营收。", en: "Separate upstream, LNG, refining, and capital allocation rather than relying on consolidated revenue." },
    { zh: "任何 FCF 只使用经营现金流减现金资本开支。", en: "Calculate FCF only as operating cash flow less cash capital expenditure." },
    { zh: "把商品价格假设、项目进度和分配政策作为独立敏感度。", en: "Treat commodity assumptions, project timing, and distribution policy as separate sensitivities." },
  ],
};

const semiconductorPack: SectorPack = {
  id: "semiconductors",
  sector: "technology",
  sectorLabel: { zh: "科技", en: "Technology" },
  subindustryLabel: { zh: "半导体", en: "Semiconductors" },
  sicCodes: ["3674"],
  coreKpis: [
    {
      id: "end-market",
      label: { zh: "终端市场收入", en: "End-market revenue" },
      description: { zh: "数据中心、游戏、汽车、工业等收入结构。", en: "Revenue mix across data center, gaming, automotive, industrial, and other end markets." },
      availability: "notStandardized",
    },
    {
      id: "ai-exposure",
      label: { zh: "AI / 数据中心敞口", en: "AI / data-center exposure" },
      description: { zh: "AI 训练、推理与网络产品收入暴露。", en: "Exposure to AI training, inference, and networking products." },
      availability: "notStandardized",
    },
    {
      id: "gross-margin",
      label: { zh: "毛利率", en: "Gross margin" },
      description: { zh: "营收减销售成本后占营收比例。", en: "Revenue less cost of revenue, divided by revenue." },
      availability: "grossMargin",
    },
    {
      id: "operating-margin",
      label: { zh: "营业利润率", en: "Operating margin" },
      description: { zh: "营业利润占营收比例。", en: "Operating income divided by revenue." },
      availability: "operatingMargin",
    },
    {
      id: "inventory",
      label: { zh: "库存", en: "Inventory" },
      description: { zh: "产品周期、供需与减值风险的资产负债表信号。", en: "Balance-sheet signal for product cycles, supply-demand, and write-down risk." },
      availability: "inventory",
    },
    {
      id: "utilization",
      label: { zh: "产能利用率", en: "Utilization" },
      description: { zh: "自有或供应链产能利用程度及周期信号。", en: "Utilization of owned or supply-chain capacity as a cycle signal." },
      availability: "notStandardized",
    },
    {
      id: "cash-capex",
      label: { zh: "现金资本开支", en: "Cash capex" },
      description: { zh: "现金购置固定资产；无晶圆厂模式也需观察基础设施投资。", en: "Cash purchases of property and equipment; relevant even for fabless infrastructure." },
      availability: "cashCapex",
    },
    {
      id: "fcf",
      label: { zh: "自由现金流", en: "Free cash flow" },
      description: { zh: "经营现金流减现金资本开支。", en: "Operating cash flow less cash capital expenditure." },
      availability: "freeCashFlow",
    },
    {
      id: "product-cycle",
      label: { zh: "产品周期", en: "Product cycle" },
      description: { zh: "架构更新、交付节奏、良率和供应约束。", en: "Architecture transitions, shipment cadence, yields, and supply constraints." },
      availability: "notStandardized",
    },
    {
      id: "customer-concentration",
      label: { zh: "客户集中度", en: "Customer concentration" },
      description: { zh: "前十大客户与云客户采购集中度。", en: "Concentration among major customers and cloud buyers." },
      availability: "notStandardized",
    },
    {
      id: "market-share",
      label: { zh: "市场份额", en: "Market share" },
      description: { zh: "按产品、加速器、CPU、网络或终端市场划分。", en: "Share by product, accelerator, CPU, networking, or end market." },
      availability: "notStandardized",
    },
  ],
  researchQuestions: [
    { zh: "增长来自单位出货、平均售价、组合升级还是供给释放？", en: "Is growth driven by units, average selling price, mix, or easing supply constraints?" },
    { zh: "AI / 数据中心需求有多少来自可持续使用量，多少来自建设周期？", en: "How much AI/data-center demand reflects durable utilization versus a buildout cycle?" },
    { zh: "产品换代、良率、封装与 HBM 供给如何影响毛利率？", en: "How do product transitions, yields, packaging, and HBM supply affect gross margin?" },
    { zh: "库存与预付款是否领先于需求放缓或供应改善？", en: "Do inventory and supply commitments lead a demand slowdown or supply improvement?" },
    { zh: "客户集中度、定制芯片和出口限制如何影响中期份额？", en: "How do customer concentration, custom silicon, and export controls affect medium-term share?" },
  ],
  marketDrivers: [
    {
      id: "ai-demand",
      name: { zh: "AI 与数据中心资本开支", en: "AI and data-center capital expenditure" },
      companyExposure: { zh: "加速器、网络、软件生态与供给分配。", en: "Accelerators, networking, software ecosystem, and supply allocation." },
      implication: { zh: "需求增长可抬升收入与组合，但高基数增加订单消化风险。", en: "Demand growth lifts revenue and mix, while a high base raises digestion risk." },
      query: "AI data center semiconductor demand accelerators logic memory sales",
    },
    {
      id: "capacity",
      name: { zh: "先进制程、封装与 HBM 产能", en: "Advanced-node, packaging, and HBM capacity" },
      companyExposure: { zh: "交付能力、成本、良率和产品爬坡。", en: "Shipment capacity, cost, yield, and product ramp." },
      implication: { zh: "产能扩张缓解瓶颈，但也可能在需求转弱时提高周期风险。", en: "Capacity expansion relieves bottlenecks but can amplify cyclicality if demand slows." },
      query: "300mm fab equipment advanced node HBM capacity packaging investment",
    },
    {
      id: "product-cycle",
      name: { zh: "产品迭代与竞争", en: "Product cadence and competition" },
      companyExposure: { zh: "性能、功耗、上市时间和生态粘性。", en: "Performance, power, time to market, and ecosystem stickiness." },
      implication: { zh: "按时换代支撑定价；延期或替代方案会侵蚀份额。", en: "On-time transitions support pricing; delays or substitutes erode share." },
      query: "semiconductor product cycle performance power competition market share",
    },
    {
      id: "export-controls",
      name: { zh: "出口管制与市场准入", en: "Export controls and market access" },
      companyExposure: { zh: "高端产品可售市场、许可证及产品降规。", en: "Addressable markets, licensing, and product redesigns for advanced chips." },
      implication: { zh: "规则变化可迅速改变收入可达性、库存和研发优先级。", en: "Rule changes can quickly alter revenue access, inventory, and R&D priorities." },
      query: "semiconductor export controls licensing AI chips market access",
    },
  ],
  peers: [
    { ticker: "AMD", cik: "0000002488", name: "Advanced Micro Devices", rationale: { zh: "AI 加速器、CPU 与数据中心可比。", en: "AI accelerator, CPU, and data-center comparator." } },
    { ticker: "AVGO", cik: "0001730168", name: "Broadcom", rationale: { zh: "定制 AI、网络与高现金转化可比。", en: "Custom AI, networking, and high cash-conversion comparator." } },
    { ticker: "INTC", cik: "0000050863", name: "Intel", rationale: { zh: "CPU、制造资本强度和晶圆代工可比。", en: "CPU, manufacturing intensity, and foundry comparator." } },
    { ticker: "TSM", cik: "0001046179", name: "TSMC", rationale: { zh: "先进制程产能与资本周期可比。", en: "Advanced-node capacity and capital-cycle comparator." } },
  ],
  valuation: {
    method: { zh: "情景 EV / 营收，并以 FCF 交叉核对", en: "Scenario EV / revenue with an FCF cross-check" },
    formula: { zh: "模型隐含企业价值 = 情景营收 × 假设 EV/营收倍数", en: "Model-implied enterprise value = scenario revenue × assumed EV/revenue multiple" },
    multipleLabel: "EV / Revenue",
    multiples: { bear: 6, base: 9, bull: 12 },
    metric: "revenue",
  },
  risks: [
    { zh: "AI 资本开支或云客户订单进入消化期。", en: "AI capex or cloud orders enter a digestion phase." },
    { zh: "产品延期、良率、封装或 HBM 供给限制交付。", en: "Product delay, yield, packaging, or HBM supply constrains shipments." },
    { zh: "客户自研芯片或竞争产品削弱定价和市场份额。", en: "Custom silicon or competing products weaken pricing and share." },
    { zh: "出口管制扩大导致市场受限、库存或产品重设。", en: "Broader export controls cause market restrictions, inventory, or redesigns." },
  ],
  catalysts: {
    operating: [
      { zh: "新架构按期量产且供给瓶颈缓解。", en: "On-time volume ramp of a new architecture with easing supply bottlenecks." },
      { zh: "AI / 数据中心收入和毛利率超出可见性。", en: "AI/data-center revenue and gross margin exceed visible expectations." },
    ],
    financial: [
      { zh: "营收增长与营运资本共同推动 FCF 转化。", en: "Revenue growth and working capital improve FCF conversion." },
      { zh: "库存周转改善且无重大减值。", en: "Inventory turns improve without material write-downs." },
    ],
    regulatory: [
      { zh: "出口许可证或规则明确扩大可服务市场。", en: "Licensing or rule clarity expands the serviceable market." },
      { zh: "产业补贴或本地化产能改善供应韧性。", en: "Industrial incentives or localized capacity improve supply resilience." },
    ],
  },
  reportGuidance: [
    { zh: "按终端市场拆分增长，避免把全部收入增长归因于 AI。", en: "Bridge growth by end market rather than attributing all revenue growth to AI." },
    { zh: "同时观察毛利率、库存和供给承诺，以识别周期质量。", en: "Read gross margin, inventory, and supply commitments together to assess cycle quality." },
    { zh: "估值应把增长、产品周期、客户集中度与出口限制作为独立敏感度。", en: "Valuation should treat growth, product cadence, customer concentration, and export controls as separate sensitivities." },
  ],
};

const PACKS: Record<SupportedSubindustry, SectorPack> = {
  "integrated-oil-gas": energyPack,
  semiconductors: semiconductorPack,
};

export function getSectorPack(id: SupportedSubindustry) {
  return PACKS[id];
}

export function listSectorPacks() {
  return Object.values(PACKS);
}
