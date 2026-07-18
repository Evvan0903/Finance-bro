import {
  createCanonicalMetric,
  type MetricRegistry,
} from "./canonical-metrics";
import { FINANCIAL_DEFINITION_IDS } from "./financial-metrics";
import type {
  MarketValuationSnapshot,
  PipelineAsset,
  ProductMetricObject,
  ResearchLocale,
} from "./research-types";

const LLY_10K_URL =
  "https://www.sec.gov/Archives/edgar/data/59478/000005947826000013/lly-20251231.htm";
const LLY_Q1_URL =
  "https://www.sec.gov/Archives/edgar/data/59478/000005947826000045/lly-20260331.htm";
const LLY_Q1_RELEASE_URL = "https://investor.lilly.com/node/54176";
const LLY_MARKET_URL =
  "https://investor.lilly.com/stock-information/historic-stock-lookup";

const PRODUCT_DEFINITIONS = [
  {
    product: "Mounjaro",
    definitionId: "issuer-reported-mounjaro-total-revenue",
    periodEnd: "2025-12-31",
    priorPeriodEnd: "2024-12-31",
    totalRevenueMetricId: "revenue",
    totalRevenueDefinitionId: FINANCIAL_DEFINITION_IDS.revenue,
    therapeuticArea: { zh: "心血管代谢", en: "Cardiometabolic health" },
    indication: { zh: "2 型糖尿病", en: "Type 2 diabetes" },
    volumePrice: {
      zh: "2025 年增长由强劲需求和境外销量推动，部分被美国及部分国际市场实现价格下降抵消。",
      en: "2025 growth was driven by demand and international volume, partly offset by lower realized prices in the U.S. and certain international markets.",
    },
    supplyCapacity: {
      zh: "新增 API 与制剂产能处于多年建设期；已承诺投资不等于当前可用产量。",
      en: "New API and finished-dose capacity is in a multi-year buildout; committed investment is not current available output.",
    },
    approvalStatus: { zh: "已批准；多个新适应症处于 III 期或申报阶段。", en: "Approved; multiple additional indications are in Phase 3 or regulatory review." },
    patentLifecycle: { zh: "发行人估计美国化合物专利于 2036 年到期。", en: "Issuer-estimated U.S. compound-patent expiry: 2036." },
    commercialRisks: {
      zh: "实现价格、报销、供应、安全性、复方竞争和适应症扩展执行。",
      en: "Realized price, reimbursement, supply, safety, incretin competition, and indication-expansion execution.",
    },
  },
  {
    product: "Zepbound",
    definitionId: "issuer-reported-zepbound-total-revenue",
    periodEnd: "2025-12-31",
    priorPeriodEnd: "2024-12-31",
    totalRevenueMetricId: "revenue",
    totalRevenueDefinitionId: FINANCIAL_DEFINITION_IDS.revenue,
    therapeuticArea: { zh: "心血管代谢", en: "Cardiometabolic health" },
    indication: { zh: "肥胖或伴体重相关合并症的超重", en: "Obesity or overweight with weight-related comorbidity" },
    volumePrice: {
      zh: "2025 年美国增长主要来自需求，部分被实现价格下降抵消。",
      en: "2025 U.S. growth was primarily demand-driven and partly offset by lower realized prices.",
    },
    supplyCapacity: {
      zh: "注射剂产能扩张仍是需求转化为收入的关键约束。",
      en: "Injectable capacity expansion remains a key constraint on converting demand into revenue.",
    },
    approvalStatus: { zh: "已批准；医保 Bridge 仅覆盖指定制剂。", en: "Approved; Medicare Bridge access applies only to specified formulations." },
    patentLifecycle: { zh: "发行人估计美国化合物专利于 2036 年到期。", en: "Issuer-estimated U.S. compound-patent expiry: 2036." },
    commercialRisks: {
      zh: "自费价格、医保准入、供应、口服 GLP-1 竞争和产品责任诉讼。",
      en: "Cash-pay pricing, payer access, supply, oral GLP-1 competition, and product-liability litigation.",
    },
  },
  {
    product: "Verzenio",
    definitionId: "issuer-reported-verzenio-total-revenue",
    periodEnd: "2025-12-31",
    priorPeriodEnd: "2024-12-31",
    totalRevenueMetricId: "revenue",
    totalRevenueDefinitionId: FINANCIAL_DEFINITION_IDS.revenue,
    therapeuticArea: { zh: "肿瘤", en: "Oncology" },
    indication: { zh: "HR+/HER2- 乳腺癌", en: "HR-positive / HER2-negative breast cancer" },
    volumePrice: { zh: "境外收入增长由销量推动；未单独披露集团层净价格桥。", en: "International growth was volume-led; no group-level net-price bridge was separately disclosed." },
    supplyCapacity: { zh: "未披露产品级产能利用率。", en: "Product-level capacity utilization was not disclosed." },
    approvalStatus: { zh: "已批准用于转移性及部分高风险早期乳腺癌。", en: "Approved in metastatic and certain high-risk early breast-cancer settings." },
    patentLifecycle: { zh: "发行人估计美国化合物专利于 2031 年到期。", en: "Issuer-estimated U.S. compound-patent expiry: 2031." },
    commercialRisks: { zh: "2028 年 Medicare 谈判价格、竞争和生命周期侵蚀。", en: "2028 Medicare negotiated pricing, competition, and lifecycle erosion." },
  },
  {
    product: "Trulicity",
    definitionId: "issuer-reported-trulicity-total-revenue",
    periodEnd: "2025-12-31",
    priorPeriodEnd: "2024-12-31",
    totalRevenueMetricId: "revenue",
    totalRevenueDefinitionId: FINANCIAL_DEFINITION_IDS.revenue,
    therapeuticArea: { zh: "心血管代谢", en: "Cardiometabolic health" },
    indication: { zh: "2 型糖尿病", en: "Type 2 diabetes" },
    volumePrice: { zh: "收入下降；发行人未在产品表中单独量化价格与销量贡献。", en: "Revenue declined; price and volume contributions were not separately quantified in the product table." },
    supplyCapacity: { zh: "成熟产品；未披露产品级产能利用率。", en: "Mature product; product-level capacity utilization was not disclosed." },
    approvalStatus: { zh: "已批准。", en: "Approved." },
    patentLifecycle: { zh: "发行人估计美国化合物专利及数据保护于 2027 年到期。", en: "Issuer-estimated U.S. compound patent and data protection expire in 2027." },
    commercialRisks: { zh: "专利到期、同类替代及 2028 年 Medicare 谈判价格。", en: "Loss of exclusivity, class substitution, and 2028 Medicare negotiated pricing." },
  },
  {
    product: "Jardiance",
    definitionId: "issuer-reported-jardiance-collaboration-revenue",
    periodEnd: "2025-12-31",
    priorPeriodEnd: "2024-12-31",
    totalRevenueMetricId: "revenue",
    totalRevenueDefinitionId: FINANCIAL_DEFINITION_IDS.revenue,
    therapeuticArea: { zh: "心血管代谢", en: "Cardiometabolic health" },
    indication: { zh: "糖尿病、心衰及慢性肾病", en: "Diabetes, heart failure, and chronic kidney disease" },
    volumePrice: { zh: "收入包含合作利润分成及一次性利益，不能视为 Lilly 的总产品净销售额。", en: "Revenue includes collaboration economics and one-time benefits and is not Lilly gross product net sales." },
    supplyCapacity: { zh: "由 Boehringer Ingelheim 合作安排共同商业化。", en: "Commercialized through the Boehringer Ingelheim collaboration." },
    approvalStatus: { zh: "已批准；美国 Medicare 谈判价格自 2026 年生效。", en: "Approved; U.S. Medicare negotiated pricing became effective in 2026." },
    patentLifecycle: { zh: "合作收入口径与产品专利经济性需分别评估。", en: "Collaboration-revenue definition and patent economics must be assessed separately." },
    commercialRisks: { zh: "合作条款、一次性里程碑、政府定价和成熟产品竞争。", en: "Collaboration terms, one-time milestones, government pricing, and mature-product competition." },
  },
  {
    product: "Taltz",
    definitionId: "issuer-reported-taltz-total-revenue",
    periodEnd: "2025-12-31",
    priorPeriodEnd: "2024-12-31",
    totalRevenueMetricId: "revenue",
    totalRevenueDefinitionId: FINANCIAL_DEFINITION_IDS.revenue,
    therapeuticArea: { zh: "免疫", en: "Immunology" },
    indication: { zh: "银屑病及相关炎症性疾病", en: "Psoriasis and related inflammatory diseases" },
    volumePrice: { zh: "产品表未单独披露价格与销量桥。", en: "The product table did not separately disclose a price-volume bridge." },
    supplyCapacity: { zh: "未披露产品级产能利用率。", en: "Product-level capacity utilization was not disclosed." },
    approvalStatus: { zh: "已批准；适应症组合持续扩展。", en: "Approved; indication portfolio continues to expand." },
    patentLifecycle: { zh: "发行人估计美国化合物专利于 2030 年到期。", en: "Issuer-estimated U.S. compound-patent expiry: 2030." },
    commercialRisks: { zh: "生物制剂竞争、净价格与适应症组合。", en: "Biologic competition, net price, and indication mix." },
  },
  {
    product: "Kisunla",
    definitionId: "issuer-reported-kisunla-total-revenue",
    periodEnd: "2026-03-31",
    priorPeriodEnd: "2025-03-31",
    totalRevenueMetricId: "quarterly-revenue",
    totalRevenueDefinitionId: "issuer-reported-total-revenue-q1-2026",
    therapeuticArea: { zh: "神经科学", en: "Neuroscience" },
    indication: { zh: "早期症状性阿尔茨海默病", en: "Early symptomatic Alzheimer's disease" },
    volumePrice: { zh: "Q1 收入来自早期商业化；未披露价格与患者量桥。", en: "Q1 revenue reflects early commercialization; no price-patient bridge was disclosed." },
    supplyCapacity: { zh: "未披露产品级输注或诊断产能。", en: "Product-level infusion or diagnostic capacity was not disclosed." },
    approvalStatus: { zh: "已在美国、欧盟及日本批准。", en: "Approved in the U.S., EU, and Japan." },
    patentLifecycle: { zh: "发行人估计美国化合物专利及数据保护于 2036 年到期。", en: "Issuer-estimated U.S. compound patent and data protection expire in 2036." },
    commercialRisks: { zh: "诊断、输注与监测基础设施、安全性及同类竞争。", en: "Diagnostic, infusion and monitoring infrastructure, safety, and class competition." },
  },
] as const;

