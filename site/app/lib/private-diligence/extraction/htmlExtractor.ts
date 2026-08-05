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
  const bodyText = cleanText(withoutNoise).slice(0, 120_000);
  const jsonLd = jsonLdBlocks(html);
  const organizations = jsonLd.filter((item) => {
    const type = item["@type"];
    return type === "Organization" || type === "Corporation" ||
      (Array.isArray(type) && type.some((entry) => entry === "Organization" || entry === "Corporation"));
  });
  const organizationNames = organizations.flatMap((item) => names(item.name));
  const legalNames = organizations.flatMap((item) => names(item.legalName));
  const alternateNames = organizations.flatMap((item) => names(item.alternateName));
  const founders = organizations.flatMap((item) => names(item.founder ?? item.founders));
  const executives = organizations.flatMap((item) => names(item.employee ?? item.member)).slice(0, 40);
  const addressValues = organizations.flatMap((item) => addresses(item.address));
  const phoneNumbers = organizations.flatMap((item) => names(item.telephone));
  const socialProfiles = organizations.flatMap((item) => names(item.sameAs))
    .filter((value) => /^https?:\/\//i.test(value));
  const products = jsonLd.filter((item) => item["@type"] === "Product").flatMap((item) => names(item.name));
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
    addresses: [...new Set(addressValues)],
    phoneNumbers: [...new Set(phoneNumbers)],
    socialProfiles: [...new Set(socialProfiles)],
    products: [...new Set(products)],
    jsonLd,
  };
}
