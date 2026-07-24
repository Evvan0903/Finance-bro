import type { SicFamilyRule, SicRule } from "./types";

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => String(start + index).padStart(4, "0"));
}

function entries(codes: string[], rule: SicRule) {
  return codes.map((code) => [code, rule] as const);
}

export const EXACT_SIC_RULES = new Map<string, SicRule>([
  ...entries(["3570", "3571", "3572", "3575", "3576", "3577", "3578", "3579", "3651", "3661", "3663", "3669"], { sector: "technology", packId: "technology-hardware-general" }),
  ...entries(["3674"], { sector: "technology", packId: "semiconductors" }),
  ...entries(["7371", "7372", "7373", "7374"], { sector: "technology", packId: "software-saas-general" }),
  ...entries(["7370", "7375", "7376", "7377", "7378", "7379"], { sector: "technology", packId: "internet-platform-general" }),
  ...entries(["6021", "6022", "6029", "6035", "6036", "6099"], { sector: "financials", packId: "banks" }),
  ...entries(["6111", "6141", "6153", "6159", "6162", "6163", "6172", "6199", "6211", "6282", "6311", "6321", "6331", "6351", "6361", "6399", "6411", "6712", "6722", "6726", "6732", "6792", "6794", "6795", "6798", "6799"], { sector: "financials", packId: "diversified-financials-general" }),
  ...entries(["2833", "2834", "2835", "2836"], { sector: "healthcare", packId: "biopharma" }),
  ...entries(["1311", "1381", "1382", "1389", "2911"], { sector: "energy", packId: "integrated-oil-gas" }),
  ...entries(["3519", "3523", "3531", "3532", "3533", "3537", "3711", ...range(3541, 3569)], { sector: "industrials", packId: "industrial-machinery" }),
  ...entries([...range(2020, 2099), "2111", ...range(2300, 2399), ...range(2840, 2844), ...range(3630, 3639), "3942", "3944"], { sector: "consumer", packId: "consumer-products-general" }),
]);

export const SIC_FAMILY_RULES: SicFamilyRule[] = [
  { minimum: 100, maximum: 999, sector: "consumer", reason: "SIC falls within an agriculture and consumer-products family." },
  { minimum: 1300, maximum: 1399, sector: "energy", reason: "SIC falls within the oil-and-gas extraction family." },
  { minimum: 1500, maximum: 1799, sector: "industrials", reason: "SIC falls within a construction and industrial-services family." },
  { minimum: 2000, maximum: 2399, sector: "consumer", packId: "consumer-products-general", reason: "SIC falls within a consumer-products manufacturing family." },
  { minimum: 2830, maximum: 2839, sector: "healthcare", reason: "SIC falls within a pharmaceutical-products family." },
  { minimum: 2900, maximum: 2999, sector: "energy", reason: "SIC falls within a petroleum-products family." },
  { minimum: 3400, maximum: 3569, sector: "industrials", reason: "SIC falls within an industrial equipment and manufacturing family." },
  { minimum: 3570, maximum: 3699, sector: "technology", packId: "technology-hardware-general", reason: "SIC falls within a technology hardware and electronics family." },
  { minimum: 3700, maximum: 3999, sector: "industrials", reason: "SIC falls within a transportation equipment or instruments family." },
  { minimum: 4000, maximum: 4899, sector: "industrials", reason: "SIC falls within a transportation or communications infrastructure family." },
  { minimum: 5000, maximum: 5999, sector: "consumer", reason: "SIC falls within a wholesale or retail family." },
  { minimum: 6000, maximum: 6799, sector: "financials", reason: "SIC falls within a financial-services family." },
  { minimum: 7370, maximum: 7379, sector: "technology", reason: "SIC falls within a computer programming and data-services family." },
  { minimum: 8000, maximum: 8099, sector: "healthcare", reason: "SIC falls within a healthcare-services family." },
];

export function normalizeSicCode(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, "");
  if (!digits || digits.length > 4) return null;
  return digits.padStart(4, "0");
}
