import type { MarketReport } from "../types";

function formatValue(value: string | number) {
  return typeof value === "number"
    ? value.toLocaleString("en-US", { maximumFractionDigits: 4 })
    : value;
}

export function marketReportToMarkdown(report: MarketReport) {
  const metricById = new Map(report.metrics.map((metric) => [metric.metricId, metric]));
  const lines = [
    `# ${report.title}`,
    "",
    `Generated: ${report.generatedAt}`,
    `Coverage: ${report.dataCoverage.status}`,
    "",
    ...report.disclosures.map((item) => `> ${item}`),
    "",
  ];
  for (const section of report.sections) {
    lines.push(`## ${section.number} ${section.title}`, "");
    lines.push(...section.paragraphs.flatMap((paragraph) => [paragraph, ""]));
    const metrics = section.metricIds.flatMap((id) => {
      const metric = metricById.get(id);
      return metric ? [metric] : [];
    });
    if (metrics.length) {
      lines.push("| Metric | Value | Unit | Period | Geography | Evidence |", "|---|---:|---|---|---|---|");
      for (const metric of metrics) {
        lines.push(`| ${metric.displayLabel} | ${formatValue(metric.value)} | ${metric.unit} | ${metric.period} | ${metric.geography} | ${metric.evidenceIds.join(", ")} |`);
      }
      lines.push("");
    }
    if (/Data Coverage|数据覆盖/.test(section.title)) {
      for (const result of report.providerResults) {
        lines.push(`- ${result.providerName}: ${result.status}`);
      }
      lines.push("");
    }
    if (/References|参考资料/.test(section.title)) {
      for (const reference of report.references) {
        lines.push(
          `### [${reference.number}] ${reference.providerName} — ${reference.officialTitle}`,
          "",
          `- Dataset / ID: ${reference.dataset} · ${reference.seriesOrTableId}`,
          `- Geography / period: ${reference.geography} · ${reference.observationPeriod}`,
          `- Unit: ${reference.units}`,
          `- Retrieved: ${reference.retrievedAt}`,
          `- Relevance: ${reference.relevance}`,
          `- Official source: [Open source](${reference.officialSourceUrl})`,
          "",
        );
      }
    }
  }
  lines.push(
    "---",
    "",
    "Generated with FinBro · Evidence-backed public-data market research",
    "",
    "Research workflow assisted by Mason",
  );
  return lines.join("\n");
}
