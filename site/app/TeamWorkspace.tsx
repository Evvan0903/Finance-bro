"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

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
  },
  {
    id: "mason",
    name: "Mason",
    title: "Market & Industry Analyst",
    status: "In Development",
    intro: "Tracks the market structure, competitive landscape, and dated industry evidence behind a company’s operating environment.",
    responsibilities: [
      "Screens current industry research",
      "Maps competitors and market structure",
      "Tracks demand, pricing, and regulation",
      "Organizes catalysts and industry risks",
    ],
    deliverables: [
      "Industry outlook",
      "Competitive landscape",
      "Market driver brief",
      "Dated source pack",
    ],
    cta: "Workflow In Development",
  },
  {
    id: "clara",
    name: "Clara",
    title: "Private Company Diligence Analyst",
    status: "Planned",
    intro: "Designed for structured private-company diligence across commercial evidence, operating metrics, and document requests.",
    responsibilities: [
      "Organizes diligence requests",
      "Reviews management materials",
      "Normalizes private-company KPIs",
      "Flags evidence gaps and open questions",
    ],
    deliverables: [
      "Diligence checklist",
      "KPI normalization",
      "Open-issues log",
      "Management question set",
    ],
    cta: "Planned Workflow",
  },
  {
    id: "felix",
    name: "Felix",
    title: "Financial Modeling Analyst",
    status: "Planned",
    intro: "Designed to turn validated operating assumptions into transparent, versioned financial models and scenario outputs.",
    responsibilities: [
      "Structures operating assumptions",
      "Builds linked model schedules",
      "Runs sensitivities and scenarios",
      "Checks formulas and reconciliations",
    ],
    deliverables: [
      "Three-statement model",
      "Scenario analysis",
      "Sensitivity tables",
      "Model QA summary",
    ],
    cta: "Planned Workflow",
  },
  {
    id: "parker",
    name: "Parker",
    title: "Portfolio Monitoring Analyst",
    status: "Planned",
    intro: "Designed to monitor portfolio signals, thesis changes, filing updates, and recurring performance checkpoints.",
    responsibilities: [
      "Tracks portfolio KPIs",
      "Monitors filings and events",
      "Compares results with expectations",
      "Escalates thesis-relevant changes",
    ],
    deliverables: [
      "Monitoring dashboard",
      "Event digest",
      "Variance review",
      "Thesis-change alerts",
    ],
    cta: "Planned Workflow",
  },
  {
    id: "nora",
    name: "Nora",
    title: "Corporate Reporting Analyst",
    status: "Planned",
    intro: "Designed to assemble consistent management reporting from governed metrics, commentary, and approved source material.",
    responsibilities: [
      "Standardizes reporting packages",
      "Organizes management commentary",
      "Maintains recurring KPI definitions",
      "Checks cross-report consistency",
    ],
    deliverables: [
      "Management report",
      "Board-ready summary",
      "KPI commentary",
      "Reporting QA log",
    ],
    cta: "Planned Workflow",
  },
];

const CHARACTER_STYLE: Record<MemberId, {
  skin: string;
  hair: string;
  suit: string;
  accent: string;
}> = {
  ethan: { skin: "#d9a37d", hair: "#2b211f", suit: "#1d2d4f", accent: "#0055FF" },
  mason: { skin: "#b97956", hair: "#171717", suit: "#283650", accent: "#4f72b8" },
  clara: { skin: "#e0aa80", hair: "#5a3426", suit: "#263857", accent: "#0055FF" },
  felix: { skin: "#c78b63", hair: "#3d2a22", suit: "#192b4b", accent: "#4773c7" },
  parker: { skin: "#8f5d43", hair: "#191919", suit: "#26334a", accent: "#0055FF" },
  nora: { skin: "#e1b08d", hair: "#231d1c", suit: "#243655", accent: "#5879ba" },
};

function PixelAnalyst({ id }: { id: MemberId }) {
  const palette = CHARACTER_STYLE[id];
  const isLongHair = id === "clara" || id === "nora";
  return (
    <div
      className="workspace-pixel-analyst"
      role="img"
      aria-label={`${TEAM.find((member) => member.id === id)?.name} at an analyst desk`}
      style={{
        "--pixel-skin": palette.skin,
        "--pixel-hair": palette.hair,
        "--pixel-suit": palette.suit,
        "--pixel-accent": palette.accent,
      } as CSSProperties}
    >
      <span className="pixel-chair" />
      <span className={`pixel-person ${isLongHair ? "pixel-person-long-hair" : ""}`}>
        <i className="pixel-head"><b /><b /><em /></i>
        <i className="pixel-hair" />
        <i className="pixel-hair-side pixel-hair-side-left" />
        <i className="pixel-hair-side pixel-hair-side-right" />
        <i className="pixel-body"><b /><em /></i>
        <i className="pixel-arm pixel-arm-left" />
        <i className="pixel-arm pixel-arm-right" />
      </span>
      <span className={`pixel-accessory pixel-accessory-${id}`}>
        <i /><i /><i />
      </span>
      <span className="pixel-monitor">
        <i className={`pixel-screen pixel-screen-${id}`}>
          <b /><b /><b /><b />
        </i>
        <i className="pixel-monitor-stand" />
      </span>
      <span className="pixel-keyboard" />
      <span className="pixel-desk">
        <i /><i />
      </span>
    </div>
  );
}

export function TeamWorkspace() {
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
          <p className="workspace-eyebrow">YOUR ANALYST BENCH</p>
          <h1 id="workspace-title">Assign Ethan’s team a financial task.</h1>
          <p>
            A team of AI analysts for repeatable financial research, diligence,
            modeling, monitoring, and reporting workflows.
          </p>
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
            <h2 id="team-title">Choose a workflow owner.</h2>
          </div>
          <p>Click an analyst to review the assignment desk.</p>
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
            <div className="workspace-modal-profile">
              <div className="workspace-modal-avatar" aria-hidden="true">
                {selected.name.charAt(0)}
              </div>
              <div>
                <span>{selected.status}</span>
                <h2 id="workspace-modal-title">{selected.name}</h2>
                <p>{selected.title}</p>
              </div>
            </div>
            <p className="workspace-modal-intro" id="workspace-modal-intro">
              {selected.intro}
            </p>
            <div className="workspace-modal-columns">
              <div>
                <h3>What {selected.name} Does</h3>
                <ul>
                  {selected.responsibilities.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div>
                <h3>Deliverables</h3>
                <ul>
                  {selected.deliverables.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
            <div className="workspace-modal-footer">
              <span>
                <i data-status={selected.status} />
                Status: {selected.status}
              </span>
              {selected.id === "ethan" ? (
                <Link className="workspace-modal-cta" href="/workflows/public-company">
                  {selected.cta}
                </Link>
              ) : (
                <button className="workspace-modal-cta" type="button" disabled>
                  {selected.cta}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
