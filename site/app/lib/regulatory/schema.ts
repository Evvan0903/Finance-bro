import type {
  CreditId,
  IndustryId,
  ObjectiveId,
  PlanId,
  ProductId,
  RegulatoryScenario,
  RoleId,
  ScenarioAnswerValue,
  ScenarioQuestionId,
} from "./types";

const INDUSTRIES: IndustryId[] = [
  "ev-battery-materials", "battery-cells-modules", "energy-storage",
  "critical-minerals", "automotive-components", "solar-manufacturing",
  "advanced-manufacturing",
];
const ROLES: RoleId[] = [
  "chinese-material-manufacturer", "technology-owner", "us-jv-participant",
  "battery-supplier", "storage-supplier", "manufacturing-investor",
];
const PLANS: PlanId[] = [
  "us-factory", "us-jv", "license-technology", "supply-materials",
  "localize-supply-chain", "compare-structures",
];
const OBJECTIVES: ObjectiveId[] = [
  "reduce-pfe-exposure", "preserve-customer-readiness", "compare-equity-licensing",
  "increase-localization", "prepare-customer-review", "identify-requirements",
];
const PRODUCTS: ProductId[] = [
  "cathode-active-material", "anode-active-material", "battery-cell",
  "battery-module", "energy-storage-technology", "applicable-critical-mineral",
  "other-battery-component", "not-sure",
];
const CREDITS: CreditId[] = ["45X", "48E", "45Y", "downstream", "not-sure"];
const QUESTIONS: ScenarioQuestionId[] = [
  "sfe-equity", "multiple-sfe-equity", "appointment-right", "sfe-debt",
  "sfe-license", "supplier-direction", "production-direction", "quantity-timing",
  "customer-output-restriction", "exclusive-equipment-rights",
  "royalty-over-ten-years", "services-over-two-years",
  "complete-technical-transfer", "pfe-materials",
  "substantial-us-manufacturing", "customer-credit-claim",
];
const ANSWERS: ScenarioAnswerValue[] = ["yes", "no", "not-sure"];

function contains<T extends string>(values: T[], value: unknown): value is T {
  return typeof value === "string" && values.includes(value as T);
}

export function emptyRegulatoryScenario(): RegulatoryScenario {
  return {
    industry: null,
    role: null,
    plan: null,
    objective: null,
    product: null,
    credit: null,
    year: null,
    answers: [],
  };
}

export function validateRegulatoryScenario(value: unknown): {
  success: boolean;
  data: RegulatoryScenario | null;
  errors: string[];
} {
  const errors: string[] = [];
  if (!value || typeof value !== "object") {
    return { success: false, data: null, errors: ["Scenario must be an object"] };
  }
  const candidate = value as Partial<RegulatoryScenario>;
  if (!contains(INDUSTRIES, candidate.industry)) errors.push("Invalid industry");
  if (!contains(ROLES, candidate.role)) errors.push("Invalid role");
  if (!contains(PLANS, candidate.plan)) errors.push("Invalid plan");
  if (!contains(OBJECTIVES, candidate.objective)) errors.push("Invalid objective");
  if (!contains(PRODUCTS, candidate.product)) errors.push("Invalid product");
  if (!contains(CREDITS, candidate.credit)) errors.push("Invalid credit");
  if (!Number.isInteger(candidate.year) || (candidate.year ?? 0) < 2026 || (candidate.year ?? 0) > 2035) {
    errors.push("Year must be between 2026 and 2035");
  }
  if (!Array.isArray(candidate.answers)) errors.push("Answers must be an array");
  const seen = new Set<string>();
  for (const answer of candidate.answers ?? []) {
    if (!contains(QUESTIONS, answer?.questionId)) errors.push("Invalid question ID");
    if (!contains(ANSWERS, answer?.value)) errors.push("Invalid answer value");
    if (seen.has(answer?.questionId)) errors.push(`Duplicate answer: ${answer.questionId}`);
    seen.add(answer?.questionId);
  }
  if (candidate.industry && candidate.industry !== "ev-battery-materials") {
    errors.push("Industry is planned but not supported");
  }
  return {
    success: errors.length === 0,
    data: errors.length ? null : candidate as RegulatoryScenario,
    errors,
  };
}

