import type {
  ClassificationCandidate,
  MarketDefinition,
  MarketScopeInput,
  OfficialClassificationMapping,
} from "../types";

const ZH_LIMITATIONS: Record<string, string> = {
  "Government classification systems do not provide one exact category for the full commercial data-center market.": "政府分类体系没有一个能够完整对应商业数据中心市场的单一类别",
  "NAICS 518210 covers computing infrastructure and hosting activities but excludes parts of construction, equipment, power, and real-estate value chains.": "NAICS 518210 覆盖计算基础设施和托管活动，但不包含部分建设、设备、电力和房地产价值链",
  "BEA and macroeconomic series are adjacent-industry or infrastructure proxies unless explicitly identified as direct indicators.": "除非明确标记为直接指标，BEA 和宏观序列均属于相邻行业或基础设施代理指标",
  "This is a user-confirmed universal mapping, not a verified specialized semiconductor market pack.": "这是用户确认的通用映射，不是已验证的半导体专用市场包",
  "Manufacturing classifications exclude parts of the design, equipment, materials, and downstream value chain.": "制造业分类不包含部分设计、设备、材料和下游价值链",
  "No validated specialized mapping exists for this market.": "当前市场没有已验证的专用映射",
  "Analysis can continue only after the user supplies or confirms an official classification or a visibly labeled proxy.": "只有在用户提供或确认官方分类或明确标记的代理指标后，分析才能继续",
};

export function validateMarketScope(scope: MarketScopeInput) {
  const errors: string[] = [];
  if (!scope.market.trim()) errors.push("Market or industry is required");
  if (!scope.geography.trim()) errors.push("Geography is required");
  if (!Number.isInteger(scope.startYear) || !Number.isInteger(scope.endYear)) {
    errors.push("Historical period must use whole years");
  } else if (scope.startYear >= scope.endYear) {
    errors.push("Historical period must contain at least one positive year interval");
  }
  if (scope.endYear > new Date().getUTCFullYear()) errors.push("End year cannot be in the future");
  if (scope.mode === "compare") {
    if (!scope.subjectB?.trim()) errors.push("Compare mode requires Subject B");
    const sameSubject =
      scope.market.trim().toLowerCase() === scope.subjectB?.trim().toLowerCase();
    const sameGeography =
      scope.geography.trim().toLowerCase() === scope.geographyB?.trim().toLowerCase();
    if (sameSubject && sameGeography) errors.push("Comparison subjects and geographies are identical");
  }
  if (scope.tickers.length > 10) errors.push("No more than 10 public-company tickers may be requested");
  return errors;
}

export function buildMarketDefinition(
  scope: MarketScopeInput,
  candidates: ClassificationCandidate[],
  limitations: string[],
): MarketDefinition {
  const localizedLimitations = scope.locale === "zh"
    ? limitations.map((item) => ZH_LIMITATIONS[item] ?? item)
    : limitations;
  const selected = candidates.filter(
    (candidate): candidate is OfficialClassificationMapping =>
      candidate.selected && candidate.code !== "USER-REVIEW",
  ).map((candidate) => ({ ...candidate, userConfirmed: true as const }));
  if (!selected.length) throw new Error("At least one official classification or proxy must be confirmed");
  return {
    marketName: scope.mode === "compare" && scope.subjectB
      ? `${scope.market} compared with ${scope.subjectB}`
      : scope.market,
    commercialDefinition: `User-defined research scope for ${scope.market}`,
    officialClassificationMappings: selected,
    includedActivities: selected.map((item) => item.includedScope),
    excludedActivities: selected.map((item) => item.knownExclusions),
    adjacentActivities: selected.filter((item) => item.isProxy).map((item) => item.officialLabel),
    geography: scope.mode === "compare" && scope.geographyB
      ? `${scope.geography} and ${scope.geographyB}`
      : scope.geography,
    customerGroups: [],
    revenueBoundary: "Public official measures are reported using their source definitions; company revenue is not treated as total industry revenue.",
    valueChainBoundary: "Only activities represented by user-confirmed official mappings are included.",
    selectedProxies: selected.filter((item) => item.isProxy).map((item) => item.code),
    definitionLimitations: localizedLimitations,
    userConfirmed: true,
  };
}
