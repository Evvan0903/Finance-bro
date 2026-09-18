import type { PrivateDiligenceReport } from '../types';
import type { VerificationFinding, VerificationLedger } from './types';
export const verificationText = (text: string) => text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[contact redacted]');
export function displayableUnverified(ledger?: VerificationLedger): VerificationFinding[] {
    const findings = ledger?.findings ?? [];
    return findings.filter(f => f.verification.status === 'unverified' && f.sources.some(s => s.excerpt.trim()) && !['unknown', 'unspecified'].includes(String(f.value)) &&
        // Field-level funding findings are the display authority, not duplicate claim copies.
        !(f.domain === 'funding' && f.claimId) && !(f.eventId && !f.field && findings.some(other => other.eventId === f.eventId && other.field && other.verification.status === 'unverified')));
}
export function attachVerificationReport(report: PrivateDiligenceReport, ledger: VerificationLedger) {
    report.verification = ledger;
    const items = displayableUnverified(ledger);
    if (!items.length)
        return;
    const paragraphs = items.flatMap(item => [
        `${item.label}${item.value !== null ? `: ${item.value}` : ''} — UNVERIFIED`,
        `Why: ${item.verification.reasonCodes.join('; ')}. Missing corroboration: ${item.verification.missingRequirements.join('; ') || 'See reasons'}.`,
        ...item.sources.map(s => `Source: ${s.sourceUrl}; retrieved ${s.retrievedAt}${s.publicationDate ? `; source published ${s.publicationDate} (not event date)` : ''}. Excerpt: ${s.excerpt}`),
    ]).map(verificationText);
    report.sections.push({ sectionId: 'unverified', number: '?', title: { en: 'Unverified Information', zh: '未核验信息' }, paragraphs, paragraphsByLocale: { en: paragraphs, zh: paragraphs }, claimIds: [], evidenceIds: [...new Set(items.flatMap(f => f.verification.supportingEvidenceIds))] });
    report.informationGaps.push(...items.map(f => ({ gapId: `verification:${f.id}`, category: f.domain, missingInformation: f.verification.missingRequirements.join('; ') || f.verification.reasonCodes.join('; '), whyItMatters: 'Candidate information is excluded from canonical facts until deterministically verified.', affectedClaims: f.claimId ? [f.claimId] : [], affectedSections: ['unverified'], priority: 'Medium' as const, recommendedEvidence: f.verification.missingRequirements, publicSearchCoverage: 'Verification decision recorded; additional corroboration required' })));
}
