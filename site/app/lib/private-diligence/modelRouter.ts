/**
 * Reserved Clara model boundary. No model provider is activated here: research
 * facts must first be present in the evidence and claim registries.
 */
export type ClaraModelTier = "small" | "medium" | "strong";
export type ClaraModelTask =
  | "discover_company_candidates" | "extract_company_identity" | "extract_business_profile"
  | "extract_jobs" | "extract_people" | "extract_relationships" | "classify_business_activity"
  | "interpret_hiring_signals" | "generate_quick_brief";

export async function runClaraModel<T>({ tier, task, input, schema }: {
  tier: ClaraModelTier; task: ClaraModelTask; input: unknown; schema: (value: unknown) => T;
}): Promise<T> {
  void tier; void task; void input; void schema;
  throw new Error("CLARA_MODEL_DISABLED");
}
