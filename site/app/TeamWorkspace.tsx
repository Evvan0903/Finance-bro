"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { UI_HEADING_COPY } from "./lib/ui-copy";

type MemberId = "ethan" | "mason" | "clara" | "felix" | "parker" | "nora";
type MemberStatus = "Available" | "In Development" | "Planned";

type TeamMember = {
  id: MemberId;
  name: string;
  title: string;
  status: MemberStatus;
  intro: string;
  responsibilities: string[];
  deliverables: string[];
  cta: string;
  route: string;
  boundary?: string;
};

const TEAM: TeamMember[] = [
  {
    id: "ethan",
    name: "Ethan",
    title: "Public Company Research Analyst",
    status: "Available",
    intro: "Specializes in evidence-backed public company analysis using filings, financial metrics, and sector-specific workflows.",
    responsibilities: [
      "Reviews annual and quarterly filings",
      "Extracts and validates financial metrics",
      "Builds public company research reports",
      "Highlights risks, catalysts, and data coverage",
    ],
    deliverables: [
      "Company research report",
      "KPI summary",
      "Risk review",
      "PDF / Markdown output",
    ],
    cta: "Open Public Company Research",
    route: "/workflows/public-company",
  },
  {
    id: "mason",
    name: "Mason",
    title: "Market & Industry Analyst",
    status: "In Development",
    intro: "Analyzes markets, industries, competitive landscapes, value chains, and structural growth drivers using evidence-backed research.",
    responsibilities: [
      "Defines markets and industry boundaries",
      "Analyzes market structure and value chains",
      "Identifies competitors, trends, and growth drivers",
      "Reviews regulation, risks, and recent developments",
    ],
    deliverables: [
      "Market and industry report",
      "Competitive landscape",
      "Industry KPI framework",
      "Source-backed market outlook",
    ],
    cta: "Explore Market & Industry Analysis",
    route: "/workflows/market-industry",
  },
  {
    id: "clara",
    name: "Clara",
    title: "Private Company Diligence Analyst",
    status: "Planned",
    intro: "Reviews private-company financial, operating, and data-room materials to identify business quality, financial risks, and diligence gaps.",
    responsibilities: [
      "Reviews financial statements and data-room documents",
      "Analyzes revenue quality and customer concentration",
      "Identifies accounting, liquidity, and operating risks",
      "Builds management questions and missing-document lists",
    ],
    deliverables: [
      "Private company diligence report",
      "Red-flag review",
      "Document-gap checklist",
      "Management question list",
    ],
    cta: "View Private Company Diligence",
    route: "/workflows/private-company",
  },
  {
    id: "felix",
    name: "Felix",
    title: "Financial Modeling Analyst",
    status: "Planned",
    intro: "Transforms historical financial data and operating assumptions into structured models, forecasts, budgets, and scenario analyses.",
    responsibilities: [
      "Normalizes historical financial statements",
      "Builds revenue and expense forecasts",
      "Creates cash-flow and financial models",
      "Runs scenarios and sensitivity analyses",
    ],
    deliverables: [
      "Financial model",
      "Cash-flow forecast",
      "Budget-versus-actual analysis",
      "Excel-ready workbook",
    ],
    cta: "View Financial Modeling",
    route: "/workflows/financial-modeling",
  },
  {
    id: "parker",
    name: "Parker",
    title: "Portfolio Monitoring Analyst",
    status: "Planned",
    intro: "Tracks holdings, filings, earnings, catalysts, risks, and investment-thesis changes across a portfolio or watchlist.",
    responsibilities: [
      "Monitors filings and earnings updates",
      "Tracks catalysts and risk events",
      "Compares new evidence with the investment thesis",
      "Prepares scheduled portfolio summaries",
    ],
    deliverables: [
      "Weekly portfolio digest",
      "Event alerts",
      "Thesis-change summary",
      "Portfolio monitoring report",
    ],
    cta: "View Portfolio Monitoring",
    route: "/workflows/portfolio-monitoring",
  },
  {
    id: "nora",
    name: "Nora",
    title: "Regulatory & Compliance Analyst",
    status: "Planned",
    intro: "Reviews regulatory requirements, internal policies, reporting obligations, and supporting evidence to identify compliance and disclosure gaps.",
    responsibilities: [
      "Reviews regulatory and reporting requirements",
      "Compares company documents with compliance checklists",
      "Identifies missing policies, controls, and evidence",
      "Prepares remediation and filing-readiness materials",
    ],
    deliverables: [
      "Regulatory gap analysis",
      "Compliance readiness report",
      "Evidence and control checklist",
      "Reporting and filing preparation package",
    ],
    cta: "View Regulatory & Compliance",
    route: "/workflows/regulatory-compliance",
    boundary: "Nora supports compliance analysis and readiness. She does not provide legal advice, guarantee compliance, or replace attorneys, auditors, or regulatory professionals.",
  },
];

