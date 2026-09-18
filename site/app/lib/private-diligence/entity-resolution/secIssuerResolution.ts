import type { EntityIdentityGraph, RawEvidence } from "../types";
import { extractFormD } from "../extraction/formDExtractor";

export type SecAddress = { street1?: string; street2?: string; city?: string; stateOrCountry?: string; zipCode?: string };
export type SecIssuerMetadata = {
  name?: string; website?: string; websites?: string;
  addresses?: { business?: SecAddress; mailing?: SecAddress };
};
export type IssuerIdentityReference = {
  evidenceId: string; sourceUrl: string | null; locator: string; excerpt: string;
  publicationDate: string | null; retrievedAt: string;
};
export type IssuerIdentitySignal = {
  code: string; references: IssuerIdentityReference[];
};
export type SecIssuerAssociation = {
  cik: string; entityId: string; secIssuerName: string | null;
  decision: "verified" | "unresolved" | "rejected";
  reasonCodes: string[]; matchedSignals: IssuerIdentitySignal[]; conflictingSignals: IssuerIdentitySignal[];
  evaluatedAt: string;
  downstreamStage?: "submissions" | "issuer_resolution" | "filing_availability" | "filing_retrieval" | "parsing" | "evidence";
  downstreamError?: string;
};

// Keep corporate suffixes: a brand, parent or similarly named subsidiary is not a legal-name match.
export const normalizeSecLegalName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const normalizeAddress = (value: string) => value.toLowerCase()
  .replace(/\bstreet\b/g, "st").replace(/\bavenue\b/g, "ave").replace(/\broad\b/g, "rd")
  .replace(/\bboulevard\b/g, "blvd").replace(/\bsuite\b/g, "ste").replace(/[^a-z0-9]/g, "");
