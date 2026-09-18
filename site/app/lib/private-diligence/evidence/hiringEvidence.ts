import { createHash } from "node:crypto";
import type { HiringActivityResult } from "../hiring/types";
import type { EntityIdentityGraph, RawEvidence } from "../types";

/**
 * Converts observed public job postings into source-backed Clara evidence.
 * A posting supports only the observation that it was open when retrieved;
 * it never establishes employee count, hiring growth, or company performance.
 */
export function hiringEvidenceFromResult(
  researchId: string,
  graph: EntityIdentityGraph,
  result: HiringActivityResult,
): RawEvidence[] {
  return result.jobs.map((job, index) => ({
    evidenceId: `hiring-${researchId}-${index + 1}`,
    researchId,
    entityId: graph.entityId,
    providerId: `hiring:${result.adapter ?? job.sourceType}`,
    sourceTier: 2,
    sourceType: `Public ${job.sourceType} job posting`,
    sourceTitle: job.title,
    sourceUrl: job.sourceUrl,
    publicReferenceUrl: job.sourceUrl,
    publicationDate: job.postedAt ?? null,
    retrievedAt: job.retrievedAt,
    rawText: job.description ?? "",
    structuredData: {
      jobId: job.id,
      sourceJobId: job.sourceJobId ?? null,
      jobTitle: job.title,
      department: job.department ?? null,
      team: job.team ?? null,
      location: job.location ?? null,
      country: job.country ?? null,
      remote: job.remote ?? null,
      employmentType: job.employmentType ?? null,
      seniority: job.seniority ?? null,
      function: job.function ?? null,
      hiringObservation: "Open public role observed at retrieval time",
      careerSourceUrl: result.selectedSource?.url ?? null,
      careerSourceType: job.sourceType,
      adapter: result.adapter,
    },
    matchedEntitySignals: [
      "Confirmed Clara target",
      `Career source: ${result.selectedSource?.url ?? job.sourceUrl}`,
    ],
    entityMatchConfidence: graph.identityConfidence,
    companyReported: true,
    officialRecord: false,
    independentlyPublished: false,
    contentHash: createHash("sha256").update(`${job.id}|${job.sourceUrl}|${job.retrievedAt}`).digest("hex"),
    limitations: [
      "A public job posting is a point-in-time observation, not evidence of headcount growth or a filled position.",
      ...result.limitations,
    ],
  }));
}
