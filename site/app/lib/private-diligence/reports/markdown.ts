import type { DiligenceLocale, PrivateDiligenceReport } from "../types";

export function privateDiligenceReportToMarkdown(report: PrivateDiligenceReport, requestedLocale?: DiligenceLocale) {
  const locale = requestedLocale ?? report.locale;
  const quick = report.reportVersion === "clara-quick-v1";
  const title = quick
    ? locale === "zh" ? "快速企业调查简报" : "Quick Company Intelligence Brief"
    : locale === "zh" ? "公开来源私营公司尽调" : "Public-Source Private Company Due Diligence";
  const coverage = locale === "zh"
    ? ({
        "Strong public-source coverage": "公开来源覆盖较强",
        "Moderate public-source coverage": "公开来源覆盖中等",
        "Limited public-source coverage": "公开来源覆盖有限",
        "Insufficient entity resolution": "实体识别信息不足",
      } as const)[report.coverageStatus]
    : report.coverageStatus;
  const lines = [
    `# ${report.entity.canonicalName} — ${title}`,
    "",
    `**${locale === "zh" ? "研究日期" : "Research date"}:** ${report.generatedAt}`,
    `**${locale === "zh" ? "证据覆盖" : "Evidence coverage"}:** ${coverage}`,
    "",
    `> ${quick ? report.disclosureByLocale?.[locale] ?? report.disclosure : report.disclosure}`,
    "",
  ];
  for (const section of report.sections) {
    lines.push(`## ${section.number} ${section.title[locale]}`, "");
    const paragraphs = quick ? section.paragraphsByLocale?.[locale] ?? section.paragraphs : section.paragraphs;
    for (const paragraph of paragraphs) lines.push(paragraph, "");
  }
  return `${lines.join("\n").trim()}\n`;
}
