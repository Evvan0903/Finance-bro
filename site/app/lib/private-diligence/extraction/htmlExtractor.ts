function decode(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(value: string) {
  return decode(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function metaContent(html: string, key: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const name = tag.match(/(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (name?.toLowerCase() !== key.toLowerCase()) continue;
    return decode(tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1] ?? "").trim();
  }
  return null;
}

function jsonLdBlocks(html: string) {
  const blocks: unknown[] = [];
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else if (parsed?.["@graph"] && Array.isArray(parsed["@graph"])) blocks.push(...parsed["@graph"]);
      else blocks.push(parsed);
    } catch {
      // Malformed optional JSON-LD is ignored; visible HTML remains available.
    }
  }
  return blocks.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
}

function names(value: unknown): string[] {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((item) => {
    if (typeof item === "string") return [item.trim()];
    if (item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string") {
      return [(item as { name: string }).name.trim()];
    }
    return [];
  }).filter(Boolean);
}

function addresses(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.flatMap((item) => {
    if (typeof item === "string") return [item.trim()];
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const parts = ["streetAddress", "addressLocality", "addressRegion", "postalCode", "addressCountry"]
      .map((key) => typeof record[key] === "string" ? record[key].trim() : "")
      .filter(Boolean);
    return parts.length ? [parts.join(", ")] : [];
  });
}

function organizationRecords(jsonLd: Record<string, unknown>[]) {
  return jsonLd.filter((item) => {
    const type = item["@type"];
    return type === "Organization" || type === "Corporation" ||
      (Array.isArray(type) && type.some((entry) => entry === "Organization" || entry === "Corporation"));
  });
}

function addressFields(value: unknown, field: string) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    return typeof record[field] === "string" && record[field].trim() ? [record[field].trim()] : [];
  });
}

function legalEntityMentions(text: string) {
  const pattern = /\b([A-Z][A-Za-z0-9&'’.,-]*(?:\s+[A-Z][A-Za-z0-9&'’.,-]*){0,7}\s+(?:Inc(?:orporated)?\.?|L\.?L\.?C\.?|Ltd\.?|Limited|Corporation|Corp\.?|Company|PBC|PLC|GmbH|S\.?A\.?|B\.?V\.?))\b/g;
  return [...text.matchAll(pattern)].map((match) => match[1].replace(/\s+/g, " ").trim()).slice(0, 20);
}

function linkedUrls(html: string) {
  return [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>/gi)]
    .map((match) => decode(match[1]).trim()).filter(Boolean).slice(0, 300);
}

export type ExtractedFactCandidate = {
  factType: "product" | "service" | "executiveRole";
  value: string;
  personName: string | null;
  role: string | null;
  temporalStatus: "current" | "historical" | "notApplicable";
  excerpt: string;
  locator: string | null;
  extractionMethod: "jsonLd" | "visibleText";
};

type ContentBlock = { text: string; locator: string };

function hasJsonLdType(item: Record<string, unknown>, expected: string) {
  const type = item["@type"];
  return type === expected || (Array.isArray(type) && type.includes(expected));
}

function bounded(value: string, maximum: number) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length <= maximum ? cleaned : `${cleaned.slice(0, maximum - 1).trim()}…`;
}

function visibleContentBlocks(html: string, description: string | null) {
  const withoutNoise = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(?:nav|header|footer|aside|form|svg|button)\b[^>]*>[\s\S]*?<\/(?:nav|header|footer|aside|form|svg|button)>/gi, " ");
  const main = withoutNoise.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    ?? withoutNoise.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    ?? withoutNoise;
  const blocks: ContentBlock[] = [];
  if (description) blocks.push({ text: bounded(description, 600), locator: "meta description" });
  for (const match of main.matchAll(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>([\s\S]{0,1800}?)(?=<h[1-4]\b|<\/(?:main|section|article)>|$)/gi)) {
    const heading = cleanText(match[2]);
    const text = cleanText(`${match[2]} ${match[3]}`);
    if (heading && text.length >= 8) blocks.push({ text: bounded(text, 900), locator: bounded(heading, 140) });
  }
  for (const match of main.matchAll(/<(article|section|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = cleanText(match[2]);
    if (text.length < 8 || text.length > 900) continue;
    const heading = cleanText(match[2].match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i)?.[1] ?? "");
    blocks.push({ text, locator: heading ? bounded(heading, 140) : `${match[1].toLowerCase()} block` });
  }
  const unique = new Map<string, ContentBlock>();
  for (const block of blocks) if (!unique.has(block.text)) unique.set(block.text, block);
  return [...unique.values()].slice(0, 120);
}

