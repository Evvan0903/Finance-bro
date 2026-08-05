import type { PrivateDiligenceReport } from "../types";

export function privateDiligenceReportToMarkdown(report: PrivateDiligenceReport) {
  const locale = report.locale;
  const lines = [
    `# ${report.entity.canonicalName} — ${locale === "zh" ? "公开来源私营公司尽调" : "Public-Source Private Company Due Diligence"}`,
    "",
    `**${locale === "zh" ? "研究日期" : "Research date"}:** ${report.generatedAt}`,
    `**${locale === "zh" ? "证据覆盖" : "Evidence coverage"}:** ${report.coverageStatus}`,
    "",
    `> ${report.disclosure}`,
    "",
  ];
  for (const section of report.sections) {
    lines.push(`## ${section.number} ${section.title[locale]}`, "");
    for (const paragraph of section.paragraphs) lines.push(paragraph, "");
  }
  return `${lines.join("\n").trim()}\n`;
}
