import type { EntityIdentityGraph, PrivateCompanyClaim, RawEvidence } from '../types';
import type { FundingEvent, FundingField } from '../funding/types';
import type { HiringActivityResult } from '../hiring/types';
import { verifySecAssociation, type SecIssuerAssociation } from '../entity-resolution/secIssuerResolution';
import { analyzeLegalEntities } from '../entity-resolution/legalEntityDiscovery';
import { extractFormD } from '../extraction/formDExtractor';
import { validateFundingCandidates } from '../funding/extraction';
import { verificationResult as result, type VerificationResult } from './types';
export const tidy = (value: string) => value.replace(/\s+/g, ' ').trim();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function sameCompanyDomain(url: string, graph: EntityIdentityGraph) {
    try {
        const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
        return graph.domains.some(d => { const domain = d.toLowerCase().replace(/^www\./, ''); return host === domain || host.endsWith(`.${domain}`); });
    }
    catch {
        return false;
    }
}
export function safeSource(url: string) {
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password;
    }
    catch {
        return false;
    }
}
export function namesTarget(text: string, graph: EntityIdentityGraph) {
    return [graph.canonicalName, ...graph.legalNames, ...graph.dbaNames].filter(Boolean).some(n => new RegExp(`\\b${escape(n)}(?:\\b|[.,])`, 'i').test(text));
}
export function verifyEntityAssociation(source: RawEvidence, graph: EntityIdentityGraph, now: string, association?: SecIssuerAssociation): VerificationResult {
    const ids = [source.evidenceId];
    if (source.entityId !== graph.entityId || source.structuredData.entityAssociation === 'rejected')
        return result('rejected', now, ['entity_mismatch'], [], [], ids);
    if (!safeSource(source.publicReferenceUrl) || source.structuredData.searchSnippet === true)
        return result('rejected', now, ['invalid_original_source'], [], [], ids);
    if (source.providerId === 'secFormD') {
        const issuer = association ?? source.structuredData.secIssuerAssociation as SecIssuerAssociation | undefined;
        if (!issuer || issuer.entityId !== graph.entityId || issuer.cik.replace(/^0+/, '') !== String(source.structuredData.cik ?? '').replace(/^0+/, ''))
            return result('unverified', now, ['sec_issuer_association_unverified'], ids, ['corroborating_identity_signal']);
        return { ...verifySecAssociation(issuer), evaluatedAt: now, supportingEvidenceIds: [...new Set([...verifySecAssociation(issuer).supportingEvidenceIds, ...ids])] };
    }
    if (source.companyReported && sameCompanyDomain(source.publicReferenceUrl, graph))
        return result('verified', now, ['confirmed_company_domain'], ids);
    if (source.companyReported && !source.providerId.startsWith('hiring:'))
        return result('rejected', now, ['company_domain_conflict'], [], [], ids);
    if (source.entityMatchConfidence !== 'Low' && source.sourceTier <= 3 && (source.independentlyPublished || source.officialRecord) && namesTarget(source.rawText, graph))
        return result('verified', now, ['attributable_original_source'], ids);
    return result('unverified', now, ['entity_association_incomplete'], ids, ['target_company_association']);
}
export function verifyFundingField(event: FundingEvent, key: string, field: FundingField, source: RawEvidence | undefined, graph: EntityIdentityGraph, now: string, association?: SecIssuerAssociation): VerificationResult {
    if (event.entityId !== graph.entityId)
        return result('rejected', now, ['entity_mismatch'], [], [], [field.evidenceId]);
    if (!source)
        return result('unverified', now, ['source_not_available'], [field.evidenceId], ['original_source']);
    const entity = verifyEntityAssociation(source, graph, now, association);
    if (entity.status === 'rejected')
        return entity;
    const metadata = source.structuredData.filingMetadata as Record<string, unknown> | undefined;
    const secMetadata = event.sourceKind === 'formD' && metadata?.[key] === field.value && field.sourceUrl === `https://data.sec.gov/submissions/CIK${String(source.structuredData.cik).padStart(10, '0')}.json`;
    const text = tidy(String(source.structuredData.fundingText ?? source.rawText));
    if (!field.excerpt.trim() || !safeSource(field.sourceUrl) || !secMetadata && (!text.includes(tidy(field.excerpt)) || field.sourceUrl !== source.publicReferenceUrl))
        return result('rejected', now, ['field_source_mismatch'], [], [], [field.evidenceId]);
    if (entity.status !== 'verified')
        return { ...entity, reasonCodes: [...entity.reasonCodes, 'field_entity_unverified'] };
    if (event.sourceKind === 'formD') {
        const extracted = extractFormD(source.rawText) as unknown as Record<string, unknown>;
        const mapped = key === 'financingType' ? 'offeringType' : key;
        return secMetadata || extracted[mapped] === field.value ? result('verified', now, ['original_filing_field'], [field.evidenceId]) : result('unverified', now, ['filing_field_support_incomplete'], [field.evidenceId], ['explicit_field_support']);
    }
    // Reuse the existing source/subject/field validator; the model cannot approve its own fields.
    const subject = field.excerpt.match(/\b([A-Z][A-Za-z0-9&., -]{1,70}?)\s+(?:has\s+)?(?:raised|secured|closed)\b/)?.[1];
    if (subject && !namesTarget(subject, graph) && !/^we$/i.test(subject.trim()))
        return result('rejected', now, ['different_financing_subject'], [], [], [field.evidenceId]);
    const validated = validateFundingCandidates({ events: [{ entityId: event.entityId, excerpt: field.excerpt, fields: { [key]: field } }] }, source, graph);
    // Supporting attributes may need the event's broader subject sentence.
    const excerpt = Object.values(event.fields).map(f => f.excerpt).find(e => e.includes(field.excerpt)) ?? field.excerpt;
    const all = validateFundingCandidates({ events: [{ entityId: event.entityId, excerpt, fields: event.fields }] }, source, graph);
    if (!validated[0]?.fields[key] && !all[0]?.fields[key])
        return result('unverified', now, ['field_support_incomplete'], [field.evidenceId], ['explicit_field_support_and_transaction_subject']);
    if (key === 'amount' && (!['current_round', 'cumulative', 'offering_total', 'amount_sold'].includes(String(event.fields.amountMeaning?.value)) || !all[0]?.fields.amountMeaning))
        return result('unverified', now, ['amount_meaning_unknown'], [field.evidenceId], ['amount_meaning']);
    if (['amountMeaning', 'currency', 'valuationCurrency', 'roundLabel', 'eventStatus', 'dateMeaning', 'valuationBasis'].includes(key) && ['unknown', 'unspecified'].includes(String(field.value)))
        return result('unverified', now, ['field_not_established'], [field.evidenceId], ['explicit_field_support']);
    return result('verified', now, ['explicit_original_field'], [field.evidenceId]);
}
export function claimExcerpt(claim: PrivateCompanyClaim, source: RawEvidence) {
    if (claim.researchFact)
        return claim.researchFact.excerpt;
    const facts = source.structuredData.factCandidates as Array<{
        value: string;
        excerpt: string;
        temporalStatus?: string;
    }> | undefined;
    const candidate = facts?.find(f => f.value === claim.normalizedValue);
    if (candidate)
        return candidate.excerpt;
    const text = tidy(source.rawText), value = tidy(String(claim.normalizedValue ?? ''));
    const index = text.toLowerCase().indexOf(value.toLowerCase());
    return index >= 0 && value ? text.slice(Math.max(0, index - 100), Math.min(text.length, index + value.length + 180)) : '';
}
export function explicitEventDate(excerpt: string): string | null {
    const value = excerpt.match(/\bon\s+(\d{4}-\d{2}-\d{2})\b/i)?.[1];
    if (!value)
        return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
export function verifyClaim(claim: PrivateCompanyClaim, sources: RawEvidence[], graph: EntityIdentityGraph, now: string): VerificationResult {
    if (claim.entityId !== graph.entityId)
        return result('rejected', now, ['entity_mismatch'], [], [], claim.evidenceIds);
    const pages = sources.filter(s => claim.evidenceIds.includes(s.evidenceId));
    if (!pages.length)
        return result('unverified', now, ['source_not_available'], claim.evidenceIds, ['original_source']);
    if (pages.every(page => verifyEntityAssociation(page, graph, now).status === 'rejected'))
        return result('rejected', now, ['entity_mismatch'], [], [], claim.evidenceIds);
    if (claim.claimType === 'legalName' && pages.every(p => p.providerId !== 'secFormD')) {
        const candidate = analyzeLegalEntities(graph, sources, now).candidates.find(c => c.legalName.toLowerCase().replace(/[^a-z0-9]/g, '') === String(claim.normalizedValue).toLowerCase().replace(/[^a-z0-9]/g, ''));
        return result(candidate?.status === 'accepted' ? 'verified' : candidate?.status === 'rejected' ? 'rejected' : 'unverified', now, candidate?.reasonCodes ?? ['legal_entity_relationship_unresolved'], claim.evidenceIds, candidate?.status === 'accepted' ? [] : ['supported_primary_legal_entity']);
    }
    if (claim.status === 'Conflicting' || claim.conflictingEvidenceIds.length)
        return result('unverified', now, ['conflicting_field_evidence'], claim.evidenceIds, ['resolve_field_conflict'], claim.conflictingEvidenceIds);
    const outcomes = pages.map(source => {
        const entity = verifyEntityAssociation(source, graph, now), excerpt = claimExcerpt(claim, source);
        if (entity.status !== 'verified')
            return entity;
        if (!excerpt || !tidy(source.rawText).includes(tidy(excerpt)))
            return result('unverified', now, ['field_support_incomplete'], [source.evidenceId], ['original_supporting_excerpt']);
        const people = ['founder', 'executive', 'executiveRole', 'formerExecutiveRole', 'research.people'].includes(claim.claimType);
        if (people) {
            const path = new URL(source.sourceUrl).pathname;
            const person = claim.claimType==='research.people' ? null : String(claim.normalizedValue).split(/\s+[—–]\s+/)[0];
            if(person&&!tidy(excerpt).toLowerCase().includes(tidy(person).toLowerCase()))return result('unverified',now,['person_role_association_incomplete'],[source.evidenceId],['explicit_person_role_and_company']);
            if (/\b(?:author|guest speaker|conference speaker|our customer|our client)\b/i.test(excerpt) && !namesTarget(excerpt, graph))
                return result('rejected', now, ['unrelated_person_context'], [], [], [source.evidenceId]);
            const role = /\b(?:CEO|CFO|COO|CTO|CRO|CMO|CPO|CCO|chief|head of|VP|vice president|president|director|co-founder|founder)\b/i;
            const employer = excerpt.match(/\b(?:CEO|CFO|COO|CTO|president|founder)\s+(?:at|of)\s+([A-Z][A-Za-z0-9 &.-]{1,60}?)(?=[,;.!?]|\s+(?:spoke|said|joined|announced)\b|$)/)?.[1];
            if (employer && !namesTarget(employer, graph) && !/^(?:the company|our company)\b/i.test(employer))
                return result('rejected', now, ['unrelated_person_context'], [], [], [source.evidenceId]);
            if (/\/authors?\//i.test(path) && (!role.test(excerpt) || !namesTarget(excerpt, graph)))
                return result('rejected', now, ['article_author_not_employee'], [], [], [source.evidenceId]);
            const associated = namesTarget(excerpt, graph) || source.companyReported && /\/(?:about|team|leadership)(?:\/|$)|introduc.*(?:cfo|cco|ceo|leadership)|appoint/i.test(path);
            if (!role.test(excerpt) || claim.claimType === 'founder' && !/\b(?:co-)?founder\b/i.test(excerpt) || !associated)
                return result('unverified', now, ['person_role_association_incomplete'], [source.evidenceId], ['explicit_person_role_and_company']);
            if (/\b(?:may be|possibly|reportedly|unclear)\b/i.test(excerpt))
                return result('unverified', now, ['role_status_unclear'], [source.evidenceId], ['role_time_context']);
            return result('verified', now, [/\b(?:former|previously|until|was the)\b/i.test(excerpt) || claim.claimType === 'formerExecutiveRole' ? 'historical_role_supported' : 'role_supported_as_of_source'], [source.evidenceId]);
        }
        if (['businessActivity', 'acquisition', 'research.recent'].includes(claim.claimType)) {
            if (!namesTarget(excerpt, graph) && !(source.companyReported && /\b(?:we|our)\b/i.test(excerpt)))
                return result('unverified', now, ['event_subject_unresolved'], [source.evidenceId], ['target_event_association']);
            if (!/\b(?:announc(?:e|es|ed|ing)|rais(?:e|es|ed|ing)|acquir(?:e|es|ed)|launch(?:ed|es)?|released|introduced|appointed|received|opened)\b/i.test(excerpt))
                return result('unverified', now, ['event_not_established'], [source.evidenceId], ['explicit_event_description']);
            // Publication anchors the statement, never substitutes for an event date.
            if (!source.publicationDate && !explicitEventDate(excerpt))
                return result('unverified', now, ['event_timing_unresolved'], [source.evidenceId], ['dated_original_source_or_event_date']);
        }
        return result('verified', now, ['source_grounded_statement'], [source.evidenceId]);
    });
    return outcomes.find(o => o.status === 'verified') ?? outcomes.find(o => o.status === 'unverified') ?? outcomes[0];
}
export function verifyHiring(resultData: HiringActivityResult, graph: EntityIdentityGraph, now: string): VerificationResult {
    if (resultData.companyId !== graph.entityId || resultData.jobs.some(j => j.companyId !== graph.entityId))
        return result('rejected', now, ['hiring_entity_mismatch']);
    const source = resultData.selectedSource;
    if (!source || !safeSource(source.url))
        return result('unverified', now, ['career_source_unconfirmed'], [], ['confirmed_career_source']);
    const associated = source.discoveryMethod === 'linked_from_website' || source.discoveryMethod === 'confirmed_source' || sameCompanyDomain(source.url, graph);
    if (!associated)
        return result('unverified', now, ['ats_association_unverified'], [], ['official_company_link_to_board']);
    const board = new URL(source.url);
    const token = (url: URL) => url.pathname.split('/').filter(Boolean).filter(p => p !== 'boards')[0];
    const ats = /\.(?:greenhouse\.io|lever\.co|ashbyhq\.com)$/.test(board.hostname);
    if (resultData.jobs.some(job => {
        if (!safeSource(job.sourceUrl))
            return true;
        const url = new URL(job.sourceUrl);
        if (sameCompanyDomain(job.sourceUrl, graph))
            return false;
        if (ats)
            return url.hostname.split('.').slice(-2).join('.') !== board.hostname.split('.').slice(-2).join('.') || token(url) !== token(board);
        return url.hostname !== board.hostname;
    }))
        return result('rejected', now, ['job_board_mismatch']);
    if (!['success_with_jobs', 'success_zero_jobs'].includes(resultData.status))
        return result('unverified', now, ['hiring_retrieval_incomplete'], [], ['successful_current_snapshot']);
    if (resultData.summary.totalOpenRoles !== resultData.jobs.length)
        return result('unverified', now, ['snapshot_count_inconsistent'], [], ['consistent_snapshot']);
    return result('verified', now, ['observed_public_openings_at_retrieval']);
}
