import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UI_HEADING_COPY } from "../../lib/ui-copy";

const workflowCopy = UI_HEADING_COPY.en;

const WORKFLOWS = {
  "market-industry": {
    name: "Mason",
    title: "Market & Industry Analyst",
    status: "In Development",
    image: "/team/mason-workstation.svg",
    intro: "Mason’s evidence-backed market and industry workflow is being built. The finished module will organize market definitions, value chains, competition, structural growth drivers, regulation, and recent developments.",
    outputs: [
      "Market and industry report",
      "Competitive landscape",
      "Industry KPI framework",
      "Source-backed market outlook",
    ],
  },
  "private-company": {
    name: "Clara",
    title: "Private Company Diligence Analyst",
    status: "Planned",
    image: "/team/clara-workstation.svg",
    intro: "Clara’s planned workflow will organize private-company financial, operating, and data-room diligence without implying that an unbuilt review has been completed.",
    outputs: [
      "Private company diligence report",
      "Red-flag review",
      "Document-gap checklist",
      "Management question list",
    ],
  },
  "financial-modeling": {
    name: "Felix",
    title: "Financial Modeling Analyst",
    status: "Planned",
    image: "/team/felix-workstation.svg",
    intro: "Felix’s planned workflow will turn validated historical data and visible operating assumptions into structured financial models, forecasts, and sensitivity analyses.",
    outputs: [
      "Financial model",
      "Cash-flow forecast",
      "Budget-versus-actual analysis",
      "Excel-ready workbook",
    ],
  },
  "portfolio-monitoring": {
    name: "Parker",
    title: "Portfolio Monitoring Analyst",
    status: "Planned",
    image: "/team/parker-workstation.svg",
    intro: "Parker’s planned workflow will monitor holdings, filings, earnings, catalysts, risks, and thesis changes across a portfolio or watchlist.",
    outputs: [
      "Weekly portfolio digest",
      "Event alerts",
      "Thesis-change summary",
      "Portfolio monitoring report",
    ],
  },
  "regulatory-compliance": {
    name: "Nora",
    title: "Regulatory & Compliance Analyst",
    status: "Planned",
    image: "/team/nora-workstation.svg",
    intro: "Nora’s planned workflow will review regulatory requirements, internal policies, reporting obligations, and supporting evidence for compliance-readiness analysis.",
    outputs: [
      "Regulatory gap analysis",
      "Compliance readiness report",
      "Evidence and control checklist",
      "Reporting and filing preparation package",
    ],
    boundary: "This planned workflow will support compliance analysis and readiness. It will not provide legal advice, guarantee compliance, or replace attorneys, auditors, or regulatory professionals.",
  },
} as const;

type WorkflowKey = keyof typeof WORKFLOWS;

export function generateStaticParams() {
  return Object.keys(WORKFLOWS).map((workflow) => ({ workflow }));
}

export default async function WorkflowOverviewPage({
  params,
}: {
  params: Promise<{ workflow: string }>;
}) {
  const { workflow } = await params;
  if (!(workflow in WORKFLOWS)) notFound();
  const workflowDefinition = WORKFLOWS[workflow as WorkflowKey];

  return (
    <main className="workflow-overview-shell">
      <header className="workflow-overview-header">
        <Link href="/" aria-label="Return to FinBro team workspace">
          <span>F</span>
          FINBRO
        </Link>
        <span>{workflowCopy.workflowStatus.toUpperCase()} · {workflowDefinition.status.toUpperCase()}</span>
      </header>
      <div className="workflow-overview-main">
        <section className="workflow-overview-card" aria-labelledby="workflow-overview-title">
          <div className="workflow-overview-visual">
            <Image
              src={workflowDefinition.image}
              alt={`${workflowDefinition.name} seated at a ${workflowDefinition.title.toLowerCase()} workstation`}
              width={560}
              height={360}
              priority
            />
          </div>
          <div className="workflow-overview-content">
            <span>{workflowDefinition.status}</span>
            <h1 id="workflow-overview-title">{workflowDefinition.name}</h1>
            <h2>{workflowDefinition.title}</h2>
            <p>{workflowDefinition.intro}</p>
            <ul>
              {workflowDefinition.outputs.map((output) => <li key={output}>{output}</li>)}
            </ul>
            {"boundary" in workflowDefinition && <p>{workflowDefinition.boundary}</p>}
            <div className="workflow-overview-actions">
              <p>This status page does not simulate an unfinished workflow.</p>
              <Link href="/">Return to the FinBro team</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