function offeringFactType(value: string): ExtractedFactCandidate["factType"] | null {
  return /\b(?:platform|software|datasets?|products?|tools?|applications?|hardware|devices?|systems?)\b/i.test(value)
    ? "product"
    : /\b(?:services?|consulting|support|research|analysis|management|security|collection|cleaning|annotation|training|evaluation|staffing|outsourcing|banking|payments|financing|insurance|logistics|delivery)\b/i.test(value) ? "service" : null;
}

function offeringCandidates(blocks: ContentBlock[]) {
  const output: ExtractedFactCandidate[] = [];
  const statement = /\b(?:we|[A-Z][A-Za-z0-9&.'’()-]*(?:\s+[A-Z][A-Za-z0-9&.'’()-]*){0,5})\s+(?:offers?|provides?|delivers?|speciali[sz]es?\s+in)\s+([^.!?]{3,240})[.!?]/g;
  for (const block of blocks) {
    for (const match of block.text.matchAll(statement)) {
      const offering = match[1].split(/\s+(?:for|to help|that helps|designed for)\s+/i)[0].trim();
      const values = offering.split(/\s*,\s*|\s+(?:and|or)\s+/i)
        .map((value) => value.replace(/^(?:(?:and|or)\s+)?(?:both|including|such as|a|an|the)?\s*/i, "").trim())
        .filter((value) => value.length >= 3 && value.length <= 100 && /[A-Za-z]/.test(value))
        .filter((value) => !/^(?:collecting|building|helping|providing|covering|using|delivering)\b/i.test(value))
        .filter((value) => !/\b(?:that|which)\s+(?:combines?|helps?|enables?|uses?)\b/i.test(value));
      for (const value of values.slice(0, 8)) {
        const factType = offeringFactType(value);
        if (!factType) continue;
        output.push({
          factType,
          value: bounded(value, 120),
          personName: null,
          role: null,
          temporalStatus: "notApplicable",
          excerpt: bounded(match[0], 320),
          locator: block.locator,
          extractionMethod: "visibleText",
        });
      }
    }
  }
  return output;
}

const PERSON_NAME = "([A-Z][A-Za-z'’.-]+(?:\\s+[A-Z][A-Za-z'’.-]+){1,2})";
const EXECUTIVE_ROLE = "(CEO|CFO|COO|CTO|CMO|CPO|Chief\\s+[A-Za-z-]+(?:\\s+[A-Za-z-]+){0,3}\\s+Officer|President|Vice President(?:\\s+of\\s+[A-Z][A-Za-z-]*(?:\\s+[A-Z][A-Za-z-]*){0,3})?|VP(?:\\s+of\\s+[A-Z][A-Za-z-]*(?:\\s+[A-Z][A-Za-z-]*){0,3})?|Managing Director|Executive Director)";

function plausiblePersonName(value: string) {
  const tokens = value.split(/\s+/);
  const blocked = /^(?:the|to|look|meet|team|our|your|company|leadership|executive|founder|university\.?|c-suites?)$/i;
  return tokens.length >= 2 && tokens.length <= 3 && tokens.every((token) => !blocked.test(token));
}

function canonicalExecutiveRole(value: string) {
  const role = value.trim().toLowerCase();
  const known: Array<[RegExp, string]> = [
    [/^(?:ceo|chief executive officer)$/, "CEO"],
    [/^(?:cfo|chief financial officer)$/, "CFO"],
    [/^(?:coo|chief operating officer)$/, "COO"],
    [/^(?:cto|chief technology officer)$/, "CTO"],
    [/^(?:cmo|chief marketing officer)$/, "CMO"],
    [/^(?:cpo|chief product officer)$/, "CPO"],
  ];
  return known.find(([pattern]) => pattern.test(role))?.[1] ?? role;
}

