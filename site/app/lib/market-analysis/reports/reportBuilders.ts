import type {
  ComparisonScore,
  DataCoverage,
  IndustryMetric,
  MarketDataRequest,
  MarketEvidence,
  MarketLocale,
  MarketReportSection,
} from "../types";

const SECTION_TITLES = {
  analyze: {
    en: [
      "Executive Summary",
      "Market Definition and Official Classification",
      "Industry Economic Footprint",
      "Establishments and Employment",
      "Payroll and Labor Costs",
      "Geographic Concentration",
      "Demand Indicators",
      "Supply and Investment Indicators",
      "Macroeconomic Environment",
      "Public Company Evidence",
      "Policy Environment",
      "Risks and Limitations",
      "Scenario Outlook",
      "Methodology",
      "Data Coverage",
      "References",
    ],
    zh: [
      "执行摘要",
      "市场定义与官方分类",
      "行业经济规模",
      "经营场所与就业",
      "薪酬与劳动力成本",
      "区域集中度",
      "需求指标",
      "供给与投资指标",
      "宏观经济环境",
      "上市公司证据",
      "政策环境",
      "风险与限制",
      "情景展望",
      "方法",
      "数据覆盖",
      "参考资料",
    ],
  },
  trend: {
    en: [
      "Executive Summary",
      "Trend Definition",
      "Data and Classification Scope",
      "Historical Development",
      "Growth Calculations",
      "Structural Drivers",
      "Cyclical Drivers",
      "Leading Indicators",
      "Current Inflection Points",
      "Base Scenario",
      "Upside Scenario",
      "Downside Scenario",
      "Risks and Limitations",
      "Methodology",
      "Data Coverage",
      "References",
    ],
    zh: [
      "执行摘要",
      "趋势定义",
      "数据与分类范围",
      "历史发展",
      "增长计算",
      "结构性驱动因素",
      "周期性驱动因素",
      "领先指标",
      "当前拐点",
      "基准情景",
      "上行情景",
      "下行情景",
      "风险与限制",
      "方法",
      "数据覆盖",
      "参考资料",
    ],
  },
  compare: {
    en: [
      "Executive Summary",
      "Comparison Scope",
      "Classification and Definition Alignment",
      "Subject A",
      "Subject B",
      "Economic Footprint Comparison",
      "Establishment and Employment Comparison",
      "Payroll and Labor-Cost Comparison",
      "Regional Concentration Comparison",
      "Macroeconomic Comparison",
      "Public Company Evidence",
      "Policy Context",
      "Comparison Scorecard",
      "Relative Outlook",
      "Risks and Limitations",
      "Methodology",
      "Data Coverage",
      "References",
    ],
    zh: [
      "执行摘要",
      "比较范围",
      "分类与定义一致性",
      "对象 A",
      "对象 B",
      "经济规模比较",
      "经营场所与就业比较",
      "薪酬与劳动力成本比较",
      "区域集中度比较",
      "宏观经济比较",
      "上市公司证据",
      "政策背景",
      "比较评分卡",
      "相对展望",
      "风险与限制",
      "方法",
      "数据覆盖",
      "参考资料",
    ],
  },
} as const;

function metricSummary(metrics: IndustryMetric[], locale: MarketLocale) {
  const numerical = metrics.filter((metric) => typeof metric.value === "number");
  if (!numerical.length) {
    return locale === "zh"
      ? "所选公共数据范围内没有足够的可比数值指标"
      : "No sufficiently comparable numerical indicators were available for the selected public-data scope";
  }
  const latest = [...numerical].sort((left, right) => right.period.localeCompare(left.period)).slice(0, 3);
  return latest.map((metric) =>
    `${metric.displayLabel}: ${Number(metric.value).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 2 })} ${metric.unit} (${metric.period})`,
  ).join("; ");
}

function sectionParagraphs(
  index: number,
  request: MarketDataRequest,
  metrics: IndustryMetric[],
  coverage: DataCoverage,
) {
  const { locale, mode } = request.scope;
  const zh = locale === "zh";
  const proxyCount = metrics.filter((metric) => metric.isProxy).length;
  if (index === 0) {
    return [
      zh
        ? `本分析基于用户确认的官方分类和公共数据，覆盖状态为“${coverage.status}”`
        : `This analysis uses user-confirmed official classifications and public data; coverage is ${coverage.status}`,
      metricSummary(metrics, locale),
    ];
  }
  if (index === 1) {
    return [
      zh
        ? `市场定义为“${request.marketDefinition.marketName}”，包含 ${request.marketDefinition.officialClassificationMappings.length} 项用户确认映射`
        : `The market is defined as “${request.marketDefinition.marketName}” using ${request.marketDefinition.officialClassificationMappings.length} user-confirmed mappings`,
      ...request.marketDefinition.definitionLimitations,
    ];
  }
  const titles = SECTION_TITLES[mode][locale];
  const title = titles[index];
  if (/Scenario|情景/.test(title)) {
    return [
      zh
        ? "以下为条件情景而非预测：基准情景延续已观察趋势；上行情景需要需求或供给指标改善；下行情景反映宏观或执行风险"
        : "These are conditional scenarios, not forecasts: the base scenario extends observed conditions, the upside requires stronger demand or supply indicators, and the downside reflects macro or execution risks",
    ];
  }
  if (/Methodology|方法/.test(title)) {
    return [
      zh
        ? "所有数值均来自官方报告数据或可复算的确定性公式；不兼容的单位、期间、地理范围和分类不会直接比较"
        : "Every value is either reported by an official provider or produced by a reproducible deterministic formula; incompatible units, periods, geographies, and classifications are not directly compared",
    ];
  }
  if (/Risks|风险/.test(title)) {
    return [
      zh
        ? `公共分类可能无法完全对应商业市场；本报告包含 ${proxyCount} 项明确标记的代理指标`
        : `Official classifications may not match the commercial market exactly; this report includes ${proxyCount} visibly labeled proxy metrics`,
    ];
  }
  if (/Coverage|覆盖/.test(title)) {
    return [
      zh
        ? `已使用 ${coverage.providersUsed.length} 个提供商，${coverage.providersUnavailable.length} 个相关提供商不可用`
        : `${coverage.providersUsed.length} providers were used and ${coverage.providersUnavailable.length} relevant providers were unavailable`,
    ];
  }
  if (/References|参考/.test(title)) return [];
  return [
    zh
      ? `${title}仅使用与本节定义相符的证据；没有可用证据时不作数值结论`
      : `${title} uses only evidence compatible with this section’s definition; no numerical conclusion is made where evidence is unavailable`,
  ];
}

