import type { ClaraWorkflowMode, DiligenceLocale, PrivateCompanyInput, QuickResearchPurpose, ReportDepth, ResearchObjective } from "./types";

const OBJECTIVES = new Set<ResearchObjective>([
  "General diligence", "Investor screening", "Vendor diligence",
  "Acquisition screening", "Partnership review", "Customer review",
]);
const QUICK_PURPOSES = new Set<QuickResearchPurpose>(["Competitor", "Potential Customer", "Vendor", "Partner", "Sales Prospect", "General Research"]);

function optionalText(value: unknown, maximum = 160) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Optional company identifiers must be text");
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > maximum) throw new Error("An input value is outside the supported length");
  return normalized;
}

export function parsePrivateCompanyInput(value: unknown): PrivateCompanyInput {
  if (!value || typeof value !== "object") throw new Error("Company input is required");
  const input = value as Record<string, unknown>;
  const companyName = optionalText(input.companyName, 180);
  const website = optionalText(input.website, 300);
  if (website) {
    let url: URL;
    try { url = new URL(website.includes("://") ? website : `https://${website}`); }
    catch { throw new Error("Company website must be a valid URL"); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error("Company website must be a public HTTP or HTTPS URL without credentials");
    }
  }
  if ((!companyName || companyName.length < 2) && !website) {
    throw new Error("A company name or company website is required");
  }
  if (companyName && companyName.length < 2) throw new Error("Company name is too short");
  const researchObjective = OBJECTIVES.has(input.researchObjective as ResearchObjective)
    ? input.researchObjective as ResearchObjective
    : "General diligence";
  const locale: DiligenceLocale = input.locale === "zh" ? "zh" : "en";
  const reportDepth: ReportDepth = input.reportDepth === "Compact" ? "Compact" : "Standard";
  const workflowMode: ClaraWorkflowMode = input.workflowMode === "deep" ? "deep" : "quick";
  const quickResearchPurpose = QUICK_PURPOSES.has(input.quickResearchPurpose as QuickResearchPurpose)
    ? input.quickResearchPurpose as QuickResearchPurpose : "General Research";
  return {
    companyName,
    website,
    city: optionalText(input.city),
    state: optionalText(input.state),
    country: optionalText(input.country),
    founderOrExecutive: optionalText(input.founderOrExecutive),
    industry: optionalText(input.industry),
    researchObjective,
    locale,
    reportDepth,
    workflowMode,
    quickResearchPurpose,
  };
}