function domain(value: string) {
  try { return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}
function sameDomain(value: string, graph: EntityIdentityGraph) {
  const host = domain(value);
  return Boolean(host && graph.domains.some((d) => host === domain(d)));
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function namePattern(name: string) {
  return name.match(/[a-z0-9]+/gi)?.map(escape).join("[\\s.,'’&-]*") ?? "(?!)";
}

/** Only already-retrieved issuer documents may be used before verification. Never fetch an unresolved issuer's filing. */
export function resolveSecIssuer(payload: SecIssuerMetadata, graph: EntityIdentityGraph, options: {
  cik: string; now: string; identityEvidence?: RawEvidence[];
}): SecIssuerAssociation {
  const cik = options.cik.padStart(10, "0");
  const matchedSignals: IssuerIdentitySignal[] = [], conflictingSignals: IssuerIdentitySignal[] = [];
  const ref = (e: RawEvidence, locator: string, excerpt: string): IssuerIdentityReference => ({
    evidenceId: e.evidenceId, sourceUrl: e.sourceUrl, locator, excerpt: excerpt.slice(0, 1000),
    publicationDate: e.publicationDate, retrievedAt: e.retrievedAt,
  });
  const graphRef = (field: string, values: string[]): IssuerIdentityReference => ({
    evidenceId: `identityGraph:${graph.entityId}`, sourceUrl: graph.confirmedWebsite ?? null,
    locator: `${field}; sources:${(graph.identityEvidenceIds ?? []).join(",")}`,
    excerpt: values.join("; "), publicationDate: null, retrievedAt: graph.confirmedAt ?? options.now,
  });
  const secRef: IssuerIdentityReference = {
    evidenceId: `sec-submissions-${cik}`, sourceUrl: `https://data.sec.gov/submissions/CIK${cik}.json`,
    locator: "name,website,addresses", excerpt: JSON.stringify({ name: payload.name, website: payload.website || payload.websites, addresses: payload.addresses }), publicationDate: null, retrievedAt: options.now,
  };
  // Reuse retrieved first-party evidence when JSON-LD extraction did not populate the graph.
  // These remain association evidence; never write them back into the confirmed snapshot.
  const trustedAddresses = graph.addresses.filter(value => /\b\d+\s+[a-z]/i.test(value) && /\b\d{5}(?:-\d{4})?\b|\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i.test(value)).map((value) => ({ value, reference: graphRef("addresses", [value]) }));
  for (const e of options.identityEvidence ?? []) {
    if (e.entityId !== graph.entityId || e.providerId !== "companyWebsite" || !sameDomain(e.sourceUrl, graph) ||
      !["privacy", "terms", "legal", "contact", "about"].includes(String(e.structuredData.pageType))) continue;
    const labels = /\b(?:Mailing|Business|Registered(?: office)?|Headquarters|Office)\s+Address:\s*(\d[^\n]{8,160}?(?:\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b|\b\d{5}(?:-\d{4})?\b))/gi;
    for (const m of e.rawText.matchAll(labels)) trustedAddresses.push({ value: m[1], reference: ref(e, `rawText:${m.index}`, m[0]) });
  }
  const add = (code: string, references: IssuerIdentityReference[], conflict = false) => {
    (conflict ? conflictingSignals : matchedSignals).push({ code, references });
  };
  const legalNames = [...graph.legalNames, ...graph.termsPageLegalNames, ...graph.privacyPageLegalNames];
  const name = payload.name ?? "";
  const legalMatch = Boolean(name && legalNames.some((n) => normalizeSecLegalName(n) === normalizeSecLegalName(name)));
  if (legalMatch) add("legal_name_match", [secRef, graphRef("legalNames", legalNames)]);
  else if (name && legalNames.length) add("legal_name_conflict", [secRef, graphRef("legalNames", legalNames)], true);
  const affiliates = [...(graph.parentCompanies ?? []), ...(graph.subsidiaries ?? []), ...(graph.affiliatedEntities ?? [])];
  if (name && affiliates.some((n) => normalizeSecLegalName(n) === normalizeSecLegalName(name))) {
    add("affiliate_relationship_unresolved", [secRef, graphRef("relatedEntities", affiliates)], true);
  }

  const issuerWebsite = payload.website || payload.websites;
  if (issuerWebsite && domain(issuerWebsite)) {
    add(sameDomain(issuerWebsite, graph) ? "official_domain_match" : "official_domain_conflict",
      [secRef, graphRef("domains", graph.domains)], !sameDomain(issuerWebsite, graph));
  }
  const compareAddress = (address: SecAddress | undefined, reference: IssuerIdentityReference, historical = false) => {
    if (!address?.street1 || !address.zipCode || !trustedAddresses.length) return false;
    const street = normalizeAddress(address.street1), postal = normalizeAddress(address.zipCode);
    // Require a street number and full postal code. City/state overlap alone is not corroboration.
    if (!/\d/.test(street) || postal.length < 4) return false;
    const streetNumber = address.street1.match(/^\s*(\d+[a-z]?)\b/i)?.[1]?.toLowerCase();
    const matches = trustedAddresses.filter(({ value }) => normalizeAddress(value).includes(street) && normalizeAddress(value).includes(postal) &&
      Boolean(streetNumber && (value.toLowerCase().match(/\b\d+[a-z]?\b/g) ?? []).some((token) => token === streetNumber)));
    if (matches.length) add(historical ? "historical_address_match" : "business_address_match", [reference, ...matches.map((a) => a.reference)]);
    else add("business_address_conflict", [reference, ...trustedAddresses.map((a) => a.reference)], true);
    return matches.length > 0;
  };
  compareAddress(payload.addresses?.business, secRef);
  // A mailing address may corroborate, but a PO box / different mailing office is not a business contradiction.
  const mailing = payload.addresses?.mailing;
  if (mailing?.street1 && mailing.zipCode && trustedAddresses.some(({ value }) => normalizeAddress(value).includes(normalizeAddress(mailing.street1!)) && normalizeAddress(value).includes(normalizeAddress(mailing.zipCode!)))) {
    compareAddress(mailing, secRef);
  }

  const historicalMatches: IssuerIdentityReference[] = [];
  for (const e of options.identityEvidence ?? []) {
    if (e.entityId !== graph.entityId) continue;
    if (e.providerId === "companyWebsite" && sameDomain(e.sourceUrl, graph) && legalMatch) {
      // A name listed in a footer, a customer story or an affiliate list is not a first-party entity statement.
      const pattern = namePattern(name);
      const brand = namePattern(graph.confirmedDisplayName ?? graph.canonicalName);
      const statement = new RegExp(`\\b${pattern}\\.?\\s*(?:[（(][“\"'‘]?\\s*(?:${brand}|we|us|our)\\s*[”\"'’]?\\s*[)）]\\s*(?:operates|owns|provides|values and respects your privacy)|(?:operates|owns|provides)\\s+(?:this|our|the)\\s+(?:website|platform|service)|values and respects your privacy)`, "i");
      const match = statement.exec(e.rawText);
      if (match && !/\b(?:subsidiary|affiliate|parent|on behalf of|customer|partner|client|example)\b/i.test(e.rawText.slice(Math.max(0, match.index - 100), match.index + match[0].length + 100))) {
        add("official_legal_entity_statement", [ref(e, `rawText:${match.index}`, e.rawText.slice(match.index, match.index + 600)), secRef]);
      }
    }
    // Do not trust third-party contact details, search snippets or a different issuer's document.
    if (e.providerId !== "secFormD" || !e.officialRecord || String(e.structuredData.cik ?? "").padStart(10, "0") !== cik ||
      !e.sourceUrl.startsWith(`https://www.sec.gov/Archives/edgar/data/${Number(cik)}/`) || !e.rawText) continue;
    const extracted = extractFormD(e.rawText);
    const reference = ref(e, "originalFormD:issuerIdentity", e.rawText.slice(0, 1000));
    if (normalizeSecLegalName(extracted.issuerLegalName ?? "") !== normalizeSecLegalName(name)) {
      add("historical_legal_name_conflict", [reference, secRef], true); continue;
    }
    const primary = e.rawText.match(/<primaryIssuer\b[^>]*>([\s\S]*?)<\/primaryIssuer>/i)?.[1] ?? "";
    const xml = (tag: string) => primary.match(new RegExp(`<${tag}\\b[^>]*>([^<]*)</${tag}>`, "i"))?.[1]?.trim();
    const address = { street1: xml("street1"), zipCode: xml("zipCode") };
    if (compareAddress(address, reference, true)) historicalMatches.push(reference);
    // Restrict to issuer-scoped fields, excluding filing agents and related-person contact details.
    const website = xml("issuerWebsite") || xml("website");
    const email = xml("issuerEmail") || xml("emailAddress");
    const host = website || email?.split("@")[1];
    if (host) add(sameDomain(host, graph) ? "official_domain_match" : "official_domain_conflict", [reference, graphRef("domains", graph.domains)], !sameDomain(host, graph));
    const supportedPeople = [...graph.founders, ...graph.executives, ...(graph.directors ?? [])];
    const people = [...new Set(extracted.relatedPersons.filter((p) => p.trim().split(/\s+/).length >= 2 && supportedPeople.some((n) => normalizeSecLegalName(n) === normalizeSecLegalName(p))).map(normalizeSecLegalName))];
    // Never let one common name decide the association. Two distinct full names must agree.
    if (people.length >= 2) add("related_person_match", [reference, graphRef("founders,executives,directors", supportedPeople)]);
    else if (people.length) add("related_person_insufficient", [reference, graphRef("founders,executives,directors", supportedPeople)]);
  }
  const distinctHistory = [...new Map(historicalMatches.map((r) => [r.sourceUrl, r])).values()];
  if (distinctHistory.length >= 2 && distinctHistory.every((r) => r.publicationDate)) add("historical_identity_consistent", distinctHistory);
  const corroborated = matchedSignals.some((s) => ["official_domain_match", "business_address_match", "related_person_match", "official_legal_entity_statement", "historical_identity_consistent"].includes(s.code));
  const decision = conflictingSignals.length
    ? (conflictingSignals.some((s) => s.code === "legal_name_conflict") && !conflictingSignals.some((s) => s.code === "affiliate_relationship_unresolved") ? "rejected" : "unresolved")
    : legalMatch && corroborated ? "verified" : "unresolved";
  return { cik, entityId: graph.entityId, secIssuerName: payload.name ?? null, decision,
    reasonCodes: [...new Set([...matchedSignals.map((s) => s.code), ...conflictingSignals.map((s) => s.code),
      ...(conflictingSignals.length ? ["identity_conflict"] : []), ...(decision === "unresolved" ? ["insufficient_corroboration"] : []), ...(decision === "rejected" ? ["candidate_rejected"] : [])])],
    matchedSignals, conflictingSignals, evaluatedAt: options.now, downstreamStage: "issuer_resolution" };
}
