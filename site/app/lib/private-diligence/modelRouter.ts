export type ClaraModelTier = "small" | "medium" | "strong";
export type ClaraModelTask =
  | "discover_company_candidates" | "extract_company_identity" | "extract_business_profile"
  | "extract_jobs" | "extract_people" | "extract_relationships" | "classify_business_activity"
  | "interpret_hiring_signals" | "generate_quick_brief";

export async function runClaraModel<T>({ tier, task, input, schema }: {
  tier: ClaraModelTier; task: ClaraModelTask; input: unknown; schema: (value: unknown) => T;
}): Promise<T> {
  if (tier !== "medium" || task !== "discover_company_candidates") throw new Error("CLARA_MODEL_TASK_DISABLED");
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("CLARA_DISCOVERY_MODEL_NOT_CONFIGURED");
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(12_000),
    body: JSON.stringify({
      model: "deepseek-v4-pro",
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      max_tokens: 1800,
      messages: [
        {
          role: "system",
          content: "Return JSON only. Select and classify company candidates exclusively from the supplied grounded public results. Never add a company, URL, person, location, industry, or legal name that is not present in those results. Exclude likely-unrelated results.",
        },
        {
          role: "user",
          content: JSON.stringify({ task, input, outputShape: { candidates: [{ candidateId: "server-issued id from a grounded result", relationshipType: "Target operating company | Possible legal entity | Parent | Subsidiary | Affiliate | DBA / Brand", matchReasons: ["short explanation grounded in supplied result"], confidence: "High | Medium | Low" }] } }),
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`CLARA_DISCOVERY_MODEL_FAILED_${response.status}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("CLARA_DISCOVERY_MODEL_EMPTY");
  return schema(JSON.parse(content));
}
