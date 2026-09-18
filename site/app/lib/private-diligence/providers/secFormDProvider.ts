import { createHash } from "node:crypto";
import { secClient, type SecClient } from "../../sec-client";
import { extractFormD } from "../extraction/formDExtractor";
import { resolveSecIssuer, type SecIssuerAssociation, type SecIssuerMetadata } from "../entity-resolution/secIssuerResolution";
import type { RawEvidence } from "../types";
import type { PrivateCompanyProvider } from "./providerTypes";

export type SubmissionPayload = SecIssuerMetadata & {
  websites?: string;
  website?: string;
  name?: string;
  stateOfIncorporation?: string;
  addresses?: { business?: { street1?: string; city?: string; stateOrCountry?: string; zipCode?: string } };
  filings?: { recent?: {
    form?: string[];
    accessionNumber?: string[];
    filingDate?: string[];
    primaryDocument?: string[];
  } };
};

type FilingRecord = {
  cik: string;
  form: "D" | "D/A";
  accessionNumber: string;
  filingDate: string;
  primaryDocument: string;
  filingUrl: string;
  document: string;
};

export function selectFormDFilings(payload: SubmissionPayload, cik: string) {
  const recent = payload.filings?.recent;
  if (!recent) return [];
  const output: Omit<FilingRecord, "document">[] = [];
  for (let index = 0; index < (recent.form?.length ?? 0); index += 1) {
    const form = recent.form?.[index];
    const accessionNumber = recent.accessionNumber?.[index] ?? "";
    const primaryDocument = recent.primaryDocument?.[index] ?? "";
    if ((form !== "D" && form !== "D/A") || !/^\d{10}-\d{2}-\d{6}$/.test(accessionNumber) ||
      !/^(?:xsl[A-Za-z0-9_-]+\/)?[A-Za-z0-9_-]+\.(?:xml|htm|html)$/.test(primaryDocument)) continue;
    const cikNumber = String(Number(cik));
    const accessionPath = accessionNumber.replaceAll("-", "");
    output.push({
      cik,
      form,
      accessionNumber,
      filingDate: recent.filingDate?.[index] ?? "Not disclosed",
      primaryDocument,
      filingUrl: `https://www.sec.gov/Archives/edgar/data/${cikNumber}/${accessionPath}/${primaryDocument.replace(/^xsl[^/]+\//, "")}`,
    });
  }
  return output.slice(0, 12);
}

export function verifySecIssuer(payload: SubmissionPayload, graph: import("../types").EntityIdentityGraph) {
  return resolveSecIssuer(payload, graph, { cik: "", now: new Date().toISOString() }).decision === "verified";
}

