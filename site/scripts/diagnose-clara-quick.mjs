#!/usr/bin/env node

/*
 * Opt-in live diagnostic for Clara's current user-facing Quick workflow.
 * It prints only sanitized identifiers, counts, URLs, and report text; it never
 * reads or prints provider credentials. The target server must already be
 * running against an isolated diagnostic database.
 */

const baseUrl = (process.env.CLARA_DIAGNOSTIC_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const companyName = process.env.CLARA_DIAGNOSTIC_COMPANY ?? "Abaka AI";
const website = process.env.CLARA_DIAGNOSTIC_WEBSITE ?? "https://abaka.ai/";

if (process.env.CLARA_DIAGNOSTIC_ALLOW_LIVE !== "1") {
  console.error("Refusing to make live provider calls. Set CLARA_DIAGNOSTIC_ALLOW_LIVE=1 explicitly.");
  process.exit(2);
}

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({ message: "Non-JSON response" }));
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${payload.code ?? payload.message ?? "unknown error"}`);
  }
  return payload;
}

const candidates = await post("/api/private-diligence/candidates", {
  input: {
    companyName,
    website,
    workflowMode: "quick",
    reportDepth: "Standard",
    researchObjective: "General diligence",
    quickResearchPurpose: "General Research",
    locale: "en",
  },
});

const candidate = candidates.candidates?.[0];
if (!candidate) throw new Error("No selectable candidate returned");

const confirmed = await post("/api/private-diligence/confirm-entity", {
  researchRequestId: candidates.researchRequestId,
  candidateId: candidate.candidateId,
  explicitUserConfirmation: true,
});
const planned = await post("/api/private-diligence/plan", { researchId: candidates.researchRequestId });
const completed = await post("/api/private-diligence/run", { researchId: candidates.researchRequestId });
const report = completed.report;

console.log(JSON.stringify({
  testedAt: new Date().toISOString(),
  route: "/workflows/company-intelligence -> candidates -> confirm-entity -> plan -> run",
  mode: "quick",
  input: { companyName, website },
  researchId: candidates.researchRequestId,
  candidate: {
    candidateId: candidate.candidateId,
    displayName: candidate.displayName,
    website: candidate.website,
    matchScore: candidate.matchScore,
    matchConfidence: candidate.matchConfidence,
    matchSignals: candidate.matchSignals,
  },
  confirmation: {
    canonicalName: confirmed.entity?.canonicalName,
    targetSelectionStatus: confirmed.targetSelectionStatus,
    identityVerificationStatus: confirmed.identityVerificationStatus,
  },
  plan: planned.plan?.map((item) => ({
    providerId: item.providerId,
    selected: item.selected,
    reason: item.reason,
  })),
  report: {
    coverageStatus: report.coverageStatus,
    evidenceCount: report.evidence?.length ?? 0,
    claimCount: report.claims?.length ?? 0,
    claimTypes: [...new Set((report.claims ?? []).map((claim) => claim.claimType))],
    sections: (report.sections ?? []).map((section) => ({
      id: section.sectionId,
      title: section.title?.en,
      paragraphs: section.paragraphsByLocale?.en ?? section.paragraphs,
      claimCount: section.claimIds?.length ?? 0,
      evidenceCount: section.evidenceIds?.length ?? 0,
    })),
    references: (report.references ?? []).map((reference) => ({
      title: reference.sourceTitle,
      url: reference.sourceUrl,
      publicationDate: reference.publicationDate,
      retrievedAt: reference.retrievedAt,
    })),
  },
}, null, 2));
