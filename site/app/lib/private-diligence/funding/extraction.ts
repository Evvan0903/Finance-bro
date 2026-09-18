import { createHash } from "node:crypto";
import type { EntityIdentityGraph, RawEvidence } from "../types";
import type { FundingEvent, FundingField } from "./types";

const stringFields: Record<string, RegExp> = {
  roundLabel: /\b(seed|series\s+[a-z](?:\d)?|pre-seed|extension|second clos[ei])\b/i,
  financingType: /^(equity|debt|mixed|unknown)$/,
  eventStatus: /^(planned|announced|closed|unknown)$/,
  amountMeaning: /^(current_round|cumulative|offering_total|amount_sold|unknown)$/,
  currency: /^(USD|GBP|EUR|CAD|AUD|JPY|CNY|unknown)$/,
  valuationCurrency: /^(USD|GBP|EUR|CAD|AUD|JPY|CNY|unknown)$/,
  valuationBasis: /^(pre_money|post_money|unspecified)$/,
  dateMeaning: /^(announcement|first_sale|closing|filing|unknown)$/,
  eventDate: /^\d{4}-\d{2}-\d{2}$/,
  investor: /\S/,
  investorRole: /^(lead|participant|unknown)$/,
};
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function fundingNames(graph: EntityIdentityGraph) {
  return [...new Set([graph.canonicalName, ...graph.legalNames, ...graph.dbaNames])].filter(Boolean);
}
function numericSupport(excerpt: string, value: number, field: "amount" | "valuation") {
  return [...excerpt.matchAll(/\b(\d[\d,]*(?:\.\d+)?)[\s-]*(billion|million|thousand|bn|[mbk])?\b/gi)]
    .some((m) => {
      const number = Number(m[1].replaceAll(",", "")) * (/^(b|bn|billion)$/i.test(m[2] ?? "") ? 1e9 : /^(m|million)$/i.test(m[2] ?? "") ? 1e6 : /^(k|thousand)$/i.test(m[2] ?? "") ? 1e3 : 1);
      if (number !== value) return false;
      const before = excerpt.slice(Math.max(0, m.index! - 45), m.index);
      const after = excerpt.slice(m.index! + m[0].length, m.index! + m[0].length + 45);
      const isValuation = /^\s*(?:(?:pre|post)[- ]money\s+)?valuation\b/i.test(after) || /valu(?:ation|ed)\s+(?:at|of)\s*(?:USD|US)?[$€£]?\s*$/i.test(before);
      if (/^\s*(?:investors|employees|people|customers)\b/i.test(after)) return false;
      return field === "valuation" ? isValuation : !isValuation;
    });
}
const semantic: Record<string, Record<string, RegExp>> = {
  financingType: { equity: /equity/i, debt: /debt|loan|credit facility/i, mixed: /equity[\s\S]*debt|debt[\s\S]*equity/i },
  eventStatus: { planned: /plans? to|seeks? to|targeting|intends? to/i, announced: /announc/i, closed: /closed|completed/i },
  amountMeaning: { current_round: /round|series|seed|financing/i, cumulative: /total funding|cumulative|to date|bringing.*total/i, offering_total: /totalOfferingAmount/, amount_sold: /totalAmountSold/ },
  currency: { USD: /US\$|USD|U\.S\. dollars/i, GBP: /£|GBP|pounds/i, EUR: /€|EUR|euros/i, CAD: /C\$|CAD|Canadian dollars/i, AUD: /A\$|AUD|Australian dollars/i, JPY: /JPY|yen/i, CNY: /CNY|RMB|yuan/i },
  valuationBasis: { pre_money: /pre[- ]money/i, post_money: /post[- ]money/i },
  dateMeaning: { announcement: /announc/i, closing: /clos|completed/i, first_sale: /first sale/i, filing: /filing|filed/i },
  investorRole: { lead: /led by|lead investor|co-led/i, participant: /participat|investor|investment from/i },
};
/** Untrusted model output is only a proposal. Every field retains its own verbatim source support. */
export function validateFundingCandidates(payload: unknown, source: RawEvidence, graph: EntityIdentityGraph): FundingEvent[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { events?: unknown }).events)) throw new Error("INVALID_FUNDING_EXTRACTION");
  const body = clean(typeof source.structuredData.fundingText === "string" ? source.structuredData.fundingText : source.rawText);
  return (payload as { events: unknown[] }).events.slice(0, 8).flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return [];
    const row = candidate as Record<string, unknown>;
    if (row.entityId !== graph.entityId || typeof row.excerpt !== "string" || row.excerpt.length > 1600 || !body.includes(clean(row.excerpt))) return [];
    // Require the target to be the financing subject, even on an official domain (portfolio pages are not issuer announcements).
    const attributed = fundingNames(graph).some((name) => new RegExp(`\\b${escape(name)}(?:[,®™]|\\s)+(?:today\\s+)?(?:has\\s+|have\\s+)?(?:announced|raised|raises|secured|closed|completed|plans|intends|is raising|seeks)\\b`, "i").test(row.excerpt as string));
    const possessive = fundingNames(graph).some((name) => new RegExp(`${escape(name)}(?:’|'|&rsquo;)s\\s+(?:latest\\s+|new\\s+)?(?:[$£€]\\s*\\d[\\d.,]*[MBKmbk]?\\s+(?:raise|round|financing)|(?:funding|financing|investment)\\s+round)`, "i").test(row.excerpt as string));
    // A first-person announcement must be hosted by the confirmed company and
    // explicitly name that company's own round in its title (not a portfolio/customer story).
    const host = new URL(source.publicReferenceUrl).hostname.replace(/^www\./, "");
    const ownDomain = graph.domains.some(d => host === d.replace(/^www\./, "") || host.endsWith(`.${d.replace(/^www\./, "")}`));
    const ownRoundTitle = fundingNames(graph).some(name => new RegExp(`${escape(name)}(?:’|'|&rsquo;)s\\s+(?:series\\s+[a-z]|funding|financing|seed round)`, "i").test(source.sourceTitle));
    const firstPerson = source.companyReported && ownDomain && ownRoundTitle && /\b(?:we(?:’|')re|we are|we)\s+(?:announcing|announced|have raised|raised|secured|closed)\b/i.test(row.excerpt);
    if ((!attributed && !possessive && !firstPerson) || !row.fields || typeof row.fields !== "object") return [];
    if (/\bannounc(?:ed|es)\s+that\s+(?!it\b|we\b|the company\b)/i.test(row.excerpt as string) || /\b(?:investment in|acquisition of)\b/i.test(row.excerpt as string)) return [];
    const fields: Record<string, FundingField> = {};
    for (const [key, unknownField] of Object.entries(row.fields)) {
      if (!unknownField || typeof unknownField !== "object") continue;
      const field = unknownField as Record<string, unknown>;
      if (typeof field.excerpt !== "string" || !field.excerpt.trim() || field.excerpt.length > 900 || !clean(row.excerpt).includes(clean(field.excerpt))) continue;
      const value = field.value;
      if (key === "amount" || key === "valuation") {
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || !numericSupport(field.excerpt, value, key)) continue;
        if (key === "valuation" && !/valu(?:ation|ed)/i.test(field.excerpt)) continue;
      } else {
        const baseKey = key.replace(/\d+$/, "");
        if (typeof value !== "string" || value.length > 180 || !stringFields[baseKey]?.test(value)) continue;
        if (["roundLabel", "investor", "eventDate"].includes(baseKey) && !clean(field.excerpt).toLowerCase().includes(value.toLowerCase())) continue;
        const rule = semantic[baseKey === "valuationCurrency" ? "currency" : baseKey]?.[value];
        if (rule && !rule.test(field.excerpt)) continue;
      }
      fields[key] = { value, evidenceId: source.evidenceId, sourceUrl: source.publicReferenceUrl, excerpt: clean(field.excerpt), locator: `visibleText:${body.indexOf(clean(field.excerpt))}`, publicationDate: source.publicationDate, retrievedAt: source.retrievedAt };
    }
    for (let investor = 1; investor <= 5; investor++) {
      if (!fields[`investor${investor}`]) delete fields[`investorRole${investor}`];
    }
    if (fields.eventStatus?.value === "closed" && /plans? to|intends? to|seeks? to/.test(String(row.excerpt))) delete fields.eventStatus;
    if (!fields.amount && !fields.roundLabel && !fields.valuation) return [];
    return [{ eventId: `funding-${source.evidenceId}-${index}`, entityId: graph.entityId, sourceKind: "announcement" as const, fields, limitations: ["Source-reported financing; missing fields remain unknown. Reprints are not independent confirmation.", ...(fields.investor5 ? ["Investor extraction is bounded to five names; this is not a complete investor list."] : [])] }];
  });
}

