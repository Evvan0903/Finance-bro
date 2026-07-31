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

function barSvg(title: string, columns: VisualAssetColumn[], rows: Row[]) {
  const valueColumn = columns.find((item) => item.type === "number");
  const labelColumn = columns.find((item) => item.type === "string");
  if (!valueColumn || !labelColumn) return undefined;
  const values = rows
    .map((row) => row[valueColumn.key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return undefined;
  const width = 960;
  const height = 540;
  const left = 90;
  const top = 92;
  const plotWidth = 820;
  const plotHeight = 350;
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = Math.max(1, max - min);
  const zeroY = top + max / range * plotHeight;
  const groupWidth = plotWidth / rows.length;
  const colors = ["#0055FF", "#12A594", "#A46BFF"];
  const bars = rows.map((row, index) => {
    const value = row[valueColumn.key];
    if (typeof value !== "number") return "";
    const valueY = top + (max - value) / range * plotHeight;
    const y = Math.min(valueY, zeroY);
    const barHeight = Math.max(2, Math.abs(zeroY - valueY));
    const x = left + index * groupWidth + groupWidth * 0.2;
    const barWidth = groupWidth * 0.6;
    return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="${colors[index % colors.length]}"/><text x="${x + barWidth / 2}" y="${height - 46}" text-anchor="middle" font-size="14" fill="#617080">${xml(row[labelColumn.key])}</text><text x="${x + barWidth / 2}" y="${Math.max(82, y - 10)}" text-anchor="middle" font-size="14" font-weight="700" fill="#1A1A1A">${xml(value.toFixed(1))}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#FFFFFF"/><title>${xml(title)}</title><text x="${left}" y="34" font-size="20" font-family="Arial, sans-serif" font-weight="700" fill="#1A1A1A">${xml(title)}</text><g font-family="Arial, sans-serif"><line x1="${left}" y1="${zeroY}" x2="${left + plotWidth}" y2="${zeroY}" stroke="#AEB9C5" stroke-width="2"/>${bars}</g></svg>`;
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
  const basePeriodColumn = column("period", isZh ? "期间" : "Period", "string");
  const isBank = report.sectorPack.id === "banks";
  const isBiopharma = report.sectorPack.id === "biopharma";
  const isIndustrial = report.sectorPack.id === "industrial-machinery";
  const chartColumns = [
    basePeriodColumn,
    column("revenue", isZh ? (isBank ? "净营收" : "营收") : (isBank ? "Net revenue" : "Revenue"), "number"),
    column(
      isBank ? "netInterestIncome" : "operatingCashFlow",
      isZh ? (isBank ? "净利息收入" : "经营现金流") : (isBank ? "Net interest income" : "Operating cash flow"),
      "number",
    ),
  ];
  const chartRows = report.periods.map((period) => ({
    period: period.periodEnd,
    revenue: period.revenue,
    netInterestIncome: period.netInterestIncome,
    operatingCashFlow: period.operatingCashFlow,
  }));
  const financialColumns = [
    basePeriodColumn,
    ...(isBank
      ? [
          column("revenue", isZh ? "净营收" : "Net revenue", "number"),
          column("netInterestIncome", isZh ? "净利息收入" : "Net interest income", "number"),
          column("deposits", isZh ? "存款" : "Deposits", "number"),
          column("loans", isZh ? "贷款" : "Loans", "number"),
          column("loanGrowth", isZh ? "贷款增长" : "Loan growth", "number"),
          column("creditLossProvision", isZh ? "信用损失拨备" : "Credit-loss provision", "number"),
          column("efficiencyRatio", isZh ? "效率比率" : "Efficiency ratio", "number"),
        ]
      : isBiopharma
        ? [
            column("revenue", isZh ? "营收" : "Revenue", "number"),
            column("grossMargin", isZh ? "毛利率" : "Gross margin", "number"),
            column("researchAndDevelopment", isZh ? "研发费用" : "Research and development", "number"),
            column("netIncome", isZh ? "净利润" : "Net income", "number"),
            ...(report.periods.some((period) => period.operatingCashFlow !== null)
              ? [column("operatingCashFlow", isZh ? "经营现金流" : "Operating cash flow", "number")]
              : []),
            ...(report.periods.some((period) => period.freeCashFlowProxy !== null)
              ? [column("freeCashFlow", isZh ? "自由现金流" : "Free cash flow", "number")]
              : []),
          ]
        : isIndustrial
          ? [
              column("revenue", isZh ? "营收" : "Revenue", "number"),
              column("operatingMargin", isZh ? "营业利润率" : "Operating margin", "number"),
              column("inventory", isZh ? "存货" : "Inventory", "number"),
              column("workingCapital", isZh ? "营运资本" : "Working capital", "number"),
              column("cashCapex", isZh ? "现金资本开支" : "Cash capex", "number"),
              column("freeCashFlow", isZh ? "自由现金流" : "Free cash flow", "number"),
              column("cashConversion", isZh ? "FCF 转化率" : "FCF conversion", "number"),
            ]
          : [
              column("revenue", isZh ? "营收" : "Revenue", "number"),
              column("grossMargin", isZh ? "毛利率" : "Gross margin", "number"),
              column("netIncome", isZh ? "净利润" : "Net income", "number"),
              column("operatingCashFlow", isZh ? "经营现金流" : "Operating cash flow", "number"),
              column("cashCapex", isZh ? "现金资本开支" : "Cash capex", "number"),
              column("freeCashFlow", isZh ? "自由现金流" : "Free cash flow", "number"),
              column("netMargin", isZh ? "净利率" : "Net margin", "number"),
            ]),
  ];
  const financialRows = report.periods.map((period) => ({
    period: period.periodEnd,
    revenue: period.revenue,
    netInterestIncome: period.netInterestIncome,
    deposits: period.deposits,
    loans: period.loans,
    loanGrowth: period.loanGrowth,
    creditLossProvision: period.creditLossProvision,
    efficiencyRatio: period.efficiencyRatio,
    grossMargin: period.grossMargin,
    researchAndDevelopment: period.researchAndDevelopment,
    netIncome: period.netIncome,
    operatingCashFlow: period.operatingCashFlow,
    operatingMargin: period.operatingMargin,
    inventory: period.inventory,
    workingCapital: period.workingCapital,
    cashCapex: period.cashCapex,
    freeCashFlow: period.freeCashFlowProxy,
    cashConversion: period.cashConversion,
    netMargin: period.netMargin,
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
      dataset: { id: "historical-financial-trend", title: "Historical financial trend", columns: chartColumns, rows: chartRows },
      metadata: { chartType: "line", unit: report.currency, isReported: true, period: `${chartRows[0].period}–${chartRows.at(-1)!.period}` },
      svg: lineSvg(isZh ? "历史财务趋势" : "Historical financial trend", chartColumns, chartRows),
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
  const dashboardColumns = [
    column("metric", isZh ? "指标" : "Metric", "string"),
    column("value", isZh ? "数值" : "Value", "string"),
    column("detail", isZh ? "说明" : "Detail", "string"),
    column("classification", isZh ? "证据分类" : "Evidence class", "string"),
  ];
  const dashboardRows = report.dashboard.map((item) => ({
    metric: item.label,
    value: item.value,
    detail: item.detail,
    classification: item.classification,
  }));
  if (dashboardRows.length) assets.push(createAsset(report, {
    assetSlug: "research-dashboard",
    title: isZh ? "研究仪表板数据表" : "Research dashboard data sheet",
    assetType: "dataSheet",
    category: "company",
    sectionId: "dashboard",
    sectionTitle: isZh ? "研究仪表板" : "Research dashboard",
    dataset: { id: "research-dashboard", title: "Research dashboard", columns: dashboardColumns, rows: dashboardRows },
    metadata: { isCalculated: true },
    svg: tableSvg(isZh ? "研究仪表板数据表" : "Research dashboard data sheet", dashboardColumns, dashboardRows),
    formats: ["csv", "xlsx"],
  }));
  const exposureColumns = [
    column("driver", isZh ? "行业驱动因素" : "Sector driver", "string"),
    column("companyExposure", isZh ? "公司敞口" : "Company exposure", "string"),
    column("evidence", isZh ? "公司证据" : "Company evidence", "string"),
    column("source", isZh ? "来源" : "Source", "string"),
    column("investmentImplication", isZh ? "投资含义" : "Investment implication", "string"),
  ];
  const exposureRows = report.driverExposure.map((item) => ({
    driver: item.driver,
    companyExposure: item.companyExposure,
    evidence: item.evidence,
    source: `${item.evidencePublisher} · ${item.evidenceDate} · ${item.evidenceUrl}`,
    investmentImplication: item.investmentImplication,
  }));
  if (exposureRows.length) assets.push(createAsset(report, {
    assetSlug: "company-sector-driver-exposure",
    title: isZh ? "公司行业驱动因素敞口" : "Company exposure to sector drivers",
    assetType: "table",
    category: "company",
    sectionId: "company-exposure",
    sectionTitle: isZh ? "公司行业敞口" : "Company exposure",
    dataset: { id: "company-sector-driver-exposure", title: "Company exposure to sector drivers", columns: exposureColumns, rows: exposureRows },
    metadata: { isReported: true },
    svg: tableSvg(isZh ? "公司行业驱动因素敞口" : "Company exposure to sector drivers", exposureColumns, exposureRows),
    formats: ["png", "csv", "xlsx"],
  }));
  const latest = report.periods.at(-1);
  const capitalMetrics = latest
    ? (isBank
        ? [
            ["cash", isZh ? "现金" : "Cash", latest.cash],
            ["deposits", isZh ? "存款" : "Deposits", latest.deposits],
            ["loans", isZh ? "贷款" : "Loans", latest.loans],
            ["tangibleBookValue", isZh ? "有形账面价值" : "Tangible book value", latest.tangibleBookValue],
            ["capitalReturns", isZh ? "股东回报" : "Capital returns", latest.capitalReturns],
            ["efficiencyRatio", isZh ? "效率比率" : "Efficiency ratio", latest.efficiencyRatio],
          ]
        : isBiopharma
          ? [
              ["cash", isZh ? "现金" : "Cash", latest.cash],
              ["researchAndDevelopment", isZh ? "研发费用" : "Research and development", latest.researchAndDevelopment],
              ["totalDebt", isZh ? "总债务" : "Total debt", latest.totalDebt],
              ["netDebt", isZh ? "净债务" : "Net debt", latest.netDebt],
              ["cashCapex", isZh ? "现金资本开支" : "Cash capex", latest.cashCapex],
              ["freeCashFlow", isZh ? "自由现金流" : "Free cash flow", latest.freeCashFlowProxy],
            ]
          : isIndustrial
            ? [
                ["workingCapital", isZh ? "营运资本" : "Working capital", latest.workingCapital],
                ["inventory", isZh ? "存货" : "Inventory", latest.inventory],
                ["cashCapex", isZh ? "现金资本开支" : "Cash capex", latest.cashCapex],
                ["freeCashFlow", isZh ? "自由现金流" : "Free cash flow", latest.freeCashFlowProxy],
                ["cashConversion", isZh ? "FCF 转化率" : "FCF conversion", latest.cashConversion],
                ["operatingMargin", isZh ? "营业利润率" : "Operating margin", latest.operatingMargin],
              ]
            : [
                ["cash", isZh ? "现金" : "Cash", latest.cash],
                ["totalDebt", isZh ? "总债务" : "Total debt", latest.totalDebt],
                ["netDebt", isZh ? "净债务" : "Net debt", latest.netDebt],
                ["inventory", isZh ? "存货" : "Inventory", latest.inventory],
                ["cashCapex", isZh ? "现金资本开支" : "Cash capex", latest.cashCapex],
                ["currentRatio", isZh ? "流动比率" : "Current ratio", latest.currentRatio],
              ])
    : [];
  const capitalColumns = [
    column("metric", isZh ? "指标" : "Metric", "string"),
    column("value", isZh ? "数值" : "Value", "number"),
    column("period", isZh ? "期间" : "Period", "string"),
    column("formula", isZh ? "公式或口径" : "Formula or definition", "string"),
  ];
  const capitalRows = capitalMetrics
    .filter((item): item is [string, string, number] => typeof item[2] === "number")
    .map(([, label, value]) => ({
      metric: label,
      value,
      period: latest?.periodEnd ?? null,
      formula: report.cashFlowProxyFormula,
    }));
  if (capitalRows.length) assets.push(createAsset(report, {
    assetSlug: "cash-capital-allocation",
    title: isZh ? "现金流、资本与股东回报" : "Cash flow, capital, and shareholder returns",
    assetType: "matrix",
    category: "financial",
    sectionId: "cash-capital",
    sectionTitle: isZh ? "现金流与资本配置" : "Cash flow and capital allocation",
    dataset: { id: "cash-capital-allocation", title: "Cash flow and capital allocation", columns: capitalColumns, rows: capitalRows },
    metadata: { isCalculated: true, unit: report.currency },
    svg: tableSvg(isZh ? "现金流、资本与股东回报" : "Cash flow, capital, and shareholder returns", capitalColumns, capitalRows),
    formats: ["png", "csv", "xlsx"],
  }));
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
  if (report.productMetrics.length) {
    const productColumns = [
      column("product", isZh ? "产品" : "Product", "string"),
      column("period", isZh ? "期间" : "Period", "string"),
      column("revenue", isZh ? "营收" : "Revenue", "number"),
      column("revenueGrowth", isZh ? "营收增长" : "Revenue growth", "number"),
      column("revenueShare", isZh ? "营收占比" : "Revenue share", "number"),
      column("therapeuticArea", isZh ? "治疗领域" : "Therapeutic area", "string"),
      column("source", isZh ? "来源" : "Source", "string"),
    ];
    const productRows = report.productMetrics.map((item) => ({
      product: item.product,
      period: item.period,
      revenue: item.revenue,
      revenueGrowth: item.revenueGrowth,
      revenueShare: item.revenueShare,
      therapeuticArea: item.therapeuticArea,
      source: `${item.sourceTitle} · ${item.sourceDate} · ${item.sourceUrl}`,
    }));
    assets.push(createAsset(report, {
      assetSlug: "product-economics",
      title: isZh ? "产品经济性数据表" : "Product economics data sheet",
      assetType: "dataSheet",
      category: "company",
      sectionId: "sector-kpis",
      sectionTitle: isZh ? "行业关键指标" : "Sector KPIs",
      dataset: { id: "product-economics", title: "Product economics", columns: productColumns, rows: productRows },
      metadata: { isReported: true, unit: report.currency },
      svg: tableSvg(isZh ? "产品经济性数据表" : "Product economics data sheet", productColumns, productRows),
      formats: ["csv", "xlsx"],
    }));
  }
  if (report.pipelineAssets.length) {
    const pipelineColumns = [
      column("asset", isZh ? "资产" : "Asset", "string"),
      column("indication", isZh ? "适应症" : "Indication", "string"),
      column("stage", isZh ? "阶段" : "Stage", "string"),
      column("latestMilestone", isZh ? "最新里程碑" : "Latest milestone", "string"),
      column("nextMilestone", isZh ? "下一里程碑" : "Next milestone", "string"),
      column("source", isZh ? "来源" : "Source", "string"),
    ];
    const pipelineRows = report.pipelineAssets.map((item) => ({
      asset: item.asset,
      indication: item.indication,
      stage: item.stage,
      latestMilestone: item.latestMilestone,
      nextMilestone: item.nextMilestone,
      source: `${item.sourceTitle} · ${item.sourceDate} · ${item.sourceUrl}`,
    }));
    assets.push(createAsset(report, {
      assetSlug: "pipeline-assets",
      title: isZh ? "管线资产数据表" : "Pipeline assets data sheet",
      assetType: "dataSheet",
      category: "company",
      sectionId: "sector-kpis",
      sectionTitle: isZh ? "行业关键指标" : "Sector KPIs",
      dataset: { id: "pipeline-assets", title: "Pipeline assets", columns: pipelineColumns, rows: pipelineRows },
      metadata: { isReported: true },
      svg: tableSvg(isZh ? "管线资产数据表" : "Pipeline assets data sheet", pipelineColumns, pipelineRows),
      formats: ["csv", "xlsx"],
    }));
  }
  const peerMetricIds = [...new Set(
    report.peerComparison.flatMap((peer) =>
      peer.metrics.filter((metric) => metric.value !== null).map((metric) => metric.id),
    ),
  )];
  const peerColumns = [
    column("ticker", isZh ? "代码" : "Ticker", "string"),
    column("company", isZh ? "公司" : "Company", "string"),
    column("rationale", isZh ? "比较逻辑" : "Comparison logic", "string"),
    column("period", isZh ? "期间" : "Period", "string"),
    ...peerMetricIds.map((metricId) => {
      const metric = report.peerComparison
        .flatMap((peer) => peer.metrics)
        .find((item) => item.id === metricId);
      return column(`metric_${slug(metricId)}`, metric?.label ?? metricId, "number");
    }),
  ];
  const peerRows = report.peerComparison
    .filter((peer) => peer.periodEnd && peer.metrics.some((metric) => metric.value !== null))
    .map((peer) => ({
      ticker: peer.ticker,
      company: peer.name,
      rationale: peer.rationale,
      period: peer.periodEnd,
      ...Object.fromEntries(peerMetricIds.map((metricId) => [
        `metric_${slug(metricId)}`,
        peer.metrics.find((metric) => metric.id === metricId)?.value ?? null,
      ])),
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
    column("revenueGrowth", isZh ? "营收或有形账面增长" : "Revenue or tangible-book growth", "number"),
    column("netMargin", isZh ? "净利率" : "Net margin", "number"),
    column("capexFactor", isZh ? "资本开支系数" : "Capex factor", "number"),
    column("projectedFreeCashFlow", isZh ? "预计自由现金流" : "Projected free cash flow", "number"),
    column("valuationMetric", isZh ? "估值指标" : "Valuation metric", "number"),
    column("valuationStartingPoint", isZh ? "估值起点" : "Valuation starting point", "number"),
    column("enterpriseValue", isZh ? "隐含企业价值" : "Implied enterprise value", "number"),
    column("netDebtAdjustment", isZh ? "净债务调整" : "Net-debt adjustment", "number"),
    column("equityValue", isZh ? "隐含股权价值" : "Implied equity value", "number"),
    column("dilutedShares", isZh ? "稀释后股数" : "Diluted shares", "number"),
    column("pricePerShare", isZh ? "隐含每股价值" : "Implied value per share", "number"),
    column("impliedPe", isZh ? "隐含市盈率" : "Implied P/E", "number"),
    column("impliedDividendYield", isZh ? "隐含股息率" : "Implied dividend yield", "number"),
    column("rotceSpread", isZh ? "ROTCE 与股权成本差" : "ROTCE less cost of equity", "number"),
  ];
  const scenarioRows = report.scenarios.map((scenario) => ({
    scenario: scenario.name,
    method: scenario.valuationMethod,
    multiple: scenario.enterpriseValueMultiple,
    revenueGrowth: scenario.revenueGrowth,
    netMargin: scenario.netMargin,
    capexFactor: scenario.capexFactor,
    projectedFreeCashFlow: scenario.projectedFreeCashFlow,
    valuationMetric: scenario.valuationMetric,
    valuationStartingPoint: scenario.valuationStartingPoint,
    enterpriseValue: scenario.modelImpliedEnterpriseValue,
    netDebtAdjustment: scenario.netDebtAdjustment,
    equityValue: scenario.modelImpliedEquityValue,
    dilutedShares: scenario.dilutedShares,
    pricePerShare: scenario.impliedPricePerShare,
    impliedPe: scenario.impliedPriceToEarnings,
    impliedDividendYield: scenario.impliedDividendYield,
    rotceSpread: scenario.rotceCostOfEquitySpread,
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
  if (report.marketValuation) {
    const valuationColumns = [
      column("asOfDate", isZh ? "截至日期" : "As of date", "string"),
      column("sharePrice", isZh ? "股价" : "Share price", "number"),
      column("marketCapitalization", isZh ? "市值" : "Market capitalization", "number"),
      column("enterpriseValue", isZh ? "企业价值" : "Enterprise value", "number"),
      column("netDebtAdjustment", isZh ? "净债务调整" : "Net-debt adjustment", "number"),
      column("dilutedShares", isZh ? "稀释后股数" : "Diluted shares", "number"),
      column("evRevenue", isZh ? "EV / 营收" : "EV / revenue", "number"),
      column("pe", isZh ? "市盈率" : "P/E", "number"),
      column("evEbitda", isZh ? "EV / EBITDA" : "EV / EBITDA", "number"),
      column("source", isZh ? "来源" : "Source", "string"),
    ];
    const valuationRows = [{
      asOfDate: report.marketValuation.asOfDate,
      sharePrice: report.marketValuation.sharePrice,
      marketCapitalization: report.marketValuation.marketCapitalization,
      enterpriseValue: report.marketValuation.enterpriseValue,
      netDebtAdjustment: report.marketValuation.netDebtAdjustment,
      dilutedShares: report.marketValuation.dilutedShares,
      evRevenue: report.marketValuation.currentEvRevenue,
      pe: report.marketValuation.currentPe,
      evEbitda: report.marketValuation.currentEvEbitda,
      source: `${report.marketValuation.sourceTitle} · ${report.marketValuation.sourceUrl}`,
    }];
    assets.push(createAsset(report, {
      assetSlug: "dated-market-valuation",
      title: isZh ? "带日期市场估值数据" : "Dated market valuation data",
      assetType: "dataSheet",
      category: "valuation",
      sectionId: "scenarios",
      sectionTitle: isZh ? "情景与估值" : "Scenarios and valuation",
      dataset: { id: "dated-market-valuation", title: "Dated market valuation", columns: valuationColumns, rows: valuationRows },
      metadata: { isReported: true, period: report.marketValuation.asOfDate },
      svg: tableSvg(isZh ? "带日期市场估值数据" : "Dated market valuation data", valuationColumns, valuationRows),
      formats: ["png", "csv", "xlsx"],
    }));
  }
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
      column("type", isZh ? "分类类型" : "Classification type", "string"),
      column("code", isZh ? "代码" : "Code", "string"),
      column("officialLabel", isZh ? "官方名称" : "Official label", "string"),
      column("analyticalRole", isZh ? "分析角色" : "Analytical role", "string"),
      column("directOrProxy", isZh ? "直接或代理" : "Direct or proxy", "string"),
      column("includedScope", isZh ? "包含范围" : "Included scope", "string"),
      column("knownExclusions", isZh ? "已知排除" : "Known exclusions", "string"),
      column("source", isZh ? "官方来源" : "Official source", "string"),
      column("confidence", isZh ? "置信度" : "Confidence", "string"),
    ];
    const definitionRows = industry.profile.candidates.map((candidate) => ({
      type: candidate.kind,
      code: candidate.code,
      officialLabel: candidate.officialLabel,
      analyticalRole: candidate.reason,
      directOrProxy: candidate.isProxy ? (isZh ? "代理指标" : "Proxy") : (isZh ? "直接分类" : "Direct classification"),
      includedScope: candidate.includedScope,
      knownExclusions: candidate.knownExclusions,
      source: candidate.providerId,
      confidence: candidate.confidence,
    }));
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
    const censusEvidence = (industry.marketReport?.evidence ?? []).filter(
      (item) => item.providerId === "census" && typeof item.value === "number",
    );
    const footprintGroups = new Map<string, MarketEvidence[]>();
    for (const evidence of censusEvidence) {
      const key = `${evidence.observationPeriod}|${evidence.geography}|${evidence.industryCode ?? ""}`;
      footprintGroups.set(key, [...(footprintGroups.get(key) ?? []), evidence]);
    }
    const footprintColumns = [
      column("period", isZh ? "期间" : "Period", "string"),
      column("geography", isZh ? "地区" : "Geography", "string"),
      column("industryCode", isZh ? "行业代码" : "Industry code", "string"),
      column("establishments", isZh ? "经营场所数" : "Establishments", "number"),
      column("employment", isZh ? "就业人数" : "Employment", "number"),
      column("annualPayrollUsd", isZh ? "年度工资总额（美元）" : "Annual payroll (USD)", "number"),
      column("payrollPerEmployee", isZh ? "人均工资（美元）" : "Payroll per employee (USD)", "number"),
    ];
    const footprintRows = [...footprintGroups.values()].map((group) => {
      const establishments = group.find((item) => item.metricLabel === "Establishment count")?.value;
      const employment = group.find((item) => item.metricLabel === "Employment")?.value;
      const payrollThousands = group.find((item) => item.metricLabel === "Annual payroll")?.value;
      const annualPayrollUsd = typeof payrollThousands === "number" ? payrollThousands * 1000 : null;
      return {
        period: group[0].observationPeriod,
        geography: group[0].geography,
        industryCode: group[0].industryCode,
        establishments: typeof establishments === "number" ? establishments : null,
        employment: typeof employment === "number" ? employment : null,
        annualPayrollUsd,
        payrollPerEmployee:
          annualPayrollUsd !== null && typeof employment === "number" && employment > 0
            ? annualPayrollUsd / employment
            : null,
      };
    }).sort((left, right) => left.period.localeCompare(right.period));
    if (footprintRows.length) assets.push(createAsset(report, {
      assetSlug: "industry-establishments-employment-payroll",
      title: isZh ? "行业经营场所、就业与工资" : "Industry establishments, employment, and payroll",
      subtitle: isZh ? "经营场所不等同于公司数量" : "Establishments are physical locations, not company counts",
      assetType: "table",
      category: "market",
      sectionId: "industry-trends",
      sectionTitle: isZh ? "行业规模与趋势" : "Industry scale and trends",
      dataset: {
        id: "industry-establishments-employment-payroll",
        title: "Industry establishments, employment, and payroll",
        columns: footprintColumns,
        rows: footprintRows,
      },
      metadata: {
        isReported: true,
        isCalculated: footprintRows.some((row) => row.payrollPerEmployee !== null),
        sourceIds: censusEvidence.map((item) => item.evidenceId).join(" · "),
        limitations: isZh ? "CBP 发布时间滞后；经营场所不等同于公司数量" : "CBP releases lag; establishments are not company counts",
      },
      svg: tableSvg(isZh ? "行业经营场所、就业与工资" : "Industry establishments, employment, and payroll", footprintColumns, footprintRows),
      formats: ["png", "csv", "xlsx"],
    }));
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
        svg: barSvg(isZh ? "公司与行业代理增长比较" : "Company versus industry proxy growth", columns, rows),
        formats: ["png", "svg", "csv", "xlsx"],
      }));
    }
  }
  return assets;
}
