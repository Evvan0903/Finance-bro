import type { ConflictRecord, EntityIdentityGraph, NormalizedEvidence, PrivateCompanyClaim, RawEvidence } from '../types';
import type { FundingEvent, FundingResearch } from '../funding/types';
import type { HiringActivityResult } from '../hiring/types';
import { verifySecAssociation, type SecIssuerAssociation } from '../entity-resolution/secIssuerResolution';
import { analyzeLegalEntities } from '../entity-resolution/legalEntityDiscovery';
import { claimExcerpt, verifyClaim, verifyEntityAssociation, verifyFundingField, verifyHiring, namesTarget, explicitEventDate } from './rules';
import { verificationResult, type VerificationFinding, type VerificationLedger, type VerificationSource } from './types';
export type VerificationInput = {
    graph: EntityIdentityGraph;
    rawEvidence: RawEvidence[];
    claims?: PrivateCompanyClaim[];
    fundingResearch?: FundingResearch;
    hiringIntelligence?: HiringActivityResult | null;
    issuerAssociations?: SecIssuerAssociation[];
    now: string;
};
const fundingId = (event: FundingEvent, key?: string) => `funding:${event.eventId}${key ? ':' + key : ''}`;
function ref(source: RawEvidence, excerpt: string, url = source.publicReferenceUrl): VerificationSource {
    return { evidenceId: source.evidenceId, sourceUrl: url, title: source.sourceTitle, excerpt, retrievedAt: source.retrievedAt, publicationDate: source.publicationDate };
}
export function claimVerificationId(claim: PrivateCompanyClaim) {
    // Stable across reordered extraction and later executions; claim-1 is not a durable identity.
    return `claim:${claim.entityId}:${claim.claimType}:${String(claim.normalizedValue).trim().toLowerCase()}`;
}
/** The only domain evaluation boundary. Stored/model-supplied verification labels are not inputs. */
export function evaluateVerification(input: VerificationInput): VerificationLedger {
    const { graph, rawEvidence, now } = input, findings: VerificationFinding[] = [];
    for (const candidate of analyzeLegalEntities(graph, rawEvidence, now).candidates) {
        // This is a brand/operator decision, not incorporation or SEC issuer verification.
        for (const reference of candidate.evidence.filter(e => e.reasonCodes.includes('explicit_ownership_relationship') && e.relatedLegalName && (namesTarget(candidate.legalName, graph) || namesTarget(e.relatedLegalName, graph)))) {
            findings.push({ id: `${candidate.candidateId}:relationship:${reference.relationship}:${reference.relatedLegalName}`, entityId: graph.entityId, domain: 'identity', label: `${candidate.legalName}: ${reference.relationship} of ${reference.relatedLegalName}`, value: candidate.legalName, sources: [{ evidenceId: reference.evidenceId, sourceUrl: reference.sourceUrl, title: reference.sourceType, excerpt: reference.excerpt, retrievedAt: reference.retrievedAt, publicationDate: null }], verification: verificationResult('verified', now, ['explicit_company_owned_relationship_statement'], [reference.evidenceId]) });
        }
        const relevant = namesTarget(candidate.legalName, graph) || candidate.relationship !== 'unknown';
        const status = candidate.status === 'accepted' ? 'verified' : candidate.status === 'rejected' || !relevant ? 'rejected' : 'unverified';
        findings.push({ id: candidate.candidateId, entityId: graph.entityId, domain: 'identity', label: `Legal entity relationship: ${candidate.relationship}`, value: candidate.legalName,
            sources: candidate.evidence.map(e => ({ evidenceId: e.evidenceId, sourceUrl: e.sourceUrl, title: e.sourceType, excerpt: e.excerpt, retrievedAt: e.retrievedAt, publicationDate: null })),
            verification: verificationResult(status, now, candidate.reasonCodes, candidate.evidence.map(e => e.evidenceId), status === 'unverified' ? ['supported_primary_legal_entity'] : []) });
    }
    const sources = new Map(rawEvidence.map(e => [e.evidenceId, e]));
    const associations = [...new Map([...(input.issuerAssociations ?? input.fundingResearch?.issuerAssociations ?? []), ...rawEvidence.flatMap(e => e.structuredData.secIssuerAssociation ? [e.structuredData.secIssuerAssociation as SecIssuerAssociation] : [])].map(a => [a.cik.padStart(10, '0'), a])).values()];
    for (const a of associations) {
        const references = [...a.matchedSignals, ...a.conflictingSignals].flatMap(s => s.references);
        findings.push({ id: `sec:${a.cik.padStart(10, '0')}`, entityId: graph.entityId, domain: 'sec_identity', label: `SEC issuer: ${a.secIssuerName ?? 'Name unavailable'} · CIK ${a.cik}`, value: a.secIssuerName,
            sources: [...new Map(references.filter(r => r.sourceUrl).map(r => [`${r.evidenceId}:${r.locator}`, { evidenceId: r.evidenceId, sourceUrl: r.sourceUrl!, title: r.evidenceId.startsWith('sec-') ? 'SEC EDGAR submissions' : 'Identity corroboration', excerpt: r.excerpt, retrievedAt: r.retrievedAt, publicationDate: r.publicationDate }])).values()],
            verification: a.entityId === graph.entityId ? { ...verifySecAssociation(a), evaluatedAt: now } : verificationResult('rejected', now, ['entity_mismatch'], [], [], references.map(r => r.evidenceId)) });
    }
    const events = [...new Map([...(input.fundingResearch?.events ?? []), ...rawEvidence.flatMap(e => Array.isArray(e.structuredData.fundingEvents) ? e.structuredData.fundingEvents as FundingEvent[] : [])].map(e => [e.eventId, e])).values()];
    for (const event of events) {
        const fields = Object.entries(event.fields).map(([key, field]) => {
            const page = sources.get(field.evidenceId);
            const association = page ? associations.find(a => a.cik.replace(/^0+/, '') === String(page.structuredData.cik ?? '').replace(/^0+/, '')) : undefined;
            let verification = verifyFundingField(event, key, field, page, graph, now, association);
            const conflictClaims = (input.claims ?? []).filter(c => c.fundingEventId === event.eventId && c.claimType === `funding.${key}` && (c.status === 'Conflicting' || c.conflictingEvidenceIds.length));
            // Never merge equal round labels into one transaction. Competing comparable statements remain provisional.
            const competing = key === 'amount' ? events.filter(other => other.eventId !== event.eventId && other.entityId === event.entityId && other.sourceKind === event.sourceKind && event.fields.roundLabel?.value && other.fields.roundLabel?.value === event.fields.roundLabel.value && other.fields.amountMeaning?.value === event.fields.amountMeaning?.value && other.fields.amount && other.fields.amount.value !== field.value) : [];
            if (verification.status !== 'rejected' && (conflictClaims.length || competing.length))
                verification = verificationResult('unverified', now, ['conflicting_field_evidence'], [field.evidenceId], ['resolve_transaction_and_amount_conflict'], [...conflictClaims.flatMap(c => c.conflictingEvidenceIds), ...competing.map(e => e.fields.amount.evidenceId)]);
            return { id: fundingId(event, key), entityId: event.entityId, domain: 'funding' as const, eventId: event.eventId, field: key, issuerCik: association?.cik, label: `${event.sourceKind === 'formD' ? 'SEC Form D / D-A' : event.fields.roundLabel?.value ?? 'Funding observation'} · ${key}`, value: field.value, sources: page ? [ref(page, field.excerpt, field.sourceUrl)] : [], verification };
        });
        findings.push(...fields);
        const material = fields.filter(f => ['amount', 'valuation', 'roundLabel', 'offeringAmount', 'amountSold'].includes(f.field));
        const status = material.some(f => f.verification.status === 'verified') ? 'verified' : material.length && material.every(f => f.verification.status === 'rejected') ? 'rejected' : 'unverified';
        findings.push({ id: fundingId(event), entityId: event.entityId, domain: 'funding', eventId: event.eventId, issuerCik: fields.find(f => f.issuerCik)?.issuerCik, label: event.sourceKind === 'formD' ? `Potential SEC Form D / D-A · CIK ${event.fields.cik?.value ?? 'unknown'}` : 'Funding observation', value: null, sources: fields.flatMap(f => f.sources).slice(0, 1),
            verification: verificationResult(status, now, [status === 'verified' ? 'supported_event_with_field_level_decisions' : 'event_not_fully_verified'], fields.flatMap(f => f.verification.supportingEvidenceIds), status === 'unverified' ? ['verified_event_subject_and_fields'] : []) });
    }
    for (const claim of input.claims ?? []) {
        let verification = claim.fundingEventId ? findings.find(f => f.id === `funding:${claim.fundingEventId}:${claim.claimType.replace(/^funding\./, '')}`)?.verification : undefined;
        // Legacy SEC scalar claims must use the same field decision, never officialRecord alone.
        if (!verification && ['offeringAmount', 'amountSold', 'firstSaleDate'].includes(claim.claimType))
            verification = findings.find(f => f.field === claim.claimType && f.sources.some(s => claim.evidenceIds.includes(s.evidenceId)))?.verification;
        verification ??= verifyClaim(claim, rawEvidence, graph, now);
        const pages = claim.evidenceIds.flatMap(id => sources.has(id) ? [sources.get(id)!] : []);
        const domain = claim.fundingEventId ? 'funding' : ['founder', 'executive', 'executiveRole', 'formerExecutiveRole', 'research.people'].includes(claim.claimType) ? 'leadership' : ['businessActivity', 'acquisition', 'research.recent'].includes(claim.claimType) ? 'recent' : claim.claimType === 'legalName' ? 'identity' : 'other';
        findings.push({ id: claimVerificationId(claim), entityId: claim.entityId, domain, claimId: claim.claimId, issuerCik: pages.find(p => p.providerId === 'secFormD')?.structuredData.cik as string | undefined, label: claim.statement, value: claim.normalizedValue,
            temporalContext: verification.reasonCodes.includes('historical_role_supported') ? 'historical' : domain === 'leadership' ? 'as_of_source' : undefined,
            eventDate: domain === 'recent' ? pages.map(p => explicitEventDate(claimExcerpt(claim, p))).find(Boolean) ?? null : null, sources: pages.map(p => ref(p, claim.fundingField?.excerpt ?? claimExcerpt(claim, p))), verification });
    }
    if (input.hiringIntelligence) {
        const hiring = input.hiringIntelligence, verification = verifyHiring(hiring, graph, now);
        // A failed fetch is a gap, not a plausible zero-job fact.
        if (hiring.jobs.length || ['success_with_jobs', 'success_zero_jobs'].includes(hiring.status))
            findings.push({ id: `hiring:${graph.entityId}`, entityId: hiring.companyId, domain: 'hiring', label: 'Observed public openings at retrieval time', value: hiring.summary.totalOpenRoles,
                sources: hiring.summary.sources.map(s => ({ evidenceId: `hiring-source:${s.sourceUrl}`, sourceUrl: s.sourceUrl, title: hiring.adapter ?? 'Career source', excerpt: hiring.jobs.slice(0, 8).map(j => j.title).join('; ') || 'Successful retrieval: zero public openings observed', retrievedAt: s.retrievedAt, publicationDate: null })), verification });
    }
    return { version: 1, evaluatedAt: now, findings: [...new Map(findings.map(f => [f.id, f])).values()] };
}
/** Canonical consumers only receive approved fields; audit findings retain all other decisions. */
export function canonicalResearch(input: VerificationInput & {
    evidence: NormalizedEvidence[];
}, ledger = evaluateVerification(input)) {
    const decisions = new Map(ledger.findings.map(f => [f.id, f]));
    const claims = (input.claims ?? []).flatMap(c => {
        const finding = decisions.get(claimVerificationId(c));
        if (finding?.verification.status !== 'verified')
            return [];
        const claim = { ...c, verification: finding.verification };
        if (finding.temporalContext === 'historical' && ['executiveRole', 'executive'].includes(claim.claimType))
            claim.claimType = 'formerExecutiveRole';
        return [claim];
    });
    const fundingResearch = input.fundingResearch ? { ...input.fundingResearch, events: input.fundingResearch.events.flatMap(event => {
            const verified = decisions.get(fundingId(event))?.verification;
            if (verified?.status !== 'verified')
                return [];
            const fields = Object.fromEntries(Object.entries(event.fields).flatMap(([key, field]) => {
                const verification = decisions.get(fundingId(event, key))?.verification;
                return verification?.status === 'verified' ? [[key, { ...field, verification }]] : [];
            }));
            return [{ ...event, fields, verification: verified }];
        }) } : undefined;
    const hiringVerification = input.hiringIntelligence ? verifyHiring(input.hiringIntelligence, input.graph, input.now) : undefined;
    const hiringIntelligence = input.hiringIntelligence ? { ...input.hiringIntelligence, verification: hiringVerification,
        ...(hiringVerification?.status !== 'verified' ? { jobs: [], status: ['success_with_jobs', 'success_zero_jobs'].includes(input.hiringIntelligence.status) ? 'partial' as const : input.hiringIntelligence.status, summary: { ...input.hiringIntelligence.summary, totalOpenRoles: 0, signals: [] } } : {}) } : null;
    const approvedEvidenceIds = new Set(claims.flatMap(c => c.evidenceIds));
    const evidence = input.evidence.flatMap(e => {
        const raw = input.rawEvidence.find(s => s.evidenceId === e.evidenceId);
        if (!raw)
            return [];
        const verification = raw.providerId.startsWith('hiring:') ? hiringVerification : verifyEntityAssociation(raw, input.graph, input.now, input.fundingResearch?.issuerAssociations?.find(a => a.cik.replace(/^0+/, '') === String(raw.structuredData.cik ?? '').replace(/^0+/, '')));
        if (verification?.status !== 'verified')
            return [];
        if (!approvedEvidenceIds.has(e.evidenceId) && !raw.providerId.startsWith('hiring:') && !fundingResearch?.events.some(event => Object.values(event.fields).some(f => f.evidenceId === e.evidenceId)))
            return [];
        const fields = { ...e.normalizedFields };
        delete fields.sourceSummary; // Unreviewed page prose must not bypass field/claim decisions.
        for (const [field, type] of [['founders', 'founder'], ['executives', 'executive'], ['products', 'product'], ['services', 'service']] as const)
            fields[field] = claims.filter(c => c.claimType === type && c.evidenceIds.includes(e.evidenceId)).map(c => String(c.normalizedValue));
        for (const [field, type] of [['organizationName', 'legalName'], ['issuerLegalName', 'legalName'], ['description', 'description'], ['offeringAmount', 'offeringAmount'], ['amountSold', 'amountSold'], ['firstSaleDate', 'firstSaleDate']] as const) {
            if (!claims.some(c => c.claimType === type && c.evidenceIds.includes(e.evidenceId)))
                delete fields[field];
        }
        if (!approvedEvidenceIds.has(e.evidenceId))
            delete fields.searchTopics;
        return [{ ...e, verification, normalizedFields: fields, fundingEvents: fundingResearch?.events.filter(event => Object.values(event.fields).some(f => f.evidenceId === e.evidenceId)) ?? [], researchFacts: e.researchFacts?.filter(f => claims.some(c => c.researchFact?.value === f.value && c.evidenceIds.includes(e.evidenceId))), factCandidates: e.factCandidates?.filter(f => claims.some(c => c.normalizedValue === f.value && c.evidenceIds.includes(e.evidenceId))) }];
    });
    return { ledger, claims, evidence, fundingResearch, hiringIntelligence };
}

/** Source eligibility alone must not make a conflicting field canonical. */
export function verifiedConflicts(conflicts: ConflictRecord[], claims: PrivateCompanyClaim[]) {
    return conflicts.filter(conflict => conflict.values.length > 0 && conflict.values.every(value =>
        claims.some(claim => claim.verification?.status === 'verified' && claim.claimType === conflict.claimType &&
            String(claim.normalizedValue) === value && claim.evidenceIds.some(id => conflict.evidenceIds.includes(id)))));
}
