function text(document: string, tags: string[]) {
  for (const tag of tags) {
    const value = document.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]
      ?.replace(/<[^>]+>/g, " ").replace(/&amp;/gi, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
    if (value) return value;
  }
  return null;
}

function numberValue(value: string | null) {
  if (!value || /indefinite|decline|not disclosed/i.test(value)) return null;
  const numeric = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

export type ExtractedFormD = {
  issuerLegalName: string | null;
  jurisdiction: string | null;
  principalPlaceOfBusiness: string | null;
  industryGroup: string | null;
  relatedPersons: string[];
  offeringType: string | null;
  offeringAmount: number | null;
  amountSold: number | null;
  remainingAmount: number | null;
  firstSaleDate: string | null;
  numberOfInvestors: number | null;
};

export function extractFormD(document: string): ExtractedFormD {
  const relatedPersons = [...document.matchAll(/<(?:relatedPersonInfo|relatedPerson)\b[^>]*>([\s\S]*?)<\/(?:relatedPersonInfo|relatedPerson)>/gi)]
    .map((match) => {
      const first = text(match[1], ["firstName"]);
      const middle = text(match[1], ["middleName"]);
      const last = text(match[1], ["lastName"]);
      return [first, middle, last].filter(Boolean).join(" ");
    }).filter(Boolean);
  return {
    issuerLegalName: text(document, ["entityName", "issuerName", "primaryName"]),
    jurisdiction: text(document, ["jurisdictionOfInc", "jurisdictionOfIncorporation"]),
    principalPlaceOfBusiness: [
      text(document, ["street1", "streetAddress"]),
      text(document, ["city"]), text(document, ["stateOrCountry", "state"]), text(document, ["zipCode", "postalCode"]),
    ].filter(Boolean).join(", ") || null,
    industryGroup: text(document, ["industryGroupType", "industryGroup"]),
    relatedPersons: [...new Set(relatedPersons)],
    offeringType: text(document, ["typeOfSecurity", "securityType"]),
    offeringAmount: numberValue(text(document, ["totalOfferingAmount"])),
    amountSold: numberValue(text(document, ["totalAmountSold"])),
    remainingAmount: numberValue(text(document, ["totalRemaining"])),
    firstSaleDate: text(document, ["dateOfFirstSale"]),
    numberOfInvestors: numberValue(text(document, ["totalNumberAlreadyInvested", "numberOfInvestors"])),
  };
}