function executiveCandidates(blocks: ContentBlock[]) {
  const output: ExtractedFactCandidate[] = [];
  const historical = new RegExp(`${PERSON_NAME}\\s+(?:formerly|previously)\\s+(?:served|worked)?\\s*(?:as\\s+)?${EXECUTIVE_ROLE}\\b`, "g");
  const former = new RegExp(`${PERSON_NAME}\\s+(?:is\\s+)?(?:a\\s+)?former\\s+${EXECUTIVE_ROLE}\\b`, "g");
  const current = new RegExp(`${PERSON_NAME}\\s+(?:is\\s+(?:the\\s+)?)?${EXECUTIVE_ROLE}\\b`, "g");
  for (const block of blocks) {
    const historicalRanges: Array<[number, number]> = [];
    for (const pattern of [historical, former]) {
      pattern.lastIndex = 0;
      for (const match of block.text.matchAll(pattern)) {
        if (!plausiblePersonName(match[1])) continue;
        historicalRanges.push([match.index, match.index + match[0].length]);
        output.push({
          factType: "executiveRole",
          value: `${match[1]} — ${match[2]}`,
          personName: match[1],
          role: match[2],
          temporalStatus: "historical",
          excerpt: bounded(match[0], 320),
          locator: block.locator,
          extractionMethod: "visibleText",
        });
      }
    }
    current.lastIndex = 0;
    for (const match of block.text.matchAll(current)) {
      if (!plausiblePersonName(match[1])) continue;
      const start = match.index;
      const end = start + match[0].length;
      if (historicalRanges.some(([left, right]) => start >= left && end <= right)) continue;
      output.push({
        factType: "executiveRole",
        value: `${match[1]} — ${match[2]}`,
        personName: match[1],
        role: match[2],
        temporalStatus: "current",
        excerpt: bounded(match[0], 320),
        locator: block.locator,
        extractionMethod: "visibleText",
      });
    }
  }
  return output;
}

function deduplicateFactCandidates(candidates: ExtractedFactCandidate[]) {
  const unique = new Map<string, ExtractedFactCandidate>();
  for (const candidate of candidates) {
    const key = candidate.factType === "executiveRole"
      ? [candidate.factType, candidate.personName, canonicalExecutiveRole(candidate.role ?? ""), candidate.temporalStatus].join("|").toLowerCase()
      : [candidate.factType, candidate.value, candidate.temporalStatus].join("|").toLowerCase();
    const existing = unique.get(key);
    const moreSpecificRole = candidate.factType === "executiveRole" && (candidate.role?.length ?? 0) > (existing?.role?.length ?? 0);
    if (!existing || moreSpecificRole || (existing.extractionMethod === "visibleText" && candidate.extractionMethod === "jsonLd")) {
      unique.set(key, candidate);
    }
  }
  return [...unique.values()].slice(0, 80);
}

export type ExtractedCompanyPage = {
  title: string;
  description: string | null;
  headings: string[];
  bodyText: string;
  organizationNames: string[];
  legalNames: string[];
  alternateNames: string[];
  founders: string[];
  organizationFounders: string[];
  executives: string[];
  addresses: string[];
  phoneNumbers: string[];
  socialProfiles: string[];
  products: string[];
  services: string[];
  emailDomains: string[];
  cities: string[];
  states: string[];
  countries: string[];
  industryLabels: string[];
  legalEntityMentions: string[];
  affiliateNames: string[];
  links: string[];
  jsonLd: Record<string, unknown>[];
  factCandidates: ExtractedFactCandidate[];
};

