import {
  TIER_1_METRIC_IDS,
  TIER_2_METRIC_IDS,
} from "./coverage-expectations";
import type { CoverageBenchmark, CoverageCompanyType } from "./types";

const all = [...TIER_1_METRIC_IDS, ...TIER_2_METRIC_IDS];
const core = [...TIER_1_METRIC_IDS];

function benchmark(
  ticker: string,
  cik: string,
  packId: string,
  companyType: CoverageCompanyType = "non-financial",
  minimumTier1Coverage = 0.65,
): CoverageBenchmark {
  return {
    ticker,
    cik,
    packId,
    companyType,
    expectedApplicableMetrics: all,
    requiredMetrics: core,
    minimumTier1Coverage,
    minimumTier2Coverage: 0,
  };
}

export const COVERAGE_BENCHMARK_VERSION = "1.0";

export const COVERAGE_BENCHMARKS: CoverageBenchmark[] = [
  benchmark("AAPL", "0000320193", "technology-hardware-general", "non-financial", 0.8),
  benchmark("DELL", "0001571996", "technology-hardware-general"),
  benchmark("HPQ", "0000047217", "technology-hardware-general"),
  benchmark("MSFT", "0000789019", "software-saas-general", "non-financial", 0.8),
  benchmark("ORCL", "0001341439", "software-saas-general"),
  benchmark("ADBE", "0000796343", "software-saas-general"),
  benchmark("GOOGL", "0001652044", "internet-platform-general", "non-financial", 0.8),
  benchmark("META", "0001326801", "internet-platform-general", "non-financial", 0.8),
  benchmark("AMZN", "0001018724", "internet-platform-general", "non-financial", 0.8),
  benchmark("KO", "0000021344", "consumer-products-general"),
  benchmark("PEP", "0000077476", "consumer-products-general"),
  benchmark("NKE", "0000320187", "consumer-products-general"),
  benchmark("WMT", "0000104169", "consumer-products-general"),
  benchmark("AXP", "0000004962", "diversified-financials-general", "diversified-financial"),
  benchmark("BLK", "0001364742", "diversified-financials-general", "diversified-financial"),
  benchmark("SCHW", "0000316709", "diversified-financials-general", "diversified-financial"),
  benchmark("NVDA", "0001045810", "semiconductors"),
  benchmark("JPM", "0000019617", "banks", "bank"),
  benchmark("SHEL", "0001306965", "integrated-oil-gas", "foreign-private-issuer"),
  benchmark("LLY", "0000059478", "biopharma"),
  benchmark("CAT", "0000018230", "industrial-machinery"),
];
