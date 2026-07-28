import type { PlanId, RegulatoryScenario, ScenarioQuestionId } from "./types";

const BASE_QUESTIONS: ScenarioQuestionId[] = [
  "sfe-equity",
  "appointment-right",
  "sfe-debt",
  "pfe-materials",
  "substantial-us-manufacturing",
  "customer-credit-claim",
];

const PLAN_QUESTIONS: Record<PlanId, ScenarioQuestionId[]> = {
  "us-factory": ["production-direction", "supplier-direction"],
  "us-jv": ["multiple-sfe-equity", "production-direction"],
  "license-technology": [
    "sfe-license",
    "supplier-direction",
    "production-direction",
    "quantity-timing",
    "customer-output-restriction",
    "exclusive-equipment-rights",
    "royalty-over-ten-years",
    "services-over-two-years",
    "complete-technical-transfer",
  ],
  "supply-materials": ["supplier-direction", "customer-output-restriction"],
  "localize-supply-chain": ["supplier-direction", "production-direction"],
  "compare-structures": [
    "multiple-sfe-equity",
    "sfe-license",
    "supplier-direction",
    "production-direction",
    "complete-technical-transfer",
  ],
};

export function dynamicScenarioQuestions(scenario: Pick<RegulatoryScenario, "plan" | "product">) {
  if (!scenario.plan) return BASE_QUESTIONS;
  const questions = [...BASE_QUESTIONS, ...PLAN_QUESTIONS[scenario.plan]];
  if (scenario.product === "energy-storage-technology") {
    questions.push("quantity-timing", "exclusive-equipment-rights");
  }
  return [...new Set(questions)];
}

export function identifiedUncertaintyIds(scenario: RegulatoryScenario) {
  const uncertainties = scenario.answers
    .filter((answer) => answer.value === "not-sure")
    .map((answer) => answer.questionId);
  if (scenario.credit === "not-sure") uncertainties.push("credit-program" as ScenarioQuestionId);
  if (scenario.product === "not-sure") uncertainties.push("product-classification" as ScenarioQuestionId);
  return uncertainties;
}

export function requiredStepIsComplete(step: number, scenario: RegulatoryScenario) {
  if (step === 0) return scenario.industry === "ev-battery-materials";
  if (step === 1) return Boolean(scenario.role);
  if (step === 2) return Boolean(scenario.plan);
  if (step === 3) return Boolean(scenario.objective);
  if (step === 4) return Boolean(scenario.product);
  if (step === 5) return Boolean(scenario.credit);
  if (step === 6) return Boolean(scenario.year && scenario.year >= 2026 && scenario.year <= 2035);
  if (step === 7) {
    const expected = dynamicScenarioQuestions(scenario);
    return expected.every((questionId) =>
      scenario.answers.some((answer) => answer.questionId === questionId),
    );
  }
  return true;
}

