export type ReportAgentId = "ethan" | "mason" | "clara" | "felix" | "parker" | "nora";

export const AGENT_REPORT_FOOTERS: Record<ReportAgentId, string> = {
  ethan: "FinBro Equity Research",
  mason: "FinBro Market & Industry Research",
  clara: "FinBro Private Company Diligence",
  felix: "FinBro Financial Modeling",
  parker: "FinBro Portfolio Monitoring",
  nora: "FinBro Regulatory Research",
};

export function reportFooterForAgent(agentId: ReportAgentId = "ethan") {
  return AGENT_REPORT_FOOTERS[agentId];
}

