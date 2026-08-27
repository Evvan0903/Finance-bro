import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { privateDiligenceStore } from "../../../lib/private-diligence/persistence/researchStore";
import { privateDiligenceReportToMarkdown } from "../../../lib/private-diligence/reports/markdown";
import { redactPrivateDiligenceText } from "../../../lib/private-diligence/security";
import type { PrivateDiligenceReport } from "../../../lib/private-diligence/types";

export const runtime = "nodejs";

function safeCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  const text = redactPrivateDiligenceText(Array.isArray(value) ? value.join("; ") : String(value));
  return /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
}

function csv(rows: Record<string, unknown>[]) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const encode = (value: unknown) => {
    const text = String(safeCell(value));
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return `\uFEFF${[columns.map(encode).join(","), ...rows.map((row) => columns.map((column) => encode(row[column])).join(","))].join("\r\n")}\r\n`;
}

function workbook(rows: Record<string, unknown>[], sheetName: string) {
  const sanitized = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, safeCell(value)])));
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(sanitized);
  sheet["!autofilter"] = sheet["!ref"] ? { ref: sheet["!ref"] } : undefined;
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function evidenceRows(report: PrivateDiligenceReport | null) {
  if (!report) return [];
  return report.evidence.map((item) => ({
    "Evidence ID": item.evidenceId,
    Provider: item.providerId,
    "Source tier": item.sourceTier,
    "Source type": item.evidenceType,
    "Source title": item.sourceTitle,
    "Public URL": item.sourceUrl,
    "Publication date": item.publicationDate,
    "Retrieval date": item.retrievedAt,
    Subject: item.subjectName,
    "Entity-match confidence": item.entityMatchConfidence,
    "Official record": item.officialRecord,
    "Company reported": item.companyReported,
    "Independent source": item.independentlyPublished,
    "Verification eligibility": item.verificationEligibility,
    "Linked claims": report.claims.filter((claim) => claim.evidenceIds.includes(item.evidenceId)).map((claim) => claim.claimId),
    Limitations: item.limitations,
  }));
}

function claimRows(report: PrivateDiligenceReport | null) {
  return report?.claims.map((claim) => ({
    "Claim ID": claim.claimId,
    Category: claim.category,
    Claim: claim.statement,
    "Normalized value": claim.normalizedValue,
    Status: claim.status,
    Confidence: claim.confidence,
    Materiality: claim.materiality,
    "Evidence IDs": claim.evidenceIds,
    "Conflicting evidence IDs": claim.conflictingEvidenceIds,
    Limitations: claim.limitations,
  })) ?? [];
}

function riskRows(report: PrivateDiligenceReport | null) {
  return report?.risks.map((risk) => ({
    "Risk ID": risk.riskId,
    Category: risk.category,
    Title: risk.title,
    Description: risk.description,
    Severity: risk.severity,
    Status: risk.status,
    "Evidence IDs": risk.evidenceIds,
    "Claim IDs": risk.claimIds,
    Limitations: risk.limitations,
  })) ?? [];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const researchId = typeof body?.researchId === "string" ? body.researchId : "";
    const type = typeof body?.type === "string" ? body.type : "";
    const format = typeof body?.format === "string" ? body.format : "";
    if (!/^[0-9a-f-]{36}$/i.test(researchId)) throw new Error("Invalid research identifier");
    const report = (await privateDiligenceStore.get(researchId))?.report;
    if (!report) throw new Error("Diligence report was not found");
    if (type === "report" && format === "markdown") {
      return new Response(privateDiligenceReportToMarkdown(report), {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="finbro-clara-${researchId}.md"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    const rows = type === "evidence" ? evidenceRows(report) : type === "claims" ? claimRows(report) : type === "risks" ? riskRows(report) : null;
    if (!rows || !["csv", "xlsx"].includes(format)) throw new Error("Unsupported export request");
    const filename = `finbro-clara-${type}-${researchId}.${format}`;
    if (format === "csv") {
      return new Response(csv(rows), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" },
      });
    }
    return new Response(new Uint8Array(workbook(rows, type)), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ code: "INVALID_EXPORT_REQUEST", message: "Clara could not prepare the requested export" }, { status: 400 });
  }
}
