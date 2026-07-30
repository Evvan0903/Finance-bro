export type CensusGeographyTarget = {
  name: string;
  censusFor: string;
  code: string;
  level: "nation" | "state";
};

const STATE_CODES: Record<string, { code: string; name: string }> = {
  alabama: { code: "01", name: "Alabama" },
  alaska: { code: "02", name: "Alaska" },
  arizona: { code: "04", name: "Arizona" },
  arkansas: { code: "05", name: "Arkansas" },
  california: { code: "06", name: "California" },
  colorado: { code: "08", name: "Colorado" },
  connecticut: { code: "09", name: "Connecticut" },
  delaware: { code: "10", name: "Delaware" },
  florida: { code: "12", name: "Florida" },
  georgia: { code: "13", name: "Georgia" },
  illinois: { code: "17", name: "Illinois" },
  maryland: { code: "24", name: "Maryland" },
  newyork: { code: "36", name: "New York" },
  northcarolina: { code: "37", name: "North Carolina" },
  ohio: { code: "39", name: "Ohio" },
  oregon: { code: "41", name: "Oregon" },
  pennsylvania: { code: "42", name: "Pennsylvania" },
  texas: { code: "48", name: "Texas" },
  utah: { code: "49", name: "Utah" },
  virginia: { code: "51", name: "Virginia" },
  washington: { code: "53", name: "Washington" },
};

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

export function normalizeCensusGeography(value: string): CensusGeographyTarget {
  const key = normalizedKey(value);
  if (!key || key === "us" || key === "usa" || key === "unitedstates") {
    return { name: "United States", censusFor: "us:*", code: "US", level: "nation" };
  }
  const state = STATE_CODES[key];
  if (!state) {
    throw new Error(`Unsupported Census geography: ${value}`);
  }
  return {
    name: state.name,
    censusFor: `state:${state.code}`,
    code: state.code,
    level: "state",
  };
}

export function censusGeographyTargets(geography: string, geographyB?: string) {
  const targets = [
    normalizeCensusGeography(geography),
    ...(geographyB ? [normalizeCensusGeography(geographyB)] : []),
  ];
  if (targets.some((target) => target.level === "state")) {
    targets.push(normalizeCensusGeography("United States"));
  }
  return [...new Map(targets.map((target) => [`${target.level}:${target.code}`, target])).values()];
}