export function extractCompanyPage(html: string): ExtractedCompanyPage {
  const title = cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "Untitled company page");
  const description = metaContent(html, "description") ?? metaContent(html, "og:description");
  const headings = [...html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => cleanText(match[1])).filter(Boolean).slice(0, 80);
  const withoutNoise = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  const bodyText = cleanText(withoutNoise
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, " ")
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, " ")
    .replace(/<meta\b[^>]*>/gi, " ")).slice(0, 120_000);
  const jsonLd = jsonLdBlocks(html);
  const organizations = organizationRecords(jsonLd);
  const organizationNames = organizations.flatMap((item) => names(item.name));
  const legalNames = organizations.flatMap((item) => names(item.legalName));
  const alternateNames = organizations.flatMap((item) => names(item.alternateName));
  const personRecords = jsonLd.filter((item) => hasJsonLdType(item, "Person"));
  const visibleFounders = [...bodyText.matchAll(/\b(?:founded|co-founded)\s+by\s+([A-Z][a-z'’.-]+(?:\s+[A-Z][a-z'’.-]+){1,3})/gi)]
    .map((match) => match[1]);
  const founders = [
    ...organizations.flatMap((item) => names(item.founder ?? item.founders)),
    ...personRecords.filter((item) => /founder/i.test(String(item.jobTitle ?? ""))).flatMap((item) => names(item.name)),
    ...visibleFounders,
  ];
  const executives = [
    ...organizations.flatMap((item) => names(item.employee ?? item.member)),
    ...personRecords.filter((item) => /chief|ceo|cfo|cto|president|director|executive/i.test(String(item.jobTitle ?? ""))).flatMap((item) => names(item.name)),
  ].slice(0, 40);
  const addressValues = organizations.flatMap((item) => addresses(item.address));
  const visibleAddresses = [...html.matchAll(/<address\b[^>]*>([\s\S]*?)<\/address>/gi)]
    .map((match) => cleanText(match[1])).filter(Boolean);
  const links = linkedUrls(html);
  const phoneNumbers = [
    ...organizations.flatMap((item) => names(item.telephone)),
    ...links.filter((value) => /^tel:/i.test(value)).map((value) => value.replace(/^tel:/i, "")),
  ];
  const socialProfiles = [
    ...organizations.flatMap((item) => names(item.sameAs)),
    ...links.filter((value) => /^https?:\/\/(?:www\.)?(?:linkedin|x|twitter|facebook|instagram|youtube)\.com/i.test(value)),
  ]
    .filter((value) => /^https?:\/\//i.test(value));
  const products = jsonLd.filter((item) => hasJsonLdType(item, "Product")).flatMap((item) => names(item.name));
  const services = jsonLd.filter((item) => hasJsonLdType(item, "Service")).flatMap((item) => names(item.name));
  const structuredCandidates: ExtractedFactCandidate[] = [
    ...products.map((value) => ({ factType: "product" as const, value, personName: null, role: null, temporalStatus: "notApplicable" as const, excerpt: bounded(value, 320), locator: "JSON-LD Product", extractionMethod: "jsonLd" as const })),
    ...services.map((value) => ({ factType: "service" as const, value, personName: null, role: null, temporalStatus: "notApplicable" as const, excerpt: bounded(value, 320), locator: "JSON-LD Service", extractionMethod: "jsonLd" as const })),
    ...personRecords.flatMap((item) => {
      const role = typeof item.jobTitle === "string" ? item.jobTitle.trim() : "";
      if (!role || !/chief|ceo|cfo|cto|coo|cmo|cpo|president|vice president|managing director|executive director/i.test(role)) return [];
      return names(item.name).map((personName) => ({ factType: "executiveRole" as const, value: `${personName} — ${role}`, personName, role, temporalStatus: "current" as const, excerpt: bounded(`${personName} — ${role}`, 320), locator: "JSON-LD Person", extractionMethod: "jsonLd" as const }));
    }),
  ];
  const visibleBlocks = visibleContentBlocks(html, description);
  const factCandidates = deduplicateFactCandidates([
    ...structuredCandidates,
    ...offeringCandidates(visibleBlocks),
    ...executiveCandidates(visibleBlocks),
  ]);
  const visibleCurrentExecutives = factCandidates
    .filter((item) => item.factType === "executiveRole" && item.temporalStatus === "current" && item.personName)
    .map((item) => item.personName!);
  const emailDomains = [...bodyText.matchAll(/\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi)]
    .map((match) => match[1].toLowerCase());
  const industries = organizations.flatMap((item) => names(item.industry ?? item.knowsAbout));
  const affiliates = organizations.flatMap((item) => names(item.parentOrganization ?? item.subOrganization));
  return {
    title,
    description,
    headings,
    bodyText,
    organizationNames: [...new Set(organizationNames)],
    legalNames: [...new Set(legalNames)],
    alternateNames: [...new Set(alternateNames)],
    founders: [...new Set(founders)],
    organizationFounders: [...new Set(organizations.flatMap(item => names(item.founder ?? item.founders)))],
    executives: [...new Set([...executives, ...visibleCurrentExecutives])],
    addresses: [...new Set([...addressValues, ...visibleAddresses])],
    phoneNumbers: [...new Set(phoneNumbers)],
    socialProfiles: [...new Set(socialProfiles)],
    products: [...new Set([...products, ...factCandidates.filter((item) => item.factType === "product").map((item) => item.value)])],
    services: [...new Set([...services, ...factCandidates.filter((item) => item.factType === "service").map((item) => item.value)])],
    emailDomains: [...new Set(emailDomains)],
    cities: [...new Set(organizations.flatMap((item) => addressFields(item.address, "addressLocality")))],
    states: [...new Set(organizations.flatMap((item) => addressFields(item.address, "addressRegion")))],
    countries: [...new Set(organizations.flatMap((item) => addressFields(item.address, "addressCountry")))],
    industryLabels: [...new Set(industries)],
    legalEntityMentions: [...new Set(legalEntityMentions(bodyText))],
    affiliateNames: [...new Set(affiliates)],
    links,
    jsonLd,
    factCandidates,
  };
}

/** Financing accepts article paragraph text, never metadata, headings, or bibliography link titles. */
export function extractFundingParagraphs(html: string) {
  const safe = html.replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  return [...safe.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanText(match[1].replace(/<[^>]*>/g, " ").replace(/&(rsquo|lsquo|rdquo|ldquo|ndash|mdash);/g, (_, entity: string) => ({ rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—" })[entity] ?? " ")))
    .filter((value) => value.length >= 20)
    .join("\n\n").slice(0, 40000);
}
