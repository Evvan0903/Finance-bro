import {
  MetricRegistry,
  formatMetricForDisplay,
  publishLocatorAuditToRegistry,
} from "../../lib/canonical-metrics";
import { formatFinancialValue, formatPercentage } from "../../lib/presentation-format";
import type { CanonicalMetricObject } from "../../lib/canonical-metrics";
import { buildCanonicalScenarios } from "../../lib/canonical-scenarios";
import {
  buildLlyMarketValuation,
  buildPipelineAssets,
  buildProductMetrics,
} from "../../lib/biopharma-metrics";
import { auditResearchReport } from "../../lib/metric-consistency-auditor";
import { REPORT_RENDERING_MODEL } from "../../lib/report-rendering-model";
import {
  buildFinancialMetricRegistry,
  ensureCoreDerivedMetrics,
  financialPeriodsFromRegistry,
  FINANCIAL_DEFINITION_IDS,
} from "../../lib/financial-metrics";
import type { IssuerReportedMetric } from "../../lib/financial-metrics";
import { getSectorMethods } from "../../lib/sector-methodology";
import { getSectorPack } from "../../lib/sector-packs";
import { getSectorOutlook, sectorEvidenceSources } from "../../lib/sector-retrieval";
import { classifyCompany } from "../../lib/research-classification/classify-company";
import type { CompanyClassification } from "../../lib/research-classification/types";
import { buildMetricExtractionAudit } from "../../lib/metric-coverage/extraction-audit";
import { scoreMetricCoverage } from "../../lib/metric-coverage/coverage-score";
import { companyTypeForPack } from "../../lib/metric-coverage/coverage-expectations";
import type { MetricExtractionAudit } from "../../lib/metric-coverage/types";
import {
  runShellMetricValidation,
  SHELL_2025_20F_URL,
} from "../../lib/shell-metric-validation";
import {
  SecClientError,
  secClient,
  toSecClientError,
} from "../../lib/sec-client";
import type {
  ResearchErrorCode,
  SecCompanyRecord,
  SecPipelineStage,
  SecRequestDiagnostic,
} from "../../lib/sec-client";
import type {
  CompanyFactsPayload,
  MetricLocatorAudit,
} from "../../lib/metric-locator-types";
import type {
  ResearchMarket,
  ResearchOptions,
  ResearchSelection,
  SectorKpiDefinition,
  SectorPack,
  SupportedSector,
  SupportedSubindustry,
} from "../../lib/sector-types";
import type {
  CatalystPoint,
  DashboardMetric,
  FilingSource,
  FinancialPeriod,
  InvestmentDebate,
  MetricUsage,
  PeerComparisonItem,
  ResearchLocale,
  ResearchReport,
  RiskPoint,
  SectorDriverExposure,
  SectorKpiResult,
  ThesisPoint,
} from "../../lib/research-types";
import shellSourceSnapshot from "../../../tests/fixtures/shel-source-snapshot.json";
import nvdaSourceSnapshot from "../../../tests/fixtures/nvda-source-snapshot.json";
import jpmSourceSnapshot from "../../../tests/fixtures/jpm-source-snapshot.json";
import llySourceSnapshot from "../../../tests/fixtures/lly-source-snapshot.json";
import catSourceSnapshot from "../../../tests/fixtures/cat-source-snapshot.json";

export const dynamic = "force-dynamic";

const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"]);
const INTERIM_FORMS = new Set(["10-Q", "10-Q/A", "6-K"]);
const RESEARCH_DATE = "2026-07-17";
const FREE_CASH_FLOW_UNAVAILABLE = "Unable to calculate free cash flow from available filings.";

type TickerRecord = SecCompanyRecord;
type CompanyFacts = CompanyFactsPayload;
type Submissions = {
  cik: string;
  name: string;
  sic?: string;
  sicDescription?: string;
  fiscalYearEnd?: string;
  exchanges?: string[];
  tickers?: string[];
  entityType?: string;
  category?: string;
  filings?: { recent?: Record<string, Array<string | number | null>> };
};
type ResearchPayload = {
  company?: string;
  locale?: ResearchLocale;
  // Deprecated compatibility fields: SEC SIC classification is authoritative.
  market?: ResearchMarket;
  sector?: SupportedSector;
  subindustry?: SupportedSubindustry;
  options?: Partial<ResearchOptions>;
  fixture?: boolean;
};
type ReportSourceSnapshot = {
  companyFacts: CompanyFactsPayload;
  submissions: Submissions;
  retrievedAt: string;
  issuerReportedMetrics?: IssuerReportedMetric[];
  sourceMode:
    | "explicit-test-snapshot"
    | "verified-runtime-fallback"
    | "verified-filing-fallback";
};

const COPY = {
  zh: {
    dataUnavailable: "数据不可用",
    notDisclosed: "未披露",
    unableFcf: "无法根据现有申报计算自由现金流。",
    annualFiling: "最新年度申报",
    interimFiling: "最新中期/当前申报",
    reportingIssuer: "SEC 申报发行人",
  },
  en: {
    dataUnavailable: "Data unavailable",
    notDisclosed: "Not disclosed",
    unableFcf: FREE_CASH_FLOW_UNAVAILABLE,
    annualFiling: "Latest annual filing",
    interimFiling: "Latest interim/current filing",
    reportingIssuer: "SEC reporting issuer",
  },
} as const;

const DEFAULT_OPTIONS: ResearchOptions = {
  sectorOutlook: true,
  peerComparison: true,
  valuation: true,
  dueDiligence: true,
  pdfExport: true,
};

function compactMoney(value: number | null, currency: string, locale: ResearchLocale) {
  return formatFinancialValue(value, currency, locale);
}

function percentage(value: number | null, locale: ResearchLocale) {
  return formatPercentage(value, locale);
}

function recentFilings(submissions: Submissions) {
  const recent = submissions.filings?.recent ?? {};
  const forms = (recent.form ?? []) as Array<string | null>;
  return forms.map((form, index) => ({
    form: String(form ?? ""),
    accessionNumber: String(recent.accessionNumber?.[index] ?? ""),
    filingDate: String(recent.filingDate?.[index] ?? ""),
    reportDate: String(recent.reportDate?.[index] ?? ""),
    primaryDocument: String(recent.primaryDocument?.[index] ?? ""),
  }));
}

function filingSource(
  submissions: Submissions,
  forms: Set<string>,
  title: string,
): FilingSource | null {
  const filing = recentFilings(submissions).find((item) => forms.has(item.form));
  if (!filing?.accessionNumber || !filing.primaryDocument) return null;
  const cikNumber = String(Number(String(submissions.cik).padStart(10, "0")));
  const accession = filing.accessionNumber.replace(/-/g, "");
  return {
    title,
    form: filing.form,
    filed: filing.filingDate,
    reportDate: filing.reportDate,
    url: `https://www.sec.gov/Archives/edgar/data/${cikNumber}/${accession}/${filing.primaryDocument}`,
  };
}

async function shellMetricAudit(
  record: TickerRecord,
  facts: CompanyFacts,
  verifiedSnapshot = false,
  diagnostics: SecRequestDiagnostic[] = [],
): Promise<MetricLocatorAudit | null> {
  if (record.ticker !== "SHEL") return null;
  if (verifiedSnapshot) {
    return runShellMetricValidation({
      companyFacts: facts as CompanyFactsPayload,
      verifiedSnapshot: true,
    });
  }
  try {
    const filingHtml = await secClient.getFilingDocument(
      SHELL_2025_20F_URL,
      diagnostics,
    );
    return runShellMetricValidation({
      companyFacts: facts as CompanyFactsPayload,
      filingHtml,
      verifiedSnapshot: false,
    });
  } catch {
    return runShellMetricValidation({
      companyFacts: facts as CompanyFactsPayload,
      verifiedSnapshot: true,
    });
  }
}

function kpiValue(
  definition: SectorKpiDefinition,
  latest: FinancialPeriod,
  currency: string,
  locale: ResearchLocale,
) {
  switch (definition.availability) {
    case "revenue":
      return compactMoney(latest.revenue, currency, locale);
    case "grossMargin":
      return percentage(latest.grossMargin, locale);
    case "operatingMargin":
      return percentage(latest.operatingMargin, locale);
    case "inventory":
      return compactMoney(latest.inventory, currency, locale);
    case "cashCapex":
      return compactMoney(latest.cashCapex, currency, locale);
    case "freeCashFlow":
    case "freeCashFlowProxy":
      return latest.cashCapex === null || latest.operatingCashFlow === null
        ? "—"
        : compactMoney(latest.freeCashFlowProxy, currency, locale);
    case "cashConversion":
      return percentage(latest.cashConversion, locale);
    case "netDebt":
      return compactMoney(latest.netDebt, currency, locale);
    default:
      return "—";
  }
}

function kpiHasValue(definition: SectorKpiDefinition, latest: FinancialPeriod) {
  switch (definition.availability) {
    case "revenue":
      return latest.revenue !== null;
    case "grossMargin":
      return latest.grossMargin !== null;
    case "operatingMargin":
      return latest.operatingMargin !== null;
    case "inventory":
      return latest.inventory !== null;
    case "cashCapex":
      return latest.cashCapex !== null;
    case "freeCashFlow":
    case "freeCashFlowProxy":
      return latest.freeCashFlowProxy !== null;
    case "cashConversion":
      return latest.cashConversion !== null;
    case "netDebt":
      return latest.netDebt !== null;
    default:
      return false;
  }
}

function buildSectorKpis(
  pack: SectorPack,
  latest: FinancialPeriod,
  currency: string,
  locale: ResearchLocale,
  metricAudit: MetricLocatorAudit | null,
  metricRegistry: MetricRegistry,
  companyId: string,
): SectorKpiResult[] {
  const located = new Map(
    metricAudit?.results.map((result) => [result.metricId, result]) ?? [],
  );
  return pack.coreKpis.map((definition): SectorKpiResult => {
    if (definition.canonicalMetricId) {
      const candidates = metricRegistry.findMetrics({
        company_id: companyId,
        metric_id: definition.canonicalMetricId,
        period_end: latest.periodEnd,
      }).filter((metric) =>
        metric.value !== null &&
        ["Reported", "Derived"].includes(metric.status) &&
        (
          !definition.definitionIds?.length ||
          definition.definitionIds.includes(metric.definition_id)
        )
      );
      const canonicalMetric = candidates.sort((left, right) => {
        const leftPriority =
          definition.definitionIds?.indexOf(left.definition_id) ?? 0;
        const rightPriority =
          definition.definitionIds?.indexOf(right.definition_id) ?? 0;
        return leftPriority - rightPriority || right.confidence - left.confidence;
      })[0];
      if (canonicalMetric) {
        return {
          id: definition.id,
          label: definition.label[locale],
          value: formatMetricForDisplay(canonicalMetric, locale),
          usable: true,
          status: canonicalMetric.status,
          period: canonicalMetric.period_end,
          definition: definition.description[locale],
          classification:
            canonicalMetric.status === "Derived"
              ? "Derived calculation"
              : "Reported fact",
          sourceNote: [
            canonicalMetric.source_document,
            canonicalMetric.source_date,
            canonicalMetric.formula,
          ].filter(Boolean).join(" · "),
          sourceUrl: canonicalMetric.source_url,
          confidence: canonicalMetric.confidence,
          extractionMethod: canonicalMetric.extraction_method,
          canonicalKey: canonicalMetric.canonical_key,
          whyItMatters:
            locale === "zh"
              ? `该指标用于回答：${pack.researchQuestions[
                  pack.coreKpis.indexOf(definition) % pack.researchQuestions.length
                ].zh}`
              : `This metric helps answer: ${pack.researchQuestions[
                  pack.coreKpis.indexOf(definition) % pack.researchQuestions.length
                ].en}`,
        };
      }
    }
    const locatorResult = located.get(definition.id);
    if (locatorResult) {
      const canonicalMetric = metricRegistry.getMetric({
        company_id: companyId,
        metric_id: locatorResult.metricId,
        period_end: locatorResult.period ?? undefined,
        definition_id: locatorResult.definitionId,
      });
      return {
        id: definition.id,
        label: definition.label[locale],
        value: locatorResult.displayValue ?? "—",
        usable: locatorResult.found,
        status: locatorResult.status,
        period: locatorResult.period,
        definition:
          locatorResult.definitionId === FINANCIAL_DEFINITION_IDS.issuerNetDebt
            ? locale === "zh"
              ? "发行人报告净债务：流动与非流动债务减现金，并调整债务对冲衍生品及相关抵押品。"
              : "Issuer-reported net debt: current and non-current debt less cash, adjusted for debt-hedging derivatives and associated collateral."
            : locatorResult.definitionId === FINANCIAL_DEFINITION_IDS.issuerCashCapex
              ? locale === "zh"
                ? "发行人报告现金资本开支，来自年度申报的自定义 XBRL。"
                : "Issuer-reported cash capital expenditure from filing-level custom XBRL."
              : definition.description[locale],
        classification:
          locatorResult.status === "Derived" ? "Derived calculation" : "Reported fact",
        sourceNote: locatorResult.found
          ? `${locatorResult.sourceDocument} · ${locatorResult.filingDate} · ${locatorResult.section}${locatorResult.table ? ` / ${locatorResult.table}` : ""} / ${locatorResult.row} · ${(locatorResult.confidence * 100).toFixed(0)}% confidence`
          : locatorResult.reason ?? locatorResult.status,
        sourceUrl: locatorResult.sourceUrl,
        confidence: locatorResult.confidence,
        extractionMethod: locatorResult.extractionMethod,
        canonicalKey: canonicalMetric.canonical_key,
        whyItMatters:
          locale === "zh"
            ? `该指标用于回答：${pack.researchQuestions[
                pack.coreKpis.indexOf(definition) % pack.researchQuestions.length
              ].zh}`
            : `This metric helps answer: ${pack.researchQuestions[
                pack.coreKpis.indexOf(definition) % pack.researchQuestions.length
              ].en}`,
      } satisfies SectorKpiResult;
    }
    const derived = ["grossMargin", "operatingMargin", "freeCashFlow", "freeCashFlowProxy", "cashConversion", "netDebt"].includes(definition.availability);
    const available = kpiHasValue(definition, latest);
    const metricField = {
      revenue: "revenue",
      grossMargin: "grossMargin",
      operatingMargin: "operatingMargin",
      inventory: "inventory",
      cashCapex: "cashCapex",
      freeCashFlow: "freeCashFlowProxy",
      freeCashFlowProxy: "freeCashFlowProxy",
      cashConversion: "cashConversion",
      netDebt: "netDebt",
      notStandardized: "",
    }[definition.availability];
    const canonicalKey = metricField ? latest.metricKeys[metricField] ?? "" : "";
    return {
      id: definition.id,
      label: definition.label[locale],
      value: kpiValue(definition, latest, currency, locale),
      usable: available,
      status: available ? (derived ? "Derived" : "Reported") : "Not yet extracted",
      period: available ? latest.periodEnd : null,
      definition: definition.description[locale],
      classification: derived ? "Derived calculation" : "Reported fact",
      sourceNote: available
        ? locale === "zh"
          ? "SEC Company Facts；按本页公式标准化。"
          : "SEC Company Facts; normalized using the displayed formula."
        : locale === "zh"
          ? "标准化 SEC Company Facts 未披露；需回到最新年报分部与业务附注。"
          : "Not disclosed in standardized SEC Company Facts; review the latest annual filing's segment and business notes.",
      sourceUrl: null,
      confidence: available ? 0.9 : 0,
      extractionMethod: available ? "Deterministic SEC Company Facts normalization" : null,
      canonicalKey,
      whyItMatters:
        locale === "zh"
          ? `该指标用于回答：${pack.researchQuestions[
              pack.coreKpis.indexOf(definition) % pack.researchQuestions.length
            ].zh}`
          : `This metric helps answer: ${pack.researchQuestions[
              pack.coreKpis.indexOf(definition) % pack.researchQuestions.length
            ].en}`,
    };
  }).filter((result) => result.usable && result.canonicalKey);
}

