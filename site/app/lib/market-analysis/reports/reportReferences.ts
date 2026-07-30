import type { MarketSourceReference, ProviderResult } from "../types";

export function buildReportReferences(providerResults: ProviderResult[]) {
  const unique = new Map<string, MarketSourceReference & { periods: string[] }>();
  for (const reference of providerResults.flatMap((result) => result.references)) {
    const key = `${reference.providerId}|${reference.dataset}|${reference.seriesOrTableId}|${reference.geography}|${reference.units}`;
    const current = unique.get(key);
    if (current) {
      current.periods.push(reference.observationPeriod);
    } else {
      unique.set(key, { ...reference, periods: [reference.observationPeriod] });
    }
  }
  return [...unique.values()]
    .map(({ periods, ...reference }) => {
      const ordered = [...new Set(periods)].sort();
      return {
        ...reference,
        observationPeriod: ordered.length > 1
          ? `${ordered[0]}–${ordered[ordered.length - 1]}`
          : ordered[0],
      };
    })
    .sort((left, right) =>
      left.providerName.localeCompare(right.providerName) ||
      left.seriesOrTableId.localeCompare(right.seriesOrTableId) ||
      left.observationPeriod.localeCompare(right.observationPeriod),
    )
    .map((reference, index) => ({ ...reference, number: index + 1 }));
}

export function validateReferences(
  references: Array<MarketSourceReference & { number: number }>,
) {
  const findings: string[] = [];
  references.forEach((reference, index) => {
    if (reference.number !== index + 1) findings.push("Reference numbering is not sequential");
    if (!reference.officialSourceUrl.startsWith("https://")) {
      findings.push(`Reference ${reference.number} is missing an official HTTPS link`);
    }
    if (/[?&](?:api_?key|key|userid|user_id)=/i.test(reference.officialSourceUrl)) {
      findings.push(`Reference ${reference.number} contains a credential query parameter`);
    }
  });
  return [...new Set(findings)];
}
