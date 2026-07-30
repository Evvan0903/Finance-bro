import type { ResearchReport } from "../research-types";
import type { MarketEvidence } from "../market-analysis/types";
import type { VisualAssetColumn, VisualAssetInput, VisualAssetValue } from "./types";
import { visualAssetDescriptor, visualAssetStore } from "./store";

type Row = Record<string, VisualAssetValue>;

function xml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 70);
}

function lineSvg(
  title: string,
  columns: VisualAssetColumn[],
  rows: Row[],
) {
  const width = 960;
  const height = 540;
  const pad = { left: 84, right: 40, top: 72, bottom: 82 };
  const numeric = columns
    .filter((column) => column.type === "number")
    .filter((column) => rows.some((row) => typeof row[column.key] === "number"))
    .slice(0, 3);
  const xColumn = columns.find((column) => column.type === "string") ?? columns[0];
  const values = numeric.flatMap((column) =>
    rows
      .map((row) => row[column.key])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
  );
  if (!values.length) return undefined;
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = Math.max(1, max - min);
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const x = (index: number) =>
    pad.left + (rows.length === 1 ? plotWidth / 2 : index * plotWidth / (rows.length - 1));
  const y = (value: number) => pad.top + (max - value) / range * plotHeight;
  const colors = ["#0055FF", "#12A594", "#A46BFF"];
  const grid = [0, 0.25, 0.5, 0.75, 1].map((step) => {
    const value = min + range * step;
    const position = y(value);
    return `<line x1="${pad.left}" y1="${position}" x2="${width - pad.right}" y2="${position}" stroke="#DDE4EC"/><text x="${pad.left - 12}" y="${position + 5}" text-anchor="end" font-size="13" fill="#617080">${xml(value.toFixed(1))}</text>`;
  }).join("");
  const series = numeric.map((column, seriesIndex) => {
    const points = rows.map((row, index) => {
      const value = row[column.key];
      return typeof value === "number" ? `${x(index)},${y(value)}` : null;
    }).filter(Boolean).join(" ");
    return `<polyline points="${points}" fill="none" stroke="${colors[seriesIndex]}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join("");
  const labels = rows.map((row, index) =>
    `<text x="${x(index)}" y="${height - 42}" text-anchor="middle" font-size="13" fill="#617080">${xml(row[xColumn.key])}</text>`,
  ).join("");
  const legend = numeric.map((column, index) =>
    `<circle cx="${pad.left + index * 220}" cy="48" r="6" fill="${colors[index]}"/><text x="${pad.left + 12 + index * 220}" y="53" font-size="14" fill="#1A1A1A">${xml(column.label)}</text>`,
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#FFFFFF"/><title>${xml(title)}</title><text x="${pad.left}" y="28" font-size="20" font-family="Arial, sans-serif" font-weight="700" fill="#1A1A1A">${xml(title)}</text><g font-family="Arial, sans-serif">${legend}${grid}${series}${labels}</g></svg>`;
}

function tableSvg(title: string, columns: VisualAssetColumn[], rows: Row[]) {
  const visibleColumns = columns.slice(0, 7);
  const visibleRows = rows.slice(0, 18);
  const width = 1200;
  const rowHeight = 42;
  const height = 94 + rowHeight * (visibleRows.length + 1);
  const colWidth = (width - 80) / visibleColumns.length;
  const header = visibleColumns.map((column, index) =>
    `<text x="${46 + index * colWidth}" y="96" font-size="14" font-weight="700" fill="#1A1A1A">${xml(column.label).slice(0, 28)}</text>`,
  ).join("");
  const body = visibleRows.map((row, rowIndex) => {
    const y = 96 + rowHeight * (rowIndex + 1);
    const cells = visibleColumns.map((column, columnIndex) =>
      `<text x="${46 + columnIndex * colWidth}" y="${y}" font-size="13" fill="#374553">${xml(row[column.key]).slice(0, 30)}</text>`,
    ).join("");
    return `<rect x="40" y="${y - 27}" width="${width - 80}" height="${rowHeight}" fill="${rowIndex % 2 ? "#F7F7F7" : "#FFFFFF"}"/>${cells}`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#FFFFFF"/><title>${xml(title)}</title><text x="40" y="42" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="#1A1A1A">${xml(title)}</text><rect x="40" y="66" width="${width - 80}" height="44" fill="#EAF1FF"/><g font-family="Arial, sans-serif">${header}${body}</g></svg>`;
}

function createAsset(
  report: ResearchReport,
  config: Omit<VisualAssetInput, "reportId" | "filenameStem"> & { assetSlug: string },
) {
  const stored = visualAssetStore.create({
    ...config,
    reportId: report.reportId,
    filenameStem: `${report.company.ticker}-${report.researchDate}-${config.sectionId}-${config.assetSlug}`,
  }, {
    assetId: `${report.reportId}--${slug(config.assetSlug)}`,
  });
  return visualAssetDescriptor(stored);
}

function column(key: string, label: string, type: VisualAssetColumn["type"]): VisualAssetColumn {
  return { key, label, type };
}

export function buildResearchVisualAssets(report: ResearchReport) {
  const assets = [];
  const locale = report.locale;
  const isZh = locale === "zh";
  const financialColumns = [
    column("period", isZh ? "期间" : "Period", "string"),
    column("revenue", isZh ? "营收" : "Revenue", "number"),
    column("netIncome", isZh ? "净利润" : "Net income", "number"),
    column("operatingCashFlow", isZh ? "经营现金流" : "Operating cash flow", "number"),
    column("freeCashFlow", isZh ? "自由现金流" : "Free cash flow", "number"),
  ];
  const financialRows = report.periods.map((period) => ({
    period: period.periodEnd,
    revenue: period.revenue,
    netIncome: period.netIncome,
    operatingCashFlow: period.operatingCashFlow,
    freeCashFlow: period.freeCashFlowProxy,
  }));
  if (financialRows.length) {
    assets.push(createAsset(report, {
      assetSlug: "historical-financial-trend",
      title: isZh ? "历史财务趋势" : "Historical financial trend",
      subtitle: isZh ? "来自规范化年度申报事实" : "Normalized annual filing facts",
      assetType: "chart",
      category: "financial",
      sectionId: "historical-financials",
      sectionTitle: isZh ? "历史财务表现" : "Historical financial performance",
      dataset: { id: "historical-financial-trend", title: "Historical financial trend", columns: financialColumns, rows: financialRows },
      metadata: { chartType: "line", unit: report.currency, isReported: true, period: `${financialRows[0].period}–${financialRows.at(-1)!.period}` },
      svg: lineSvg(isZh ? "历史财务趋势" : "Historical financial trend", financialColumns, financialRows),
      formats: ["png", "svg", "csv", "xlsx"],
    }));
    assets.push(createAsset(report, {
      assetSlug: "historical-financial-table",
      title: isZh ? "历史财务数据表" : "Historical financial table",
      assetType: "table",
      category: "financial",
      sectionId: "historical-financials",
      sectionTitle: isZh ? "历史财务表现" : "Historical financial performance",
      dataset: { id: "historical-financial-table", title: "Historical financial table", columns: financialColumns, rows: financialRows },
      metadata: { unit: report.currency, isReported: true },
      svg: tableSvg(isZh ? "历史财务数据表" : "Historical financial table", financialColumns, financialRows),
      formats: ["png", "csv", "xlsx"],
    }));
  }
  const kpiColumns = [
    column("metric", isZh ? "指标" : "Metric", "string"),
    column("value", isZh ? "数值" : "Value", "string"),
    column("period", isZh ? "期间" : "Period", "string"),
    column("status", isZh ? "状态" : "Status", "string"),
    column("source", isZh ? "来源" : "Source", "string"),
  ];
  const kpiRows = report.sectorKpis.filter((item) => item.usable).map((item) => ({
    metric: item.label,
    value: item.value,
    period: item.period,
    status: item.status,
    source: item.sourceNote,
  }));
  if (kpiRows.length) assets.push(createAsset(report, {
    assetSlug: "sector-kpi-data-sheet",
    title: isZh ? "行业 KPI 数据表" : "Sector KPI data sheet",
    assetType: "dataSheet",
    category: "company",
    sectionId: "sector-kpis",
    sectionTitle: isZh ? "行业关键指标" : "Sector KPIs",
    dataset: { id: "sector-kpi-data-sheet", title: "Sector KPI data sheet", columns: kpiColumns, rows: kpiRows },
    metadata: { isReported: true },
    svg: tableSvg(isZh ? "行业 KPI 数据表" : "Sector KPI data sheet", kpiColumns, kpiRows),
    formats: ["csv", "xlsx"],
  }));
  const peerColumns = [
    column("ticker", isZh ? "代码" : "Ticker", "string"),
    column("company", isZh ? "公司" : "Company", "string"),
    column("period", isZh ? "期间" : "Period", "string"),
    column("revenueGrowth", isZh ? "营收增长" : "Revenue growth", "number"),
    column("netMargin", isZh ? "净利率" : "Net margin", "number"),
    column("fcfMargin", isZh ? "FCF 利润率" : "FCF margin", "number"),
  ];
  const peerRows = report.peerComparison.map((peer) => ({
    ticker: peer.ticker,
    company: peer.name,
    period: peer.periodEnd,
    revenueGrowth: peer.revenueGrowth,
    netMargin: peer.netMargin,
    fcfMargin: peer.freeCashFlowMargin,
  }));
  if (peerRows.length) assets.push(createAsset(report, {
    assetSlug: "peer-comparison",
    title: isZh ? "同业比较" : "Peer comparison",
    assetType: "table",
    category: "peer",
    sectionId: "peer-comparison",
    sectionTitle: isZh ? "同业比较" : "Peer comparison",
    dataset: { id: "peer-comparison", title: "Peer comparison", columns: peerColumns, rows: peerRows },
    metadata: { isCalculated: true, limitations: isZh ? "财政年度和业务组合可能不同" : "Fiscal years and business mixes may differ" },
    svg: tableSvg(isZh ? "同业比较" : "Peer comparison", peerColumns, peerRows),
    formats: ["png", "csv", "xlsx"],
  }));
  const scenarioColumns = [
    column("scenario", isZh ? "情景" : "Scenario", "string"),
    column("method", isZh ? "方法" : "Method", "string"),
    column("multiple", isZh ? "倍数" : "Multiple", "number"),
    column("equityValue", isZh ? "隐含股权价值" : "Implied equity value", "number"),
    column("pricePerShare", isZh ? "隐含每股价值" : "Implied value per share", "number"),
  ];
  const scenarioRows = report.scenarios.map((scenario) => ({
    scenario: scenario.name,
    method: scenario.valuationMethod,
    multiple: scenario.enterpriseValueMultiple,
    equityValue: scenario.modelImpliedEquityValue,
    pricePerShare: scenario.impliedPricePerShare,
  }));
  if (scenarioRows.length) assets.push(createAsset(report, {
    assetSlug: "valuation-scenarios",
    title: isZh ? "估值情景" : "Valuation scenarios",
    assetType: "table",
    category: "valuation",
    sectionId: "scenarios",
    sectionTitle: isZh ? "情景与估值" : "Scenarios and valuation",
    dataset: { id: "valuation-scenarios", title: "Valuation scenarios", columns: scenarioColumns, rows: scenarioRows },
    metadata: { isCalculated: true, unit: report.currency },
    svg: tableSvg(isZh ? "估值情景" : "Valuation scenarios", scenarioColumns, scenarioRows),
    formats: ["png", "csv", "xlsx"],
  }));
  const riskColumns = [
    column("risk", isZh ? "风险" : "Risk", "string"),
    column("evidence", isZh ? "证据" : "Evidence", "string"),
    column("thesisBreaker", isZh ? "论点破坏条件" : "Thesis breaker", "string"),
  ];
  const riskRows = report.risks.map((risk) => ({
    risk: risk.title,
    evidence: risk.evidence,
    thesisBreaker: risk.thesisBreaker,
  }));
  if (riskRows.length) assets.push(createAsset(report, {
    assetSlug: "risk-matrix",
    title: isZh ? "风险矩阵" : "Risk matrix",
    assetType: "matrix",
    category: "risk",
    sectionId: "risks",
    sectionTitle: isZh ? "风险与论点破坏条件" : "Risks and thesis breakers",
    dataset: { id: "risk-matrix", title: "Risk matrix", columns: riskColumns, rows: riskRows },
    metadata: { isCalculated: false },
    svg: tableSvg(isZh ? "风险矩阵" : "Risk matrix", riskColumns, riskRows),
    formats: ["png", "csv", "xlsx"],
  }));

  const industry = report.industryAnalysis;
  if (industry?.included && industry.profile) {
    const definitionColumns = [
      column("field", isZh ? "字段" : "Field", "string"),
      column("value", isZh ? "内容" : "Value", "string"),
      column("confidence", isZh ? "置信度" : "Confidence", "string"),
    ];
    const definitionRows = [
      { field: isZh ? "主要市场" : "Primary market", value: industry.profile.primaryMarket, confidence: industry.profile.classificationConfidence },
      { field: "SIC", value: `${industry.profile.sicCode ?? "—"} ${industry.profile.sicDescription ?? ""}`.trim(), confidence: industry.profile.classificationConfidence },
      { field: "NAICS", value: industry.profile.naicsCodes.join(", "), confidence: industry.profile.classificationConfidence },
      { field: "BEA", value: industry.profile.beaIndustryCodes.join(", "), confidence: industry.profile.classificationConfidence },
      { field: isZh ? "次要市场" : "Secondary markets", value: industry.profile.secondaryMarkets.join(", "), confidence: industry.profile.classificationConfidence },
    ].filter((row) => row.value);
    assets.push(createAsset(report, {
      assetSlug: "market-definition",
      title: isZh ? "市场定义与分类" : "Market definition and classification",
      assetType: "table",
      category: "market",
      sectionId: "market-definition",
      sectionTitle: isZh ? "市场定义" : "Market definition",
      dataset: { id: "market-definition", title: "Market definition", columns: definitionColumns, rows: definitionRows },
      metadata: { isReported: true, limitations: industry.profile.classificationLimitations.join(" ") },
      svg: tableSvg(isZh ? "市场定义与分类" : "Market definition and classification", definitionColumns, definitionRows),
      formats: ["png", "csv", "xlsx"],
    }));

    const evidenceGroups = new Map<string, MarketEvidence[]>();
    for (const evidence of industry.marketReport?.evidence ?? []) {
      if (typeof evidence.value !== "number") continue;
      const key = `${evidence.providerId}:${evidence.seriesOrTableId}:${evidence.unit}`;
      evidenceGroups.set(key, [...(evidenceGroups.get(key) ?? []), evidence]);
    }
    for (const [key, evidence] of evidenceGroups) {
      if (evidence.length < 2) continue;
      const ordered = [...evidence].sort((left, right) => left.observationPeriod.localeCompare(right.observationPeriod));
      const columns = [
        column("period", isZh ? "期间" : "Period", "string"),
        column("value", ordered[0].metricLabel, "number"),
      ];
      const rows = ordered.map((item) => ({ period: item.observationPeriod, value: item.value as number }));
      const assetSlug = `industry-trend-${slug(key)}`;
      assets.push(createAsset(report, {
        assetSlug,
        title: ordered[0].sourceTitle,
        subtitle: isZh ? "官方行业指标；不等同于商业市场规模" : "Official industry indicator; not commercial market size",
        assetType: "chart",
        category: "market",
        sectionId: "industry-trends",
        sectionTitle: isZh ? "行业规模与趋势" : "Industry scale and trends",
        dataset: { id: assetSlug, title: ordered[0].sourceTitle, columns, rows },
        metadata: {
          chartType: "line",
          unit: ordered[0].unit,
          geography: ordered[0].geography,
          period: `${ordered[0].observationPeriod}–${ordered.at(-1)!.observationPeriod}`,
          isProxy: ordered[0].isProxy,
          sourceIds: ordered.map((item) => item.evidenceId).join(" · "),
          limitations: ordered[0].notes.join(" "),
        },
        svg: lineSvg(ordered[0].sourceTitle, columns, rows),
        formats: ["png", "svg", "csv", "xlsx"],
      }));
    }
    for (const comparison of industry.comparisons.filter((item) => item.chartEligible)) {
      const columns = [
        column("metric", isZh ? "指标" : "Metric", "string"),
        column("growth", isZh ? "增长率" : "Growth", "number"),
      ];
      const rows = [
        { metric: isZh ? "公司" : "Company", growth: comparison.companyValue },
        { metric: isZh ? "行业代理" : "Industry proxy", growth: comparison.industryValue },
      ];
      const assetSlug = `company-industry-${slug(comparison.companyMetricId)}`;
      assets.push(createAsset(report, {
        assetSlug,
        title: isZh ? "公司与行业代理增长比较" : "Company versus industry proxy growth",
        subtitle: isZh ? "方向性代理比较，不表示因果关系" : "Directional proxy comparison; no causal inference",
        assetType: "chart",
        category: "market",
        sectionId: "company-industry-positioning",
        sectionTitle: isZh ? "公司与行业定位" : "Company versus industry positioning",
        dataset: { id: assetSlug, title: "Company versus industry proxy growth", columns, rows },
        metadata: {
          chartType: "bar",
          unit: "%",
          isCalculated: true,
          isProxy: true,
          sourceIds: comparison.industryEvidenceIds.join(" · "),
          limitations: comparison.interpretationLimitations.join(" "),
        },
        svg: lineSvg(isZh ? "公司与行业代理增长比较" : "Company versus industry proxy growth", columns, rows),
        formats: ["png", "svg", "csv", "xlsx"],
      }));
    }
  }
  return assets;
}