function exactMetric(
  registry: MetricRegistry,
  companyId: string,
  metricId: string,
  periodEnd: string,
  definitionId: string,
) {
  return registry.findMetrics({
    company_id: companyId,
    metric_id: metricId,
    period_end: periodEnd,
    definition_id: definitionId,
  })[0] ?? null;
}

export function buildProductMetrics(
  registry: MetricRegistry,
  companyId: string,
  locale: ResearchLocale,
): ProductMetricObject[] {
  if (companyId !== "LLY") return [];
  return PRODUCT_DEFINITIONS.flatMap((definition) => {
    const current = exactMetric(
      registry,
      companyId,
      "product-revenue",
      definition.periodEnd,
      definition.definitionId,
    );
    if (!current?.value) return [];
    const prior = exactMetric(
      registry,
      companyId,
      "product-revenue",
      definition.priorPeriodEnd,
      definition.definitionId,
    );
    const totalRevenue = exactMetric(
      registry,
      companyId,
      definition.totalRevenueMetricId,
      definition.periodEnd,
      definition.totalRevenueDefinitionId,
    );
    const growth = prior?.value
      ? registry.calculateDerived({
          metric_id: "product-revenue-growth",
          company_id: companyId,
          sector: "biopharma",
          period: current.period,
          period_end: current.period_end,
          definition_id: `${definition.definitionId}-growth`,
          formula_id: "growth-rate",
          formula: "current_product_revenue / prior_comparable_product_revenue - 1",
          input_metric_keys: [current.canonical_key, prior.canonical_key],
          unit: "ratio",
          currency: null,
        })
      : null;
    const share = totalRevenue?.value
      ? registry.calculateDerived({
          metric_id: "product-revenue-share",
          company_id: companyId,
          sector: "biopharma",
          period: current.period,
          period_end: current.period_end,
          definition_id: `${definition.definitionId}-share-of-revenue`,
          formula_id: "divide",
          formula: "product_revenue / comparable_total_revenue",
          input_metric_keys: [current.canonical_key, totalRevenue.canonical_key],
          unit: "ratio",
          currency: null,
        })
      : null;
    return [{
      product: definition.product,
      therapeuticArea: definition.therapeuticArea[locale],
      period: current.period,
      periodType: current.period.startsWith("Q") ? "quarterly" as const : "annual" as const,
      revenue: current.value,
      priorRevenue: prior?.value ?? null,
      revenueGrowth: growth?.value ?? null,
      revenueShare: share?.value ?? null,
      indication: definition.indication[locale],
      geography: locale === "zh" ? "全球（除非另有说明）" : "Worldwide unless otherwise noted",
      volumePrice: definition.volumePrice[locale],
      supplyCapacity: definition.supplyCapacity[locale],
      approvalStatus: definition.approvalStatus[locale],
      patentLifecycle: definition.patentLifecycle[locale],
      commercialRisks: definition.commercialRisks[locale],
      classification: "Reported fact" as const,
      sourceTitle: current.source_document ?? "Eli Lilly public filing",
      sourceDate: current.source_date ?? "2026-02-12",
      sourceUrl: current.source_url ?? LLY_10K_URL,
      metricReferences: {
        revenue: current.canonical_key,
        ...(prior ? { priorRevenue: prior.canonical_key } : {}),
        ...(growth ? { revenueGrowth: growth.canonical_key } : {}),
        ...(share ? { revenueShare: share.canonical_key } : {}),
      },
    }];
  });
}

