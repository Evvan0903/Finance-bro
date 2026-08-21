import { createHash } from "node:crypto";
import { fetchOfficialJson } from "../../market-analysis/security";
import { normalizeEntityName } from "../entity-resolution/entityMatcher";
import type { RawEvidence } from "../types";
import type { PrivateCompanyProvider } from "./providerTypes";

type Recipient = { recipient_name?: string; recipient_id?: string; uei?: string; legal_entity_id?: number };
type Award = Record<string, unknown>;

const AWARD_TYPE_GROUPS = [
  ["A", "B", "C", "D"],
  ["02", "03", "04", "05", "F001", "F002"],
  ["07", "08", "F003", "F004"],
  ["06", "10", "F006", "F007"],
  ["09", "11", "-1", "F005", "F008", "F009", "F010"],
  ["IDV_A", "IDV_B", "IDV_B_A", "IDV_B_B", "IDV_B_C", "IDV_C", "IDV_D", "IDV_E"],
] as const;

function recipientRows(payload: unknown) {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  if (Array.isArray(results)) return results as Recipient[];
  if (results && typeof results === "object") {
    const record = results as Record<string, unknown>;
    return [...(Array.isArray(record.recipients) ? record.recipients : []),
      ...(Array.isArray(record.recipient) ? record.recipient : []),
      ...(Array.isArray(record.parent_recipient) ? record.parent_recipient : [])] as Recipient[];
  }
  return [];
}

export function createUsaSpendingProvider(fetchImpl: typeof fetch = fetch): PrivateCompanyProvider {
  return {
    providerId: "usaSpending",
    providerName: "USAspending.gov",
    sourceTier: 1,
    providerCategory: "governmentContract",
    isConfigured: () => true,
    supports: (context) => Boolean(context.identityGraph.canonicalName) && /united states|usa|u\.s\./i.test(context.input.country ?? "United States"),
    validateConfiguration: () => "success",
    search: async (context) => {
      const names = [context.identityGraph.canonicalName, ...context.identityGraph.legalNames, ...context.identityGraph.dbaNames].slice(0, 5);
      const accepted: Recipient[] = [];
      let rejectedWeakMatches = 0;
      for (const name of names) {
        const payload = await fetchOfficialJson<unknown>(
          "https://api.usaspending.gov/api/v2/autocomplete/recipient/",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ search_text: name, limit: 10 }),
            cacheTtlMs: 30 * 60 * 1_000,
          },
          fetchImpl,
        );
        for (const recipient of recipientRows(payload)) {
          if (!recipient.recipient_name) continue;
          if (normalizeEntityName(recipient.recipient_name) === normalizeEntityName(name)) accepted.push(recipient);
          else rejectedWeakMatches += 1;
        }
      }
      const unique = [...new Map(accepted.map((item) => [normalizeEntityName(item.recipient_name ?? ""), item])).values()];
      return { status: unique.length ? "success" as const : "noData" as const, records: unique, rejectedWeakMatches };
    },
    fetchDetails: async (records, context) => {
      const awards: Award[] = [];
      for (const recipient of records as Recipient[]) {
        const name = recipient.recipient_name ?? context.identityGraph.canonicalName;
        for (let index = 0; index < AWARD_TYPE_GROUPS.length; index += 3) {
          const payloads = await Promise.allSettled(AWARD_TYPE_GROUPS.slice(index, index + 3).map((awardTypeCodes) =>
            fetchOfficialJson<{ results?: Award[] }>(
              "https://api.usaspending.gov/api/v2/search/spending_by_award/",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  filters: {
                    recipient_search_text: [name],
                    time_period: [{ start_date: "2007-10-01", end_date: context.now().toISOString().slice(0, 10) }],
                    award_type_codes: awardTypeCodes,
                  },
                  fields: ["Award ID", "Recipient Name", "Award Amount", "Description", "Start Date", "End Date", "Awarding Agency", "Funding Agency", "Award Type"],
                  page: 1,
                  limit: 25,
                  sort: "Award Amount",
                  order: "desc",
                  subawards: false,
                }),
                cacheTtlMs: 30 * 60 * 1_000,
              },
              fetchImpl,
            )));
          for (const result of payloads) {
            if (result.status !== "fulfilled") continue;
            const payload = result.value;
            for (const award of payload.results ?? []) {
              if (normalizeEntityName(String(award["Recipient Name"] ?? "")) === normalizeEntityName(name)) awards.push(award);
            }
          }
        }
      }
      return [...new Map(awards.map((award) => [
        String(award.generated_internal_id ?? `${award["Award ID"] ?? ""}|${award["Recipient Name"] ?? ""}|${award["Award Type"] ?? ""}`),
        award,
      ])).values()]
        .sort((left, right) => Number(right["Award Amount"] ?? 0) - Number(left["Award Amount"] ?? 0))
        .slice(0, 25);
    },
    normalize: async (records, context) => (records as Award[]).map((award, index): RawEvidence => {
      const awardId = String(award["Award ID"] ?? award.generated_internal_id ?? `award-${index + 1}`);
      return {
        evidenceId: `usaspending-${context.researchId}-${index + 1}`,
        researchId: context.researchId,
        entityId: context.identityGraph.entityId,
        providerId: "usaSpending",
        sourceTier: 1,
        sourceType: "Federal award record",
        sourceTitle: `USAspending award ${awardId}`,
        sourceUrl: "https://api.usaspending.gov/api/v2/search/spending_by_award/",
        publicReferenceUrl: "https://www.usaspending.gov/search",
        publicationDate: typeof award["Start Date"] === "string" ? award["Start Date"] : null,
        retrievedAt: context.now().toISOString(),
        rawText: "",
        structuredData: {
          recipientName: award["Recipient Name"] ?? null,
          awardId,
          awardType: award["Award Type"] ?? null,
          awardAmount: typeof award["Award Amount"] === "number" ? award["Award Amount"] : null,
          awardingAgency: award["Awarding Agency"] ?? null,
          fundingAgency: award["Funding Agency"] ?? null,
          startDate: award["Start Date"] ?? null,
          endDate: award["End Date"] ?? null,
          description: award.Description ?? null,
        },
        matchedEntitySignals: ["Exact normalized recipient-name match"],
        entityMatchConfidence: "Medium",
        companyReported: false,
        officialRecord: true,
        independentlyPublished: false,
        contentHash: createHash("sha256").update(`usaspending|${awardId}`).digest("hex"),
        limitations: ["Recipient matching requires exact normalized legal or DBA name; name-only near matches are excluded."],
      };
    }),
    buildPublicReference: (evidence: RawEvidence) => evidence.publicReferenceUrl,
  };
}