const PERIOD_FIELD_BY_METRIC_ID: Record<string, string> = {
  revenue: "revenue",
  "revenue-growth": "revenueGrowth",
  "revenue-cagr": "revenueCagr",
  "gross-profit": "grossProfit",
  "net-income": "netIncome",
  "net-interest-income": "netInterestIncome",
  "research-and-development": "researchAndDevelopment",
  deposits: "deposits",
  "deposit-cost": "depositCost",
  loans: "loans",
  "loan-growth": "loanGrowth",
  "credit-loss-provision": "creditLossProvision",
  "net-charge-offs": "netChargeOffs",
  "credit-loss-allowance": "creditLossAllowance",
  "allowance-coverage": "allowanceCoverage",
  "efficiency-ratio": "efficiencyRatio",
  "roe-proxy": "roeProxy",
  "return-on-common-equity": "returnOnCommonEquity",
  "return-on-tangible-common-equity": "returnOnTangibleCommonEquity",
  "tangible-book-value": "tangibleBookValue",
  "tangible-book-value-per-share": "tangibleBookValuePerShare",
  dividends: "dividends",
  "share-buybacks": "shareBuybacks",
  "capital-returns": "capitalReturns",
  "investment-banking-fees": "investmentBankingFees",
  "trading-revenue": "tradingRevenue",
  "net-margin": "netMargin",
  "net-margin-change": "netMarginChange",
  "gross-margin": "grossMargin",
  "operating-margin": "operatingMargin",
  "operating-cash-flow": "operatingCashFlow",
  "operating-cash-flow-margin": "operatingCashFlowMargin",
  "cash-capex": "cashCapex",
  fcf: "freeCashFlowProxy",
  "fcf-margin": "freeCashFlowMargin",
  "cash-conversion": "cashConversion",
  "working-capital": "workingCapital",
  assets: "assets",
  liabilities: "liabilities",
  "liabilities-assets": "liabilitiesAssets",
  inventory: "inventory",
  "current-ratio": "currentRatio",
  "net-debt": "netDebt",
};

const DRIVER_METRIC_IDS: Record<string, string[]> = {
  "oil-balance": ["production", "realized-prices", "operating-cash-flow"],
  "lng-cycle": ["lng", "segment-earnings", "operating-cash-flow"],
  "refining-cycle": ["refining-margin", "segment-earnings", "operating-cash-flow"],
  "capital-discipline": ["cash-capex", "fcf", "net-debt", "dividends", "share-buybacks"],
  "ai-demand": ["revenue", "revenue-growth", "gross-margin", "operating-margin", "fcf"],
  capacity: ["gross-margin", "operating-margin", "inventory", "cash-capex"],
  "product-cycle": ["revenue-growth", "gross-margin", "operating-margin", "inventory"],
  "export-controls": ["revenue", "revenue-growth", "inventory"],
  "rates-deposits": ["net-interest-income", "net-interest-margin", "deposits", "deposit-cost", "loans", "loan-growth"],
  "credit-cycle": ["credit-loss-provision", "net-charge-offs", "credit-loss-allowance", "allowance-coverage", "loans"],
  "capital-liquidity": ["cet1-ratio", "liquidity-coverage-ratio", "tangible-book-value", "tangible-book-value-per-share", "return-on-tangible-common-equity", "dividends", "share-buybacks", "capital-returns"],
  "operating-leverage": ["revenue", "net-interest-income", "net-interest-margin", "efficiency-ratio", "return-on-common-equity", "return-on-tangible-common-equity", "investment-banking-fees", "trading-revenue"],
  "pharma-obesity-demand": ["product-revenue", "product-revenue-growth", "product-concentration", "revenue-growth"],
  "pharma-glp1-competition": ["product-revenue", "product-revenue-growth", "gross-margin"],
  "pharma-pipeline": ["research-and-development", "operating-cash-flow", "fcf"],
  "pharma-manufacturing": ["cash-capex", "operating-cash-flow", "fcf"],
  "pharma-pricing-access": ["product-revenue", "product-concentration", "gross-margin"],
  "pharma-patent-cycle": ["patent-expiry-year", "product-revenue", "product-concentration"],
  "pharma-rd-productivity": ["research-and-development", "revenue", "operating-cash-flow"],
  "pharma-oncology": ["product-revenue", "product-revenue-growth", "research-and-development"],
  "pharma-alzheimers": ["product-revenue", "product-revenue-growth", "research-and-development"],
  "pharma-regulatory": ["product-revenue", "research-and-development"],
  "pharma-earnings-valuation": ["revenue", "revenue-growth", "gross-margin", "fcf", "net-debt"],
  "industrial-order-cycle": ["backlog", "near-term-backlog-share", "revenue-growth", "inventory"],
  "industrial-price-cost": ["price-realization-impact", "manufacturing-cost-impact", "price-cost-impact", "operating-margin"],
  "industrial-capacity": ["backlog", "inventory", "cash-capex", "operating-margin"],
  "industrial-cash-execution": ["working-capital", "cash-conversion", "fcf", "near-term-backlog-share"],
};

