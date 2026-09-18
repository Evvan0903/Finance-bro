import { discoverEntityCandidates } from "../entity-resolution/candidateDiscovery";
import { getEntityConfirmationEligibility } from "../entity-resolution/entityMatcher";
import { parsePrivateCompanyInput } from "../schema";
import type { EntityCandidate, EntityIdentityGraph, PrivateCompanyInput, RawEvidence } from "../types";
import type { ClaraTool, ClaraToolResult } from "./types";
import { isConfirmedToolContext, toolMetadata } from "./types";

export type CompanyIdentityToolInput = { company: PrivateCompanyInput };
export type CompanyIdentityToolOutput = {
  candidates: EntityCandidate[];
  confirmableCandidateIds: string[];
  confirmedEntity: EntityIdentityGraph | null;
  websiteStatus: "notProvided" | "reachable" | "unreachable" | "insufficientIdentity" | "alreadyConfirmed";
};

type DiscoverIdentity = typeof discoverEntityCandidates;

export function createCompanyIdentityTool(dependencies: { discover?: DiscoverIdentity } = {}): ClaraTool<CompanyIdentityToolInput, CompanyIdentityToolOutput> {
  const discover = dependencies.discover ?? discoverEntityCandidates;
  const name = "company_identity";
  return {
    name,
    description: "Discover or validate a Clara company target without bypassing explicit candidate confirmation",
    inputSchema: {
      type: "object",
      required: ["company"],
      properties: { company: { type: "object", description: "Validated Clara private-company identifiers and research settings" } },
      additionalProperties: false,
    },
    async execute(input, context): Promise<ClaraToolResult<CompanyIdentityToolOutput>> {
      const startedAt = (context.now ?? (() => new Date()))().toISOString();
      if (!input || typeof input !== "object" || Object.keys(input).some((key) => key !== "company")) {
        return { status: "failed", observations: [], evidence: [], gaps: [], errors: [{ code: "invalid_tool_input", message: "Company Identity accepts only the company input object", retryable: false }], metadata: toolMetadata(name, startedAt, context, []) };
      }
      if (!context.researchId.trim()) {
        const evidence: RawEvidence[] = [];
        return { status: "failed", observations: [], evidence, gaps: [], errors: [{ code: "invalid_research_context", message: "A research request ID is required", retryable: false }], metadata: toolMetadata(name, startedAt, context, evidence) };
      }
      try {
        const company = parsePrivateCompanyInput(input?.company);
        if (isConfirmedToolContext(context) && context.identityGraph) {
          const output: CompanyIdentityToolOutput = { candidates: [], confirmableCandidateIds: [], confirmedEntity: context.identityGraph, websiteStatus: "alreadyConfirmed" };
          return {
            status: "success", data: output,
            observations: [{ code: "confirmed_target_preserved", topic: "company identity", description: `The existing selected target ${context.identityGraph.canonicalName} was preserved`, evidenceIds: [] }],
            evidence: [], gaps: [], errors: [], metadata: toolMetadata(name, startedAt, context, []),
          };
        }
        const discovery = await discover(context.researchId, company);
        const confirmableCandidateIds = discovery.candidates
          .filter((candidate) => getEntityConfirmationEligibility(candidate, true).canConfirm)
          .map((candidate) => candidate.candidateId);
        const evidence = discovery.websiteEvidence;
        const noCandidates = discovery.candidates.length === 0;
        const noConfirmableCandidate = !noCandidates && confirmableCandidateIds.length === 0;
        const output: CompanyIdentityToolOutput = {
          candidates: discovery.candidates,
          confirmableCandidateIds,
          confirmedEntity: null,
          websiteStatus: discovery.websiteStatus,
        };
        return {
          status: noConfirmableCandidate ? "partial" : "success",
          data: output,
          observations: discovery.candidates.length ? [{
            code: "grounded_candidates_discovered", topic: "company identity",
            description: `${discovery.candidates.length} grounded company candidate${discovery.candidates.length === 1 ? " was" : "s were"} discovered; explicit confirmation is still required`,
            evidenceIds: evidence.map((item) => item.evidenceId),
          }] : [],
          evidence,
          gaps: [
            ...(noCandidates ? [{ code: "company_identity_not_found", topic: "company identity", description: "No grounded company candidate was found from the supplied identifiers", severity: "high" as const, retryable: true }] : []),
            ...(noConfirmableCandidate ? [{ code: "company_identity_incomplete", topic: "company identity", description: "Candidates were found but current identity evidence is insufficient for confirmation", severity: "high" as const, retryable: true }] : []),
          ],
          errors: [],
          metadata: toolMetadata(name, startedAt, context, evidence),
        };
      } catch {
        const evidence: RawEvidence[] = [];
        return { status: "failed", observations: [], evidence, gaps: [], errors: [{ code: "company_identity_failed", message: "Company identity discovery did not complete", retryable: true }], metadata: toolMetadata(name, startedAt, context, evidence) };
      }
    },
  };
}

export const companyIdentityTool = createCompanyIdentityTool();
