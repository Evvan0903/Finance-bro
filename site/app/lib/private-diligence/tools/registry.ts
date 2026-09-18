import { secFundingTool } from "./secFundingTool";
import { fundingSearchTool } from "./fundingSearchTool";
import { companyIdentityTool } from "./companyIdentityTool";
import { hiringIntelligenceTool } from "./hiringIntelligenceTool";
import type { ClaraTool } from "./types";
import { webResearchTool } from "./webResearchTool";

export type RegisteredClaraTool = typeof companyIdentityTool | typeof webResearchTool | typeof hiringIntelligenceTool | typeof fundingSearchTool | typeof secFundingTool;
export type ClaraToolName = "company_identity" | "web_research" | "hiring_intelligence" | "funding_search" | "sec_funding";

export function createClaraToolRegistry(tools: RegisteredClaraTool[] = [companyIdentityTool, webResearchTool, hiringIntelligenceTool, fundingSearchTool, secFundingTool]) {
  const registry = new Map<string, RegisteredClaraTool>();
  for (const tool of tools) {
    if (!tool.name.trim() || !tool.description.trim()) throw new Error("Clara tools require a name and description");
    if (registry.has(tool.name)) throw new Error(`Duplicate Clara tool name: ${tool.name}`);
    registry.set(tool.name, tool);
  }
  return registry;
}

export const claraToolRegistry = createClaraToolRegistry();

export const claraToolDefinitions = [...claraToolRegistry.values()].map((tool) => ({
  name: tool.name as ClaraToolName,
  description: tool.description,
  inputSchema: tool.inputSchema,
}));

export function getClaraTool(name: string): ClaraTool<unknown, unknown> | null {
  return (claraToolRegistry.get(name) as ClaraTool<unknown, unknown> | undefined) ?? null;
}
