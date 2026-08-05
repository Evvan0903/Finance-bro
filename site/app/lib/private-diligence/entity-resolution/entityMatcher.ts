import type { EntityCandidate, MatchConfidence, PrivateCompanyInput, ResolutionStatus } from "../types";

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

function hasSignal(candidate: Pick<EntityCandidate, "matchSignals">, text: string) {
  return candidate.matchSignals.includes(text);
}

export function getEntityConfirmationEligibility(
  candidate: Pick<EntityCandidate, "matchSignals" | "matchScore" | "matchConfidence" | "websiteReachable" | "resolutionStatus">,
  explicitUserConfirmation = false,
) {
  const exactDomain = hasSignal(candidate, "Exact confirmed domain match");
  const websiteName = hasSignal(candidate, "Organization name confirmed on official website");
  const termsEntity = hasSignal(candidate, "Legal entity identified in Terms or Privacy");
  const officialLegalName = hasSignal(candidate, "Exact legal name match from official record");
  const additionalSignalCount = candidate.matchSignals.filter((signal) =>
    signal !== "Exact legal name match from official record" &&
    signal !== "Website organization differs from supplied company name",
  ).length;
  const strongSignalRule = (exactDomain && websiteName) ||
    (exactDomain && termsEntity) ||
    (officialLegalName && additionalSignalCount > 0);
  const thresholdRule = candidate.matchScore >= 60;
  const lowDomainOverride = explicitUserConfirmation && exactDomain && candidate.websiteReachable;
  const canConfirm = strongSignalRule || thresholdRule || lowDomainOverride;
  const autoConfirm = canConfirm && candidate.matchConfidence === "High" && candidate.resolutionStatus !== "userConfirmed";
  return { canConfirm, autoConfirm, strongSignalRule, thresholdRule, lowDomainOverride };
}

export function scoreEntityCandidate(
  input: PrivateCompanyInput,
  candidate: Omit<EntityCandidate, "matchScore" | "matchConfidence" | "resolutionStatus" | "matchSignals">,
) {
  let score = 0;
  const signals = new Set<string>();
  const inputName = input.companyName?.trim() ?? "";
  const websiteNames = [...candidate.websiteOrganizationNames, ...candidate.pageTitles]
    .filter((name) => normalizeEntityName(name));
  const websiteNameScore = inputName
    ? Math.max(0, ...websiteNames.map((name) => similarity(inputName, name)))
    : websiteNames.length ? 1 : 0;

  if (input.website && candidate.domain && candidate.websiteReachable) {
    const inputDomain = new URL(input.website.includes("://") ? input.website : `https://${input.website}`)
      .hostname.replace(/^www\./, "").toLowerCase();
    if (inputDomain === candidate.domain.replace(/^www\./, "").toLowerCase()) {
      score += 35;
      signals.add("Exact confirmed domain match");
    }
  }
  if (websiteNameScore >= 0.8) {
    score += 20;
    signals.add("Organization name confirmed on official website");
  } else if (inputName && websiteNames.length && websiteNameScore < 0.5) {
    signals.add("Website organization differs from supplied company name");
  }
  if (candidate.termsLegalNames.length || candidate.privacyLegalNames.length) {
    score += 20;
    signals.add("Legal entity identified in Terms or Privacy");
  }
  if (candidate.registrationNumbers.length && candidate.legalName &&
      (!inputName || similarity(inputName, candidate.legalName) >= 0.8)) {
    score += 30;
    signals.add("Exact legal name match from official record");
  }
  const locationMatched = [
    input.city && candidate.city && input.city.toLowerCase() === candidate.city.toLowerCase(),
    input.state && candidate.state && input.state.toLowerCase() === candidate.state.toLowerCase(),
    input.country && candidate.country && input.country.toLowerCase() === candidate.country.toLowerCase(),
  ].some(Boolean);
  if (locationMatched) { score += 15; signals.add("Location identified on official website"); }
  if (input.founderOrExecutive && [...candidate.founders, ...candidate.executives]
    .some((name) => similarity(input.founderOrExecutive!, name) >= 0.8)) {
    score += 15;
    signals.add("Founder or executive identified on official website");
  }
  if (candidate.domain && candidate.emailDomains.some((domain) => domain.replace(/^www\./, "") === candidate.domain)) {
    score += 10;
    signals.add("Official email domain matches website");
  }
  if (input.industry && candidate.industry && similarity(input.industry, candidate.industry) >= 0.5) {
    score += 5;
    signals.add("Industry identified on official website");
  }
  const bounded = Math.min(100, score);
  const confidence: MatchConfidence = bounded >= 80 ? "High" : bounded >= 45 ? "Medium" : "Low";
  const provisional = {
    matchScore: bounded,
    matchConfidence: confidence,
    matchSignals: [...signals],
    websiteReachable: candidate.websiteReachable,
    resolutionStatus: "unresolved" as const,
  };
  const eligibility = getEntityConfirmationEligibility(provisional, false);
  const explicitEligibility = getEntityConfirmationEligibility(provisional, true);
  const resolutionStatus: ResolutionStatus = eligibility.autoConfirm
    ? "autoConfirmed"
    : explicitEligibility.canConfirm
      ? "requiresUserConfirmation"
      : "unresolved";
  return { matchScore: bounded, matchConfidence: confidence, resolutionStatus, matchSignals: [...signals] };
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
