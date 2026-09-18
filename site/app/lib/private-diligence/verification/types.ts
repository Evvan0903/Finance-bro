/** Governance is separate from source attribution (CompanyReported, official record, etc.). */
export type VerificationStatus = 'verified' | 'unverified' | 'rejected';
export type VerificationResult = {
    status: VerificationStatus;
    reasonCodes: string[];
    supportingEvidenceIds: string[];
    conflictingEvidenceIds: string[];
    missingRequirements: string[];
    evaluatedAt: string;
};
export type VerificationSource = {
    evidenceId: string;
    sourceUrl: string;
    title: string;
    excerpt: string;
    retrievedAt: string;
    publicationDate: string | null;
};
export type VerificationFinding = {
    id: string;
    entityId: string;
    domain: 'sec_identity' | 'funding' | 'leadership' | 'hiring' | 'recent' | 'identity' | 'other';
    label: string;
    value: string | number | boolean | null;
    eventId?: string;
    field?: string;
    claimId?: string;
    issuerCik?: string;
    temporalContext?: 'historical' | 'as_of_source' | 'unknown';
    eventDate?: string | null;
    sources: VerificationSource[];
    verification: VerificationResult;
};
export type VerificationTransition = {
    findingId: string;
    previousStatus: VerificationStatus | null;
    newStatus: VerificationStatus;
    reasonCodes: string[];
    supportingEvidenceIds: string[];
    conflictingEvidenceIds: string[];
    missingRequirements: string[];
    evaluatedAt: string;
    executionId: string;
};
export type VerificationLedger = {
    version: 1;
    evaluatedAt: string;
    findings: VerificationFinding[];
};
export function verificationResult(status: VerificationStatus, evaluatedAt: string, reasonCodes: string[], supportingEvidenceIds: string[] = [], missingRequirements: string[] = [], conflictingEvidenceIds: string[] = []): VerificationResult {
    return { status, evaluatedAt, reasonCodes: [...new Set(reasonCodes)], supportingEvidenceIds: [...new Set(supportingEvidenceIds)], missingRequirements: [...new Set(missingRequirements)], conflictingEvidenceIds: [...new Set(conflictingEvidenceIds)] };
}
