import { createHash } from "node:crypto";
import { extractCompanyPage } from "../extraction/htmlExtractor";
import { normalizeOfficialCompanyUrl, robotsDisallows, safeCompanyFetch } from "../security";
import type { EntityIdentityGraph, RawEvidence } from "../types";

export type LegalEntityRelationship = "primaryOperatingEntity" | "parent" | "subsidiary" | "lendingEntity" | "advisoryEntity" | "fundOrSpv" | "unknown";
export type LegalSourceType = "terms" | "privacy" | "legal" | "regulatory" | "financingAnnouncement" | "footer";
export type LegalEntityReference = {
  evidenceId: string; sourceUrl: string; sourceType: LegalSourceType; excerpt: string;
  retrievedAt: string; locator: string; relationship: LegalEntityRelationship;
  relatedLegalName?: string; reasonCodes: string[];
};
export type LegalEntityCandidate = {
  candidateId: string; legalName: string; relationship: LegalEntityRelationship;
  status: "candidate" | "accepted" | "rejected" | "unresolved";
  evidence: LegalEntityReference[]; reasonCodes: string[];
};
export type LegalEntityDiscovery = {
  entityId: string; evaluatedAt: string; status: "selected" | "unresolved" | "no_entity";
  candidates: LegalEntityCandidate[]; secQueryLegalNames: string[];
  sources: Array<{ sourceUrl: string; status: "reused" | "retrieved" | "unavailable" | "robotsDisallowed" | "budgetExceeded" }>;
  requests: number; limitations: string[];
};
const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const legalPath = /(?:^|\/)(?:[^/]*terms[^/]*|[^/]*privacy[^/]*|legal|imprint|impressum|compliance|regulatory)(?:\/|$)/i;
function owned(url: string, graph: EntityIdentityGraph) {
  try {
    const host = normalizeOfficialCompanyUrl(url).hostname.toLowerCase().replace(/^www\./, "");
    return graph.domains.some(d => { const root = d.toLowerCase().replace(/^www\./, ""); return host === root || host.endsWith(`.${root}`); });
  } catch { return false; }
}
function sourceType(url: string): LegalSourceType {
  const path = new URL(url).pathname;
  if (/\/(?:products|solutions|resources|downloads|careers)(?:\/|$)/i.test(path)) return "footer";
  if (/privacy/i.test(path)) return "privacy";
  if (/terms|\/legal\/user(?:\/|$)/i.test(path)) return "terms";
  if (/compliance|regulatory|license|disclosure/i.test(path)) return "regulatory";
  if (/legal|imprint|impressum/i.test(path)) return "legal";
  if (/news|press|funding|financing|blog/i.test(path)) return "financingAnnouncement";
  return "footer";
}
// Suffixes identify possible incorporated names, not verification or brand ownership.
const namePattern = /\b([A-Z][A-Za-z0-9&'’.-]*(?:[\s,]+(?:[A-Z][A-Za-z0-9&'’.-]*|and|of|the|\d+)){0,6}?[\s,]+(?:Inc\.?|Incorporated|L\.?L\.?C\.?|Ltd\.?|Limited|Corporation|Corp\.?|PBC|PLC|GmbH|B\.?V\.?)\.?)(?=\s|[,;:()“”"']|$)/g;
function mentions(text: string) {
  return [...text.matchAll(namePattern)].flatMap(match => {
    // Remove navigation/heading fragments; never insert a brand or a suffix.
    const raw = match[1];
    const prefix = /^(?:[\s\S]*?\b(?:Copyright|Updated|Policy|Statement|Agreement|Notice|Licenses|Contact|Mail|Email|Attn|This|These|Our|The|By|For|To|With)\s+)+/;
    const legalName = raw.replace(prefix, "").trim()
      .replace(/^(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\s+/i, "")
      .replace(/^(?:(?:[A-Z]{2}\s+)?License\s+No\.?|NMLS(?:\s+No\.?)?|NPN(?:\s+No\.?)?)\s+[A-Z0-9]+\s+(?:Disclosures\s*[, ]*)?/i, "")
      .replace(/^(?:(?:LinkedIn|Facebook|Instagram|Twitter|X)\s+)+/, "")
      .replace(/^Board of Directors of\s+|^How\s+/, "")
      .replace(/\s+/g, " ").replace(/[,\s]+$/, "");
    if (!legalName || !/[A-Za-z]{2}/.test(legalName.replace(/\b(?:Inc|LLC|Ltd|Limited|Corporation|Corp|Incorporated)\.?$/i, ""))) return [];
    const index = match.index! + raw.lastIndexOf(legalName);
    return [{ legalName, index: index >= match.index! ? index : match.index!, end: match.index! + raw.length }];
  });
}

/** Company statements establish query eligibility only; SEC verification remains independent. */
export function analyzeLegalEntities(graph: EntityIdentityGraph, evidence: RawEvidence[], now: string): LegalEntityDiscovery {
  const candidates = new Map<string, LegalEntityCandidate>();
  const brand = graph.confirmedDisplayName ?? graph.canonicalName;
  const brandPattern = new RegExp(`(?:^|[\\s"“'‘])${escape(brand)}(?:$|[\\s"”'’,])`, "i");
  const sources: LegalEntityDiscovery["sources"] = [];
  for (const page of evidence) {
    if (page.entityId !== graph.entityId || !page.companyReported || !owned(page.sourceUrl, graph) ||
      !["companyWebsite", "serpApiWebSearch"].includes(page.providerId) || !page.rawText) continue;
    // Search-provider evidence is eligible only after the existing original-page fetch.
    if (page.providerId === "serpApiWebSearch" && !page.structuredData.pageTitle) continue;
    const type = sourceType(page.sourceUrl);
    sources.push({ sourceUrl: page.sourceUrl, status: "reused" });
    const text = page.rawText;
    const found = mentions(text);
    for (const mention of found) {
      const before = text.slice(Math.max(0, mention.index - 180), mention.index);
      const after = text.slice(mention.end, mention.end + 350);
      const excerptStart = Math.max(0, mention.index - 180);
      const excerpt = text.slice(excerptStart, mention.end + 400);
      const reasons: string[] = [];
      let relationship: LegalEntityRelationship = "unknown";
      const alias = after.match(/^[.,\s]*(?:[^()\n]{0,140})\(([^)]{1,220})\)/)?.[1] ?? "";
      const aliasPrefix = after.slice(0, after.indexOf("(") >= 0 ? after.indexOf("(") : 0);
      const aliasBound = Boolean(alias && !mentions(aliasPrefix).length && (brandPattern.test(alias) || /[“"'‘]\s*(?:we|us|our)\s*[”"'’]/i.test(alias)));
      const subsidiaryMention = /\b(?:our|its|a|the)\s+(?:(?:wholly[- ]owned|operating)\s+)?(?:subsidiar(?:y|ies)|affiliates?|parent)(?:\s+(?:company|entity))?(?:\s+(?:include|includes|including|such as|is|are))?[,\s]*$/i.test(before) ||
        /^[.,\s]*(?:is\s+)?(?:a|the|our)\s+(?:wholly[- ]owned\s+)?(?:subsidiary|affiliate|parent)\b/i.test(after);
      const thirdParty = /(?:\b(?:customers?|partners?|clients?|vendors?|licensors?|investors?|clearing broker)(?:\s+(?:include|includes|including|such as))?\s*[,:(]?\s*|\b(?:trademark|service mark)\s+of\s*)$/i.test(before) || /^\s*(?:is\s+)?(?:our|a|an)\s+(?:customer|partner|vendor|investor)\b/i.test(after);
      const legalPage = ["terms", "privacy", "legal", "regulatory"].includes(type);
      const operator = /^[.,\s]*(?:\([^)]{0,180}\)\s*)?(?:operates|owns|provides)\s+(?:this|our|the)\s+(?:website|platform|services?)\b/i.test(after);
      const contracting = /\b(?:agreement|terms|contract)\b[^.!?]{0,150}\bbetween\s+(?:you|the customer|the user|customer)\s+(?:[^.!?]{0,80}\s+)?and\s*$/i.test(before);
      const financing = type === "financingAnnouncement" && aliasBound && /\b(?:issuer|issued|raised|financing|funding round)\b/i.test(after.slice(0, 250));
      const direct = !thirdParty && !subsidiaryMention && ((legalPage && (aliasBound || operator || contracting)) || financing);
      const purpose = /\b(?:Advisory|Advisers?|Advisors?|Investment Services)\b/i.test(mention.legalName) ? "advisoryEntity"
        : /\b(?:Lending|Loans?|Credit|Servicing)\b/i.test(mention.legalName) ? "lendingEntity"
        : /\b(?:Fund|SPV|Special Purpose)\b/i.test(mention.legalName) ? "fundOrSpv" : null;
      const explicitPurpose = /investment advis[eo]r|advisory services|lending|loans?|special purpose|investment fund/i.test(before.slice(-60) + after.slice(0, 120));
      if (thirdParty) reasons.push("third_party_mention");
      else if (subsidiaryMention) { relationship = /parent/i.test(before.slice(-40)) || /^[.,\s]*(?:is\s+)?(?:a|the|our)\s+parent\b/i.test(after) ? "parent" : "subsidiary"; reasons.push("related_entity_not_primary"); }
      if (purpose && explicitPurpose) relationship = purpose;
      // A specialised entity must be explicitly the selected brand, not merely a product provider.
      const brandIsSpecialised = purpose && new RegExp(purpose === "advisoryEntity" ? "advisory|adviser|advisor|investment" : purpose === "lendingEntity" ? "lending|loan|credit|servicing" : "fund|spv", "i").test(brand);
      if (purpose && !brandIsSpecialised) reasons.push("specialised_entity_not_supported_for_brand");
      if (direct && (!purpose || brandIsSpecialised)) { relationship = "primaryOperatingEntity"; reasons.push(financing ? "explicit_brand_issuer_statement" : "first_party_operating_statement"); }
      if (!reasons.length) reasons.push(/(?:©|copyright)\s*\d{0,4}[^\w]{0,10}$/i.test(before) ? "copyright_name_only" : "unbound_legal_name_mention");
      const id = key(mention.legalName);
      const candidate = candidates.get(id) ?? { candidateId: `legal-${createHash("sha256").update(graph.entityId + id).digest("hex").slice(0, 16)}`, legalName: mention.legalName, relationship: "unknown" as const, status: "candidate" as const, evidence: [], reasonCodes: [] };
      const reference: LegalEntityReference = { evidenceId: page.evidenceId, sourceUrl: page.sourceUrl, sourceType: type, excerpt, retrievedAt: page.retrievedAt, locator: `rawText:${excerptStart}`, relationship, reasonCodes: reasons };
      if (!candidate.evidence.some(r => r.sourceUrl === reference.sourceUrl && r.locator === reference.locator)) candidate.evidence.push(reference);
      candidates.set(id, candidate);
    }
    // Preserve explicit directed ownership relations without equating parent and issuer.
    for (let i = 0; i < found.length - 1; i++) {
      const child = found[i], parent = found[i + 1];
      const between = text.slice(child.end, parent.index);
      if (between.length > 160) continue;
      const subsidiaryOf = /^[.,\s]*(?:\([^)]*\)\s*)?(?:is\s+)?(?:a\s+|the\s+)?(?:wholly[- ]owned\s+)?subsidiary\s+of\s*$/i.test(between);
      const parentOf = /^[.,\s]*(?:is\s+)?(?:the\s+|a\s+)?parent(?:\s+company)?\s+of\s*$/i.test(between);
      const joint = /^[,\s]*(?:and|&)\s*$/i.test(between) &&
        /^[.,\s]*\((?:collectively[^)]*|[^)]*[“"'](?:we|us|our)[”"'][^)]*)\)/i.test(text.slice(parent.end, parent.end + 240)) &&
        ["terms", "privacy", "legal"].includes(type);
      if (joint) {
        for (const item of [child, parent]) candidates.get(key(item.legalName))?.evidence.push({ evidenceId: page.evidenceId, sourceUrl: page.sourceUrl, sourceType: type, excerpt: text.slice(child.index, parent.end + 180), retrievedAt: page.retrievedAt, locator: `rawText:${child.index}`, relationship: "primaryOperatingEntity", reasonCodes: ["joint_operating_entity_statement"] });
      }
      if (!subsidiaryOf && !parentOf) continue;
      for (const [item, other, relationship] of [[child, parent, parentOf ? "parent" : "subsidiary"], [parent, child, parentOf ? "subsidiary" : "parent"]] as const) {
        candidates.get(key(item.legalName))?.evidence.push({ evidenceId: page.evidenceId, sourceUrl: page.sourceUrl, sourceType: type, excerpt: text.slice(child.index, parent.end), retrievedAt: page.retrievedAt, locator: `rawText:${child.index}`, relationship, relatedLegalName: other.legalName, reasonCodes: ["explicit_ownership_relationship"] });
      }
    }
  }
  const output = [...candidates.values()];
  const eligible: LegalEntityCandidate[] = [];
  for (const candidate of output) {
    candidate.reasonCodes = [...new Set(candidate.evidence.flatMap(e => e.reasonCodes))];
    const relations = [...new Set(candidate.evidence.map(e => e.relationship).filter(r => r !== "unknown"))];
    const primary = relations.includes("primaryOperatingEntity");
    candidate.relationship = primary ? "primaryOperatingEntity" : relations[0] ?? "unknown";
    const excluded = candidate.reasonCodes.some(r => ["specialised_entity_not_supported_for_brand", "third_party_mention", "related_entity_not_primary"].includes(r));
    if (primary && excluded) { candidate.status = "unresolved"; candidate.reasonCodes.push("conflicting_scope_statements"); }
    else if (primary) eligible.push(candidate);
    else if (excluded || relations.some(r => ["parent", "subsidiary", "lendingEntity", "advisoryEntity", "fundOrSpv"].includes(r))) candidate.status = "rejected";
    else candidate.status = "candidate";
  }
  const conflict = output.some(c => c.status === "unresolved");
  for (const candidate of eligible) {
    candidate.status = eligible.length === 1 && !conflict ? "accepted" : "unresolved";
    candidate.reasonCodes.push(candidate.status === "accepted" ? "unique_supported_brand_operator" : "ambiguous_operating_entities");
  }
  const selected = output.filter(c => c.status === "accepted").map(c => c.legalName);
  return { entityId: graph.entityId, evaluatedAt: now, status: selected.length ? "selected" : output.length ? "unresolved" : "no_entity", candidates: output, secQueryLegalNames: selected, sources, requests: 0,
    limitations: ["Accepted means supported for SEC candidate discovery, not verified incorporation or a verified SEC issuer.", "Unbound names, copyright notices, affiliates and specialised product entities are retained but do not become brand-level SEC queries."] };
}

export function legalEntitySecGraph(graph: EntityIdentityGraph, discovery: LegalEntityDiscovery): EntityIdentityGraph {
  // Scoped copy only: never overwrite the confirmed identity or repurpose rejected names as aliases.
  const names = discovery.entityId === graph.entityId ? discovery.candidates.filter(c => c.status === "accepted" && c.relationship === "primaryOperatingEntity").map(c => c.legalName) : [];
  return { ...graph, legalNames: names, termsPageLegalNames: [], privacyPageLegalNames: [], identityEvidenceIds: [...new Set([...(graph.identityEvidenceIds ?? []), ...discovery.candidates.filter(c => names.includes(c.legalName)).flatMap(c => c.evidence.map(e => e.evidenceId))])] };
}

export async function discoverLegalEntities(graph: EntityIdentityGraph, researchId: string, existing: RawEvidence[], options: {
  fetchImpl?: typeof fetch; resolveHost?: Parameters<typeof safeCompanyFetch>[1]["resolveHost"];
  deadline?: number; maxPages?: number; now?: () => Date;
} = {}) {
  const now = options.now ?? (() => new Date());
  const deadline = Math.min(options.deadline ?? Infinity, Date.now() + 10_000);
  const maxPages = Math.max(0, Math.min(options.maxPages ?? 6, 6));
  const evidence: RawEvidence[] = [];
  const fetches: LegalEntityDiscovery["sources"] = [];
  let requests = 0;
  if (graph.targetSelectionStatus !== "userSelected") return { discovery: { ...analyzeLegalEntities(graph, [], now().toISOString()), limitations: ["Company confirmation required"] }, evidence };
  const fetchImpl: typeof fetch = async (input, init) => {
    if (requests >= 12 || Date.now() >= deadline) throw Object.assign(new Error("LEGAL_DISCOVERY_BUDGET"), { code: "timeout" });
    requests++;
    const signal = AbortSignal.timeout(Math.max(1, Math.min(4000, deadline - Date.now())));
    return (options.fetchImpl ?? fetch)(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal });
  };
  const canonical = (value: string) => { const u = normalizeOfficialCompanyUrl(value); return u.toString().replace(/\/$/, ""); };
  const seen = new Set(existing.map(e => { try { return canonical(e.sourceUrl); } catch { return e.sourceUrl; } }));
  const queue = new Set<string>();
  const addLinks = (page: RawEvidence) => {
    if (!owned(page.sourceUrl, graph) || !page.companyReported || !["companyWebsite", "serpApiWebSearch"].includes(page.providerId)) return;
    const links = Array.isArray(page.structuredData.links) ? page.structuredData.links : [];
    for (const link of links) {
      if (typeof link !== "string") continue;
      try {
        const u = normalizeOfficialCompanyUrl(new URL(link, page.sourceUrl).toString());
        if (!owned(u.toString(), graph) || !legalPath.test(u.pathname) || /\/(?:products|solutions|resources|downloads|careers)\//i.test(u.pathname) || /cookie|privacy-choices|privacy-opt|preferences/i.test(u.pathname)) continue;
        const value = canonical(u.toString());
        if (!seen.has(value)) queue.add(value);
      } catch { /* Invalid links are not discovery authority. */ }
    }
  };
  existing.forEach(addLinks);
  // Bounded conventional first-party endpoints only when no authoritative link was available.
  if (!queue.size && !existing.some(e => owned(e.sourceUrl, graph) && legalPath.test(new URL(e.sourceUrl).pathname))) {
    const base = graph.confirmedWebsite ?? (graph.domains[0] ? `https://${graph.domains[0]}` : null);
    if (base) for (const path of ["/terms", "/privacy", "/legal"]) { const url = canonical(new URL(path, base).toString()); if (!seen.has(url)) queue.add(url); }
  }
  const robots = new Map<string, Promise<string>>();
  const priority = (url: string) => /terms|\/legal\/user(?:$|\/)/i.test(url) ? 0 : /privacy/i.test(url) ? 1 : /legal\/?$/i.test(url) ? 2 : 3;
  let pages = 0;
  while (queue.size && pages < maxPages && Date.now() < deadline && requests < 12) {
    const urls = [...queue].sort((a, b) => priority(a) - priority(b)).slice(0, Math.min(2, maxPages - pages));
    urls.forEach(u => { queue.delete(u); seen.add(u); }); pages += urls.length;
    await Promise.all(urls.map(async url => {
      const target = new URL(url);
      const opts = { officialHostname: target.hostname, fetchImpl, resolveHost: options.resolveHost, timeoutMs: 4000 };
      if (!robots.has(target.origin)) robots.set(target.origin, safeCompanyFetch(new URL("/robots.txt", target), { ...opts, expectedContent: "text", maxBytes: 250000 }).then(r => r.text).catch(() => ""));
      if (robotsDisallows(await robots.get(target.origin)!, target.pathname)) { fetches.push({ sourceUrl: url, status: "robotsDisallowed" }); return; }
      try {
        const response = await safeCompanyFetch(target, opts);
        if (!owned(response.url, graph)) throw new Error("outside_company_scope");
        const extracted = extractCompanyPage(response.text);
        const rawText = extracted.bodyText;
        const source = sourceType(response.url);
        const page: RawEvidence = {
          evidenceId: `legal-page-${researchId}-${createHash("sha256").update(response.url).digest("hex").slice(0, 12)}`,
          researchId, entityId: graph.entityId, providerId: "companyWebsite", sourceTier: 2,
          sourceType: `Company-owned ${source} page for legal entity discovery`, sourceTitle: extracted.title,
          sourceUrl: response.url, publicReferenceUrl: response.url, publicationDate: null,
          retrievedAt: now().toISOString(), rawText,
          structuredData: { pageType: source, links: extracted.links, legalDiscoverySource: true },
          matchedEntitySignals: ["confirmed company domain; legal source only"], entityMatchConfidence: "Medium",
          companyReported: true, officialRecord: false, independentlyPublished: false,
          contentHash: createHash("sha256").update(rawText).digest("hex"), limitations: ["Company-owned legal disclosure; legal entity selection does not verify an SEC issuer."],
        };
        evidence.push(page); addLinks(page); fetches.push({ sourceUrl: response.url, status: "retrieved" });
      } catch { fetches.push({ sourceUrl: url, status: Date.now() >= deadline || requests >= 12 ? "budgetExceeded" : "unavailable" }); }
    }));
  }
  const discovery = analyzeLegalEntities(graph, [...existing, ...evidence], now().toISOString());
  discovery.sources = [...discovery.sources.filter(s => !fetches.some(f => f.sourceUrl === s.sourceUrl)), ...fetches];
  discovery.requests = requests;
  if (queue.size) discovery.limitations.push("Bounded legal-source review ended with additional legal links unvisited.");
  return { discovery, evidence };
}