export function buildPipelineAssets(
  companyId: string,
  locale: ResearchLocale,
): PipelineAsset[] {
  if (companyId !== "LLY") return [];
  const noProbability = locale === "zh"
    ? "未假设；缺少可验证的候选药级成功概率"
    : "Not assumed; no verified candidate-level success probability";
  const noPeakSales = locale === "zh"
    ? "未假设；不以候选药数量替代峰值销售"
    : "Not assumed; candidate count is not a peak-sales proxy";
  const excluded = locale === "zh"
    ? "未纳入 rNPV；仅作为里程碑监测"
    : "Excluded from rNPV; monitored only as a milestone";
  return [
    {
      asset: "Foundayo (orforglipron)",
      indication: locale === "zh" ? "肥胖；2 型糖尿病" : "Obesity; type 2 diabetes",
      stage: locale === "zh" ? "美国肥胖适应症已批准；糖尿病 III 期/申报" : "U.S. obesity approved; diabetes Phase 3 / filing",
      latestMilestone: locale === "zh" ? "2026-04-01 获 FDA 批准用于肥胖。" : "FDA approved for obesity on 2026-04-01.",
      nextMilestone: locale === "zh" ? "跟踪糖尿病申报、商业放量和准入。" : "Monitor diabetes filings, commercial uptake, and access.",
      successProbability: noProbability,
      launchTiming: locale === "zh" ? "肥胖已上市；不预测糖尿病上市日期。" : "Launched in obesity; no diabetes launch date forecast.",
      peakSalesAssumption: noPeakSales,
      valuationTreatment: excluded,
      classification: "Reported fact",
      sourceTitle: "Lilly Foundayo FDA approval release",
      sourceDate: "2026-04-01",
      sourceUrl: "https://investor.lilly.com/news-releases/news-release-details/fda-approves-lillys-foundayotm-orforglipron-only-glp-1-pill",
    },
    {
      asset: "Retatrutide",
      indication: locale === "zh" ? "肥胖、2 型糖尿病及心肾结局" : "Obesity, type 2 diabetes, and cardiovascular / renal outcomes",
      stage: locale === "zh" ? "III 期" : "Phase 3",
      latestMilestone: locale === "zh" ? "TRANSCEND-T2D-1 报告积极顶线结果；注册库未发布结果。" : "TRANSCEND-T2D-1 reported positive topline results; registry results are not posted.",
      nextMilestone: locale === "zh" ? "完整数据、其他 III 期读出及监管路径。" : "Full data, additional Phase 3 readouts, and regulatory path.",
      successProbability: noProbability,
      launchTiming: locale === "zh" ? "未假设上市时间。" : "No launch timing assumed.",
      peakSalesAssumption: noPeakSales,
      valuationTreatment: excluded,
      classification: "Management statement",
      sourceTitle: "Lilly retatrutide Phase 3 update",
      sourceDate: "2026-03-19",
      sourceUrl: "https://investor.lilly.com/news-releases/news-release-details/lillys-triple-agonist-retatrutide-demonstrated-significant",
    },
    {
      asset: "Eloralintide",
      indication: locale === "zh" ? "肥胖" : "Obesity",
      stage: locale === "zh" ? "III 期" : "Phase 3",
      latestMilestone: locale === "zh" ? "2025 年报披露 III 期试验已启动。" : "The 2025 10-K disclosed that Phase 3 began.",
      nextMilestone: locale === "zh" ? "入组、读出和安全性。" : "Enrollment, readout, and safety.",
      successProbability: noProbability,
      launchTiming: locale === "zh" ? "未假设上市时间。" : "No launch timing assumed.",
      peakSalesAssumption: noPeakSales,
      valuationTreatment: excluded,
      classification: "Reported fact",
      sourceTitle: "Eli Lilly and Company 2025 Form 10-K",
      sourceDate: "2026-02-12",
      sourceUrl: LLY_10K_URL,
    },
    {
      asset: "Tirzepatide lifecycle",
      indication: locale === "zh" ? "心血管结局、MASH、肥胖发病/死亡及 1 型糖尿病" : "CV outcomes, MASH, obesity morbidity / mortality, and type 1 diabetes",
      stage: locale === "zh" ? "申报及 III 期" : "Submitted and Phase 3",
      latestMilestone: locale === "zh" ? "年报列示多项适应症扩展项目。" : "The 10-K lists multiple indication-expansion programs.",
      nextMilestone: locale === "zh" ? "监管决定和关键 III 期读出。" : "Regulatory decisions and pivotal Phase 3 readouts.",
      successProbability: noProbability,
      launchTiming: locale === "zh" ? "不预测新增适应症时间。" : "No indication-expansion timing forecast.",
      peakSalesAssumption: noPeakSales,
      valuationTreatment: locale === "zh" ? "现有商业收入已进入估值；未批准扩展不单独计值。" : "Existing commercial revenue is valued; unapproved extensions receive no separate value.",
      classification: "Reported fact",
      sourceTitle: "Eli Lilly and Company 2025 Form 10-K",
      sourceDate: "2026-02-12",
      sourceUrl: LLY_10K_URL,
    },
    {
      asset: "Remternetug",
      indication: locale === "zh" ? "临床前/轻度认知障碍阿尔茨海默病" : "Preclinical / MCI Alzheimer's disease",
      stage: locale === "zh" ? "III 期已完成，尚无注册库结果" : "Phase 3 completed; no registry results posted",
      latestMilestone: locale === "zh" ? "ClinicalTrials.gov 记录主要试验于 2026-05-12 完成。" : "ClinicalTrials.gov records primary study completion on 2026-05-12.",
      nextMilestone: locale === "zh" ? "结果披露、监管路径及与 Kisunla 的组合定位。" : "Results disclosure, regulatory path, and positioning with Kisunla.",
      successProbability: noProbability,
      launchTiming: locale === "zh" ? "未假设上市时间。" : "No launch timing assumed.",
      peakSalesAssumption: noPeakSales,
      valuationTreatment: excluded,
      classification: "Reported fact",
      sourceTitle: "ClinicalTrials.gov NCT05463731",
      sourceDate: "2026-05-22",
      sourceUrl: "https://clinicaltrials.gov/study/NCT05463731",
    },
    {
      asset: "Imlunestrant / Inluriyo lifecycle",
      indication: locale === "zh" ? "晚期及辅助乳腺癌" : "Advanced and adjuvant breast cancer",
      stage: locale === "zh" ? "晚期适应症已批准；辅助治疗 III 期" : "Advanced disease approved; adjuvant Phase 3",
      latestMilestone: locale === "zh" ? "FDA 2025 年批准晚期适应症；EMBER-4 仍在进行。" : "FDA approved the advanced-disease indication in 2025; EMBER-4 remains ongoing.",
      nextMilestone: locale === "zh" ? "EMBER-4 主要完成与读出。" : "EMBER-4 primary completion and readout.",
      successProbability: noProbability,
      launchTiming: locale === "zh" ? "现有适应症已上市；不预测辅助适应症时间。" : "Existing indication launched; no adjuvant timing forecast.",
      peakSalesAssumption: noPeakSales,
      valuationTreatment: excluded,
      classification: "Reported fact",
      sourceTitle: "FDA Drug Trials Snapshot: Inluriyo",
      sourceDate: "2025-09-25",
      sourceUrl: "https://www.fda.gov/drugs/drug-approvals-and-databases/drug-trials-snapshots-inluriyo",
    },
  ];
}