const WORKSTATION_ASSETS: Record<MemberId, string> = {
  ethan: "/team/ethan-workstation.svg",
  mason: "/team/mason-workstation.svg",
  clara: "/team/clara-workstation.svg",
  felix: "/team/felix-workstation.svg",
  parker: "/team/parker-workstation.svg",
  nora: "/team/nora-workstation.svg",
};

const workspaceCopy = UI_HEADING_COPY.en;

function PixelAnalyst({ id }: { id: MemberId }) {
  const member = TEAM.find((candidate) => candidate.id === id)!;
  return (
    <Image
      className="workspace-pixel-analyst"
      src={WORKSTATION_ASSETS[id]}
      alt={`${member.name} seated at a ${member.title.toLowerCase()} workstation`}
      width={560}
      height={360}
      priority={id === "ethan"}
    />
  );
}

export function TeamWorkspace() {
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!selected) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [selected]);

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <Link className="workspace-brand" href="/" aria-label="FinBro workspace home">
          <span className="workspace-brand-mark">F</span>
          <span>FINBRO</span>
        </Link>
        <span className="workspace-header-note">AI ANALYST TEAM · WORKSPACE 01</span>
      </header>

      <section className="workspace-hero" aria-labelledby="workspace-title">
        <div className="workspace-hero-copy">
          <p className="workspace-eyebrow">FINBRO</p>
          <h1 id="workspace-title">{workspaceCopy.homeHeroTitle}</h1>
          <p>{workspaceCopy.homeHeroSubheading}</p>
          <p>{workspaceCopy.homeHeroScope}</p>
        </div>
        <div className="workspace-summary" aria-label="Workflow availability">
          <span><strong>1</strong> Available</span>
          <span><strong>1</strong> In Development</span>
          <span><strong>4</strong> Planned</span>
        </div>
      </section>

      <section className="workspace-team" aria-labelledby="team-title">
        <div className="workspace-section-heading">
          <div>
            <span>THE TEAM</span>
            <h2 id="team-title">{workspaceCopy.teamSectionTitle}</h2>
          </div>
          <p>{workspaceCopy.teamInstruction}</p>
        </div>

        <div className="workspace-team-grid">
          {TEAM.map((member) => (
            <button
              className={`workspace-member-card workspace-member-${member.id}`}
              type="button"
              key={member.id}
              onClick={() => setSelected(member)}
              aria-haspopup="dialog"
              aria-label={`Open ${member.name}, ${member.title}`}
            >
              <div className="workspace-character-stage">
                <PixelAnalyst id={member.id} />
              </div>
              <div className="workspace-member-meta">
                <div>
                  <strong>{member.name}</strong>
                  <span>{member.title}</span>
                </div>
                <small data-status={member.status}>{member.status}</small>
              </div>
              <span className="workspace-profile-hint" aria-hidden="true">{workspaceCopy.profileHint}</span>
            </button>
          ))}
        </div>
      </section>

      <footer className="workspace-footer">
        <span>FINBRO</span>
        <p>Assign the work. Review the evidence. Keep the judgment.</p>
      </footer>

      {selected && (
        <div
          className="workspace-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section
            className="workspace-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-modal-title"
            aria-describedby="workspace-modal-intro"
            ref={dialogRef}
          >
            <button
              className="workspace-modal-close"
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close analyst profile"
              ref={closeButtonRef}
            >
              ×
            </button>
            <div className="workspace-modal-layout">
              <div className="workspace-modal-profile">
                <span>{selected.status}</span>
                <h2 id="workspace-modal-title">{selected.name}</h2>
                <h3>{selected.title}</h3>
                <p className="workspace-modal-intro" id="workspace-modal-intro">
                  {selected.intro}
                </p>
                <div className="workspace-modal-details">
                  <div>
                    <h3>What {selected.name} Does</h3>
                    <ul>
                      {selected.responsibilities.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h3>{workspaceCopy.modalDeliverables}</h3>
                    <ul>
                      {selected.deliverables.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                </div>
                <div className="workspace-modal-status">
                  <span>
                    <i data-status={selected.status} />
                    {workspaceCopy.modalStatus}
                  </span>
                  <strong>{selected.status}</strong>
                </div>
                {selected.boundary && <p className="workspace-modal-boundary">{selected.boundary}</p>}
                <Link className="workspace-modal-cta" href={selected.route}>
                  {selected.cta}
                </Link>
              </div>
              <div className="workspace-modal-visual">
                <div className="workspace-modal-workstation">
                  <PixelAnalyst id={selected.id} />
                </div>
                <p>{selected.name} · FinBro workflow owner</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
