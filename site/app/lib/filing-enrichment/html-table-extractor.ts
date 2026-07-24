export type FilingTableCandidate = {
  label: string;
  valueText: string;
  tableCaption: string;
  status: "candidate-only";
};

export function locateHtmlTableCandidates(
  html: string,
  aliases: string[],
): FilingTableCandidate[] {
  const normalizedAliases = aliases.map((alias) => alias.toLowerCase());
  const candidates: FilingTableCandidate[] = [];
  for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const tableText = table[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const label = normalizedAliases.find((alias) => tableText.toLowerCase().includes(alias));
    if (!label) continue;
    const valueText = tableText.match(/(?:[$€£]\s*)?\(?-?[\d,.]+\)?/)?.[0];
    if (!valueText) continue;
    candidates.push({
      label,
      valueText,
      tableCaption: tableText.slice(0, 160),
      status: "candidate-only",
    });
  }
  return candidates;
}
