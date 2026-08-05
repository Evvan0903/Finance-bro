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
    status: "Available",
    intro: "Analyzes industry scale, growth, regional concentration, economic contribution, operating indicators, macroeconomic drivers, and policy context using official public data.",
    responsibilities: [
      "Confirms official market and industry classifications",
      "Normalizes government economic and operating data",
      "Analyzes trends, regions, drivers, and policy context",
      "Documents evidence coverage, proxies, and limitations",
    ],
    deliverables: [
      "Market and industry report",
      "Competitive landscape",
      "Industry KPI framework",
      "Source-backed market outlook",
    ],
    cta: "Open Market & Industry Analysis",
    route: "/workflows/market-industry",
  },
  {
    id: "clara",
    name: "Clara",
    title: "Private Company Diligence Analyst",
    status: "Available",
    intro: "Investigates private companies using official records, public sources, company disclosures, and cross-source verification.",
    responsibilities: [
      "Resolves private-company identities",
      "Reviews registrations and official records",
      "Researches founders, financing, relationships, contracts, and intellectual property",
      "Verifies public claims and identifies conflicts, risks, and information gaps",
    ],
    deliverables: [
      "Private company diligence report",
      "Entity identity profile",
      "Evidence and claim registers",
      "Risk matrix and information-gap list",
      "Follow-up diligence questions",
    ],
    cta: "Open Private Company Diligence",
    route: "/workflows/private-company-diligence",
    boundary: "Clara uses publicly accessible information only. She does not provide complete legal, financial, tax, cybersecurity, ownership, litigation, valuation, fraud, background-investigation, or investment conclusions.",
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
    status: "In Development",
    intro: "Explores regulatory requirements and proposes reference-backed structures for investment, licensing, localization, and supply-chain planning.",
    responsibilities: [
      "Identifies potentially applicable regulatory requirements",
      "Compares possible investment and operating structures",
      "Displays relevant statutory thresholds",
      "Generates reference-backed proposals for professional review",
    ],
    deliverables: [
      "Proposed structure comparison",
      "Applicable legal threshold summary",
      "Regulatory risk explanation",
      "Professional review question list",
      "Official source references",
    ],
    cta: "Explore Regulatory & Compliance",
    route: "/workflows/regulatory-compliance",
    boundary: "Nora is a scenario-based regulatory strategy assistant. She does not provide legal or tax advice, guarantee compliance, determine final credit eligibility, or replace qualified professionals.",
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

const STATUS_COUNTS = TEAM.reduce<Record<MemberStatus, number>>((counts, member) => {
  counts[member.status] += 1;
  return counts;
}, { Available: 0, "In Development": 0, Planned: 0 });

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
          <span><strong>{STATUS_COUNTS.Available}</strong> Available</span>
          <span><strong>{STATUS_COUNTS["In Development"]}</strong> In Development</span>
          <span><strong>{STATUS_COUNTS.Planned}</strong> Planned</span>
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