function registerMarketPrice(
  registry: MetricRegistry,
  companyId: string,
  retrievedAt: string,
) {
  const marketPrice = createCanonicalMetric({
    metric_id: "share-price",
    company_id: companyId,
    sector: "biopharma",
    period: "Market 2026-07-14",
    period_start: null,
    period_end: "2026-07-14",
    value: 1152.54,
    unit: "USD/share",
    currency: "USD",
    status: "Reported",
    definition_id: "lseg-closing-share-price",
    formula_id: null,
    formula: null,
    input_metric_keys: [],
    source_document: "Lilly Historic Price Lookup — LSEG",
    source_url: LLY_MARKET_URL,
    source_type: "market-data",
    source_date: "2026-07-14",
    filing_date: null,
    section: "Week of July 13, 2026",
    table: "Historical stock price information",
    row_label: "July 14, 2026 closing price",
    raw_value: "$1,152.54",
    extraction_method: "deterministic-market-table",
    confidence: 0.98,
    retrieved_at: retrievedAt,
    data_version: registry.dataVersion,
    calculation_version: registry.calculationVersion,
  });
  return registry.registerOrVerify(marketPrice);
}

export function buildLlyMarketValuation(
  registry: MetricRegistry,
  companyId: string,
  retrievedAt: string,
): MarketValuationSnapshot | null {
  if (companyId !== "LLY") return null;
  const price = registerMarketPrice(registry, companyId, retrievedAt);
  const reportedShares = exactMetric(
    registry,
    companyId,
    "shares-outstanding",
    "2026-04-27",
    "issuer-reported-common-shares-outstanding-april-2026",
  );
  const q1Debt = exactMetric(
    registry,
    companyId,
    "total-debt",
    "2026-03-31",
    "issuer-reported-total-debt-q1-2026",
  );
  const q1Cash = exactMetric(
    registry,
    companyId,
    "cash",
    "2026-03-31",
    "issuer-reported-cash-and-equivalents-q1-2026",
  );
  const revenue = exactMetric(
    registry,
    companyId,
    "revenue",
    "2025-12-31",
    FINANCIAL_DEFINITION_IDS.revenue,
  );
  const dilutedEps = exactMetric(
    registry,
    companyId,
    "diluted-eps",
    "2025-12-31",
    "issuer-reported-diluted-eps",
  );
  if (!reportedShares || !q1Debt || !q1Cash || !revenue || !dilutedEps) return null;
  const currentPeriod = "Market 2026-07-14";
  const currentEnd = "2026-07-14";
  const shareCount = registry.registerAssumption({
    metric_id: "market-share-count",
    company_id: companyId,
    sector: "biopharma",
    period: currentPeriod,
    period_end: currentEnd,
    definition_id: "april-2026-shares-held-constant-to-market-date",
    value: reportedShares.value!,
    formula: "April 27, 2026 reported shares held constant solely for the July 14 market-cap bridge",
    input_metric_keys: [reportedShares.canonical_key],
    unit: "shares",
    currency: null,
  });
  const q1NetDebt = registry.calculateDerived({
    metric_id: "market-net-debt-input",
    company_id: companyId,
    sector: "biopharma",
    period: "Q1 2026",
    period_end: "2026-03-31",
    definition_id: "q1-2026-total-debt-less-cash",
    formula_id: "subtract",
    formula: "q1_total_debt - q1_cash_and_equivalents",
    input_metric_keys: [q1Debt.canonical_key, q1Cash.canonical_key],
    unit: "USD",
    currency: "USD",
  });
  const netDebt = registry.registerAssumption({
    metric_id: "market-net-debt-adjustment",
    company_id: companyId,
    sector: "biopharma",
    period: currentPeriod,
    period_end: currentEnd,
    definition_id: "q1-2026-net-debt-held-constant-to-market-date",
    value: q1NetDebt.value!,
    formula: "March 31, 2026 net debt held constant solely for the July 14 valuation bridge",
    input_metric_keys: [q1NetDebt.canonical_key],
    unit: "USD",
    currency: "USD",
  });
  const marketCap = registry.calculateDerived({
    metric_id: "market-capitalization",
    company_id: companyId,
    sector: "biopharma",
    period: currentPeriod,
    period_end: currentEnd,
    definition_id: "share-price-times-carried-share-count",
    formula_id: "multiply",
    formula: "closing_share_price * carried_forward_reported_shares",
    input_metric_keys: [price.canonical_key, shareCount.canonical_key],
    unit: "USD",
    currency: "USD",
  });
  const enterpriseValue = registry.calculateDerived({
    metric_id: "enterprise-value",
    company_id: companyId,
    sector: "biopharma",
    period: currentPeriod,
    period_end: currentEnd,
    definition_id: "market-capitalization-plus-carried-net-debt",
    formula_id: "add",
    formula: "market_capitalization + carried_forward_net_debt",
    input_metric_keys: [marketCap.canonical_key, netDebt.canonical_key],
    unit: "USD",
    currency: "USD",
  });
  const carriedRevenue = registry.registerAssumption({
    metric_id: "market-revenue-input",
    company_id: companyId,
    sector: "biopharma",
    period: currentPeriod,
    period_end: currentEnd,
    definition_id: "fy2025-revenue-held-constant-to-market-date",
    value: revenue.value!,
    formula: "FY2025 reported revenue held constant solely for the July 14 EV/revenue cross-check",
    input_metric_keys: [revenue.canonical_key],
    unit: revenue.unit,
    currency: revenue.currency,
  });
  const carriedDilutedEps = registry.registerAssumption({
    metric_id: "market-diluted-eps-input",
    company_id: companyId,
    sector: "biopharma",
    period: currentPeriod,
    period_end: currentEnd,
    definition_id: "fy2025-diluted-eps-held-constant-to-market-date",
    value: dilutedEps.value!,
    formula: "FY2025 diluted EPS held constant solely for the July 14 P/E cross-check",
    input_metric_keys: [dilutedEps.canonical_key],
    unit: dilutedEps.unit,
    currency: dilutedEps.currency,
  });
  const evRevenue = registry.calculateDerived({
    metric_id: "current-ev-revenue",
    company_id: companyId,
    sector: "biopharma",
    period: currentPeriod,
    period_end: currentEnd,
    definition_id: "enterprise-value-over-fy2025-revenue",
    formula_id: "divide",
    formula: "current_enterprise_value / fy2025_revenue",
    input_metric_keys: [enterpriseValue.canonical_key, carriedRevenue.canonical_key],
    unit: "x",
    currency: null,
  });
  const pe = registry.calculateDerived({
    metric_id: "current-price-earnings",
    company_id: companyId,
    sector: "biopharma",
    period: currentPeriod,
    period_end: currentEnd,
    definition_id: "closing-price-over-fy2025-diluted-eps",
    formula_id: "divide",
    formula: "closing_share_price / fy2025_diluted_eps",
    input_metric_keys: [price.canonical_key, carriedDilutedEps.canonical_key],
    unit: "x",
    currency: null,
  });
  return {
    asOfDate: "2026-07-14",
    sharePrice: price.value!,
    marketCapitalization: marketCap.value!,
    enterpriseValue: enterpriseValue.value!,
    netDebtAdjustment: netDebt.value!,
    dilutedShares: shareCount.value!,
    currentEvRevenue: evRevenue.value!,
    currentPe: pe.value!,
    currentEvEbitda: null,
    formulas: [
      "Market capitalization proxy = 2026-07-14 closing price × 2026-04-27 reported shares outstanding",
      "Enterprise value = market capitalization proxy + Q1 2026 total debt − Q1 2026 cash",
      "Current EV / revenue = enterprise value ÷ FY2025 revenue",
      "Current P/E = 2026-07-14 closing price ÷ FY2025 diluted EPS",
    ],
    sourceTitle: "Lilly Historic Price Lookup — LSEG",
    sourceUrl: LLY_MARKET_URL,
    metricReferences: {
      sharePrice: price.canonical_key,
      shares: shareCount.canonical_key,
      netDebt: netDebt.canonical_key,
      marketCapitalization: marketCap.canonical_key,
      enterpriseValue: enterpriseValue.canonical_key,
      currentEvRevenue: evRevenue.canonical_key,
      currentPe: pe.canonical_key,
    },
  };
}

export const LLY_SOURCES = {
  annualFiling: LLY_10K_URL,
  quarterlyFiling: LLY_Q1_URL,
  quarterlyRelease: LLY_Q1_RELEASE_URL,
  marketData: LLY_MARKET_URL,
};