export function createSecFormDProvider(client: SecClient = secClient, options: {
  discoverCiks?: (context: import("./providerTypes").PrivateProviderContext) => Promise<string[]>;
  requireUserAgent?: boolean;
  identityEvidence?: RawEvidence[];
} = {}): PrivateCompanyProvider {
  const requireUserAgent = options.requireUserAgent ?? client === secClient;
  const associations: SecIssuerAssociation[] = [];
  const submissionsByCik = new Map<string, SubmissionPayload>();
  const retrievedIdentityEvidence: RawEvidence[] = [];
  const failure = (association: SecIssuerAssociation, error: unknown) => {
    association.downstreamError = error && typeof error === "object" && "code" in error ? String(error.code) : "upstreamUnavailable";
  };
  return {
    getIssuerAssociations: () => structuredClone(associations),
    providerId: "secFormD",
    providerName: "SEC EDGAR Form D",
    sourceTier: 1,
    providerCategory: "financing",
    isConfigured: () => !requireUserAgent || validSecUserAgent(),
    supports: (context) => context.identityGraph.cikCandidates.length > 0 || Boolean(options.discoverCiks),
    validateConfiguration: () => requireUserAgent && !validSecUserAgent() ? "invalidConfiguration" : "success",
    search: async (context) => {
      associations.length = 0;
      submissionsByCik.clear();
      retrievedIdentityEvidence.length = 0;
      const records: Omit<FilingRecord, "document">[] = [];
      const candidates = [...new Set([...context.identityGraph.cikCandidates, ...(options.discoverCiks ? await options.discoverCiks(context) : [])]
        .filter((cik) => /^\d{1,10}$/.test(cik) && Number(cik) > 0).map((cik) => cik.padStart(10, "0")))].slice(0, 2);
      let verified = false;
      for (const cik of candidates) {
        const pending: SecIssuerAssociation = { cik: cik.padStart(10, "0"), entityId: context.identityGraph.entityId, secIssuerName: null, decision: "unresolved", reasonCodes: ["submissions_unavailable"], matchedSignals: [], conflictingSignals: [], evaluatedAt: context.now().toISOString(), downstreamStage: "submissions" };
        associations.push(pending);
        let submissions: SubmissionPayload;
        try { submissions = await client.getSubmissions<SubmissionPayload>(cik); }
        catch (error) { failure(pending, error); throw error; }
        submissionsByCik.set(cik, submissions);
        const association = resolveSecIssuer(submissions, context.identityGraph, { cik, now: context.now().toISOString(), identityEvidence: options.identityEvidence });
        Object.assign(pending, association);
        if (association.decision !== "verified") continue;
        verified = true;
        pending.downstreamStage = "filing_availability";
        records.push(...selectFormDFilings(submissions, cik).slice(0, 3));
      }
      return { status: records.length ? "success" as const : "noData" as const, records, sanitizedIssue: verified ? "No Form D found in recent submissions; older history was not searched" : "issuer_unresolved" };
    },
    fetchDetails: async (records, context) => {
      const output: FilingRecord[] = [];
      for (const record of records as Omit<FilingRecord, "document">[]) {
        const association = associations.find((a) => a.cik === record.cik.padStart(10, "0"));
        if (association?.decision !== "verified") throw Object.assign(new Error("SEC_ISSUER_NOT_VERIFIED"), { code: "invalidRequest" });
        association.downstreamStage = "filing_retrieval";
        let document: string;
        try { document = await client.getFilingDocument(record.filingUrl); }
        catch (error) { failure(association, error); throw error; }
        association.downstreamStage = "parsing";
        const issuer = extractFormD(document).issuerLegalName;
        const names = [...context.identityGraph.legalNames, ...context.identityGraph.termsPageLegalNames, ...context.identityGraph.privacyPageLegalNames];
        const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!issuer || !names.some((name) => norm(name) === norm(issuer)) || norm(issuer) !== norm(association.secIssuerName ?? "")) {
          association.downstreamError = !issuer ? "form_d_parse_failed" : "filing_issuer_conflict";
          throw Object.assign(new Error("SEC_FORM_D_PARSE_OR_ISSUER_MISMATCH"), { code: "malformedResponse" });
        }
        retrievedIdentityEvidence.push({
          evidenceId: `sec-identity-${record.cik}-${record.accessionNumber}`, researchId: context.researchId,
          entityId: context.identityGraph.entityId, providerId: "secFormD", sourceTier: 1,
          sourceType: "SEC issuer identity", sourceTitle: `${record.form} ${record.filingDate}`,
          sourceUrl: record.filingUrl, publicReferenceUrl: record.filingUrl, publicationDate: record.filingDate,
          retrievedAt: context.now().toISOString(), rawText: document, structuredData: { cik: record.cik },
          matchedEntitySignals: [], entityMatchConfidence: "High", companyReported: true, officialRecord: true,
          independentlyPublished: false, contentHash: createHash("sha256").update(document).digest("hex"), limitations: [],
        });
        // Newer/older original documents can invalidate a provisional association; publish no partial evidence on conflict.
        const rechecked = resolveSecIssuer(submissionsByCik.get(record.cik)!, context.identityGraph, {
          cik: record.cik, now: context.now().toISOString(), identityEvidence: [...(options.identityEvidence ?? []), ...retrievedIdentityEvidence],
        });
        Object.assign(association, rechecked);
        if (association.decision !== "verified") {
          association.downstreamError = "filing_identity_conflict";
          throw Object.assign(new Error("SEC_FILING_IDENTITY_CONFLICT"), { code: "invalidRequest" });
        }
        output.push({ ...record, document });
      }
      return output;
    },
    normalize: async (records, context) => (records as FilingRecord[]).map((record, index): RawEvidence => {
      const association = associations.find((a) => a.cik === record.cik.padStart(10, "0"));
      if (association?.decision !== "verified") throw Object.assign(new Error("SEC_ISSUER_NOT_VERIFIED"), { code: "invalidRequest" });
      association.downstreamStage = "evidence";
      const extracted = extractFormD(record.document);
      const evidenceId = `sec-form-d-${context.researchId}-${index + 1}`;
      const fields: Record<string, import("../funding/types").FundingField> = {};
      const tags: Record<string, string> = { offeringAmount: "totalOfferingAmount", amountSold: "totalAmountSold", firstSaleDate: "dateOfFirstSale" };
      for (const [key, tag] of Object.entries(tags)) {
        const value = extracted[key as keyof typeof extracted];
        const excerpt = record.document.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "i"))?.[0];
        if ((typeof value !== "string" && typeof value !== "number") || !excerpt) continue;
        fields[key] = { value, evidenceId, sourceUrl: record.filingUrl, excerpt: excerpt.slice(0, 900), locator: `xml:${tag}`, publicationDate: record.filingDate, retrievedAt: context.now().toISOString() };
      }
      if (extracted.offeringType && ["equity", "debt", "mixed"].includes(extracted.offeringType)) {
        const excerpt = record.document.match(/<typesOfSecuritiesOffered\b[^>]*>[\s\S]*?<\/typesOfSecuritiesOffered>/i)?.[0];
        if (excerpt) fields.financingType = { value: extracted.offeringType, evidenceId, sourceUrl: record.filingUrl, excerpt: excerpt.slice(0, 900), locator: "xml:typesOfSecuritiesOffered", publicationDate: record.filingDate, retrievedAt: context.now().toISOString() };
      }
      for (const [key, value] of Object.entries({ cik: record.cik, accessionNumber: record.accessionNumber, filingDate: record.filingDate, form: record.form })) {
        fields[key] = { value, evidenceId, sourceUrl: `https://data.sec.gov/submissions/CIK${record.cik.padStart(10, "0")}.json`, excerpt: `${key}: ${value}`, locator: "filings.recent", publicationDate: record.filingDate, retrievedAt: context.now().toISOString() };
      }
      if (extracted.previousAccessionNumber) fields.previousAccessionNumber = { ...fields.accessionNumber, value: extracted.previousAccessionNumber, sourceUrl: record.filingUrl, excerpt: extracted.previousAccessionNumber, locator: "xml:previousAccessionNumber" };
      return {
        evidenceId: `sec-form-d-${context.researchId}-${index + 1}`,
        researchId: context.researchId,
        entityId: context.identityGraph.entityId,
        providerId: "secFormD",
        sourceTier: 1,
        sourceType: "SEC Form D filing",
        sourceTitle: `${record.form} filed ${record.filingDate}`,
        sourceUrl: record.filingUrl,
        publicReferenceUrl: record.filingUrl,
        publicationDate: record.filingDate === "Not disclosed" ? null : record.filingDate,
        retrievedAt: context.now().toISOString(),
        rawText: record.document,
        structuredData: { ...extracted, cik: record.cik, form: record.form, accessionNumber: record.accessionNumber, fundingEvents: [{ eventId: `formD-${record.accessionNumber}`, entityId: context.identityGraph.entityId, sourceKind: "formD", fields, limitations: ["Issuer disclosure hosted by SEC, not independently verified by SEC. USD offering total and amount sold are distinct; no total funding is calculated.", record.form === "D/A" ? "Amendment; not a new financing round. Previous accession is linked only when explicitly disclosed." : "Notice of offering; not proof of a completed round.", "Only the three most recent Form D filings in recent submissions were in scope; older history not searched."] }] },
        matchedEntitySignals: [`CIK ${record.cik}`, ...(extracted.issuerLegalName ? [`Filed issuer ${extracted.issuerLegalName}`] : [])],
        entityMatchConfidence: "High",
        companyReported: true,
        officialRecord: true,
        independentlyPublished: false,
        contentHash: createHash("sha256").update(`${record.accessionNumber}|${record.form}`).digest("hex"),
        limitations: [
          "Form D is a notice filing and is not an audited financial statement.",
          "Amount offered is not company valuation, and amount sold is not automatically total financing raised.",
          "Related persons are not automatically founders or current executives.",
        ],
      };
    }),
    buildPublicReference: (evidence: RawEvidence) => evidence.publicReferenceUrl,
  };
}

export function validSecUserAgent() {
  const value = process.env.SEC_USER_AGENT ?? "";
  return /[^\s@]+@[^\s@]+\.[^\s@]+/.test(value) && !/example\.(com|org)|<|>/.test(value);
}
