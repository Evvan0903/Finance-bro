import type {
  SectorEvidenceSource,
  SectorLearningAudit,
} from "./sector-types";

export const SECTOR_RESEARCH_START_DATE = "2025-01-01";
// The research date is explicit so a deployment host's clock cannot silently
// exclude accepted public evidence that belongs in this report edition.
export const SECTOR_RESEARCH_AS_OF_DATE = "2026-07-17";
const MAX_CONCISE_TEXT_LENGTH = 1_200;

export type SectorResearchCandidate = SectorEvidenceSource & {
  relevant: boolean;
  accessible: boolean;
};

export type SectorLearningCorpus = {
  sources: SectorEvidenceSource[];
  audit: SectorLearningAudit;
};

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function canonicalUrl(value: string) {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

function missingRequiredMetadata(source: SectorResearchCandidate) {
  return [
    source.title,
    source.publisher,
    source.publicationDate,
    source.retrievalDate,
    source.sector,
    source.subindustry,
    source.topic,
    source.url,
    source.sourceType,
  ].some((value) => !value.trim()) ||
    source.geography.length === 0;
}

function conciseLearningContent(source: SectorResearchCandidate) {
  const texts = [
    source.currentEvidence.zh,
    source.currentEvidence.en,
    source.investorImplication.zh,
    source.investorImplication.en,
    ...source.generalizedMethods.flatMap((method) => [method.zh, method.en]),
  ];
  return texts.every(
    (text) => text.trim().length > 0 && text.length <= MAX_CONCISE_TEXT_LENGTH,
  );
}

function rejectionReason(
  source: SectorResearchCandidate,
  currentDate: string,
  seenUrls: Set<string>,
  seenTitles: Set<string>,
) {
  if (!source.accessible || source.access !== "public") return "not-publicly-accessible";
  if (!source.relevant) return "not-relevant";
  if (missingRequiredMetadata(source)) return "missing-required-metadata";
  if (!validDate(source.publicationDate)) return "invalid-publication-date";
  if (!validDate(source.retrievalDate)) return "invalid-retrieval-date";
  if (
    source.publicationDate < SECTOR_RESEARCH_START_DATE ||
    source.publicationDate > currentDate
  ) return "outside-publication-window";
  if (
    source.retrievalDate < source.publicationDate ||
    source.retrievalDate > currentDate
  ) return "invalid-retrieval-sequence";
  if (!source.url.startsWith("https://")) return "non-https-url";
  if (source.generalizedMethods.length === 0) return "missing-generalized-method";
  if (!conciseLearningContent(source)) return "non-concise-learning-content";

  const url = canonicalUrl(source.url);
  const title = source.title.trim().toLowerCase();
  if (seenUrls.has(url) || seenTitles.has(title)) return "duplicate-source";
  return null;
}

export function ingestSectorResearch(
  candidates: SectorResearchCandidate[],
  currentDate = SECTOR_RESEARCH_AS_OF_DATE,
): SectorLearningCorpus {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const sources: SectorEvidenceSource[] = [];
  const rejectionReasons: SectorLearningAudit["rejectionReasons"] = [];

  for (const candidate of candidates) {
    const reason = rejectionReason(candidate, currentDate, seenUrls, seenTitles);
    if (reason) {
      rejectionReasons.push({ sourceId: candidate.id, reason });
      continue;
    }

    seenUrls.add(canonicalUrl(candidate.url));
    seenTitles.add(candidate.title.trim().toLowerCase());
    const {
      relevant: _relevant,
      accessible: _accessible,
      ...source
    } = candidate;
    void _relevant;
    void _accessible;
    sources.push(source);
  }

  return {
    sources,
    audit: {
      acceptedSources: sources.length,
      rejectedSources: rejectionReasons.length,
      extractedMethods: sources.reduce(
        (count, source) => count + source.generalizedMethods.length,
        0,
      ),
      currentEvidenceItems: sources.length,
      publicationWindowStart: SECTOR_RESEARCH_START_DATE,
      publicationWindowEnd: currentDate,
      rejectionReasons,
    },
  };
}
