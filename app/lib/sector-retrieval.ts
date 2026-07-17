import { MemoryCache } from "./cache";
import { CURRENT_SECTOR_EVIDENCE } from "./sector-evidence";
import { SECTOR_RESEARCH_START_DATE } from "./sector-learning-pipeline";
import { getSectorPack } from "./sector-packs";
import type {
  EvidenceChunk,
  ResearchMarket,
  SectorEvidenceSource,
  SectorOutlook,
  SupportedSubindustry,
} from "./sector-types";
import type { ResearchLocale } from "./research-types";

const VECTOR_SIZE = 96;
const OUTLOOK_TTL_MS = 6 * 60 * 60 * 1000;
const outlookCache = new MemoryCache<SectorOutlook>(OUTLOOK_TTL_MS);
const embeddingCache = new Map<string, number[]>();

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function embed(text: string) {
  const cached = embeddingCache.get(text);
  if (cached) return cached;

  const vector = Array<number>(VECTOR_SIZE).fill(0);
  for (const token of tokenize(text)) {
    const hash = hashToken(token);
    const position = hash % VECTOR_SIZE;
    const sign = (hash & 1) === 0 ? 1 : -1;
    vector[position] += sign * (1 + Math.log1p(token.length));
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  const normalized = vector.map((value) => value / magnitude);
  embeddingCache.set(text, normalized);
  return normalized;
}

function cosine(a: number[], b: number[]) {
  return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

function geographyMatches(source: SectorEvidenceSource, market: ResearchMarket) {
  if (source.geography.includes("Global")) return true;
  if (market === "Global") return source.geography.includes("International");
  if (market === "US") {
    return source.geography.includes("US") || source.geography.includes("North America");
  }
  return source.geography.includes("Europe") || source.geography.includes("International");
}

function filteredSources(market: ResearchMarket, subindustry: SupportedSubindustry) {
  const pack = getSectorPack(subindustry);
  const today = new Date().toISOString().slice(0, 10);
  return CURRENT_SECTOR_EVIDENCE.filter(
    (source) =>
      source.sector === pack.sector &&
      source.subindustry === subindustry &&
      source.publicationDate >= "2025-01-01" &&
      source.publicationDate <= today &&
      geographyMatches(source, market),
  );
}

function retrieveChunks(
  market: ResearchMarket,
  subindustry: SupportedSubindustry,
  locale: ResearchLocale,
) {
  const pack = getSectorPack(subindustry);
  const query = [
    ...pack.marketDrivers.map((driver) => driver.query),
    ...pack.researchQuestions.map((question) => question[locale]),
    ...pack.reportGuidance.map((guidance) => guidance[locale]),
  ].join(" ");
  const queryVector = embed(query);

  return filteredSources(market, subindustry)
    .flatMap((source): EvidenceChunk[] => {
      const methodChunks = source.generalizedMethods.map((method, index) => ({
        id: `${source.id}:method:${index}`,
        source,
        kind: "method" as const,
        text: method[locale],
        score: cosine(queryVector, embed(`${source.topic} ${method[locale]}`)),
      }));
      return [{
        id: `${source.id}:summary`,
        source,
        kind: "summary",
        text: source.currentEvidence[locale],
        score: cosine(queryVector, embed(`${source.topic} ${source.currentEvidence[locale]}`)),
      },
      ...methodChunks];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function buildOutlook(
  market: ResearchMarket,
  subindustry: SupportedSubindustry,
  locale: ResearchLocale,
): SectorOutlook {
  const pack = getSectorPack(subindustry);
  const eligibleSources = filteredSources(market, subindustry);
  const chunks = retrieveChunks(market, subindustry, locale);
  const sourceById = new Map<string, SectorEvidenceSource>();
  for (const chunk of chunks) {
    if (chunk.kind === "summary") sourceById.set(chunk.source.id, chunk.source);
  }
  const sources = [...sourceById.values()].slice(0, 4);
  const now = new Date().toISOString();
  const evidenceCutoff =
    sources.map((source) => source.publicationDate).sort().at(-1) ?? "2025-01-01";

  return {
    sector: pack.sector,
    subindustry,
    market,
    evidenceCutoff,
    lastRefreshedAt: now,
    claims: sources.map((source) => ({
      claim: source.currentEvidence[locale],
      whyItMatters: source.investorImplication[locale],
      publisher: source.publisher,
      publicationDate: source.publicationDate,
      title: source.title,
      url: source.url,
      topic: source.topic,
    })),
    insufficientEvidence: sources.length < 2,
    methodology:
      locale === "zh"
        ? "先按行业、子行业、地区和发布日期过滤，再对原创摘要与方法片段进行本地确定性向量检索；不载入完整报告。"
        : "Sources are filtered by sector, subindustry, geography, and publication date before local deterministic vector retrieval over original summary and method chunks; full reports are never loaded.",
    learningAudit: {
      acceptedSources: eligibleSources.length,
      rejectedSources: 0,
      extractedMethods: eligibleSources.reduce(
        (count, source) => count + source.generalizedMethods.length,
        0,
      ),
      currentEvidenceItems: eligibleSources.length,
      publicationWindowStart: SECTOR_RESEARCH_START_DATE,
      publicationWindowEnd: new Date().toISOString().slice(0, 10),
    },
  };
}

export function getSectorOutlook(
  market: ResearchMarket,
  subindustry: SupportedSubindustry,
  locale: ResearchLocale,
  refresh = false,
) {
  const key = `${market}:${subindustry}:${locale}`;
  if (refresh) outlookCache.delete(key);
  return outlookCache.getOrLoad(key, async () => buildOutlook(market, subindustry, locale));
}

export function sectorEvidenceSources(
  market: ResearchMarket,
  subindustry: SupportedSubindustry,
) {
  return filteredSources(market, subindustry);
}