export function buildReportSections(
  request: MarketDataRequest,
  metrics: IndustryMetric[],
  coverage: DataCoverage,
): MarketReportSection[] {
  const titles = SECTION_TITLES[request.scope.mode][request.scope.locale];
  return titles.map((title, index) => {
    const sectionMetrics = metrics.filter((metric) => {
      if (/Economic|经济/.test(title)) return metric.category === "economic output" || metric.category === "value added";
      if (/Establishment|经营场所/.test(title)) return ["establishments", "employment"].includes(metric.category);
      if (/Payroll|薪酬/.test(title)) return ["payroll", "wages"].includes(metric.category);
      if (/Macro|宏观/.test(title)) return metric.category === "macroeconomic";
      if (/Company|上市公司/.test(title)) return metric.category === "company evidence";
      if (/Policy|政策/.test(title)) return metric.category === "policy context";
      if (/Growth|增长/.test(title)) return /CAGR|change/i.test(metric.canonicalLabel);
      return index === 0 ? metrics.slice(0, 6).includes(metric) : false;
    });
    return {
      number: String(index + 1).padStart(2, "0"),
      title,
      paragraphs: sectionParagraphs(index, request, metrics, coverage),
      metricIds: sectionMetrics.map((metric) => metric.metricId),
      evidenceIds: [...new Set(sectionMetrics.flatMap((metric) => metric.evidenceIds))],
    };
  });
}

export function buildComparisonScorecard(
  request: MarketDataRequest,
  evidence: MarketEvidence[],
): ComparisonScore[] {
  if (request.scope.mode !== "compare") return [];
  const criterionLabels: Record<string, RegExp> = {
    establishments: /Establishment count/i,
    employment: /^Employment$/i,
    payroll: /Annual payroll/i,
    payrollPerEmployee: /payroll per employee/i,
    regionalConcentration: /regional .* share/i,
    valueAdded: /value added/i,
    industryOutput: /gross output/i,
    growth: /CAGR|growth/i,
    macroEnvironment: /rate|price|production|capacity/i,
    laborCost: /payroll|wage|labor/i,
  };
  return request.scope.comparisonCriteria.map((criterion) => {
    const pattern = criterionLabels[criterion];
    const related = pattern
      ? evidence.filter((item) => pattern.test(item.metricLabel))
      : [];
    const a = [...related]
      .filter((item) => item.geography.includes(request.scope.geography))
      .sort((left, right) => right.observationPeriod.localeCompare(left.observationPeriod))[0];
    const b = [...related]
      .filter((item) => item.geography.includes(request.scope.geographyB ?? ""))
      .sort((left, right) => right.observationPeriod.localeCompare(left.observationPeriod))[0];
    if (!a || !b) {
      return {
        dimension: criterion,
        assessment: "Insufficient Evidence",
        evidenceIds: related.slice(0, 3).map((item) => item.evidenceId),
        explanation: "No two compatible observations support this comparison dimension.",
      };
    }
    if (
      typeof a.value !== "number" ||
      typeof b.value !== "number" ||
      a.unit !== b.unit ||
      a.observationPeriod !== b.observationPeriod ||
      a.industryCode !== b.industryCode
    ) {
      return {
        dimension: criterion,
        assessment: "Not Comparable",
        evidenceIds: [a.evidenceId, b.evidenceId],
        explanation: "The available observations differ in unit, period, or industry definition.",
      };
    }
    const difference = a.value - b.value;
    return {
      dimension: criterion,
      assessment: difference > 0 ? "Higher" : difference < 0 ? "Lower" : "Moderate",
      evidenceIds: [a.evidenceId, b.evidenceId],
      explanation: `Subject A is ${difference > 0 ? "higher than" : difference < 0 ? "lower than" : "equal to"} Subject B on the latest compatible official observation.`,
    };
  });
}

export { SECTION_TITLES };
