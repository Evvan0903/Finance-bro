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

export type ExtractedCompanyPage = {
  title: string;
  description: string | null;
  headings: string[];
  bodyText: string;
  organizationNames: string[];
  legalNames: string[];
  alternateNames: string[];
  founders: string[];
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
};

export function extractCompanyPage(html: string): ExtractedCompanyPage {
  const title = cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "Untitled company page");
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
  const personRecords = jsonLd.filter((item) => item["@type"] === "Person");
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
  const products = jsonLd.filter((item) => item["@type"] === "Product").flatMap((item) => names(item.name));
  const services = jsonLd.filter((item) => item["@type"] === "Service").flatMap((item) => names(item.name));
  const emailDomains = [...bodyText.matchAll(/\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi)]
    .map((match) => match[1].toLowerCase());
  const industries = organizations.flatMap((item) => names(item.industry ?? item.knowsAbout));
  const affiliates = organizations.flatMap((item) => names(item.parentOrganization ?? item.subOrganization));
  return {
    title,
    description: metaContent(html, "description") ?? metaContent(html, "og:description"),
    headings,
    bodyText,
    organizationNames: [...new Set(organizationNames)],
    legalNames: [...new Set(legalNames)],
    alternateNames: [...new Set(alternateNames)],
    founders: [...new Set(founders)],
    executives: [...new Set(executives)],
    addresses: [...new Set([...addressValues, ...visibleAddresses])],
    phoneNumbers: [...new Set(phoneNumbers)],
    socialProfiles: [...new Set(socialProfiles)],
    products: [...new Set(products)],
    services: [...new Set(services)],
    emailDomains: [...new Set(emailDomains)],
    cities: [...new Set(organizations.flatMap((item) => addressFields(item.address, "addressLocality")))],
    states: [...new Set(organizations.flatMap((item) => addressFields(item.address, "addressRegion")))],
    countries: [...new Set(organizations.flatMap((item) => addressFields(item.address, "addressCountry")))],
    industryLabels: [...new Set(industries)],
    legalEntityMentions: [...new Set(legalEntityMentions(bodyText))],
    affiliateNames: [...new Set(affiliates)],
    links,
    jsonLd,
  };
}
