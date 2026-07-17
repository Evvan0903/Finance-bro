import {
  METRIC_SOURCE_ORDER,
  SHELL_METRIC_DEFINITIONS,
} from "./metric-definitions";
import {
  extractFilingCustomXbrl,
  extractFilingText,
  extractStandardSecXbrl,
  locateMetrics,
  mergeExtractionBatches,
} from "./metric-locator";
import type {
  CompanyFactsPayload,
  MetricDocument,
  MetricExtractionBatch,
  MetricLocatorAudit,
} from "./metric-locator-types";

export const SHELL_REPORTING_PERIOD = "2025-12-31";
export const SHELL_2025_20F_URL =
  "https://www.sec.gov/Archives/edgar/data/1306965/000162828026017024/shel-20251231.htm";
export const SHELL_COMPANY_FACTS_URL =
  "https://data.sec.gov/api/xbrl/companyfacts/CIK0001306965.json";

export const SHELL_VERIFIED_COMPANY_FACTS: CompanyFactsPayload = {
  cik: 1306965,
  entityName: "Shell plc",
  facts: {
    "ifrs-full": {
      CashFlowsFromUsedInOperatingActivities: {
        label: "Cash flow from operating activities",
        description: "Cash generated from operating activities.",
        units: {
          USD: [{
            start: "2025-01-01",
            end: SHELL_REPORTING_PERIOD,
            val: 42_863_000_000,
            form: "20-F",
            filed: "2026-03-12",
            accn: "0001628280-26-017024",
          }],
        },
      },
      DividendsPaidToEquityHoldersOfParentClassifiedAsFinancingActivities: {
        label: "Dividends paid to Shell plc shareholders",
        description: "Cash dividends paid to equity holders of the parent.",
        units: {
          USD: [{
            start: "2025-01-01",
            end: SHELL_REPORTING_PERIOD,
            val: 8_472_000_000,
            form: "20-F",
            filed: "2026-03-12",
            accn: "0001628280-26-017024",
          }],
        },
      },
      PaymentsToAcquireOrRedeemEntitysShares: {
        label: "Share buybacks",
        description: "Cash paid to repurchase Shell plc shares.",
        units: {
          USD: [{
            start: "2025-01-01",
            end: SHELL_REPORTING_PERIOD,
            val: 13_879_000_000,
            form: "20-F",
            filed: "2026-03-12",
            accn: "0001628280-26-017024",
          }],
        },
      },
    },
  },
};

export const SHELL_VERIFIED_FILING_EXCERPT = `
<html><body>
<xbrli:unit id="usd"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit>
<xbrli:context id="c-1"><xbrli:entity><xbrli:identifier>0001306965</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period></xbrli:context>
<xbrli:context id="c-segment"><xbrli:entity><xbrli:identifier>0001306965</xbrli:identifier><xbrli:segment><xbrldi:explicitMember dimension="shel:SegmentsAxis">shel:IntegratedGasMember</xbrldi:explicitMember></xbrli:segment></xbrli:entity><xbrli:period><xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period></xbrli:context>
<ix:nonFraction unitRef="usd" contextRef="c-1" decimals="-6" name="shel:CashOutflowForTotalCashCapitalExpenditure" scale="6">20,915</ix:nonFraction>
<ix:nonFraction unitRef="usd" contextRef="c-segment" decimals="-6" name="shel:CashOutflowForTotalCashCapitalExpenditure" scale="6">4,689</ix:nonFraction>
<ix:nonFraction unitRef="usd" contextRef="c-1" decimals="-6" name="shel:AdjustedEarnings" scale="6">18,813</ix:nonFraction>
<ix:nonFraction unitRef="usd" contextRef="c-segment" decimals="-6" name="shel:AdjustedEarnings" scale="6">8,024</ix:nonFraction>

<h2>Oil and gas information</h2>
<p>Production available for sale. Oil and gas production available for sale in 2025 was 2,800 thousand boe/d. Oil and gas production available for sale. Thousand boe/d 2025 2024 2023 Crude oil and natural gas liquids 1,494 1,452 1,454 Synthetic crude oil 41 51 52 Natural gas 1,265 1,333 1,285 Total 2,800 2,836 2,791.</p>
<p>Average realised price by geographical area Crude oil and natural gas liquids $/barrel 2025 2024 2023 Shell subsidiaries Shell share of joint ventures and associates Europe 64.83 65.29 70.82 76.61 77.19 79.10.</p>
<p>LNG sales volumes (million tonnes) 72.9 65.8 67.1.</p>
<p>Global indicative refining margin $/bbl 2025 2024 2023 Indicative refining margin 10.14 7.74 12.45. Actual margins realised by Shell may vary.</p>
<p>Cash flow from investing activities (16,811) (13,734) (18,523) Free cash flow* 26,052 39,533 36,457 Cash capital expenditure 20,915 21,085 24,392.</p>
<p>Net debt* at December 31 [E] 45,687 38,809 43,542.</p>
<p>Projects & Technology delivered the successful start-up of 21 projects, notably Whale in the Gulf of America, Penguins in the UK, Mero-4 in Brazil and the first export cargo from LNG Canada.</p>
</body></html>`;

export function shellMetricDocument(
  html: string,
  extractionMethodSuffix = "",
): MetricDocument {
  return {
    id: "0001628280-26-017024",
    company: "Shell plc",
    title: "Shell plc 2025 Form 20-F",
    url: SHELL_2025_20F_URL,
    filingDate: "2026-03-12",
    sourceDate: "2026-03-12",
    reportingPeriod: SHELL_REPORTING_PERIOD,
    form: "20-F",
    html,
    extractionMethodSuffix,
  };
}

export function runShellMetricValidation(input: {
  companyFacts?: CompanyFactsPayload;
  filingHtml?: string;
  verifiedSnapshot?: boolean;
} = {}): MetricLocatorAudit {
  const companyFacts = input.companyFacts ?? SHELL_VERIFIED_COMPANY_FACTS;
  const filingHtml = input.filingHtml ?? SHELL_VERIFIED_FILING_EXCERPT;
  const suffix = input.verifiedSnapshot === false ? "" : " (verified 2025 filing snapshot)";
  const document = shellMetricDocument(filingHtml, suffix);
  const availableProjectSources: MetricExtractionBatch = {
    candidates: [],
    searchedSources: [
      "earnings-release-exhibit",
      "investor-presentation",
    ],
    extractionFailures: {},
  };
  const batch = mergeExtractionBatches(
    extractStandardSecXbrl(
      companyFacts,
      SHELL_METRIC_DEFINITIONS,
      SHELL_REPORTING_PERIOD,
    ),
    extractFilingCustomXbrl(document, SHELL_METRIC_DEFINITIONS),
    extractFilingText(document, SHELL_METRIC_DEFINITIONS),
    availableProjectSources,
  );
  return locateMetrics({
    company: "Shell plc",
    reportingPeriod: SHELL_REPORTING_PERIOD,
    definitions: SHELL_METRIC_DEFINITIONS,
    candidates: batch.candidates,
    searchedSources: batch.searchedSources.length
      ? batch.searchedSources
      : METRIC_SOURCE_ORDER,
    extractionFailures: batch.extractionFailures,
  });
}
