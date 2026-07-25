export type UiLocale = "zh" | "en";

export const TERMINAL_HEADING_PUNCTUATION = /[。.]\s*$/u;

export const UI_HEADING_COPY = {
  zh: {
    metadataTitle: "FinBro | 你那位加班过度的初级分析师",
    homeHeroTitle: "让 Ethan 的团队处理一项财务任务",
    homeHeroSubheading: "一个帮助你完成可重复财务工作的 AI 分析师团队",
    homeHeroScope: "研究、尽调、建模、监控、合规和财务分析，全部由一个团队完成",
    teamSectionTitle: "选择工作流负责人",
    teamInstruction: "点击分析师查看工作台",
    profileHint: "查看资料 →",
    modalDeliverables: "交付成果",
    modalStatus: "状态",
    researchHeroTitle: "把股票代码交给 Ethan",
    researchHeroSubheading: "他会读申报、学习行业、核对数字，并准备一份你可以向上汇报的材料",
    loadingTitle: "Ethan 正在翻阅申报文件",
    genericErrorTitle: "Ethan 暂时无法完成这项任务",
    workflowStatus: "工作流状态",
  },
  en: {
    metadataTitle: "FinBro | Your overworked entry-level analyst",
    homeHeroTitle: "Assign Ethan’s team a financial task",
    homeHeroSubheading: "An AI analyst team that helps you complete repeatable financial work",
    homeHeroScope: "Research, diligence, modeling, monitoring, compliance, and financial analysis — all in one team",
    teamSectionTitle: "Choose a workflow owner",
    teamInstruction: "Click an analyst to review the assignment desk",
    profileHint: "View profile →",
    modalDeliverables: "Deliverables",
    modalStatus: "Status",
    researchHeroTitle: "Give Ethan a ticker",
    researchHeroSubheading: "He’ll read the filings, learn the sector, check the numbers, and prepare something you can send upstairs",
    loadingTitle: "Ethan is working through the filings",
    genericErrorTitle: "Ethan could not complete that assignment",
    workflowStatus: "Workflow status",
  },
} as const;

export function findTerminalHeadingPunctuation(
  copy: Record<string, string>,
): string[] {
  return Object.entries(copy)
    .filter(([, value]) => TERMINAL_HEADING_PUNCTUATION.test(value))
    .map(([key]) => key);
}