function matchingClaim(
  query: string,
  outlook: Awaited<ReturnType<typeof getSectorOutlook>>,
) {
  const tokens = new Set(
    query
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
  return [...outlook.claims]
    .map((claim) => {
      const haystack = `${claim.topic} ${claim.title}`.toLowerCase();
      const score = [...tokens].reduce(
        (sum, token) => sum + (haystack.includes(token) ? 1 : 0),
        0,
      );
      return { claim, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.claim;
}

type CompanyExposureTemplate = {
  driverId: string;
  title: string;
  publisher: string;
  date: string;
  url: string;
  evidence: Record<ResearchLocale, string>;
  companyExposure: Record<ResearchLocale, string>;
  investmentImplication: Record<ResearchLocale, string>;
};

const NVDA_FY2026_10K_URL = "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm";
const NVDA_FY2026_Q1_10Q_URL = "https://www.sec.gov/Archives/edgar/data/1045810/000104581025000116/nvda-20250427.htm";

const NVDA_EXPOSURE_TEMPLATES: CompanyExposureTemplate[] = [
  {
    driverId: "ai-demand",
    title: "NVIDIA FY2026 Form 10-K",
    publisher: "NVIDIA Corporation",
    date: "2026-02-25",
    url: NVDA_FY2026_10K_URL,
    evidence: {
      zh: "NVIDIA 披露 FY2026 数据中心收入为 US$193.7 billion，同比增长 68%，并将增长归因于加速计算和 AI 平台需求。",
      en: "NVIDIA disclosed FY2026 Data Center revenue of US$193.7 billion, up 68%, and attributed the increase to accelerated-computing and AI-platform demand.",
    },
    companyExposure: {
      zh: "高：数据中心计算与网络产品直接受 AI 工作负载和大规模数据中心部署影响。",
      en: "High: Data Center compute and networking are directly exposed to AI workloads and scaled data-center deployment.",
    },
    investmentImplication: {
      zh: "数据中心收入持续性比行业总销售更能检验 AI 需求是否转化为公司级增长。",
      en: "Data Center revenue durability is more informative than industry sales for judging whether AI demand converts into company-level growth.",
    },
  },
  {
    driverId: "capacity",
    title: "NVIDIA Announces Financial Results for Fourth Quarter and Fiscal 2026",
    publisher: "NVIDIA Corporation",
    date: "2026-02-25",
    url: "https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Fourth-Quarter-and-Fiscal-2026/",
    evidence: {
      zh: "NVIDIA 将第三方制造、组装、封装和测试依赖列为风险因素；该材料未披露公司级 HBM 供应量或价格。",
      en: "NVIDIA identifies reliance on third parties to manufacture, assemble, package, and test its products as a risk factor; the release does not disclose company-level HBM supply volumes or pricing.",
    },
    companyExposure: {
      zh: "中高：外包制造和封装依赖使系统供给、成本和交付时点成为公司级变量；不将行业 HBM 数据视作 NVIDIA 的披露。",
      en: "Medium-high: Outsourced manufacturing and packaging make system availability, cost, and delivery timing company-level variables; industry HBM data is not presented as NVIDIA disclosure.",
    },
    investmentImplication: {
      zh: "应把毛利率、库存和供应承诺与产品交付一并检验；HBM/先进封装只作为行业背景，除非发行人进一步量化。",
      en: "Test gross margin, inventory, supply commitments, and delivery together; HBM and advanced packaging remain industry context unless the issuer quantifies them further.",
    },
  },
  {
    driverId: "product-cycle",
    title: "NVIDIA FY2026 Form 10-K",
    publisher: "NVIDIA Corporation",
    date: "2026-02-25",
    url: NVDA_FY2026_10K_URL,
    evidence: {
      zh: "NVIDIA 披露 FY2026 数据中心计算收入增长 59%，主要受 Blackwell 推动；网络收入增长 142%，主要受 NVLink 计算结构和以太网推动。",
      en: "NVIDIA disclosed FY2026 Data Center compute revenue growth of 59%, primarily from Blackwell, and networking growth of 142%, primarily from NVLink compute fabric and Ethernet.",
    },
    companyExposure: {
      zh: "高：产品周期同时影响加速器与网络收入结构，不能仅用单一 GPU 指标概括。",
      en: "High: The product cycle affects both accelerator and networking mix, so a single GPU measure is incomplete.",
    },
    investmentImplication: {
      zh: "计算与网络增速的差异有助于识别平台扩张、产品过渡或客户部署节奏的变化。",
      en: "The spread between compute and networking growth can signal platform expansion, product transition, or customer-deployment timing.",
    },
  },
  {
    driverId: "export-controls",
    title: "NVIDIA FY2026 Q1 Form 10-Q",
    publisher: "NVIDIA Corporation",
    date: "2025-05-28",
    url: NVDA_FY2026_Q1_10Q_URL,
    evidence: {
      zh: "NVIDIA 披露，美国对 H20 向中国出口的许可要求导致其在 FY2026 第一季度确认 US$4.5 billion 费用，并可能影响后续收入。",
      en: "NVIDIA disclosed that U.S. licensing requirements for H20 exports to China caused a US$4.5 billion charge in FY2026 Q1 and could affect subsequent revenue.",
    },
    companyExposure: {
      zh: "高：出口许可直接影响可服务市场、特定产品库存和收入实现时点。",
      en: "High: Export licensing directly affects the serviceable market, inventory for specific products, and revenue timing.",
    },
    investmentImplication: {
      zh: "监管情景应独立于核心需求情景，并用许可、产品结构和库存处理检验。",
      en: "A regulatory scenario should remain separate from the core-demand scenario and be tested through licensing, product mix, and inventory treatment.",
    },
  },
];

const JPM_Q2_2026_SUPPLEMENT_URL =
  "https://www.sec.gov/Archives/edgar/data/19617/000162828026048078/a2q26erfex992supplement.htm";

const JPM_EXPOSURE_TEMPLATES: CompanyExposureTemplate[] = [
  {
    driverId: "rates-deposits",
    title: "JPMorganChase 2Q26 Earnings Supplement",
    publisher: "JPMorgan Chase & Co.",
    date: "2026-07-14",
    url: JPM_Q2_2026_SUPPLEMENT_URL,
    evidence: {
      zh: "JPMorganChase 披露 2Q26 管理口径净利息收入 256 亿美元、公司净收益率 2.40%、期末存款 2.71 万亿美元；较低利率与存款重定价共同决定利差路径。",
      en: "JPMorganChase reported 2Q26 managed net interest income of US$25.6 billion, firmwide net yield of 2.40%, and period-end deposits of US$2.71 trillion; lower rates and deposit repricing jointly determine the margin path.",
    },
    companyExposure: {
      zh: "高：资产收益率、存款成本与存款组合直接影响净利息收入和净收益率。",
      en: "High: Asset yields, deposit cost, and deposit mix directly affect net interest income and firmwide net yield.",
    },
    investmentImplication: {
      zh: "投资者应同时跟踪净收益率、存款成本和存款增长，避免把规模增长误判为利差改善。",
      en: "Investors should track net yield, deposit cost, and deposit growth together rather than treating balance-sheet growth as margin improvement.",
    },
  },
  {
    driverId: "credit-cycle",
    title: "JPMorganChase 2Q26 Earnings Supplement",
    publisher: "JPMorgan Chase & Co.",
    date: "2026-07-14",
    url: JPM_Q2_2026_SUPPLEMENT_URL,
    evidence: {
      zh: "2Q26 信用损失拨备为 25 亿美元，净核销为 24 亿美元，贷款损失准备覆盖率为 1.79%；信用成本仍需按消费和批发组合分别判断。",
      en: "The 2Q26 credit-loss provision was US$2.5 billion, net charge-offs were US$2.4 billion, and allowance coverage was 1.79%; credit cost still needs to be assessed separately across consumer and wholesale portfolios.",
    },
    companyExposure: {
      zh: "高：信用卡、消费、商业地产和批发贷款的正常化会影响拨备前利润与资本。",
      en: "High: Normalization in card, consumer, CRE, and wholesale credit affects pre-provision earnings and capital.",
    },
    investmentImplication: {
      zh: "拨备与净核销接近时，准备金变化和组合迁徙比单季损失率更能说明信用拐点。",
      en: "When provision and charge-offs are close, reserve movement and portfolio migration are more informative than a single-quarter loss rate.",
    },
  },
  {
    driverId: "capital-liquidity",
    title: "JPMorganChase 2Q26 Earnings Supplement",
    publisher: "JPMorgan Chase & Co.",
    date: "2026-07-14",
    url: JPM_Q2_2026_SUPPLEMENT_URL,
    evidence: {
      zh: "2Q26 标准化 CET1 比率为 14.1%，现金和可变现证券为 1.5 万亿美元；季度普通股股息为每股 1.50 美元，普通股回购为 67 亿美元。",
      en: "The 2Q26 standardized CET1 ratio was 14.1% and cash plus marketable securities were US$1.5 trillion; the quarterly common dividend was US$1.50 per share and common-share repurchases were US$6.7 billion.",
    },
    companyExposure: {
      zh: "高：压力资本、风险加权资产、流动性缓冲和监管要求共同约束股息与回购。",
      en: "High: Stress capital, risk-weighted assets, liquidity buffers, and regulation jointly constrain dividends and buybacks.",
    },
    investmentImplication: {
      zh: "资本回报应与最低压力 CET1 和流动性缓冲一并评估，而不能只看期末资本盈余。",
      en: "Capital returns should be assessed against trough stress CET1 and liquidity buffers, not period-end capital surplus alone.",
    },
  },
  {
    driverId: "operating-leverage",
    title: "JPMorganChase 2Q26 Earnings Supplement",
    publisher: "JPMorgan Chase & Co.",
    date: "2026-07-14",
    url: JPM_Q2_2026_SUPPLEMENT_URL,
    evidence: {
      zh: "2Q26 投资银行费用为 33 亿美元，Markets 收入为 121 亿美元，管理口径效率比率为 47%，剔除重大项目后的 ROTCE 为 23%。",
      en: "The 2Q26 investment-banking fees were US$3.3 billion, Markets revenue was US$12.1 billion, the managed efficiency ratio was 47%, and ROTCE excluding significant items was 23%.",
    },
    companyExposure: {
      zh: "高：投行与交易活动提高非息收入，但其质量取决于客户活动、风险消耗和费用纪律。",
      en: "High: Investment-banking and trading activity lift noninterest revenue, but quality depends on client activity, risk consumption, and expense discipline.",
    },
    investmentImplication: {
      zh: "投行费、Markets 收入、效率比率和 ROTCE 必须共同验证经营杠杆是否转化为股东回报。",
      en: "Investment-banking fees, Markets revenue, efficiency, and ROTCE should jointly validate whether operating leverage converts to shareholder returns.",
    },
  },
];

const LLY_10K_URL =
  "https://www.sec.gov/Archives/edgar/data/59478/000005947826000013/lly-20251231.htm";
const LLY_Q1_RELEASE_URL = "https://investor.lilly.com/node/54176";
const LLY_EXPOSURE_TEMPLATES: CompanyExposureTemplate[] = [
  {
    driverId: "pharma-obesity-demand",
    title: "Lilly Q1 2026 Earnings Release",
    publisher: "Eli Lilly and Company",
    date: "2026-04-30",
    url: LLY_Q1_RELEASE_URL,
    evidence: {
      zh: "Q1 2026 Mounjaro 收入 86.62 亿美元、同比增长 125%；Zepbound 收入 41.60 亿美元、同比增长 80%。",
      en: "Q1 2026 Mounjaro revenue was US$8.662 billion, up 125%, and Zepbound revenue was US$4.160 billion, up 80%.",
    },
    companyExposure: {
      zh: "极高：两款替尔泊肽产品已成为 Lilly 最主要的增长与集中度来源。",
      en: "Very high: the two tirzepatide brands are Lilly's primary sources of growth and concentration.",
    },
    investmentImplication: {
      zh: "需求持续性必须与实现价格、准入和供应共同验证；收入增长本身不等于单位经济改善。",
      en: "Demand durability must be tested with realized price, access, and supply; revenue growth alone does not prove better unit economics.",
    },
  },
  {
    driverId: "pharma-glp1-competition",
    title: "Lilly Q1 2026 Earnings Release",
    publisher: "Eli Lilly and Company",
    date: "2026-04-30",
    url: LLY_Q1_RELEASE_URL,
    evidence: {
      zh: "Lilly 披露销量增长 65%、实现价格下降 13%，并将 Foundayo 的商业化列为 2026 年增长组成。",
      en: "Lilly reported 65% volume growth, a 13% realized-price decline, and included the Foundayo launch in its 2026 growth profile.",
    },
    companyExposure: {
      zh: "高：注射与口服 GLP-1 的疗效、便利性、供给和净价格竞争会直接影响组合。",
      en: "High: efficacy, convenience, supply, and net-price competition across injectable and oral GLP-1 products directly affect mix.",
    },
    investmentImplication: {
      zh: "竞争判断应看产品级收入、实现价格和新患者采用，而不是仅看市场规模。",
      en: "Competition should be judged through product revenue, realized price, and new-patient adoption, not market size alone.",
    },
  },
  {
    driverId: "pharma-pipeline",
    title: "Eli Lilly and Company 2025 Form 10-K",
    publisher: "Eli Lilly and Company",
    date: "2026-02-12",
    url: LLY_10K_URL,
    evidence: {
      zh: "年报列示 orforglipron、retatrutide、eloralintide、tirzepatide 扩展、remternetug 与 imlunestrant 等后期项目。",
      en: "The 10-K lists late-stage programs including orforglipron, retatrutide, eloralintide, tirzepatide extensions, remternetug, and imlunestrant.",
    },
    companyExposure: {
      zh: "高：后期读出和监管里程碑决定现有产品集中度能否被新资产分散。",
      en: "High: late-stage readouts and regulatory milestones determine whether new assets can diversify current product concentration.",
    },
    investmentImplication: {
      zh: "公开输入不足以支持候选药级 rNPV；本报告仅监测阶段和里程碑。",
      en: "Public inputs do not support candidate-level rNPV; this report monitors stages and milestones only.",
    },
  },
  {
    driverId: "pharma-manufacturing",
    title: "Lilly commits an additional $4.5 billion across Indiana manufacturing sites",
    publisher: "Eli Lilly and Company",
    date: "2026-05-06",
    url: "https://investor.lilly.com/news-releases/news-release-details/lilly-commits-additional-45-billion-across-indiana-manufacturing",
    evidence: {
      zh: "Lilly 宣布再向印第安纳制造基地投入 45 亿美元，使 2020 年以来美国制造承诺超过 210 亿美元。",
      en: "Lilly announced another US$4.5 billion for Indiana manufacturing, taking U.S. manufacturing commitments since 2020 above US$21 billion.",
    },
    companyExposure: {
      zh: "高：API 与制剂产能决定高需求能否转化为可交付收入。",
      en: "High: API and finished-dose capacity determine whether demand converts into deliverable revenue.",
    },
    investmentImplication: {
      zh: "投资承诺不是当前可用产能；用现金资本开支、交付与毛利率检验扩产回报。",
      en: "Committed investment is not current capacity; test the buildout through cash capex, deliveries, and gross margin.",
    },
  },
  {
    driverId: "pharma-pricing-access",
    title: "Lilly Q1 2026 Earnings Release",
    publisher: "Eli Lilly and Company",
    date: "2026-04-30",
    url: LLY_Q1_RELEASE_URL,
    evidence: {
      zh: "Q1 收入增长由销量推动，但实现价格下降 13%，显示准入扩张与净价格存在权衡。",
      en: "Q1 growth was volume-led while realized price fell 13%, demonstrating the trade-off between access expansion and net price.",
    },
    companyExposure: {
      zh: "高：商业保险、Medicare、现金支付和国际定价共同决定净收入。",
      en: "High: commercial insurance, Medicare, cash-pay channels, and international pricing jointly determine net revenue.",
    },
    investmentImplication: {
      zh: "扩大准入只有在销量与毛利足以抵消价格下降时才增值。",
      en: "Broader access creates value only when volume and gross profit offset lower realized price.",
    },
  },
  {
    driverId: "pharma-patent-cycle",
    title: "Eli Lilly and Company 2025 Form 10-K",
    publisher: "Eli Lilly and Company",
    date: "2026-02-12",
    url: LLY_10K_URL,
    evidence: {
      zh: "发行人估计 Mounjaro/Zepbound 美国化合物专利 2036 年到期，Trulicity 2027 年、Verzenio 2031 年。",
      en: "Issuer-estimated U.S. compound-patent expiries are 2036 for Mounjaro/Zepbound, 2027 for Trulicity, and 2031 for Verzenio.",
    },
    companyExposure: {
      zh: "中高：近期成熟产品侵蚀与远期替尔泊肽集中度需要分别建模。",
      en: "Medium-high: near-term mature-product erosion and longer-dated tirzepatide concentration require separate treatment.",
    },
    investmentImplication: {
      zh: "产品级收入和到期时间决定替代管线需要填补的现金流缺口。",
      en: "Product revenue and expiry timing define the cash-flow gap the replacement pipeline must fill.",
    },
  },
  {
    driverId: "pharma-rd-productivity",
    title: "Lilly Q1 2026 Earnings Release",
    publisher: "Eli Lilly and Company",
    date: "2026-04-30",
    url: LLY_Q1_RELEASE_URL,
    evidence: {
      zh: "Q1 2026 研发支出为 35.10 亿美元；FY2025 研发支出为 133.37 亿美元。",
      en: "Q1 2026 R&D expense was US$3.510 billion, versus US$13.337 billion for FY2025.",
    },
    companyExposure: {
      zh: "高：研发规模只有在读出、批准和商业回报中兑现才创造价值。",
      en: "High: R&D scale creates value only when it converts into readouts, approvals, and commercial returns.",
    },
    investmentImplication: {
      zh: "把研发支出与资产阶段、关键终点和批准逐项核对，避免用项目数量替代生产率。",
      en: "Reconcile R&D spending to asset stage, endpoints, and approvals rather than using candidate count as a productivity proxy.",
    },
  },
  {
    driverId: "pharma-oncology",
    title: "Eli Lilly and Company 2025 Form 10-K",
    publisher: "Eli Lilly and Company",
    date: "2026-02-12",
    url: LLY_10K_URL,
    evidence: {
      zh: "FY2025 Verzenio 收入 57.23 亿美元、同比增长 8%；Inluriyo 已获批用于特定晚期乳腺癌。",
      en: "FY2025 Verzenio revenue was US$5.723 billion, up 8%, and Inluriyo is approved for a defined advanced breast-cancer setting.",
    },
    companyExposure: {
      zh: "中高：Verzenio 是主要非肠促胰素产品，生命周期与后续资产影响组合多元化。",
      en: "Medium-high: Verzenio is a major non-incretin product, and its lifecycle plus successor assets affect diversification.",
    },
    investmentImplication: {
      zh: "肿瘤业务能否保持增长是降低替尔泊肽集中度的重要检验。",
      en: "Durable oncology growth is an important test of whether Lilly can reduce tirzepatide concentration.",
    },
  },
  {
    driverId: "pharma-alzheimers",
    title: "Lilly Q1 2026 Earnings Release",
    publisher: "Eli Lilly and Company",
    date: "2026-04-30",
    url: LLY_Q1_RELEASE_URL,
    evidence: {
      zh: "Q1 2026 Kisunla 收入 1.24 亿美元，上年同期为 0.22 亿美元。",
      en: "Q1 2026 Kisunla revenue was US$124 million, versus US$22 million a year earlier.",
    },
    companyExposure: {
      zh: "中：早期商业化受诊断、输注、监测、安全性和支付基础设施约束。",
      en: "Medium: early commercialization depends on diagnostic, infusion, monitoring, safety, and payment infrastructure.",
    },
    investmentImplication: {
      zh: "收入爬坡必须与患者启动、基础设施和后续 remternetug 数据共同评估。",
      en: "The revenue ramp must be evaluated with patient starts, infrastructure, and later remternetug data.",
    },
  },
  {
    driverId: "pharma-regulatory",
    title: "FDA approves Lilly's Foundayo",
    publisher: "Eli Lilly and Company",
    date: "2026-04-01",
    url: "https://investor.lilly.com/news-releases/news-release-details/fda-approves-lillys-foundayotm-orforglipron-only-glp-1-pill",
    evidence: {
      zh: "FDA 于 2026-04-01 批准 Foundayo（orforglipron）用于肥胖。",
      en: "The FDA approved Foundayo (orforglipron) for obesity on 2026-04-01.",
    },
    companyExposure: {
      zh: "高：批准扩大 Lilly 的口服肠促胰素组合，但上市执行和标签仍决定经济性。",
      en: "High: approval broadens Lilly's oral incretin portfolio, but launch execution and label determine economics.",
    },
    investmentImplication: {
      zh: "将批准事实与商业放量分开；不把监管成功自动转换为峰值销售。",
      en: "Keep approval separate from commercial uptake; regulatory success is not automatically a peak-sales estimate.",
    },
  },
  {
    driverId: "pharma-earnings-valuation",
    title: "Eli Lilly and Company 2025 Form 10-K",
    publisher: "Eli Lilly and Company",
    date: "2026-02-12",
    url: LLY_10K_URL,
    evidence: {
      zh: "FY2025 营收 651.79 亿美元、净利润 206.40 亿美元、经营现金流 168.13 亿美元、现金资本开支 78.41 亿美元。",
      en: "FY2025 revenue was US$65.179 billion, net income US$20.640 billion, operating cash flow US$16.813 billion, and cash capex US$7.841 billion.",
    },
    companyExposure: {
      zh: "高：增长、现金转化、资本密集度与产品集中共同决定估值可持续性。",
      en: "High: growth, cash conversion, capital intensity, and product concentration jointly determine valuation durability.",
    },
    investmentImplication: {
      zh: "估值必须从企业价值扣除净债务并除以稀释股数，同时以带日期的市场值作交叉检查。",
      en: "Valuation must bridge enterprise value through net debt and diluted shares, with a dated market-value cross-check.",
    },
  },
];

function selectedCanonicalMetrics(
  registry: MetricRegistry,
  companyId: string,
  latest: FinancialPeriod,
  metricIds: string[],
) {
  const selected: CanonicalMetricObject[] = [];
  for (const metricId of metricIds) {
    const field = PERIOD_FIELD_BY_METRIC_ID[metricId];
    const exactKey = field ? latest.metricKeys[field] : undefined;
    const exact = exactKey ? registry.getByKey(exactKey) : null;
    const candidates = exact
      ? [exact]
      : registry.findMetrics({
          company_id: companyId,
          metric_id: metricId,
          period_end: latest.periodEnd,
        }).filter((metric) => metric.value !== null && ["Reported", "Derived"].includes(metric.status));
    const chosen = candidates.sort((left, right) =>
      right.confidence - left.confidence ||
      left.definition_id.localeCompare(right.definition_id)
    )[0];
    if (chosen && !selected.some((metric) => metric.canonical_key === chosen.canonical_key)) {
      selected.push(chosen);
    }
  }
  return selected;
}

function buildDriverExposure(
  pack: SectorPack,
  locale: ResearchLocale,
  registry: MetricRegistry,
  companyId: string,
  latest: FinancialPeriod,
): { rows: SectorDriverExposure[]; omittedDrivers: string[] } {
  const templates =
    companyId === "NVDA"
      ? NVDA_EXPOSURE_TEMPLATES
      : companyId === "JPM"
        ? JPM_EXPOSURE_TEMPLATES
        : companyId === "LLY"
          ? LLY_EXPOSURE_TEMPLATES
        : [];
  const rows = pack.marketDrivers.flatMap((driver) => {
    const template = templates.find((item) => item.driverId === driver.id);
    if (!template) return [];
    const canonicalMetrics = selectedCanonicalMetrics(
      registry,
      companyId,
      latest,
      DRIVER_METRIC_IDS[driver.id] ?? [],
    );
    return {
      driver: driver.name[locale],
      companyExposure: template.companyExposure[locale],
      evidence: template.evidence[locale],
      evidenceTitle: template.title,
      evidencePublisher: template.publisher,
      evidenceDate: template.date,
      evidenceUrl: template.url,
      investmentImplication: template.investmentImplication[locale],
      metricReferences: canonicalMetrics.map((metric) => metric.canonical_key),
    };
  });
  return {
    rows,
    omittedDrivers: pack.marketDrivers
      .filter((driver) => !rows.some((row) => row.driver === driver.name[locale]))
      .map((driver) => driver.name[locale]),
  };
}

function buildNarrative(
  companyName: string,
  periods: FinancialPeriod[],
  currency: string,
  pack: SectorPack,
  outlook: Awaited<ReturnType<typeof getSectorOutlook>>,
  locale: ResearchLocale,
  registry: MetricRegistry,
  companyId: string,
) {
  const latest = periods.at(-1)!;
  const revenueCagr = latest.revenueCagr;
  const marginDelta = latest.netMarginChange;
  const liabilityRatio = latest.liabilitiesAssets;
  const cashConversion = latest.cashConversion;
  const biopharmaMetrics = pack.id === "biopharma"
    ? selectedCanonicalMetrics(
        registry,
        companyId,
        latest,
        [
          "product-revenue",
          "product-concentration",
          "research-and-development",
          "patent-expiry-year",
        ],
      )
    : [];
  const biopharmaMetric = (metricId: string) =>
    biopharmaMetrics.find((metric) => metric.metric_id === metricId) ?? null;
  const largestProductRevenue = biopharmaMetric("product-revenue");
  const productConcentration = biopharmaMetric("product-concentration");
  const researchAndDevelopment = biopharmaMetric("research-and-development");
  const patentExpiry = biopharmaMetric("patent-expiry-year");
  const industrialMetrics = pack.id === "industrial-machinery"
    ? selectedCanonicalMetrics(
        registry,
        companyId,
        latest,
        [
          "backlog",
          "near-term-backlog-share",
          "price-cost-impact",
          "segment-margin",
          "working-capital",
          "cash-conversion",
        ],
      )
    : [];
  const industrialMetric = (metricId: string) =>
    industrialMetrics.find((metric) => metric.metric_id === metricId) ?? null;
  const backlog = industrialMetric("backlog");
  const nearTermBacklogShare = industrialMetric("near-term-backlog-share");
  const priceCostImpact = industrialMetric("price-cost-impact");
  const segmentMargin = industrialMetric("segment-margin");
  const workingCapital = industrialMetric("working-capital");
  const bankMetrics = pack.id === "banks"
    ? selectedCanonicalMetrics(
        registry,
        companyId,
        latest,
        [
          "net-interest-income",
          "net-interest-margin",
          "deposits",
          "deposit-cost",
          "net-charge-offs",
          "allowance-coverage",
          "cet1-ratio",
          "liquidity-coverage-ratio",
          "efficiency-ratio",
          "return-on-tangible-common-equity",
          "tangible-book-value-per-share",
          "investment-banking-fees",
          "trading-revenue",
        ],
      )
    : [];
  const bankMetric = (metricId: string) =>
    bankMetrics.find((metric) => metric.metric_id === metricId) ?? null;
  const bankNetInterestIncome = bankMetric("net-interest-income");
  const bankNetYield = bankMetric("net-interest-margin");
  const bankDeposits = bankMetric("deposits");
  const bankDepositCost = bankMetric("deposit-cost");
  const bankNetChargeOffs = bankMetric("net-charge-offs");
  const bankAllowanceCoverage = bankMetric("allowance-coverage");
  const bankCet1 = bankMetric("cet1-ratio");
  const bankLiquidity = bankMetric("liquidity-coverage-ratio");
  const bankEfficiency = bankMetric("efficiency-ratio");
  const bankRotce = bankMetric("return-on-tangible-common-equity");
  const bankTbvps = bankMetric("tangible-book-value-per-share");
  const bankInvestmentBankingFees = bankMetric("investment-banking-fees");
  const bankTradingRevenue = bankMetric("trading-revenue");
  const primaryNetDebtMetric = latest.metricKeys.netDebt
    ? registry.getByKey(latest.metricKeys.netDebt)
    : null;
  const primarySectorMetric =
    pack.id === "semiconductors"
      ? {
          label: locale === "zh" ? "毛利率" : "Gross margin",
          value: percentage(latest.grossMargin, locale),
          detail:
            locale === "zh"
              ? "毛利率 = 毛利润 ÷ 营收；产品组合与供给成本的重要信号。"
              : "Gross margin = gross profit / revenue; a key signal for product mix and supply cost.",
          metricKey: latest.metricKeys.grossMargin ?? "",
          classification: "Derived calculation" as const,
        }
      : pack.id === "banks"
        ? {
            label: locale === "zh" ? "有形账面价值" : "Tangible book value",
            value: compactMoney(latest.tangibleBookValue, currency, locale),
            detail:
              locale === "zh"
                ? "股东权益减商誉和有限寿命无形资产；P/TBV 情景的规范起点。"
                : "Stockholders' equity less goodwill and finite-lived intangibles; the canonical P/TBV starting point.",
            metricKey: latest.metricKeys.tangibleBookValue ?? "",
            classification: "Derived calculation" as const,
          }
      : pack.id === "biopharma"
        ? {
            label: locale === "zh" ? "主要产品集中度" : "Major-product concentration",
            value: productConcentration
              ? formatMetricForDisplay(productConcentration, locale)
              : "—",
            detail:
              locale === "zh"
                ? "发行人披露的 Mounjaro 与 Zepbound 合计占总营收比例；用于衡量产品集中风险。"
                : "Issuer-reported combined share of revenue from Mounjaro and Zepbound; a measure of product-concentration risk.",
            metricKey: productConcentration?.canonical_key ?? "",
            classification: "Reported fact" as const,
          }
      : pack.id === "industrial-machinery"
        ? {
            label: locale === "zh" ? "确定积压订单" : "Firm order backlog",
            value: backlog ? formatMetricForDisplay(backlog, locale) : "—",
            detail:
              locale === "zh"
                ? "发行人认定为确定且尚未履约的订单；积压不是已确认营收。"
                : "Orders the issuer believes to be firm and unfulfilled; backlog is not recognized revenue.",
            metricKey: backlog?.canonical_key ?? "",
            classification: "Reported fact" as const,
          }
      : {
          label: locale === "zh" ? "净债务" : "Net debt",
          value: compactMoney(latest.netDebt, currency, locale),
          detail:
            primaryNetDebtMetric?.definition_id ===
            FINANCIAL_DEFINITION_IDS.issuerNetDebt
              ? locale === "zh"
                ? "发行人报告口径；包括债务对冲衍生品及相关抵押品调整，用于衡量下行周期韧性。"
                : "Issuer-reported definition including debt-hedging derivative and associated-collateral adjustments; a measure of downside-cycle resilience."
              : locale === "zh"
                ? "标准化净债务 = 总债务 - 现金；衡量周期下行韧性。"
                : "Normalized net debt = total debt - cash; a measure of downside-cycle resilience.",
          metricKey: latest.metricKeys.netDebt ?? "",
          classification:
            primaryNetDebtMetric?.status === "Reported"
              ? "Reported fact" as const
              : "Derived calculation" as const,
        };
  const fcfValue =
    latest.freeCashFlowProxy === null
      ? "—"
      : compactMoney(latest.freeCashFlowProxy, currency, locale);
  const inlineFcfValue = fcfValue.replace(/[。.]+$/, "");
  const dashboard: DashboardMetric[] = [
    {
      label: locale === "zh" ? "最新营收" : "Latest revenue",
      value: compactMoney(latest.revenue, currency, locale),
      detail:
        locale === "zh"
          ? `同比 ${percentage(latest.revenueGrowth, locale)}；多期 CAGR ${percentage(revenueCagr, locale)}`
          : `YoY ${percentage(latest.revenueGrowth, locale)}; multi-period CAGR ${percentage(revenueCagr, locale)}`,
      classification: "Reported fact",
      tone: latest.revenueGrowth === null ? "neutral" : latest.revenueGrowth >= 0 ? "positive" : "watch",
      metricKey: latest.metricKeys.revenue ?? "",
    },
    {
      label: locale === "zh" ? "净利润率" : "Net margin",
      value: percentage(latest.netMargin, locale),
      detail:
        locale === "zh"
          ? `较上年 ${marginDelta === null ? COPY.zh.dataUnavailable : `${(marginDelta * 100).toFixed(1)}个百分点`}`
          : `YoY change ${marginDelta === null ? COPY.en.dataUnavailable : `${(marginDelta * 100).toFixed(1)}ppt`}`,
      classification: "Derived calculation",
      tone: marginDelta === null ? "neutral" : marginDelta >= 0 ? "positive" : "watch",
      metricKey: latest.metricKeys.netMargin ?? "",
    },
    {
      label: locale === "zh" ? "自由现金流" : "Free cash flow",
      value: fcfValue,
      detail:
        locale === "zh"
          ? "FCF = 经营现金流 - 现金资本开支；资本开支缺失时不计算。"
          : "FCF = operating cash flow - cash capital expenditure; no value is calculated when capex is unavailable.",
      classification: "Derived calculation",
      tone: latest.freeCashFlowProxy === null ? "neutral" : latest.freeCashFlowProxy > 0 ? "positive" : "watch",
      metricKey: latest.metricKeys.freeCashFlowProxy ?? "",
    },
    {
      label: primarySectorMetric.label,
      value: primarySectorMetric.value,
      detail: primarySectorMetric.detail,
      classification: primarySectorMetric.classification,
      tone: "neutral",
      metricKey: primarySectorMetric.metricKey,
    },
    {
      label: locale === "zh" ? "负债 / 资产" : "Liabilities / assets",
      value: percentage(liabilityRatio, locale),
      detail:
        locale === "zh"
          ? `流动比率 ${latest.currentRatio === null ? COPY.zh.dataUnavailable : `${latest.currentRatio.toFixed(2)}x`}`
          : `Current ratio ${latest.currentRatio === null ? COPY.en.dataUnavailable : `${latest.currentRatio.toFixed(2)}x`}`,
      classification: "Derived calculation",
      tone: liabilityRatio === null ? "neutral" : liabilityRatio <= 0.65 ? "positive" : "watch",
      metricKey: latest.metricKeys.liabilitiesAssets ?? "",
    },
  ];
  const bankDashboard: DashboardMetric[] = [
    {
      label: locale === "zh" ? "净利息收入" : "Net interest income",
      value: bankNetInterestIncome ? formatMetricForDisplay(bankNetInterestIncome, locale) : "—",
      detail:
        locale === "zh"
          ? `公司净收益率 ${bankNetYield ? formatMetricForDisplay(bankNetYield, locale) : "—"}；需结合资产收益率与存款重定价。`
          : `Firmwide net yield ${bankNetYield ? formatMetricForDisplay(bankNetYield, locale) : "—"}; assess with asset yields and deposit repricing.`,
      classification: "Reported fact",
      tone: "neutral",
      metricKey: bankNetInterestIncome?.canonical_key ?? "",
    },
    {
      label: locale === "zh" ? "存款与存款成本" : "Deposits and deposit cost",
      value: bankDeposits ? formatMetricForDisplay(bankDeposits, locale) : "—",
      detail:
        locale === "zh"
          ? `总存款平均利率 ${bankDepositCost ? formatMetricForDisplay(bankDepositCost, locale) : "—"}；规模与价格必须共同验证。`
          : `Average rate on total deposits ${bankDepositCost ? formatMetricForDisplay(bankDepositCost, locale) : "—"}; volume and pricing must be tested together.`,
      classification: "Reported fact",
      tone: "neutral",
      metricKey: bankDeposits?.canonical_key ?? "",
    },
    {
      label: locale === "zh" ? "标准化 CET1" : "Standardized CET1",
      value: bankCet1 ? formatMetricForDisplay(bankCet1, locale) : "—",
      detail:
        locale === "zh"
          ? "普通股一级资本相对风险加权资产；资本分配的核心约束。"
          : "Common equity tier 1 capital relative to risk-weighted assets; a core constraint on distributions.",
      classification: "Reported fact",
      tone: "neutral",
      metricKey: bankCet1?.canonical_key ?? "",
    },
    {
      label: locale === "zh" ? "有形普通股回报率" : "Return on tangible common equity",
      value: bankRotce ? formatMetricForDisplay(bankRotce, locale) : "—",
      detail:
        locale === "zh"
          ? `FY2025 发行人报告口径；每股有形账面价值 ${bankTbvps ? formatMetricForDisplay(bankTbvps, locale) : "—"}。`
          : `Issuer-reported FY2025 measure; tangible book value per share was ${bankTbvps ? formatMetricForDisplay(bankTbvps, locale) : "—"}.`,
      classification: "Reported fact",
      tone: "positive",
      metricKey: bankRotce?.canonical_key ?? "",
    },
    {
      label: locale === "zh" ? "资本市场收入" : "Capital-markets revenue",
      value: bankTradingRevenue ? formatMetricForDisplay(bankTradingRevenue, locale) : "—",
      detail:
        locale === "zh"
          ? `FY2025 Markets 收入；同期投行费 ${bankInvestmentBankingFees ? formatMetricForDisplay(bankInvestmentBankingFees, locale) : "—"}。`
          : `FY2025 Markets revenue; investment-banking fees were ${bankInvestmentBankingFees ? formatMetricForDisplay(bankInvestmentBankingFees, locale) : "—"}.`,
      classification: "Reported fact",
      tone: "positive",
      metricKey: bankTradingRevenue?.canonical_key ?? "",
    },
  ];
  const visibleDashboard = pack.id === "banks"
    ? bankDashboard.filter((metric) => metric.metricKey && metric.value !== "—")
    : dashboard.filter((_, index) => [
    latest.revenue !== null,
    latest.netMargin !== null,
    latest.freeCashFlowProxy !== null,
    pack.id === "semiconductors"
      ? latest.grossMargin !== null
      : pack.id === "banks"
        ? latest.tangibleBookValue !== null
        : pack.id === "biopharma"
          ? productConcentration !== null
          : pack.id === "industrial-machinery"
            ? backlog !== null
            : latest.netDebt !== null,
    liabilityRatio !== null,
  ][index]);

  const earningsQuality =
    pack.id === "industrial-machinery"
      ? locale === "zh"
        ? [
            `${companyName} 年末确定积压订单为 ${backlog ? formatMetricForDisplay(backlog, locale) : "—"}，其中预计一年内履约占比为 ${nearTermBacklogShare ? formatMetricForDisplay(nearTermBacklogShare, locale) : "—"}；这是交付义务，不是完工率或已确认收入。`,
            `全年价格与制造成本合计利润影响为 ${priceCostImpact ? formatMetricForDisplay(priceCostImpact, locale) : "—"}，Power & Energy 分部利润率为 ${segmentMargin ? formatMetricForDisplay(segmentMargin, locale) : "—"}；收入增长只有在价格、成本与组合桥接后才代表盈利改善。`,
            `严格 FCF 为 ${compactMoney(latest.freeCashFlowProxy, currency, locale)}，FCF / 净利润为 ${cashConversion === null ? "—" : percentage(cashConversion, locale)}，期末营运资本为 ${workingCapital ? formatMetricForDisplay(workingCapital, locale) : "—"}。`,
            `库存为 ${compactMoney(latest.inventory, currency, locale)}、现金资本开支为 ${compactMoney(latest.cashCapex, currency, locale)}；积压必须与库存、产能、供应链和实际现金转化交叉验证。`,
          ]
        : [
            `${companyName}'s firm year-end backlog was ${backlog ? formatMetricForDisplay(backlog, locale) : "—"}, with ${nearTermBacklogShare ? formatMetricForDisplay(nearTermBacklogShare, locale) : "—"} expected within one year; this is a delivery obligation, not a completion rate or recognized revenue.`,
            `The full-year price and manufacturing-cost profit impact was ${priceCostImpact ? formatMetricForDisplay(priceCostImpact, locale) : "—"}, while Power & Energy segment profit margin was ${segmentMargin ? formatMetricForDisplay(segmentMargin, locale) : "—"}; growth indicates earnings improvement only after price, cost, and mix are bridged.`,
            `Strict FCF was ${compactMoney(latest.freeCashFlowProxy, currency, locale)}, FCF / net income was ${cashConversion === null ? "—" : percentage(cashConversion, locale)}, and period-end working capital was ${workingCapital ? formatMetricForDisplay(workingCapital, locale) : "—"}.`,
            `Inventory was ${compactMoney(latest.inventory, currency, locale)} and cash capex was ${compactMoney(latest.cashCapex, currency, locale)}; backlog must be cross-checked against inventory, capacity, supply chain, and realized cash conversion.`,
          ]
      : pack.id === "biopharma"
      ? locale === "zh"
        ? [
            `${companyName} 最新年度营收为 ${compactMoney(latest.revenue, currency, locale)}，其中最大产品收入为 ${largestProductRevenue ? formatMetricForDisplay(largestProductRevenue, locale) : "—"}。`,
            `Mounjaro 与 Zepbound 合计占总营收 ${productConcentration ? formatMetricForDisplay(productConcentration, locale) : "—"}；产品集中放大供应、价格、安全和竞争风险。`,
            `研发支出为 ${researchAndDevelopment ? formatMetricForDisplay(researchAndDevelopment, locale) : "—"}，毛利率为 ${percentage(latest.grossMargin, locale)}；研发支出与临床阶段、里程碑和批准必须分别核对。`,
            `Mounjaro / Zepbound 美国化合物专利预计到期年份为 ${patentExpiry ? formatMetricForDisplay(patentExpiry, locale) : "—"}；公开输入不足以支持候选药级 rNPV，因此不计算风险调整管线价值。`,
          ]
        : [
            `${companyName}'s latest annual revenue was ${compactMoney(latest.revenue, currency, locale)}, including largest-product revenue of ${largestProductRevenue ? formatMetricForDisplay(largestProductRevenue, locale) : "—"}.`,
            `Mounjaro and Zepbound represented ${productConcentration ? formatMetricForDisplay(productConcentration, locale) : "—"} of total revenue; concentration magnifies supply, pricing, safety, and competition risk.`,
            `R&D expense was ${researchAndDevelopment ? formatMetricForDisplay(researchAndDevelopment, locale) : "—"} and gross margin was ${percentage(latest.grossMargin, locale)}; R&D spending must be reconciled separately to stages, milestones, and approvals.`,
            `The issuer-estimated U.S. compound-patent expiry year for Mounjaro / Zepbound was ${patentExpiry ? formatMetricForDisplay(patentExpiry, locale) : "—"}; public inputs are insufficient for candidate-level rNPV, so no risk-adjusted pipeline value is calculated.`,
          ]
      : pack.id === "banks"
      ? locale === "zh"
        ? [
            `${companyName} FY2025 净利息收入为 ${bankNetInterestIncome ? formatMetricForDisplay(bankNetInterestIncome, locale) : "—"}，公司净收益率为 ${bankNetYield ? formatMetricForDisplay(bankNetYield, locale) : "—"}，总存款平均利率为 ${bankDepositCost ? formatMetricForDisplay(bankDepositCost, locale) : "—"}；利差质量必须与存款定价共同判断。`,
            `信用损失拨备为 ${compactMoney(latest.creditLossProvision, currency, locale)}、净核销为 ${bankNetChargeOffs ? formatMetricForDisplay(bankNetChargeOffs, locale) : "—"}、准备金覆盖为 ${bankAllowanceCoverage ? formatMetricForDisplay(bankAllowanceCoverage, locale) : "—"}；拨备与核销的差额会改变准备金缓冲。`,
            `效率比率为 ${bankEfficiency ? formatMetricForDisplay(bankEfficiency, locale) : "—"}，发行人报告 ROTCE 为 ${bankRotce ? formatMetricForDisplay(bankRotce, locale) : "—"}；ROTCE 是非 GAAP 指标，保留发行人口径。`,
            `标准化 CET1 为 ${bankCet1 ? formatMetricForDisplay(bankCet1, locale) : "—"}、平均 LCR 为 ${bankLiquidity ? formatMetricForDisplay(bankLiquidity, locale) : "—"}，现金股息与普通股回购分别为 ${compactMoney(latest.dividends, currency, locale)} 和 ${compactMoney(latest.shareBuybacks, currency, locale)}；资本回报必须服从压力资本与流动性约束。`,
          ]
        : [
            `${companyName}'s FY2025 net interest income was ${bankNetInterestIncome ? formatMetricForDisplay(bankNetInterestIncome, locale) : "—"}, firmwide net yield was ${bankNetYield ? formatMetricForDisplay(bankNetYield, locale) : "—"}, and the average rate on total deposits was ${bankDepositCost ? formatMetricForDisplay(bankDepositCost, locale) : "—"}; spread quality must be assessed with deposit pricing.`,
            `Credit-loss provision was ${compactMoney(latest.creditLossProvision, currency, locale)}, net charge-offs were ${bankNetChargeOffs ? formatMetricForDisplay(bankNetChargeOffs, locale) : "—"}, and allowance coverage was ${bankAllowanceCoverage ? formatMetricForDisplay(bankAllowanceCoverage, locale) : "—"}; the provision-versus-charge-off gap changes the reserve cushion.`,
            `The efficiency ratio was ${bankEfficiency ? formatMetricForDisplay(bankEfficiency, locale) : "—"} and issuer-reported ROTCE was ${bankRotce ? formatMetricForDisplay(bankRotce, locale) : "—"}; ROTCE is a non-GAAP measure whose issuer definition is preserved.`,
            `Standardized CET1 was ${bankCet1 ? formatMetricForDisplay(bankCet1, locale) : "—"}, average LCR was ${bankLiquidity ? formatMetricForDisplay(bankLiquidity, locale) : "—"}, and cash dividends and common-share buybacks were ${compactMoney(latest.dividends, currency, locale)} and ${compactMoney(latest.shareBuybacks, currency, locale)}, respectively; distributions remain constrained by stress capital and liquidity.`,
          ]
      : locale === "zh"
      ? [
          `${companyName} 最新年度净利润为 ${compactMoney(latest.netIncome, currency, locale)}，经营现金流为 ${compactMoney(latest.operatingCashFlow, currency, locale)}。`,
          latest.freeCashFlowProxy === null
            ? COPY.zh.unableFcf
            : `FCF = 经营现金流 - 现金资本开支 = ${compactMoney(latest.freeCashFlowProxy, currency, locale)}；FCF / 净利润为 ${cashConversion === null ? COPY.zh.dataUnavailable : `${cashConversion.toFixed(2)}x`}。`,
          pack.id === "semiconductors"
            ? `毛利率 ${percentage(latest.grossMargin, locale)}，库存 ${compactMoney(latest.inventory, currency, locale)}；需结合产品换代和供给承诺判断周期质量。`
            : pack.id === "integrated-oil-gas"
              ? `现金资本开支 ${compactMoney(latest.cashCapex, currency, locale)}，净债务 ${compactMoney(latest.netDebt, currency, locale)}；需结合商品价格与分配政策判断覆盖。`
              : `现金资本开支 ${compactMoney(latest.cashCapex, currency, locale)}，净债务 ${compactMoney(latest.netDebt, currency, locale)}；需结合经营韧性与资本配置判断覆盖。`,
          "标准化 XBRL 不足以识别所有重组、减值、一次性项目或管理层调整项，需回到年报附注复核。",
        ]
      : [
          `${companyName}'s latest annual net income was ${compactMoney(latest.netIncome, currency, locale)}, versus operating cash flow of ${compactMoney(latest.operatingCashFlow, currency, locale)}.`,
          latest.freeCashFlowProxy === null
            ? COPY.en.unableFcf
            : `FCF = operating cash flow - cash capital expenditure = ${compactMoney(latest.freeCashFlowProxy, currency, locale)}; FCF / net income was ${cashConversion === null ? COPY.en.dataUnavailable : `${cashConversion.toFixed(2)}x`}.`,
          pack.id === "semiconductors"
            ? `Gross margin was ${percentage(latest.grossMargin, locale)} and inventory was ${compactMoney(latest.inventory, currency, locale)}; assess both with product transitions and supply commitments.`
            : pack.id === "integrated-oil-gas"
              ? `Cash capex was ${compactMoney(latest.cashCapex, currency, locale)} and net debt was ${compactMoney(latest.netDebt, currency, locale)}; assess coverage with commodity prices and distribution policy.`
              : `Cash capex was ${compactMoney(latest.cashCapex, currency, locale)} and net debt was ${compactMoney(latest.netDebt, currency, locale)}; assess coverage with operating resilience and capital allocation.`,
          "Standardized XBRL cannot identify every restructuring, impairment, one-off, or management adjustment; verify them in the annual-filing notes.",
        ];

  const thesis: ThesisPoint[] = pack.marketDrivers.slice(0, 4).map((driver, index) => {
    const claim =
      matchingClaim(driver.query, outlook) ??
      outlook.claims[index % Math.max(outlook.claims.length, 1)];
    const metricReferences = selectedCanonicalMetrics(
      registry,
      companyId,
      latest,
      [
        ...(DRIVER_METRIC_IDS[driver.id] ?? []),
        ...(pack.id === "banks" ? [] : ["revenue-growth", "fcf"]),
      ],
    ).map((metric) => metric.canonical_key);
    return {
      title: driver.name[locale],
      view:
        pack.id === "banks"
          ? locale === "zh"
            ? `${companyName} 的公司专属敞口已在“公司敞口”中按最新 2Q26 补充材料验证。FY2025 净利息收入为 ${bankNetInterestIncome ? formatMetricForDisplay(bankNetInterestIncome, locale) : "—"}、ROTCE 为 ${bankRotce ? formatMetricForDisplay(bankRotce, locale) : "—"}。行业证据：${claim?.publisher ?? COPY.zh.dataUnavailable} · ${claim?.publicationDate ?? COPY.zh.dataUnavailable}。`
            : `${companyName}'s company-specific exposure is verified in Company Exposure using the latest 2Q26 supplement. FY2025 net interest income was ${bankNetInterestIncome ? formatMetricForDisplay(bankNetInterestIncome, locale) : "—"} and ROTCE was ${bankRotce ? formatMetricForDisplay(bankRotce, locale) : "—"}. Sector evidence: ${claim?.publisher ?? COPY.en.dataUnavailable} · ${claim?.publicationDate ?? COPY.en.dataUnavailable}.`
        : locale === "zh"
          ? `${companyName} 的相关敞口是${driver.companyExposure.zh} 最新营收增长 ${percentage(latest.revenueGrowth, locale)}、FCF ${inlineFcfValue}。行业证据：${claim?.publisher ?? COPY.zh.dataUnavailable} · ${claim?.publicationDate ?? COPY.zh.dataUnavailable}。`
          : `${companyName}'s relevant exposure is ${driver.companyExposure.en} Latest revenue growth was ${percentage(latest.revenueGrowth, locale)} and FCF was ${inlineFcfValue}. Sector evidence: ${claim?.publisher ?? COPY.en.dataUnavailable} · ${claim?.publicationDate ?? COPY.en.dataUnavailable}.`,
      counterEvidence: pack.risks[index % pack.risks.length][locale],
      monitor: pack.researchQuestions[index % pack.researchQuestions.length][locale],
      metricReferences,
    };
  });

  const riskMetricReferences = selectedCanonicalMetrics(
    registry,
    companyId,
    latest,
    pack.id === "biopharma"
      ? ["product-revenue", "product-concentration", "research-and-development", "gross-margin", "patent-expiry-year", "fcf"]
      : pack.id === "industrial-machinery"
        ? ["backlog", "near-term-backlog-share", "price-cost-impact", "segment-margin", "working-capital", "cash-conversion", "fcf"]
        : pack.id === "banks"
          ? ["net-interest-income", "deposit-cost", "net-charge-offs", "allowance-coverage", "cet1-ratio", "liquidity-coverage-ratio", "efficiency-ratio", "return-on-tangible-common-equity", "dividends", "share-buybacks"]
        : ["revenue-growth", "net-margin", "fcf", "net-debt"],
  ).map((metric) => metric.canonical_key);
  const risks: RiskPoint[] = pack.risks.map((risk, index) => ({
    title: risk[locale],
    evidence:
      pack.id === "banks"
        ? locale === "zh"
          ? `${companyName} FY2025 存款成本 ${bankDepositCost ? formatMetricForDisplay(bankDepositCost, locale) : "—"}、净核销 ${bankNetChargeOffs ? formatMetricForDisplay(bankNetChargeOffs, locale) : "—"}、CET1 ${bankCet1 ? formatMetricForDisplay(bankCet1, locale) : "—"}、ROTCE ${bankRotce ? formatMetricForDisplay(bankRotce, locale) : "—"}。`
          : `${companyName}'s FY2025 deposit cost was ${bankDepositCost ? formatMetricForDisplay(bankDepositCost, locale) : "—"}, net charge-offs were ${bankNetChargeOffs ? formatMetricForDisplay(bankNetChargeOffs, locale) : "—"}, CET1 was ${bankCet1 ? formatMetricForDisplay(bankCet1, locale) : "—"}, and ROTCE was ${bankRotce ? formatMetricForDisplay(bankRotce, locale) : "—"}.`
      : locale === "zh"
        ? `${companyName} 最新营收增速 ${percentage(latest.revenueGrowth, locale)}、净利润率 ${percentage(latest.netMargin, locale)}、FCF ${inlineFcfValue}。`
        : `${companyName}'s latest revenue growth was ${percentage(latest.revenueGrowth, locale)}, net margin ${percentage(latest.netMargin, locale)}, and FCF ${inlineFcfValue}.`,
    thesisBreaker:
      locale === "zh"
        ? `若“${pack.researchQuestions[index % pack.researchQuestions.length].zh}”连续两个报告期无法得到积极验证，则该论点失效。`
        : `The thesis breaks if "${pack.researchQuestions[index % pack.researchQuestions.length].en}" cannot be positively validated for two reporting periods.`,
    metricReferences: riskMetricReferences,
  }));
  return { dashboard: visibleDashboard, earningsQuality, thesis, risks };
}

function buildDebates(
  companyName: string,
  pack: SectorPack,
  outlook: Awaited<ReturnType<typeof getSectorOutlook>>,
  locale: ResearchLocale,
  registry: MetricRegistry,
  companyId: string,
  latest: FinancialPeriod,
): InvestmentDebate[] {
  return pack.researchQuestions.slice(0, 4).map((question, index) => {
    const driver = pack.marketDrivers[index % pack.marketDrivers.length];
    const claim =
      matchingClaim(driver.query, outlook) ??
      outlook.claims[index % Math.max(outlook.claims.length, 1)];
    return {
      question: question[locale],
      evidenceFor:
        claim?.claim ??
        (locale === "zh" ? "近期行业证据不足。" : "Recent sector evidence is insufficient."),
      evidenceAgainst: pack.risks[index % pack.risks.length][locale],
      monitor: `${companyName}: ${pack.coreKpis[index % pack.coreKpis.length].label[locale]}`,
      interpretation:
        locale === "zh"
          ? `投资含义：只有当公司指标与带日期的行业证据方向一致时，才提高对该论点的信心；冲突时以公司披露和可复现计算为准。`
          : `Investor interpretation: confidence rises only when company metrics and dated sector evidence agree; conflicts are resolved in favor of issuer disclosure and reproducible calculations.`,
      metricReferences: selectedCanonicalMetrics(
        registry,
        companyId,
        latest,
        DRIVER_METRIC_IDS[driver.id] ?? [],
      ).map((metric) => metric.canonical_key),
    };
  });
}

function catalystPoints(
  items: SectorPack["catalysts"]["operating"],
  locale: ResearchLocale,
  metricReferences: string[],
): CatalystPoint[] {
  return items.map((item) => ({
    timing: locale === "zh" ? "持续监测" : "Ongoing monitor",
    event: item[locale],
    investorRelevance:
      locale === "zh"
        ? "仅在经营或财务结果改变时视为催化剂；单纯申报日期不是催化剂。"
        : "Treated as a catalyst only when operating or financial outcomes change; a filing date alone is not a catalyst.",
    metricReferences,
  }));
}

async function buildPeerComparison(
  pack: SectorPack,
  locale: ResearchLocale,
  reportRegistry: MetricRegistry,
  dataVersion: string,
  retrievedAt: string,
  diagnostics: SecRequestDiagnostic[],
): Promise<PeerComparisonItem[]> {
  const metricSpecs =
    pack.id === "banks"
      ? [
          { id: "loanGrowth", label: locale === "zh" ? "贷款增长" : "Loan growth" },
          { id: "roeProxy", label: locale === "zh" ? "期末权益回报代理" : "Period-end equity return proxy" },
          { id: "efficiencyRatio", label: locale === "zh" ? "效率比率" : "Efficiency ratio" },
        ]
      : pack.id === "biopharma"
        ? [
            { id: "revenueGrowth", label: locale === "zh" ? "营收增长" : "Revenue growth" },
            { id: "grossMargin", label: locale === "zh" ? "毛利率" : "Gross margin" },
            { id: "freeCashFlowMargin", label: locale === "zh" ? "FCF 利润率" : "FCF margin" },
          ]
      : [
          { id: "revenueGrowth", label: locale === "zh" ? "营收增长" : "Revenue growth" },
          { id: "netMargin", label: locale === "zh" ? "净利率" : "Net margin" },
          { id: "freeCashFlowMargin", label: locale === "zh" ? "FCF 利润率" : "FCF margin" },
        ];
  return Promise.all(
    pack.peers.map(async (peer) => {
      try {
        const facts = await secClient.getCompanyFacts<CompanyFacts>(
          peer.cik,
          diagnostics,
        );
        const peerRegistry = buildFinancialMetricRegistry({
          facts: facts as CompanyFactsPayload,
          companyId: peer.ticker,
          sector: pack.id,
          dataVersion,
          retrievedAt,
        });
        for (const metric of peerRegistry.values()) {
          reportRegistry.registerOrVerify(metric);
        }
        const { periods } = financialPeriodsFromRegistry(peerRegistry, peer.ticker);
        const latest = periods.at(-1);
        const metrics = metricSpecs.map((spec) => {
          const value = latest?.[spec.id as keyof FinancialPeriod];
          const canonicalKey = latest?.metricKeys[spec.id] ?? "";
          return {
            id: spec.id,
            label: spec.label,
            value: typeof value === "number" ? value : null,
            canonicalKey,
          };
        });
        return {
          ticker: peer.ticker,
          name: peer.name,
          rationale: peer.rationale[locale],
          revenueGrowth: pack.id === "banks" ? null : latest?.revenueGrowth ?? null,
          netMargin: pack.id === "banks" ? null : latest?.netMargin ?? null,
          freeCashFlowMargin: pack.id === "banks" ? null : latest?.freeCashFlowMargin ?? null,
          periodEnd: latest?.periodEnd ?? null,
          metrics,
          metricReferences: Object.fromEntries(
            metrics
              .filter((metric) => metric.canonicalKey)
              .map((metric) => [metric.id, metric.canonicalKey]),
          ),
        };
      } catch {
        return {
          ticker: peer.ticker,
          name: peer.name,
          rationale: peer.rationale[locale],
          revenueGrowth: null,
          netMargin: null,
          freeCashFlowMargin: null,
          periodEnd: null,
          metrics: metricSpecs.map((spec) => ({
            ...spec,
            value: null,
            canonicalKey: "",
          })),
          metricReferences: {},
        };
      }
    }),
  );
}

function buildMetricUsage(
  registry: MetricRegistry,
  locale: ResearchLocale,
  groups: Array<{ module: string; keys: string[] }>,
): MetricUsage[] {
  const seen = new Set<string>();
  const usage: MetricUsage[] = [];
  for (const group of groups) {
    for (const canonicalKey of group.keys.filter(Boolean)) {
      const usageKey = `${group.module}|${canonicalKey}`;
      if (seen.has(usageKey)) continue;
      seen.add(usageKey);
      const metric = registry.getByKey(canonicalKey);
      usage.push({
        module: group.module,
        canonicalKey,
        canonicalValue: metric.value,
        displayedValue:
          metric.value === null ? null : formatMetricForDisplay(metric, locale),
      });
    }
  }
  return usage;
}

function selectionFromClassification(
  classification: CompanyClassification,
  payload: ResearchPayload,
  record: TickerRecord,
): ResearchSelection {
  const pack = getSectorPack(classification.selectedPackId);
  const market: ResearchMarket =
    record.ticker === "SHEL"
      ? "Europe"
      : record.exchange && /nasdaq|nyse|amex/i.test(record.exchange)
        ? "US"
        : "Global";
  return {
    market,
    sector: pack.sector,
    subindustry: pack.id,
    options: { ...DEFAULT_OPTIONS, ...payload.options },
  };
}

function verifiedIssuerMetrics(
  ticker: string,
  latestAnnual: FilingSource | null,
): IssuerReportedMetric[] | undefined {
  if (
    ticker === "JPM" &&
    latestAnnual?.form === "10-K" &&
    latestAnnual.reportDate === "2025-12-31" &&
    latestAnnual.filed === "2026-02-13"
  ) {
    return jpmSourceSnapshot.issuerReportedMetrics as IssuerReportedMetric[];
  }
  if (
    ticker === "LLY" &&
    latestAnnual?.form === "10-K" &&
    latestAnnual.reportDate === "2025-12-31" &&
    latestAnnual.filed === "2026-02-12"
  ) {
    return llySourceSnapshot.issuerReportedMetrics as IssuerReportedMetric[];
  }
  if (
    ticker === "CAT" &&
    latestAnnual?.form === "10-K" &&
    latestAnnual.reportDate === "2025-12-31" &&
    latestAnnual.filed === "2026-02-13"
  ) {
    return catSourceSnapshot.issuerReportedMetrics as IssuerReportedMetric[];
  }
  return undefined;
}

const VERIFIED_SOURCE_SNAPSHOTS = {
  SHEL: shellSourceSnapshot,
  NVDA: nvdaSourceSnapshot,
  JPM: jpmSourceSnapshot,
  LLY: llySourceSnapshot,
  CAT: catSourceSnapshot,
} as const;

function reportSourceSnapshot(
  fixture: (typeof VERIFIED_SOURCE_SNAPSHOTS)[keyof typeof VERIFIED_SOURCE_SNAPSHOTS],
  sourceMode: ReportSourceSnapshot["sourceMode"],
): ReportSourceSnapshot {
  return {
    companyFacts: fixture.companyFacts as CompanyFactsPayload,
    submissions: fixture.submissions as unknown as Submissions,
    retrievedAt: "2026-07-17T00:00:00.000Z",
    issuerReportedMetrics:
      "issuerReportedMetrics" in fixture
        ? fixture.issuerReportedMetrics as IssuerReportedMetric[]
        : undefined,
    sourceMode,
  };
}

function isTemporaryPublicDataFailure(error: unknown) {
  return error instanceof SecClientError && error.retryable;
}

async function buildReport(
  record: TickerRecord,
  selection: ResearchSelection,
  classification: CompanyClassification,
  submissions: Submissions,
  locale: ResearchLocale,
  sourceSnapshot?: ReportSourceSnapshot,
  diagnostics: SecRequestDiagnostic[] = [],
): Promise<ResearchReport> {
  const cik = record.cik;
  const sectorOutlook = await getSectorOutlook(
    selection.market,
    selection.subindustry,
    locale,
  );
  const facts = sourceSnapshot
    ? sourceSnapshot.companyFacts
    : await secClient.getCompanyFacts<CompanyFacts>(cik, diagnostics);
  const pack = getSectorPack(selection.subindustry);

  const companyName = submissions.name || facts.entityName || record.title;
  const companyDataRetrievedAt =
    sourceSnapshot?.retrievedAt ?? new Date().toISOString();
  const latestAnnual = filingSource(submissions, ANNUAL_FORMS, COPY[locale].annualFiling);
  const latestInterim = filingSource(submissions, INTERIM_FORMS, COPY[locale].interimFiling);
  const dataVersion = [
    record.ticker,
    latestAnnual?.reportDate ?? "latest",
    latestAnnual?.filed ?? "unfiled",
    "canonical-v1",
  ].join("-");
  const metricRegistry = buildFinancialMetricRegistry({
    facts: facts as CompanyFactsPayload,
    companyId: record.ticker,
    sector: pack.id,
    dataVersion,
    retrievedAt: companyDataRetrievedAt,
    issuerReportedMetrics:
      sourceSnapshot?.issuerReportedMetrics ??
      verifiedIssuerMetrics(record.ticker, latestAnnual),
  });
  const metricAudit = await shellMetricAudit(
    record,
    facts,
    Boolean(sourceSnapshot),
    diagnostics,
  );
  if (metricAudit) {
    publishLocatorAuditToRegistry({
      registry: metricRegistry,
      audit: metricAudit,
      companyId: record.ticker,
      sector: pack.id,
      retrievedAt: companyDataRetrievedAt,
    });
    ensureCoreDerivedMetrics(metricRegistry, record.ticker);
  }
  const { periods, currency } = financialPeriodsFromRegistry(metricRegistry, record.ticker);
  if (!periods.length) {
    throw new SecClientError({
      code: "NO_STANDARDIZED_XBRL_FACTS",
      stage: "metric_normalization",
      diagnostic: `Company Facts was retrieved for ${record.ticker}, but no verified annual periods passed deterministic normalization.`,
      details: {
        latestAnnualForm: latestAnnual?.form ?? null,
        latestAnnualFiled: latestAnnual?.filed ?? null,
        filingFallbackAttempted: record.ticker === "SHEL",
      },
    });
  }
  const latest = periods.at(-1)!;
  const productMetrics = buildProductMetrics(metricRegistry, record.ticker, locale);
  const pipelineAssets = buildPipelineAssets(record.ticker, locale);
  const marketValuation = buildLlyMarketValuation(
    metricRegistry,
    record.ticker,
    companyDataRetrievedAt,
  );
  const narrative = buildNarrative(
    companyName,
    periods,
    currency,
    pack,
    sectorOutlook,
    locale,
    metricRegistry,
    record.ticker,
  );
  const scenarios = selection.options.valuation
    ? buildCanonicalScenarios({
        registry: metricRegistry,
        companyId: record.ticker,
        periods,
        pack,
        locale,
      })
    : [];
  const peerComparison = selection.options.peerComparison
      ? await buildPeerComparison(
          pack,
          locale,
          metricRegistry,
          dataVersion,
          companyDataRetrievedAt,
          diagnostics,
        )
    : [];
  const exposureBuild = buildDriverExposure(
    pack,
    locale,
    metricRegistry,
    record.ticker,
    latest,
  );
  const driverExposure = exposureBuild.rows;
  const sectorKpis = buildSectorKpis(
    pack,
    latest,
    currency,
    locale,
    metricAudit,
    metricRegistry,
    record.ticker,
  );
  const registrySnapshot = metricRegistry.snapshot();
  const packSpecificAudits: MetricExtractionAudit[] = sectorKpis.map((kpi) => ({
    metricId: kpi.id,
    definitionId: kpi.canonicalKey
      ? registrySnapshot.metrics.find(
          (metric) => metric.canonical_key === kpi.canonicalKey,
        )?.definition_id ?? null
      : null,
    tier: 3,
    applicable: true,
    status: kpi.usable
      ? kpi.status === "Derived" ? "derived" : "found"
      : "missing",
    reason: kpi.usable
      ? kpi.status === "Derived"
        ? "derived-from-components"
        : "issuer-specific-concept-match"
      : "custom-tag-not-mapped",
    searchedSources: kpi.usable
      ? kpi.status === "Derived"
        ? ["company-facts", "derived-metric-engine"]
        : ["company-facts"]
      : ["company-facts"],
    searchedConcepts: [],
    candidateConcepts: [],
    selectedCanonicalKey: kpi.canonicalKey || undefined,
    selectedSourceUrl: kpi.sourceUrl ?? undefined,
    selectedPeriod: kpi.period ?? undefined,
    selectedValue: kpi.usable ? kpi.value : undefined,
  }));
  const metricExtractionAudit = [
    ...buildMetricExtractionAudit({
      registry: registrySnapshot,
      companyId: record.ticker,
      periodEnd: latest.periodEnd,
      packId: pack.id,
      companyType: companyTypeForPack(
        pack.id,
        latestAnnual?.form === "20-F" || latestAnnual?.form === "40-F",
      ),
    }),
    ...packSpecificAudits,
  ];
  const metricCoverage = scoreMetricCoverage(metricExtractionAudit);
  const investmentDebates = selection.options.dueDiligence
    ? buildDebates(
        companyName,
        pack,
        sectorOutlook,
        locale,
        metricRegistry,
        record.ticker,
        latest,
      )
    : [];
  const filingMetricReferences = selectedCanonicalMetrics(
    metricRegistry,
    record.ticker,
    latest,
    pack.id === "banks"
      ? ["revenue", "net-interest-income", "net-interest-margin", "deposits", "deposit-cost", "loans", "loan-growth", "credit-loss-provision", "net-charge-offs", "allowance-coverage", "cet1-ratio", "liquidity-coverage-ratio", "efficiency-ratio", "return-on-tangible-common-equity", "tangible-book-value-per-share", "dividends", "share-buybacks", "investment-banking-fees", "trading-revenue"]
      : pack.id === "biopharma"
        ? ["revenue", "product-revenue", "product-concentration", "research-and-development", "gross-margin", "patent-expiry-year"]
        : pack.id === "industrial-machinery"
          ? ["revenue", "operating-income", "net-income", "operating-cash-flow", "cash-capex", "fcf", "backlog", "price-cost-impact", "segment-margin"]
          : ["revenue", "net-income", "operating-cash-flow", "fcf"],
  ).map((metric) => metric.canonical_key);
  const filingWatchlist: CatalystPoint[] = [
    ...(latestAnnual
      ? [{
          timing: latestAnnual.filed,
          event: `${latestAnnual.form} · ${latestAnnual.reportDate}`,
          investorRelevance:
            locale === "zh"
              ? "申报监测项：复核分部、会计政策、风险与资本配置；申报日期本身不是催化剂。"
              : "Filing watch item: reconcile segments, accounting policy, risks, and capital allocation; the filing date itself is not a catalyst.",
          metricReferences: filingMetricReferences,
        }]
      : []),
    ...(latestInterim
      ? [{
          timing: latestInterim.filed,
          event: `${latestInterim.form} · ${latestInterim.reportDate}`,
          investorRelevance:
            locale === "zh"
              ? "申报监测项：检查经营、流动性与指引变化；申报日期本身不是催化剂。"
              : "Filing watch item: review operating, liquidity, and guidance changes; the filing date itself is not a catalyst.",
          metricReferences: filingMetricReferences,
        }]
      : []),
  ];
  const operatingCatalystReferences = selectedCanonicalMetrics(
    metricRegistry,
    record.ticker,
    latest,
    pack.id === "integrated-oil-gas"
      ? ["production", "lng", "refining-margin", "major-projects"]
      : pack.id === "banks"
        ? ["net-interest-income", "net-interest-margin", "deposits", "deposit-cost", "loans", "loan-growth", "efficiency-ratio", "investment-banking-fees", "trading-revenue"]
      : pack.id === "biopharma"
          ? ["product-revenue", "product-concentration", "research-and-development", "gross-margin"]
          : pack.id === "industrial-machinery"
            ? ["backlog", "near-term-backlog-share", "price-cost-impact", "segment-margin", "inventory"]
            : ["revenue-growth", "gross-margin", "inventory"],
  ).map((metric) => metric.canonical_key);
  const financialCatalystReferences = selectedCanonicalMetrics(
    metricRegistry,
    record.ticker,
    latest,
    pack.id === "banks"
      ? ["credit-loss-provision", "net-charge-offs", "allowance-coverage", "cet1-ratio", "liquidity-coverage-ratio", "return-on-tangible-common-equity", "tangible-book-value-per-share", "dividends", "share-buybacks"]
      : pack.id === "biopharma"
        ? ["research-and-development", "gross-margin", "operating-cash-flow", "fcf"]
        : pack.id === "industrial-machinery"
          ? ["cash-capex", "working-capital", "fcf", "cash-conversion", "price-cost-impact"]
          : ["cash-capex", "fcf", "net-debt", "dividends", "share-buybacks"],
  ).map((metric) => metric.canonical_key);
  const regulatoryCatalystReferences = selectedCanonicalMetrics(
    metricRegistry,
    record.ticker,
    latest,
    pack.id === "integrated-oil-gas"
      ? ["major-projects", "cash-capex"]
      : pack.id === "banks"
        ? ["credit-loss-provision", "net-charge-offs", "cet1-ratio", "liquidity-coverage-ratio", "return-on-tangible-common-equity", "dividends", "share-buybacks"]
      : pack.id === "biopharma"
          ? ["product-revenue", "product-concentration", "patent-expiry-year"]
          : pack.id === "industrial-machinery"
            ? ["backlog", "near-term-backlog-share", "cash-capex", "working-capital"]
            : ["revenue", "inventory"],
  ).map((metric) => metric.canonical_key);
  const catalysts = {
    operating: catalystPoints(pack.catalysts.operating, locale, operatingCatalystReferences),
    financial: catalystPoints(pack.catalysts.financial, locale, financialCatalystReferences),
    regulatory: catalystPoints(pack.catalysts.regulatory, locale, regulatoryCatalystReferences),
  };
  const sourceBase = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
  const evidenceSources = sectorEvidenceSources(selection.market, selection.subindustry);
  const strictFcfFormula =
    locale === "zh"
      ? "自由现金流 = 经营现金流 - 现金资本开支"
      : "Free cash flow = operating cash flow - cash capital expenditure";
  const useValuationFallback =
    pack.valuation.metric === "freeCashFlow" &&
    (latest.cashCapex === null || latest.operatingCashFlow === null) &&
    pack.valuation.fallback !== undefined;
  const effectiveValuation = useValuationFallback ? pack.valuation.fallback! : pack.valuation;
  const valuationFormula =
    pack.id === "banks"
      ? locale === "zh"
        ? `${effectiveValuation.formula.zh}；模型隐含 P/E = 模型隐含股权价值 ÷ 最新年度净利润；模型隐含现金股息率 = 最新年度现金股息 ÷ 模型隐含股权价值；ROTCE 溢价 = 发行人报告 ROTCE - 10% 分析师股权成本假设。`
        : `${effectiveValuation.formula.en}; implied P/E = model-implied equity value / latest annual net income; implied cash-dividend yield = latest annual cash dividends / model-implied equity value; ROTCE spread = issuer-reported ROTCE - a 10% analyst cost-of-equity assumption.`
      : `${effectiveValuation.formula[locale]}; ${strictFcfFormula}.`;
  const displayedOutlook = selection.options.sectorOutlook
    ? sectorOutlook
    : { ...sectorOutlook, claims: [] };
  const criticalMetricIds = metricAudit
    ? ["cash-capex", "fcf", "net-debt"].filter(
        (id) => !metricAudit.results.find((result) => result.metricId === id)?.found,
      )
    : pack.id === "banks"
      ? [
          ...(latest.tangibleBookValue === null ? ["tangible-book-value"] : []),
          ...(latest.tangibleBookValuePerShare === null ? ["tangible-book-value-per-share"] : []),
          ...(latest.creditLossProvision === null ? ["credit-loss-provision"] : []),
          ...(latest.netChargeOffs === null ? ["net-charge-offs"] : []),
          ...(latest.returnOnTangibleCommonEquity === null ? ["return-on-tangible-common-equity"] : []),
        ]
      : pack.id === "biopharma"
        ? [
            ...(!metricRegistry.findMetrics({
              company_id: record.ticker,
              metric_id: "product-revenue",
              period_end: latest.periodEnd,
            }).some((metric) => metric.value !== null) ? ["product-revenue"] : []),
            ...(latest.researchAndDevelopment === null ? ["research-and-development"] : []),
            ...(latest.grossMargin === null ? ["gross-margin"] : []),
          ]
        : pack.id === "industrial-machinery"
          ? [
              ...(!metricRegistry.findMetrics({
                company_id: record.ticker,
                metric_id: "backlog",
                period_end: latest.periodEnd,
              }).some((metric) => metric.value !== null) ? ["backlog"] : []),
              ...(latest.freeCashFlowProxy === null ? ["fcf"] : []),
              ...(latest.cashConversion === null ? ["cash-conversion"] : []),
            ]
          : [
              ...(latest.cashCapex === null ? ["cash-capex"] : []),
              ...(latest.freeCashFlowProxy === null ? ["fcf"] : []),
              ...(pack.valuation.metric === "freeCashFlow" && latest.netDebt === null
                ? ["net-debt"]
                : []),
            ];
  const usageGroups = [
    ...periods.map((period) => ({
      module: `historical-table:${period.periodEnd}`,
      keys: Object.values(period.metricKeys),
    })),
    ...periods.map((period) => ({
      module: `trend-chart:${period.periodEnd}`,
      keys: [
        period.metricKeys.revenue,
        pack.id === "banks"
          ? period.metricKeys.netInterestIncome
          : period.metricKeys.operatingCashFlow,
      ].filter(Boolean),
    })),
    { module: "dashboard", keys: narrative.dashboard.map((metric) => metric.metricKey) },
    {
      module: "earnings-quality",
      keys: selectedCanonicalMetrics(
        metricRegistry,
        record.ticker,
        latest,
        pack.id === "banks"
          ? ["net-interest-income", "net-interest-margin", "deposits", "deposit-cost", "loans", "loan-growth", "credit-loss-provision", "net-charge-offs", "allowance-coverage", "cet1-ratio", "liquidity-coverage-ratio", "efficiency-ratio", "return-on-common-equity", "return-on-tangible-common-equity", "tangible-book-value", "tangible-book-value-per-share", "dividends", "share-buybacks", "investment-banking-fees", "trading-revenue"]
          : pack.id === "biopharma"
            ? ["product-revenue", "product-concentration", "research-and-development", "gross-margin", "patent-expiry-year", "operating-cash-flow", "fcf"]
            : pack.id === "industrial-machinery"
              ? ["backlog", "near-term-backlog-share", "price-cost-impact", "segment-margin", "net-income", "working-capital", "inventory", "cash-capex", "fcf", "cash-conversion"]
              : ["net-income", "operating-cash-flow", "cash-capex", "fcf", "cash-conversion", "net-debt"],
      ).map((metric) => metric.canonical_key),
    },
    ...narrative.thesis.map((item) => ({ module: "investment-thesis", keys: item.metricReferences })),
    ...narrative.risks.map((item) => ({ module: "risks", keys: item.metricReferences })),
    ...driverExposure.map((item) => ({ module: "driver-exposure", keys: item.metricReferences })),
    ...sectorKpis.map((item) => ({ module: "sector-kpis", keys: [item.canonicalKey] })),
    ...investmentDebates.map((item) => ({ module: "investment-debates", keys: item.metricReferences })),
    ...productMetrics.map((item) => ({
      module: "product-metrics",
      keys: Object.values(item.metricReferences),
    })),
    ...(marketValuation
      ? [{
          module: "market-valuation",
          keys: Object.values(marketValuation.metricReferences),
        }]
      : []),
    ...filingWatchlist.map((item) => ({ module: "filing-watchlist", keys: item.metricReferences })),
    ...Object.values(catalysts).flat().map((item) => ({
      module: "catalysts",
      keys: item.metricReferences,
    })),
    ...scenarios.map((item) => ({
      module: "scenarios",
      keys: Object.values(item.metricReferences),
    })),
    ...scenarios.map((item) => ({
      module: "valuation",
      keys: [
        item.metricReferences.enterpriseValueMultiple,
        item.metricReferences.valuationStartingPoint,
        item.metricReferences.valuationMetric,
        item.metricReferences.modelImpliedEnterpriseValue,
      ].filter(Boolean),
    })),
    ...peerComparison.map((item) => ({
      module: "peer-comparison",
      keys: Object.values(item.metricReferences),
    })),
  ];
  const quantitativeKeys = [...new Set(
    usageGroups.flatMap((group) => group.keys).filter(Boolean),
  )];
  const metricUsage = buildMetricUsage(metricRegistry, locale, [
    ...usageGroups,
    { module: "json-research-object", keys: quantitativeKeys },
    { module: "web-report", keys: quantitativeKeys },
    { module: "pdf-data-model", keys: quantitativeKeys },
  ]);

  return {
    locale,
    selection,
    classification,
    company: {
      name: companyName,
      ticker: submissions.tickers?.[0] || record.ticker,
      cik,
      exchange: submissions.exchanges?.[0] || COPY[locale].notDisclosed,
      sic: submissions.sic || COPY[locale].notDisclosed,
      sicDescription: submissions.sicDescription || COPY[locale].notDisclosed,
      fiscalYearEnd: submissions.fiscalYearEnd || COPY[locale].notDisclosed,
      filingStatus: submissions.entityType || submissions.category || COPY[locale].reportingIssuer,
    },
    researchDate: RESEARCH_DATE,
    cutoff: companyDataRetrievedAt,
    evidenceCutoff: sectorOutlook.evidenceCutoff,
    sectorLastRefreshedAt: sectorOutlook.lastRefreshedAt,
    companyDataRetrievedAt,
    currency,
    latestAnnual,
    latestInterim,
    metricRegistry: registrySnapshot,
    metricUsage,
    renderingModel: REPORT_RENDERING_MODEL,
    periods,
    dashboard: narrative.dashboard,
    sectorPack: {
      id: pack.id,
      sectorLabel: pack.sectorLabel[locale],
      subindustryLabel: pack.subindustryLabel[locale],
      researchQuestions: pack.researchQuestions.map((item) => item[locale]),
      reportGuidance: pack.reportGuidance.map((item) => item[locale]),
      valuationMethod: effectiveValuation.method[locale],
    },
    sectorOutlook: displayedOutlook,
    driverExposure,
    sectorKpis,
    productMetrics,
    pipelineAssets,
    marketValuation,
    metricCoverage,
    metricExtractionAudit,
    dataCoverage: {
      limited: criticalMetricIds.length > 0,
      criticalMetricIds,
      searchedSources: metricAudit?.searchedSources ?? ["standard-sec-xbrl"],
      metrics: metricAudit?.results ?? [],
      notes: [
        ...(sourceSnapshot?.sourceMode === "verified-runtime-fallback" ||
        sourceSnapshot?.sourceMode === "verified-filing-fallback"
          ? [
              locale === "zh"
                ? `SEC 实时标准化数据未能完整返回；本报告使用检索于 ${sourceSnapshot.retrievedAt.slice(0, 10)} 的已验证官方申报与文件提取快照。申报身份和期间仍按来源记录显示。`
                : `The live standardized SEC data did not return completely, so this report uses a verified official filing and extraction snapshot retrieved ${sourceSnapshot.retrievedAt.slice(0, 10)}. Filing identity and period remain disclosed from the source record.`,
            ]
          : []),
        ...(metricAudit
          ? [
              locale === "zh"
                ? `Shell FY2025 指标定位器已提取 ${metricAudit.extractedCount}/${metricAudit.requestedCount} 项。`
                : `The Shell FY2025 locator extracted ${metricAudit.extractedCount}/${metricAudit.requestedCount} requested metrics.`,
            ]
          : []),
        ...(criticalMetricIds.length
          ? [
              locale === "zh"
                ? `${pack.id === "banks" ? "影响银行盈利或估值" : pack.id === "biopharma" ? "影响商业分析或估值" : pack.id === "industrial-machinery" ? "影响积压兑现、现金转化或估值" : "影响 FCF 或估值"}的关键输入尚未可用：${criticalMetricIds.join(", ")}。`
                : `Critical ${pack.id === "banks" ? "bank earnings or valuation" : pack.id === "biopharma" ? "commercial analysis or valuation" : pack.id === "industrial-machinery" ? "backlog execution, cash conversion, or valuation" : "FCF or valuation"} inputs remain unavailable: ${criticalMetricIds.join(", ")}.`,
            ]
          : []),
        ...(exposureBuild.omittedDrivers.length
          ? [
              locale === "zh"
                ? `公司敞口未显示以下行业驱动因素，因为目前没有可验证的公司专属证据：${exposureBuild.omittedDrivers.join("、")}。`
                : `Company exposure omits these sector drivers because no verifiable company-specific evidence is currently available: ${exposureBuild.omittedDrivers.join(", ")}.`,
            ]
          : []),
        ...(pack.id === "biopharma"
          ? [
              locale === "zh"
                ? "管线阶段、临床里程碑和监管状态保留为带日期的文本证据；因候选药级概率、时间、经济性和成本输入不足，不计算风险调整管线价值。"
                : "Pipeline stage, clinical milestones, and regulatory status remain dated text evidence; no risk-adjusted pipeline value is calculated because candidate-level probability, timing, economics, and cost inputs are insufficient.",
            ]
          : []),
        ...(pack.id === "industrial-machinery"
          ? [
              locale === "zh"
                ? "新增订单、统一内生增长和 CAT 公司级产能利用率未披露为可比 FY2025 数值；一年内预计履约积压占比是交付义务，不是项目完工率。"
                : "Comparable FY2025 new orders, uniform organic growth, and CAT company-level utilization were not disclosed as numeric metrics; backlog expected within one year is a delivery obligation, not a project completion rate.",
            ]
          : []),
      ],
    },
    overview:
      locale === "zh"
        ? `${companyName} 被纳入 ${pack.sectorLabel.zh} / ${pack.subindustryLabel.zh} 分析师包。SEC 分类为 ${submissions.sicDescription || COPY.zh.notDisclosed}（SIC ${submissions.sic || COPY.zh.notDisclosed}）。结论同时使用标准化申报事实、显式计算和 2025 年以来的近期行业证据。`
        : `${companyName} is analyzed with the ${pack.sectorLabel.en} / ${pack.subindustryLabel.en} analyst pack. Its SEC classification is ${submissions.sicDescription || COPY.en.notDisclosed} (SIC ${submissions.sic || COPY.en.notDisclosed}). Conclusions combine normalized filing facts, visible calculations, and recent sector evidence published since 2025.`,
    segmentAnalysis:
      metricAudit
        ? locale === "zh"
          ? `指标定位器依次检索标准 SEC XBRL、自定义 XBRL、申报表格与正文，并保留口径验证和拒绝记录；本期提取 ${metricAudit.extractedCount}/${metricAudit.requestedCount} 项。${pack.reportGuidance.map((item) => item.zh).join(" ")}`
          : `The metric locator searches standard SEC XBRL, custom XBRL, filing tables, and filing text in order while retaining validation and rejection records; it extracted ${metricAudit.extractedCount}/${metricAudit.requestedCount} items for this period. ${pack.reportGuidance.map((item) => item.en).join(" ")}`
        : locale === "zh"
          ? `标准化 Company Facts 不能稳定保留发行人自定义分部和经营 KPI，因此系统不推测缺失值。${pack.reportGuidance.map((item) => item.zh).join(" ")}`
          : `Standardized Company Facts does not consistently preserve issuer-defined segments and operating KPIs, so missing values are not inferred. ${pack.reportGuidance.map((item) => item.en).join(" ")}`,
    earningsQuality: narrative.earningsQuality,
    thesis: narrative.thesis,
    investmentDebates,
    filingWatchlist,
    catalysts,
    risks: narrative.risks,
    scenarios,
    peerComparison,
    valuationAssessment:
      !selection.options.valuation
        ? locale === "zh" ? "本次未选择估值模块。" : "Valuation was not selected for this run."
        : locale === "zh"
          ? pack.id === "banks"
            ? `采用${effectiveValuation.method.zh}作为主框架，并以模型隐含 P/E、现金股息率及 ROTCE 相对 10% 股权成本的溢价交叉验证。1.20x–2.20x P/TBV 为清晰标注的情景假设，不宣称为未验证的历史或同业交易区间；由于未使用带日期的市场价格，本报告不输出评级或目标价。`
            : pack.id === "biopharma" && marketValuation
              ? `采用${effectiveValuation.method.zh}。截至 ${marketValuation.asOfDate}，带日期的市场桥接显示 EV/营收 ${marketValuation.currentEvRevenue.toFixed(2)}x、P/E ${marketValuation.currentPe.toFixed(2)}x；14x/17x/20x EV/营收为显式情景假设。每个情景均按“企业价值 − 最新可得净债务 = 股权价值；股权价值 ÷ FY2025 稀释股数 = 模型每股价值”桥接。商业收入情景不包含未验证的风险调整管线价值，也不输出评级或目标价。`
            : `采用${effectiveValuation.method.zh}，不使用未注明日期的实时股价，不输出评级或目标价。${useValuationFallback ? "由于现金资本开支不可取得，经营现金流仅作为估值指标，未被表述为 FCF。" : ""}${pack.id === "biopharma" ? "商业收入情景不包含未验证的风险调整管线价值。" : ""}倍数为分析假设，企业价值用于敏感性而非价格预测。`
          : pack.id === "banks"
            ? `Uses ${effectiveValuation.method.en} as the primary framework, cross-checked against model-implied P/E, cash-dividend yield, and issuer-reported ROTCE relative to a 10% cost-of-equity assumption. The 1.20x–2.20x P/TBV range is a clearly labeled scenario assumption, not a claimed historical or peer trading range; without a dated market price, the report provides no rating or price target.`
            : pack.id === "biopharma" && marketValuation
              ? `Uses ${effectiveValuation.method.en}. As of ${marketValuation.asOfDate}, the dated market bridge implies ${marketValuation.currentEvRevenue.toFixed(2)}x EV/revenue and ${marketValuation.currentPe.toFixed(2)}x P/E; 14x/17x/20x EV/revenue are explicit scenario assumptions. Each scenario bridges enterprise value less latest available net debt to equity value, then divides by FY2025 diluted shares for model value per share. Commercial-revenue scenarios exclude unverified risk-adjusted pipeline value, and no rating or price target is provided.`
            : `Uses ${effectiveValuation.method.en} without an undated real-time share price, rating, or price target. ${useValuationFallback ? "Because cash capex is unavailable, operating cash flow is used only as the valuation metric and is not presented as FCF. " : ""}${pack.id === "biopharma" ? "The commercial-revenue scenarios exclude unverified risk-adjusted pipeline value. " : ""}Multiples are analyst assumptions and enterprise values are sensitivities, not forecasts.`,
    cashFlowProxyFormula:
      pack.id === "banks"
        ? locale === "zh"
          ? "银行盈利桥接使用净利息收入、信用损失拨备和非利息费用；不使用工业公司 FCF。"
          : "The bank earnings bridge uses net interest income, credit-loss provision, and noninterest expense; no industrial-company FCF is used."
        : latest.cashCapex === null || latest.operatingCashFlow === null
        ? COPY[locale].unableFcf
        : strictFcfFormula,
    valuationFormula,
    methodology: getSectorMethods(selection.subindustry).map((method) => ({
      name: method.name[locale],
      purpose: method.purpose[locale],
      steps: method.steps.map((step) => step[locale]),
    })),
    sources: [
      {
        title: locale === "zh" ? "SEC 公司与交易代码映射" : "SEC company and ticker mapping",
        url: "https://www.sec.gov/files/company_tickers.json",
        retrievedAt: companyDataRetrievedAt,
        publisher: "U.S. Securities and Exchange Commission",
      },
      {
        title: locale === "zh" ? "SEC 发行人申报索引" : "SEC issuer submissions index",
        url: sourceBase,
        retrievedAt: companyDataRetrievedAt,
        publisher: "U.S. Securities and Exchange Commission",
      },
      {
        title: locale === "zh" ? "SEC Company Facts" : "SEC Company Facts",
        url: factsUrl,
        retrievedAt: companyDataRetrievedAt,
        publisher: "U.S. Securities and Exchange Commission",
      },
      ...(latestAnnual
        ? [{
            title: `${latestAnnual.form} ${locale === "zh" ? "年度申报" : "annual filing"}`,
            url: latestAnnual.url,
            retrievedAt: companyDataRetrievedAt,
            publisher: companyName,
            publicationDate: latestAnnual.filed,
            topic: "Issuer filing",
          }]
        : []),
      ...driverExposure.filter(
        (item, index, rows) =>
          rows.findIndex((candidate) => candidate.evidenceUrl === item.evidenceUrl) === index,
      ).map((item) => ({
        title: item.evidenceTitle,
        url: item.evidenceUrl,
        retrievedAt: companyDataRetrievedAt,
        publisher: item.evidencePublisher,
        publicationDate: item.evidenceDate,
        topic: "Company exposure evidence",
      })),
      ...pipelineAssets.filter(
        (item, index, rows) =>
          rows.findIndex((candidate) => candidate.sourceUrl === item.sourceUrl) === index &&
          !driverExposure.some((candidate) => candidate.evidenceUrl === item.sourceUrl),
      ).map((item) => ({
        title: item.sourceTitle,
        url: item.sourceUrl,
        retrievedAt: companyDataRetrievedAt,
        publisher: item.sourceUrl.includes("clinicaltrials.gov")
          ? "ClinicalTrials.gov"
          : item.sourceUrl.includes("fda.gov")
            ? "U.S. Food and Drug Administration"
            : companyName,
        publicationDate: item.sourceDate,
        topic: "Pipeline evidence",
      })),
      ...(marketValuation
        ? [{
            title: marketValuation.sourceTitle,
            url: marketValuation.sourceUrl,
            retrievedAt: companyDataRetrievedAt,
            publisher: companyName,
            publicationDate: marketValuation.asOfDate,
            topic: "Dated market data",
          }]
        : []),
      ...evidenceSources.map((source) => ({
        title: source.title,
        url: source.url,
        retrievedAt: companyDataRetrievedAt,
        publisher: source.publisher,
        publicationDate: source.publicationDate,
        topic: source.topic,
      })),
    ],
    limitations: [
      ...(sectorOutlook.insufficientEvidence
        ? ["Insufficient recent sector research available for 2025–2026."]
        : []),
      locale === "zh"
        ? "标准化 SEC XBRL 不足以稳定提取全部发行人自定义分部和 KPI，包括净息差、CET1、HQLA、利用率、产品收入、管线阶段、客户集中度和市场份额；缺失值保持为未提取。"
        : "Standardized SEC XBRL does not consistently expose every issuer-defined segment and KPI, including NIM, CET1, HQLA, utilization, product revenue, pipeline stage, customer concentration, and market share; missing values remain not yet extracted.",
      pack.id === "banks"
        ? locale === "zh"
          ? "银行不使用工业公司 FCF。报告优先使用发行人报告的 ROE 与非 GAAP ROTCE，并保留其定义；期末权益回报代理仅保留在注册表中，不替代发行人口径。"
          : "Banks do not use industrial-company FCF. The report prioritizes issuer-reported ROE and non-GAAP ROTCE with their definitions preserved; the period-end-equity return proxy remains in the registry and does not replace issuer measures."
        : pack.id === "biopharma"
          ? locale === "zh"
            ? "商业指标来自申报事实；管线概率、时间和价值未作为事实。公开输入不足以支持候选药级 rNPV，因此未计算风险调整管线价值或现金跑道。"
            : "Commercial metrics use filing facts; pipeline probability, timing, and value are not treated as facts. Public inputs are insufficient for candidate-level rNPV, so no risk-adjusted pipeline value or cash runway is calculated."
        : pack.id === "industrial-machinery"
          ? locale === "zh"
            ? "新增订单、统一内生增长和 CAT 公司级利用率没有可比 FY2025 数值；行业利用率仅作背景。积压与近期待履约占比分别表示未履约订单和交付义务，不表示已确认收入或完工率。"
            : "Comparable FY2025 new orders, uniform organic growth, and CAT company-level utilization are unavailable; industry utilization is context only. Backlog and its near-term share represent unfulfilled orders and delivery obligations, not recognized revenue or completion rates."
        : latest.cashCapex === null || latest.operatingCashFlow === null
        ? COPY[locale].unableFcf
        : locale === "zh"
          ? "FCF 严格按经营现金流减现金资本开支计算，可能不同于发行人自定义口径。"
          : "FCF is calculated strictly as operating cash flow less cash capital expenditure and may differ from the issuer's definition.",
      locale === "zh"
        ? "同业比较使用各公司最近可取得的标准化年度事实，财政年度、业务组合和会计口径可能不同。"
        : "Peer comparison uses each company's latest available standardized annual facts; fiscal years, business mixes, and accounting definitions may differ.",
      locale === "zh"
        ? "行业证据仅包含发布日期在 2025-01-01 至研究日之间、可公开访问且通过去重和相关性筛选的来源。"
        : "Sector evidence includes only accessible, deduplicated, relevant sources published from 2025-01-01 through the research date.",
      locale === "zh"
        ? pack.id === "banks"
          ? "未使用带日期的市场价格，因此不宣称当前、历史或同业交易倍数，也不提供评级或目标价；每股价值、P/E 与股息率均为显式 P/TBV 情景下的模型敏感度。"
          : pack.id === "biopharma" && marketValuation
            ? `市场价格为 ${marketValuation.asOfDate} 收盘价；市值使用 2026-04-27 披露股数，净债务使用 2026-03-31 资产负债表并持有至市场日，因此为带日期的估值代理而非实时值。`
          : "未使用实时股价，因此不提供评级、目标价或每股价值；情景价值仅为透明敏感度。"
        : pack.id === "banks"
          ? "No dated market price is used, so the report does not claim current, historical, or peer trading multiples and provides no rating or price target; per-share values, P/E, and dividend yields are model sensitivities under explicit P/TBV scenarios."
          : pack.id === "biopharma" && marketValuation
            ? `The market price is the ${marketValuation.asOfDate} close; market capitalization carries the 2026-04-27 reported share count and net debt carries the 2026-03-31 balance sheet to the market date, so this is a dated valuation proxy rather than real-time data.`
          : "No real-time share price is used, so the report does not provide a rating, price target, or per-share value; scenario values are transparent sensitivities only.",
    ],
  };
}

type PreservedSelections = {
  company: string;
  locale: ResearchLocale;
  options: ResearchOptions;
};

type ResearchPipelineError = {
  code: ResearchErrorCode;
  title: string;
  message: string;
  technicalDiagnostic: string;
  retryable: boolean;
  failedStage: SecPipelineStage;
  traceId: string;
  preservedSelections: PreservedSelections;
  httpStatus: number | null;
  endpointCategory?: SecRequestDiagnostic["endpointCategory"];
  matchDetails?: SecClientError["matchDetails"];
  details?: SecClientError["details"];
  capabilities: {
    filingFallback: boolean;
    limitedCoverage: boolean;
  };
  diagnostics: SecRequestDiagnostic[];
};

function traceId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `finbro-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function errorStatus(code: ResearchErrorCode) {
  if (code === "INVALID_INPUT") return 400;
  if (code === "TICKER_NOT_FOUND" || code === "SUBMISSIONS_NOT_FOUND") return 404;
  if (code === "AMBIGUOUS_TICKER") return 409;
  if (
    code === "NO_STANDARDIZED_XBRL_FACTS" ||
    code === "COMPANY_FACTS_NOT_FOUND" ||
    code === "UNSUPPORTED_REPORTING_ENTITY" ||
    code === "UNSUPPORTED_SECTOR_PACK" ||
    code === "SECTOR_CLASSIFICATION_CONFLICT" ||
    code === "INSUFFICIENT_VERIFIED_METRICS"
  ) return 422;
  if (code === "SEC_TIMEOUT") return 504;
  if (code === "SEC_RATE_LIMITED" || code === "SEC_SERVICE_UNAVAILABLE") return 503;
  if (code === "SEC_FORBIDDEN") return 502;
  return 500;
}

function userErrorCopy(code: ResearchErrorCode, locale: ResearchLocale) {
  const english: Record<ResearchErrorCode, { title: string; message: string }> = {
    INVALID_INPUT: {
      title: "Ethan needs a valid assignment.",
      message: "Enter a company name or ticker between 2 and 100 characters.",
    },
    TICKER_NOT_FOUND: {
      title: "Ethan could not match that ticker to an SEC reporting company.",
      message: "Check the exact ticker or try the issuer's legal company name.",
    },
    AMBIGUOUS_TICKER: {
      title: "Ethan found more than one possible SEC reporting company.",
      message: "Use an exact ticker or choose from the matched SEC identities.",
    },
    CIK_RESOLUTION_FAILED: {
      title: "Ethan found the company but lost the paperwork.",
      message: "The SEC identity could not be resolved to a valid CIK.",
    },
    SEC_FORBIDDEN: {
      title: "Ethan cannot access the SEC right now.",
      message: "The SEC rejected the server request. The assignment is preserved.",
    },
    SEC_RATE_LIMITED: {
      title: "Ethan is waiting on the SEC.",
      message: "The SEC asked the server to slow down. Retry in a moment.",
    },
    SEC_TIMEOUT: {
      title: "Ethan is waiting on the SEC.",
      message: "The SEC took too long to respond. Your assignment is preserved.",
    },
    SEC_SERVICE_UNAVAILABLE: {
      title: "Ethan does not want to work right now.",
      message: "The SEC or FinBro backend is genuinely unavailable. Retry shortly.",
    },
    SUBMISSIONS_NOT_FOUND: {
      title: "Ethan found the ticker, but not its filing history.",
      message: "No SEC Submissions record was available for the resolved CIK.",
    },
    COMPANY_FACTS_NOT_FOUND: {
      title: "Ethan found the filings, but the numbers are not standardized.",
      message: "SEC Company Facts is unavailable for this issuer. No values were fabricated.",
    },
    NO_STANDARDIZED_XBRL_FACTS: {
      title: "Ethan found the filings, but the numbers are not standardized.",
      message: "The available XBRL facts did not meet the verified metric threshold.",
    },
    FILING_NOT_FOUND: {
      title: "Ethan cannot find the filing document.",
      message: "The filing index exists, but the selected SEC document was not available.",
    },
    FILING_PARSE_FAILED: {
      title: "Ethan found the filing but could not read the table.",
      message: "The filing was preserved for review; no values were guessed.",
    },
    UNSUPPORTED_REPORTING_ENTITY: {
      title: "Ethan cannot use this reporting format yet.",
      message: "The issuer's filing framework is not supported by the current extractor.",
    },
    UNSUPPORTED_SECTOR_PACK: {
      title: "Ethan has not been staffed on this sector yet.",
      message: "Company retrieval succeeded, but the selected research pack is unsupported.",
    },
    SECTOR_CLASSIFICATION_CONFLICT: {
      title: "Selected sector differs from the detected company classification.",
      message: "Confirm the company and choose the sector pack that matches its SEC classification.",
    },
    INSUFFICIENT_VERIFIED_METRICS: {
      title: "Ethan needs more verified numbers.",
      message: "The minimum evidence threshold for a full report was not met.",
    },
    INTERNAL_PIPELINE_ERROR: {
      title: "Ethan hit an internal review exception.",
      message: "The failure occurred after retrieval and was not an SEC service outage.",
    },
  };
  if (locale === "en") return english[code];
  const chinese: Partial<typeof english> = {
    INVALID_INPUT: { title: "Ethan 需要一项有效任务。", message: "请输入 2–100 个字符的公司名或交易代码。" },
    TICKER_NOT_FOUND: { title: "Ethan 无法把该代码匹配到 SEC 申报公司。", message: "请核对精确代码，或输入发行人的法定公司名。" },
    AMBIGUOUS_TICKER: { title: "Ethan 找到了多个可能的 SEC 申报公司。", message: "请输入精确代码，或根据 SEC 身份候选项确认。" },
    CIK_RESOLUTION_FAILED: { title: "Ethan 找到公司，但弄丢了文件编号。", message: "无法把 SEC 公司身份解析为有效 CIK。" },
    SEC_RATE_LIMITED: { title: "Ethan 正在等 SEC。", message: "SEC 要求服务器降低请求速度，请稍后重试。" },
    SEC_TIMEOUT: { title: "Ethan 正在等 SEC。", message: "SEC 响应超时；当前任务选择已保留。" },
    SEC_SERVICE_UNAVAILABLE: { title: "Ethan 现在不想干活。", message: "SEC 或 FinBro 后端确实不可用，请稍后重试。" },
    COMPANY_FACTS_NOT_FOUND: { title: "Ethan 找到了申报，但数字没有标准化。", message: "该发行人的 SEC Company Facts 不可用；系统没有编造数值。" },
    NO_STANDARDIZED_XBRL_FACTS: { title: "Ethan 找到了申报，但数字没有标准化。", message: "现有 XBRL 事实未达到经验证指标门槛。" },
    UNSUPPORTED_SECTOR_PACK: { title: "Ethan 还没有被安排到这个行业。", message: "公司检索成功，但当前不支持所选研究包。" },
    SECTOR_CLASSIFICATION_CONFLICT: { title: "所选行业与检测到的公司分类不同。", message: "请确认公司，并选择与 SEC 分类一致的行业研究包。" },
    INTERNAL_PIPELINE_ERROR: { title: "Ethan 遇到了内部复核异常。", message: "故障发生在数据检索之后，不是 SEC 服务中断。" },
  };
  return chinese[code] ?? english[code];
}

function preservedSelections(
  payload: ResearchPayload,
  locale: ResearchLocale,
): PreservedSelections {
  return {
    company: payload.company?.trim() ?? "",
    locale,
    options: { ...DEFAULT_OPTIONS, ...payload.options },
  };
}

function errorResponse(
  error: unknown,
  locale: ResearchLocale,
  selections: PreservedSelections,
  requestTraceId: string,
  diagnostics: SecRequestDiagnostic[],
) {
  const classified = toSecClientError(error, "report_initialization");
  const copy = userErrorCopy(classified.code, locale);
  const payload: ResearchPipelineError = {
    code: classified.code,
    title: copy.title,
    message: copy.message,
    technicalDiagnostic: classified.diagnostic,
    retryable: classified.retryable,
    failedStage: classified.stage,
    traceId: requestTraceId,
    preservedSelections: selections,
    httpStatus: classified.httpStatus,
    endpointCategory: classified.endpointCategory,
    matchDetails: classified.matchDetails,
    details: classified.details,
    capabilities: {
      filingFallback:
        classified.details?.filingFallbackAttempted === true &&
        classified.code === "NO_STANDARDIZED_XBRL_FACTS",
      limitedCoverage: false,
    },
    diagnostics,
  };
  console.error(JSON.stringify({
    event: "research_pipeline_error",
    traceId: requestTraceId,
    normalizedInput: selections.company.trim().toUpperCase().replace(/[./]/g, "-"),
    code: payload.code,
    failedStage: payload.failedStage,
    retryable: payload.retryable,
    httpStatus: payload.httpStatus,
    diagnostics,
  }));
  return Response.json({ error: payload }, { status: errorStatus(payload.code) });
}

export async function POST(request: Request) {
  const requestTraceId = traceId();
  const diagnostics: SecRequestDiagnostic[] = [];
  let locale: ResearchLocale = "zh";
  let payload: ResearchPayload = {};
  let selections = preservedSelections(payload, locale);
  let record: TickerRecord | null = null;
  try {
    try {
      payload = (await request.json()) as ResearchPayload;
    } catch (error) {
      throw new SecClientError({
        code: "INVALID_INPUT",
        stage: "input_validation",
        diagnostic: "Request body was not valid JSON.",
        cause: error,
      });
    }
    locale = payload.locale === "en" ? "en" : "zh";
    selections = preservedSelections(payload, locale);
    const company = selections.company;
    if (company.length < 2 || company.length > 100) {
      throw new SecClientError({
        code: "INVALID_INPUT",
        stage: "input_validation",
        diagnostic: "Company input must contain between 2 and 100 characters.",
      });
    }
    record = await secClient.resolveCompany(company, diagnostics);
    const requestHostname = new URL(request.url).hostname;
    const localFixtureAllowed =
      ["localhost", "127.0.0.1"].includes(requestHostname);
    const fixtureByTicker = VERIFIED_SOURCE_SNAPSHOTS;
    const selectedFixture =
      payload.fixture && localFixtureAllowed
        ? fixtureByTicker[record.ticker as keyof typeof fixtureByTicker]
        : undefined;
    const sourceSnapshot = selectedFixture
      ? reportSourceSnapshot(selectedFixture, "explicit-test-snapshot")
      : undefined;
    let report: ResearchReport;
    let classification: CompanyClassification;
    let fallbackUsed = false;
    const buildFromSource = async (snapshot?: ReportSourceSnapshot) => {
      const submissions = snapshot
        ? snapshot.submissions
        : await secClient.getSubmissions<Submissions>(record!.cik, diagnostics);
      const nextClassification = classifyCompany({
        sicCode: submissions.sic ?? null,
        sicDescription: submissions.sicDescription ?? null,
      });
      const nextSelection = selectionFromClassification(
        nextClassification,
        payload,
        record!,
      );
      return {
        report: await buildReport(
          record!,
          nextSelection,
          nextClassification,
          submissions,
          locale,
          snapshot,
          diagnostics,
        ),
        classification: nextClassification,
      };
    };
    try {
      ({ report, classification } = await buildFromSource(sourceSnapshot));
    } catch (error) {
      const verifiedFallback =
        fixtureByTicker[record.ticker as keyof typeof fixtureByTicker];
      const classified = error instanceof SecClientError ? error : null;
      const filingFallbackSupported =
        record.ticker === "SHEL" &&
        classified?.code === "COMPANY_FACTS_NOT_FOUND";
      if (
        sourceSnapshot ||
        !verifiedFallback ||
        (!isTemporaryPublicDataFailure(error) && !filingFallbackSupported)
      ) throw error;
      fallbackUsed = true;
      ({ report, classification } = await buildFromSource(
        reportSourceSnapshot(
          verifiedFallback,
          filingFallbackSupported
            ? "verified-filing-fallback"
            : "verified-runtime-fallback",
        ),
      ));
    }
    const consistencyAudit = auditResearchReport(report);
    if (!consistencyAudit.passed) {
      throw new SecClientError({
        code: "INTERNAL_PIPELINE_ERROR",
        stage: "report_initialization",
        diagnostic: "Canonical metric consistency audit failed; report publication was blocked.",
      });
    }
    const pipeline = {
      traceId: requestTraceId,
      normalizedInput: company.trim().toUpperCase().replace(/[./]/g, "-"),
      resolvedCompany: {
        ticker: record.ticker,
        name: record.title,
        cik: record.cik,
        exchange: record.exchange,
        mappingSource: record.mappingSource,
        reportingStatus: record.reportingStatus,
        resolvedAt: record.resolvedAt,
      },
      classification,
      fallbackUsed,
      diagnostics,
    };
    console.info(JSON.stringify({ event: "research_pipeline_complete", ...pipeline }));
    return Response.json({
      report,
      classification,
      metricCoverage: report.metricCoverage,
      extractionAudit: report.metricExtractionAudit,
      consistencyAudit,
      pipeline,
    });
  } catch (error) {
    return errorResponse(
      error,
      locale,
      selections,
      requestTraceId,
      diagnostics,
    );
  }
}
