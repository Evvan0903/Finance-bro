import { createHash } from "node:crypto";
import { secClient, type SecClient } from "../../sec-client";
import { extractFormD } from "../extraction/formDExtractor";
import type { RawEvidence } from "../types";
import type { PrivateCompanyProvider } from "./providerTypes";

type SubmissionPayload = {
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
      !/^[A-Za-z0-9_.-]+$/.test(primaryDocument)) continue;
    const cikNumber = String(Number(cik));
    const accessionPath = accessionNumber.replaceAll("-", "");
    output.push({
      cik,
      form,
      accessionNumber,
      filingDate: recent.filingDate?.[index] ?? "Not disclosed",
      primaryDocument,
      filingUrl: `https://www.sec.gov/Archives/edgar/data/${cikNumber}/${accessionPath}/${primaryDocument}`,
    });
  }
  return output.slice(0, 12);
}

export function createSecFormDProvider(client: SecClient = secClient): PrivateCompanyProvider {
  return {
    providerId: "secFormD",
    providerName: "SEC EDGAR Form D",
    sourceTier: 1,
    providerCategory: "financing",
    isConfigured: () => true,
    supports: (context) => context.identityGraph.cikCandidates.length > 0,
    validateConfiguration: () => "success",
    search: async (context) => {
      const records: Omit<FilingRecord, "document">[] = [];
      for (const cik of context.identityGraph.cikCandidates) {
        const submissions = await client.getSubmissions<SubmissionPayload>(cik);
        records.push(...selectFormDFilings(submissions, cik));
      }
      return { status: records.length ? "success" as const : "noData" as const, records };
    },
    fetchDetails: async (records) => {
      const output: FilingRecord[] = [];
      for (const record of records as Omit<FilingRecord, "document">[]) {
        output.push({ ...record, document: await client.getFilingDocument(record.filingUrl) });
      }
      return output;
    },
    normalize: async (records, context) => (records as FilingRecord[]).map((record, index): RawEvidence => {
      const extracted = extractFormD(record.document);
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
        rawText: "",
        structuredData: { ...extracted, form: record.form, accessionNumber: record.accessionNumber },
        matchedEntitySignals: [`CIK ${record.cik}`, ...(extracted.issuerLegalName ? [`Filed issuer ${extracted.issuerLegalName}`] : [])],
        entityMatchConfidence: "High",
        companyReported: false,
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
