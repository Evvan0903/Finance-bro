import type { EntityCandidate, MatchConfidence, PrivateCompanyInput } from "../types";

export function normalizeEntityName(value: string) {
  return value.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(incorporated|inc|corp|corporation|company|co|limited|ltd|llc|lp|pllc|pbc)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim().replace(/\s+/g, " ");
}

function similarity(left: string, right: string) {
  const a = normalizeEntityName(left);
  const b = normalizeEntityName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const leftTokens = new Set(a.split(" "));
  const rightTokens = new Set(b.split(" "));
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return shared / Math.max(leftTokens.size, rightTokens.size);
}

export function scoreEntityCandidate(
  input: PrivateCompanyInput,
  candidate: Omit<EntityCandidate, "matchScore" | "matchConfidence" | "resolutionStatus" | "matchSignals">,
) {
  let score = 0;
  const signals: string[] = [];
  const independentlyObservedNames = candidate.legalName
    ? [candidate.legalName, ...candidate.dbaNames]
    : candidate.sourceIds.length
      ? candidate.dbaNames
      : [candidate.displayName, ...candidate.dbaNames];
  const nameScore = Math.max(0,
    ...independentlyObservedNames.map((name) => similarity(input.companyName, name)),
  );
  if (nameScore === 1) { score += 28; signals.push("Exact legal or operating name match"); }
  else if (nameScore >= 0.5) { score += 10; signals.push("Fuzzy name match"); }
  if (input.website && candidate.domain) {
    const inputDomain = new URL(input.website.includes("://") ? input.website : `https://${input.website}`).hostname.replace(/^www\./, "");
    if (inputDomain === candidate.domain.replace(/^www\./, "")) {
      score += 35; signals.push("Exact confirmed domain match");
    }
  }
  if (input.city && candidate.city && input.city.toLowerCase() === candidate.city.toLowerCase()) {
    score += 8; signals.push("City match");
  }
  if (input.state && candidate.state && input.state.toLowerCase() === candidate.state.toLowerCase()) {
    score += 7; signals.push("State match");
  }
  if (input.country && candidate.country && input.country.toLowerCase() === candidate.country.toLowerCase()) {
    score += 4; signals.push("Country match");
  }
  if (input.founderOrExecutive && [...candidate.founders, ...candidate.executives]
    .some((name) => similarity(input.founderOrExecutive!, name) >= 0.8)) {
    score += 12; signals.push("Founder or executive match");
  }
  if (input.industry && candidate.industry && similarity(input.industry, candidate.industry) >= 0.5) {
    score += 6; signals.push("Industry match");
  }
  if (candidate.registrationNumbers.length) {
    score += 20; signals.push("Official registration identifier available");
  }
  const bounded = Math.min(100, score);
  const confidence: MatchConfidence = bounded >= 80 ? "High" : bounded >= 45 ? "Medium" : "Low";
  const resolutionStatus = bounded >= 90 && candidate.registrationNumbers.length
    ? "autoConfirmed"
    : bounded >= 45
      ? "requiresUserConfirmation"
      : "unresolved";
  return { matchScore: bounded, matchConfidence: confidence, resolutionStatus, matchSignals: signals } as const;
}

export function candidatesAreDistinct(left: EntityCandidate, right: EntityCandidate) {
  if (left.registrationNumbers.length && right.registrationNumbers.length) {
    return !left.registrationNumbers.some((number) => right.registrationNumbers.includes(number));
  }
  if (left.domain && right.domain) return left.domain !== right.domain;
  return normalizeEntityName(left.legalName ?? left.displayName) !== normalizeEntityName(right.legalName ?? right.displayName) ||
    [left.city, left.state, left.country].join("|").toLowerCase() !==
    [right.city, right.state, right.country].join("|").toLowerCase();
}