export function deterministicFundingCandidates(source: RawEvidence, graph: EntityIdentityGraph) {
  const events = clean(typeof source.structuredData.fundingText === "string" ? source.structuredData.fundingText : source.rawText).split(/(?<=[.!?])\s+(?=[A-Z])/).filter((s) => /raise|raised|raises|financing|funding|plans to|closed|series [a-z]|seed round/i.test(s)).slice(0, 20).map((excerpt) => {
    const fields: Record<string, { value: string | number; excerpt: string }> = {};
    const amount = excerpt.match(/(?:US\$|USD\s*|GBP\s*|EUR\s*|[$£€])\s*(\d[\d,]*(?:\.\d+)?)[\s-]*(billion|million|thousand|bn|[mbk])?\b/i);
    // Multiple amounts require field-specific model extraction; never assume the first is the round.
    if (amount && (excerpt.match(/(?:US\$|USD\s*|GBP\s*|EUR\s*|[$£€])\s*\d/gi)?.length ?? 0) === 1 && !/valu(?:ation|ed)/i.test(excerpt)) {
      fields.amount = { value: Number(amount[1].replaceAll(",", "")) * (/^(billion|bn|b)$/i.test(amount[2] ?? "") ? 1e9 : /^(million|m)$/i.test(amount[2] ?? "") ? 1e6 : /^(thousand|k)$/i.test(amount[2] ?? "") ? 1e3 : 1), excerpt };
      fields.amountMeaning = { value: /total funding|cumulative|to date|bringing.*total/i.test(excerpt) ? "cumulative" : /round|series|seed|financing/i.test(excerpt) ? "current_round" : "unknown", excerpt };
      const currency = Object.entries(semantic.currency).find(([, pattern]) => pattern.test(excerpt));
      if (currency) fields.currency = { value: currency[0], excerpt };
    }
    // Distinguish an explicitly labelled raise from valuation even in the same sentence.
    const monetary = [...excerpt.matchAll(/(?:US\$|USD\s*|GBP\s*|EUR\s*|[$£€])\s*(\d[\d,]*(?:\.\d+)?)[\s-]*(billion|million|thousand|bn|[mbk])?\b/gi)];
    for (const money of monetary) {
      const value = Number(money[1].replaceAll(",", "")) * (/^(billion|bn|b)$/i.test(money[2] ?? "") ? 1e9 : /^(million|m)$/i.test(money[2] ?? "") ? 1e6 : /^(thousand|k)$/i.test(money[2] ?? "") ? 1e3 : 1);
      const after = excerpt.slice(money.index! + money[0].length, money.index! + money[0].length + 70);
      const before = excerpt.slice(Math.max(0, money.index! - 60), money.index);
      if (/^\s*(?:(?:pre|post)[- ]money\s+)?valuation/i.test(after) || /valuation (?:of|at)\s*$/i.test(before)) {
        fields.valuation = { value, excerpt };
        if (/pre[- ]money/i.test(after)) fields.valuationBasis = { value: "pre_money", excerpt };
        if (/post[- ]money/i.test(after)) fields.valuationBasis = { value: "post_money", excerpt };
      } else if (monetary.length > 1 && /^\s*(?:in\s+)?(?:raise|round|financing|series\s+[a-z])\b/i.test(after) && !/total funding|cumulative|to date|bringing.*total/i.test(excerpt)) {
        fields.amount = { value, excerpt };
        fields.amountMeaning = { value: /round|financing|series\s+[a-z]/i.test(excerpt) ? "current_round" : "unknown", excerpt };
      }
    }
    const leads = excerpt.match(/(?:led by|co-led by)\s+(.+?)(?:,\s*(?:with|alongside)|\s+with|\.|$)/i)?.[1];
    if (leads) leads.split(/,\s*|\s+and\s+/).slice(0, 5).forEach((name, index) => {
      if (!/^[A-Z][A-Za-z &'’.-]{1,100}$/.test(name.trim())) return;
      fields[`investor${index + 1}`] = { value: name.trim(), excerpt };
      fields[`investorRole${index + 1}`] = { value: "lead", excerpt };
    });
    const round = excerpt.match(/\b(?:pre-seed|seed|series\s+[A-Z](?:\d)?)\b/i)?.[0];
    if (round) fields.roundLabel = { value: round, excerpt };
    fields.eventStatus = { value: /plans? to|seeks? to|intends? to/i.test(excerpt) ? "planned" : /closed|completed/i.test(excerpt) ? "closed" : /announc/i.test(excerpt) ? "announced" : "unknown", excerpt };
    return { entityId: graph.entityId, excerpt, fields };
  });
  return validateFundingCandidates({ events }, source, graph);
}

export function reconcileFunding(events: FundingEvent[]) {
  // Retain source statements separately; identical text is a reprint, not additional corroboration.
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = createHash("sha256").update(JSON.stringify([event.entityId, event.sourceKind, Object.entries(event.fields).map(([key, field]) => [key, field.value, field.excerpt])])).digest("hex");
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
