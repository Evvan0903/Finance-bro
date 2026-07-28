import {
  COMPARISON_LABELS,
  CREDIT_OPTIONS,
  INDUSTRY_OPTIONS,
  NORA_COPY,
  OBJECTIVE_OPTIONS,
  PLAN_OPTIONS,
  PRODUCT_OPTIONS,
  RESULT_SECTION_TITLES,
  ROLE_OPTIONS,
} from "./copy";
import { referencedSourceNumbers } from "./engine";
import type { LocalizedOption } from "./copy";
import type { RegulatoryLocale, RegulatoryProposalReport } from "./types";

function optionLabel<T extends string>(
  options: LocalizedOption<T>[],
  id: T | null,
  locale: RegulatoryLocale,
) {
  return options.find((option) => option.id === id)?.label[locale] ?? "—";
}

function refs(report: RegulatoryProposalReport, ids: string[]) {
  return referencedSourceNumbers(report, ids).map((number) => `[${number}]`).join(", ");
}

export function regulatoryReportToMarkdown(report: RegulatoryProposalReport) {
  const locale = report.locale;
  const copy = NORA_COPY[locale];
  const section = (index: number) =>
    `## ${RESULT_SECTION_TITLES[index].number} ${RESULT_SECTION_TITLES[index][locale]}`;
  const lines: string[] = [
    `# ${copy.workflowName}`,
    "",
    `**${copy.headerName} · ${copy.headerTitle}**  `,
    `**${copy.reportLabels.generatedAt}:** ${report.generatedAt}  `,
    `**${copy.reportLabels.sourceCoverage}:** ${report.sourceCoverage.status}`,
    "",
    ...report.disclaimer.map((item) => `> ${item}`),
    "",
    section(0),
    "",
    `- **${copy.reviewLabels.industry}:** ${optionLabel(INDUSTRY_OPTIONS, report.scenario.industry, locale)}`,
    `- **${copy.reviewLabels.role}:** ${optionLabel(ROLE_OPTIONS, report.scenario.role, locale)}`,
    `- **${copy.reviewLabels.plan}:** ${optionLabel(PLAN_OPTIONS, report.scenario.plan, locale)}`,
    `- **${copy.reviewLabels.objective}:** ${optionLabel(OBJECTIVE_OPTIONS, report.scenario.objective, locale)}`,
    `- **${copy.reviewLabels.product}:** ${optionLabel(PRODUCT_OPTIONS, report.scenario.product, locale)}`,
    `- **${copy.reviewLabels.credit}:** ${optionLabel(CREDIT_OPTIONS, report.scenario.credit, locale)}`,
    `- **${copy.reviewLabels.year}:** ${report.scenario.year}`,
    "",
    section(1),
    "",
    report.scenario.credit === "not-sure"
      ? copy.informational.notSureCredit
      : optionLabel(CREDIT_OPTIONS, report.scenario.credit, locale),
    "",
    section(2),
    "",
    ...report.applicableRules.map((rule) =>
      `- **${rule.label[locale]}:** ${rule.description[locale]} ${refs(report, rule.sourceIds)}`),
    "",
    section(3),
    "",
    ...report.structures.flatMap((structure) => [
      `### ${structure.rank}. ${structure.name[locale]}`,
      "",
      structure.description[locale],
      "",
      `**${copy.reportLabels.riskLabel}:** ${structure.riskLabel[locale]}`,
      "",
      ...structure.considerations.map((item) => `- ${item[locale]}`),
      "",
    ]),
    section(4),
    "",
    copy.informational.proposedValuesNote,
    "",
  ];
  for (const structure of report.structures) {
    lines.push(
      `### ${structure.name[locale]}`,
      "",
      `| ${copy.tableLabels.parameter} | ${copy.tableLabels.proposedValue} | ${copy.tableLabels.legalTrigger} | ${copy.tableLabels.whyItMatters} | ${copy.tableLabels.referenceNumber} |`,
      "|---|---|---|---|---|",
      ...structure.parameters.map((parameter) =>
        `| ${parameter.parameter[locale]} | ${parameter.proposedValue[locale]} | ${parameter.legalTrigger[locale]} | ${parameter.whyItMatters[locale]} | ${refs(report, parameter.referenceSourceIds)} |`),
      "",
    );
  }
  lines.push(
    section(5),
    "",
    `| ${copy.tableLabels.topic} | ${copy.tableLabels.currentTrigger} | ${copy.tableLabels.relevantEvent} | ${copy.tableLabels.ruleStatus} | ${copy.tableLabels.reference} |`,
    "|---|---|---|---|---|",
    ...report.applicableRules.filter((rule) => !rule.topic.includes("macr")).map((rule) =>
      `| ${rule.label[locale]} | ${String(rule.triggerValue)}${rule.unit === "percent" ? "%" : ""} | ${rule.applicableEvent[locale]} | ${rule.ruleStatus} | ${refs(report, rule.sourceIds)} |`),
    "",
    section(6),
    "",
    report.applicableMacrRule
      ? `| ${copy.tableLabels.program} | ${copy.tableLabels.productOrProject} | ${copy.tableLabels.relevantEvent} | ${copy.tableLabels.applicableYear} | ${copy.tableLabels.percentage} | ${copy.tableLabels.reference} |\n|---|---|---|---:|---:|---|\n| ${report.applicableMacrRule.applicableCredit.join("/")} | ${report.applicableMacrRule.label[locale]} | ${report.applicableMacrRule.applicableEvent[locale]} | ${report.scenario.year} | ${report.applicableMacrRule.triggerValue}% | ${refs(report, report.applicableMacrRule.sourceIds)} |`
      : copy.informational.notSureCredit,
    "",
    copy.informational.macrDataCaveat,
    "",
    section(7),
    "",
    `| ${copy.tableLabels.dimension} | ${report.structures.map((item) => item.name[locale]).join(" | ")} |`,
    `|---|${report.structures.map(() => "---").join("|")}|`,
    ...report.comparison.map((item) =>
      `| ${item.dimension[locale]} | ${report.structures.map((structure) => COMPARISON_LABELS[locale][item.values[structure.structureId]]).join(" | ")} |`),
    "",
    section(8),
    "",
    `**${copy.reportLabels.proposedStructureForReview}**`,
    "",
    ...report.proposedDirection.map((item) => `${item}\n`),
    section(9),
    "",
    ...report.informationNeeded.map((item) => `- ${item}`),
    "",
    section(10),
    "",
    ...report.professionalQuestions.map((item) =>
      `- **${item.audience[locale]}:** ${item.question[locale]} ${refs(report, item.sourceIds)}`),
    "",
    section(11),
    "",
    copy.informational.methodology,
    "",
    copy.informational.limitations,
    "",
    section(12),
    "",
  );
  for (const reference of report.references) {
    lines.push(
      `### [${reference.number}] ${reference.source.title}`,
      "",
      `- **${copy.reportLabels.issuingAuthority}:** ${reference.source.issuingAuthority}`,
      `- **${copy.reportLabels.sourceType}:** ${reference.source.sourceType}`,
      `- **${copy.reportLabels.publicationDate}:** ${reference.source.publicationDate}`,
      `- **${copy.tableLabels.ruleStatus}:** ${reference.source.status}`,
      `- **${copy.reportLabels.relevantSections}:** ${reference.source.relevantSections.join("; ")}`,
      `- **${copy.tableLabels.lastVerified}:** ${reference.source.lastVerifiedAt}`,
      `- [${copy.buttons.openOfficialSource}](${reference.source.url})`,
      "",
      reference.source.summary[locale],
      "",
    );
  }
  lines.push("---", "", copy.footer, "", copy.footerSecondary);
  return lines.join("\n");
}

