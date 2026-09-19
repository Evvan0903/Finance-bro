import type { NormalizedEvidence, PrivateCompanyClaim } from './types';
import type { VerificationResult, VerificationSource } from './verification/types';

type RecordBase = {
  recordId: string;
  entityId: string;
  statement: string;
  claimIds: string[];
  sources: VerificationSource[];
  verification: VerificationResult;
};

/** A small projection of approved claims, not a second extraction or identity system. */
export type StructuredResearchRecord = RecordBase & (
  | { kind: 'product'; name: string | null; offeringType: 'product' | 'service' | 'description' }
  | { kind: 'person_role'; personName: string | null; role: string | null; temporalContext: 'historical' | 'as_of_source' }
  | { kind: 'company_event'; eventType: 'acquisition' | 'product_launch' | 'appointment' | 'development'; publicationDate: string | null; eventDate: string | null }
  | { kind: 'customer_evidence'; relationship: 'reported_customer' }
  | { kind: 'partnership_evidence'; relationship: 'reported_relationship' }
  | { kind: 'source_observation'; topic: 'pricing' | 'security' }
);

export function buildStructuredResearchRecords(claims: PrivateCompanyClaim[], evidence: NormalizedEvidence[]): StructuredResearchRecord[] {
  const output = new Map<string, StructuredResearchRecord>();
  for (const claim of claims) {
    if (claim.verification?.status !== 'verified') continue;
    const fact = claim.researchFact;
    const candidate = evidence.flatMap(e => claim.evidenceIds.includes(e.evidenceId) ? e.factCandidates ?? [] : [])
      .find(c => c.value === claim.normalizedValue);
    const sources = evidence.flatMap(e => {
      if (!claim.evidenceIds.includes(e.evidenceId)) return [];
      const excerpt = fact?.evidenceId === e.evidenceId ? fact.excerpt : e.factCandidates?.find(c => c.value === claim.normalizedValue)?.excerpt;
      if (!excerpt) return [];
      return [{ evidenceId: e.evidenceId, sourceUrl: e.sourceUrl, title: e.sourceTitle, excerpt,
        retrievedAt: e.retrievedAt, publicationDate: e.publicationDate }];
    });
    if (!sources.length) continue;
    const base: RecordBase = { recordId: `record:${claim.claimId}`, entityId: claim.entityId,
      statement: fact?.value ?? String(claim.normalizedValue), claimIds: [claim.claimId], sources, verification: claim.verification };
    let record: StructuredResearchRecord | undefined;
    if (['product', 'service', 'research.products'].includes(claim.claimType)) {
      record = { ...base, kind: 'product', name: candidate?.value ?? (fact ? null : String(claim.normalizedValue)),
        offeringType: claim.claimType === 'service' ? 'service' : fact ? 'description' : 'product' };
    } else if (['executiveRole', 'formerExecutiveRole', 'research.people'].includes(claim.claimType)) {
      record = { ...base, kind: 'person_role', personName: candidate?.personName ?? null, role: candidate?.role ?? null,
        temporalContext: claim.claimType === 'formerExecutiveRole' || claim.verification.reasonCodes.includes('historical_role_supported') ? 'historical' : 'as_of_source' };
    } else if (fact?.topic === 'recent') {
      record = { ...base, kind: 'company_event', publicationDate: fact.publicationDate,
        // Publication date does not establish the transaction/event date.
        eventDate: null,
        eventType: /\bacquir(?:ed|es|ing)|\bacquisition\b/i.test(fact.value) ? 'acquisition'
          : /\blaunch(?:ed|es)?|\breleased\b/i.test(fact.value) ? 'product_launch'
            : /\bappointed\b/i.test(fact.value) ? 'appointment' : 'development' };
    } else if (fact?.topic === 'customers') {
      record = { ...base, kind: 'customer_evidence', relationship: 'reported_customer' };
    } else if (fact?.topic === 'partnerships') {
      record = { ...base, kind: 'partnership_evidence', relationship: 'reported_relationship' };
    } else if (fact?.topic === 'pricing' || fact?.topic === 'security') {
      record = { ...base, kind: 'source_observation', topic: fact.topic };
    }
    if (!record) continue;
    const key = `${record.kind}:${record.statement.toLowerCase().replace(/\s+/g, ' ').trim()}`;
    const previous = output.get(key);
    if (previous) {
      previous.claimIds = [...new Set([...previous.claimIds, claim.claimId])];
      previous.sources = [...new Map([...previous.sources, ...sources].map(s => [s.evidenceId, s])).values()];
    } else output.set(key, record);
  }
  return [...output.values()];
}
