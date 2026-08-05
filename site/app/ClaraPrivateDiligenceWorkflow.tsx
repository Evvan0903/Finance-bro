"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CLARA_COPY, CLARA_PROGRESS } from "./lib/private-diligence/copy";
import { REPORT_RENDERING_MODEL } from "./lib/report-rendering-model";
import type { DiligenceLocale, EntityCandidate, PrivateCompanyInput, PrivateDiligenceReport, ResearchObjective } from "./lib/private-diligence/types";

const OBJECTIVES: ResearchObjective[] = [
  "General diligence", "Investor screening", "Vendor diligence",
  "Acquisition screening", "Partnership review", "Customer review",
];

const OBJECTIVE_LABELS: Record<DiligenceLocale, Record<ResearchObjective, string>> = {
  en: Object.fromEntries(OBJECTIVES.map((objective) => [objective, objective])) as Record<ResearchObjective, string>,
  zh: {
    "General diligence": "一般尽调",
    "Investor screening": "投资者筛选",
    "Vendor diligence": "供应商尽调",
    "Acquisition screening": "收购筛选",
    "Partnership review": "合作伙伴审查",
    "Customer review": "客户审查",
  },
};

const EMPTY_INPUT: PrivateCompanyInput = {
  companyName: "", website: null, city: null, state: null, country: "United States",
  founderOrExecutive: null, industry: null, researchObjective: "General diligence",
  locale: "en", reportDepth: "Standard",
};

type WorkflowState = "input" | "resolving" | "confirmation" | "researching" | "report";

async function jsonRequest(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.message ?? "Clara could not complete the request");
  return payload;
}

function downloadResponse(response: Response, fallback: string) {
  if (!response.ok) throw new Error("Download failed");
  return response.blob().then((blob) => {
    const disposition = response.headers.get("content-disposition") ?? "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? fallback;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  });
}

function CandidateCard({ candidate, onConfirm, locale }: {
  candidate: EntityCandidate;
  onConfirm: () => void;
  locale: DiligenceLocale;
}) {
  return (
    <article className="clara-candidate-card">
      <header>
        <div><span>{candidate.matchConfidence}</span><h3>{candidate.legalName ?? candidate.displayName}</h3></div>
        <strong>{candidate.matchScore}/100</strong>
      </header>
      <dl>
        <div><dt>{locale === "zh" ? "网站" : "Website"}</dt><dd>{candidate.website ?? "—"}</dd></div>
        <div><dt>{locale === "zh" ? "地点" : "Location"}</dt><dd>{[candidate.city, candidate.state, candidate.country].filter(Boolean).join(", ") || "—"}</dd></div>
        <div><dt>{locale === "zh" ? "行业" : "Industry"}</dt><dd>{candidate.industry ?? "—"}</dd></div>
        <div><dt>{locale === "zh" ? "已知人员" : "Known people"}</dt><dd>{[...candidate.founders, ...candidate.executives].join(", ") || "—"}</dd></div>
        <div><dt>{locale === "zh" ? "注册辖区" : "Registration jurisdiction"}</dt><dd>{candidate.registrationJurisdiction ?? "—"}</dd></div>
      </dl>
      <div className="clara-match-signals">
        {candidate.matchSignals.map((signal) => <span key={signal}>{signal}</span>)}
      </div>
      <button type="button" onClick={onConfirm}>{CLARA_COPY[locale].confirm}</button>
    </article>
  );
}

function ClaraReport({ report, researchId, onReset }: {
  report: PrivateDiligenceReport;
  researchId: string;
  onReset: () => void;
}) {
  const copy = CLARA_COPY[report.locale];
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  async function exportServer(type: "report" | "evidence" | "claims" | "risks", format: "markdown" | "csv" | "xlsx") {
    const response = await fetch("/api/private-diligence/export", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ researchId, type, format }),
    });
    await downloadResponse(response, `finbro-clara-${type}.${format === "markdown" ? "md" : format}`);
  }

  async function exportPdf() {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      const { exportReportPdf } = await import("./lib/pdf-export");
      await exportReportPdf(reportRef.current, {
        ticker: "CLARA", agentId: "clara", subject: report.entity.canonicalName,
        researchDate: report.generatedAt.slice(0, 10),
        filename: `finbro-clara-${report.entity.canonicalName}-${report.generatedAt.slice(0, 10)}.pdf`,
      });
    } finally { setExporting(false); }
  }

  return (
    <div className="clara-results">
      <div className="clara-report-actions" data-visual-download-control>
        <button type="button" onClick={onReset}>{copy.edit}</button>
        <button type="button" onClick={() => exportServer("report", "markdown")}>{copy.downloadMarkdown}</button>
        <button type="button" onClick={exportPdf} disabled={exporting}>{exporting ? copy.downloadingPdf : copy.downloadPdf}</button>
        <button type="button" onClick={() => exportServer("evidence", "csv")}>{copy.evidenceCsv}</button>
        <button type="button" onClick={() => exportServer("evidence", "xlsx")}>{copy.evidenceXlsx}</button>
        <button type="button" onClick={() => exportServer("claims", "csv")}>{copy.claimsCsv}</button>
        <button type="button" onClick={() => exportServer("claims", "xlsx")}>{copy.claimsXlsx}</button>
        <button type="button" onClick={() => exportServer("risks", "csv")}>{copy.riskCsv}</button>
      </div>
      <div className="clara-report" ref={reportRef} data-rendering-model={REPORT_RENDERING_MODEL.pdf}>
        <header className="clara-report-cover" data-pdf-block>
          <span>FINBRO · CLARA</span>
          <h1>{report.entity.canonicalName}</h1>
          <h2>{report.locale === "zh" ? "公开来源私营公司尽调" : "Public-Source Private Company Due Diligence"}</h2>
          <dl>
            <div><dt>{report.locale === "zh" ? "研究日期" : "Research date"}</dt><dd>{report.generatedAt.slice(0, 10)}</dd></div>
            <div><dt>{report.locale === "zh" ? "身份置信度" : "Identity confidence"}</dt><dd>{report.entity.identityConfidence}</dd></div>
            <div><dt>{report.locale === "zh" ? "证据覆盖" : "Evidence coverage"}</dt><dd>{report.coverageStatus}</dd></div>
            <div><dt>{report.locale === "zh" ? "报告版本" : "Report version"}</dt><dd>{report.reportVersion}</dd></div>
          </dl>
          <p>{report.disclosure}</p>
        </header>
        {report.sections.map((section) => (
          <section className="clara-report-section" key={section.sectionId} data-pdf-block>
            <header><span>{section.number}</span><h2>{section.title[report.locale]}</h2></header>
            {section.paragraphs.map((paragraph, index) => <p key={`${section.sectionId}-${index}`}>{paragraph}</p>)}
            {section.sectionId === "17" && (
              <div className="clara-table-wrap"><table><thead><tr><th>{report.locale === "zh" ? "优先级" : "Priority"}</th><th>{report.locale === "zh" ? "缺失信息" : "Missing information"}</th><th>{report.locale === "zh" ? "建议证据" : "Recommended evidence"}</th></tr></thead><tbody>{report.informationGaps.map((gap) => <tr key={gap.gapId}><td>{gap.priority}</td><td>{gap.missingInformation}</td><td>{gap.recommendedEvidence.join("; ")}</td></tr>)}</tbody></table></div>
            )}
            {section.sectionId === "18" && (
              <div className="clara-question-list">{report.questions.map((question) => <article key={question.questionId}><span>{question.priority}</span><h3>{question.question}</h3><p>{question.reason}</p><small>{question.recommendedEvidence.join("; ")}</small></article>)}</div>
            )}
            {section.sectionId === "20" && (
              <ol className="clara-reference-list">{report.references.map((reference) => <li key={reference.evidenceId}><a href={reference.sourceUrl} target="_blank" rel="noreferrer">{reference.sourceTitle}</a><span>Tier {reference.sourceTier} · {reference.publicationDate ?? reference.retrievedAt.slice(0, 10)}</span></li>)}</ol>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

export function ClaraPrivateDiligenceWorkflow() {
  const [input, setInput] = useState<PrivateCompanyInput>(EMPTY_INPUT);
  const [state, setState] = useState<WorkflowState>("input");
  const [researchId, setResearchId] = useState("");
  const [candidates, setCandidates] = useState<EntityCandidate[]>([]);
  const [confirmedId, setConfirmedId] = useState("");
  const [report, setReport] = useState<PrivateDiligenceReport | null>(null);
  const [error, setError] = useState("");
  const copy = CLARA_COPY[input.locale];
  const progressIndex = state === "resolving" ? 0 : state === "confirmation" ? 1 : state === "researching" ? 3 : state === "report" ? CLARA_PROGRESS.length : -1;
  const normalizedInput = useMemo(() => Object.fromEntries(Object.entries(input).map(([key, value]) => [key, typeof value === "string" && !value.trim() ? null : value])), [input]);

  useEffect(() => {
    document.documentElement.lang = input.locale === "zh" ? "zh-CN" : "en";
  }, [input.locale]);

  function update<K extends keyof PrivateCompanyInput>(key: K, value: PrivateCompanyInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  async function discover(event: React.FormEvent) {
    event.preventDefault(); setError(""); setState("resolving");
    try {
      const payload = await jsonRequest("/api/private-diligence/candidates", { input: normalizedInput });
      setResearchId(payload.researchId);
      setCandidates(payload.candidates ?? []);
      if (!payload.candidates?.length) { setError(copy.insufficientIdentity); setState("input"); return; }
      setState("confirmation");
    } catch (problem) { setError(problem instanceof Error ? problem.message : copy.insufficientIdentity); setState("input"); }
  }

  async function confirm(candidate: EntityCandidate) {
    setError("");
    try {
      await jsonRequest("/api/private-diligence/confirm-entity", { researchId, candidateId: candidate.candidateId });
      setConfirmedId(candidate.candidateId);
    } catch (problem) { setError(problem instanceof Error ? problem.message : copy.insufficientIdentity); }
  }

  async function generate() {
    if (!confirmedId) return;
    setState("researching"); setError("");
    try {
      await jsonRequest("/api/private-diligence/plan", { researchId });
      const payload = await jsonRequest("/api/private-diligence/run", { researchId });
      setReport(payload.report); setState("report");
    } catch (problem) { setError(problem instanceof Error ? problem.message : copy.insufficientEvidence); setState("confirmation"); }
  }

  function reset() { setState("input"); setResearchId(""); setCandidates([]); setConfirmedId(""); setReport(null); setError(""); }

  return (
    <main className="clara-shell">
      <header className="clara-header"><Link href="/" aria-label={copy.back}><span>F</span> FINBRO</Link><div><strong>CLARA</strong><span>{copy.role}</span></div><button type="button" onClick={() => update("locale", input.locale === "en" ? "zh" : "en")}>{input.locale === "en" ? "中文" : "EN"}</button></header>
      <section className="clara-hero">
        <div><span>PUBLIC-SOURCE DILIGENCE</span><h1>{copy.heading}</h1><p>{copy.subheading}</p><small>{copy.publicOnly}</small></div>
        <Image src="/team/clara-workstation.svg" alt="Clara at a private company diligence workstation" width={560} height={360} priority />
      </section>
      {state !== "report" && (
        <div className="clara-workspace">
          <aside className="clara-progress"><span>{input.locale === "zh" ? "工作流程" : "Research workflow"}</span><ol>{CLARA_PROGRESS.map((item, index) => <li key={item.en} data-state={index < progressIndex ? "complete" : index === progressIndex ? "current" : "pending"}>{item[input.locale]}</li>)}</ol></aside>
          <section className="clara-panel">
            {(state === "input" || state === "resolving") && <form onSubmit={discover}>
              <header><span>01</span><h2>{input.locale === "zh" ? "确定目标公司" : "Define the target company"}</h2></header>
              <div className="clara-form-grid">
                <label><span>{copy.fields.companyName}</span><input required value={input.companyName} onChange={(event) => update("companyName", event.target.value)} /></label>
                <label><span>{copy.fields.website}</span><input type="url" placeholder="https://" value={input.website ?? ""} onChange={(event) => update("website", event.target.value || null)} /></label>
                <label><span>{copy.fields.city}</span><input value={input.city ?? ""} onChange={(event) => update("city", event.target.value || null)} /></label>
                <label><span>{copy.fields.state}</span><input value={input.state ?? ""} onChange={(event) => update("state", event.target.value || null)} /></label>
                <label><span>{copy.fields.country}</span><input value={input.country ?? ""} onChange={(event) => update("country", event.target.value || null)} /></label>
                <label><span>{copy.fields.founder}</span><input value={input.founderOrExecutive ?? ""} onChange={(event) => update("founderOrExecutive", event.target.value || null)} /></label>
                <label><span>{copy.fields.industry}</span><input value={input.industry ?? ""} onChange={(event) => update("industry", event.target.value || null)} /></label>
                <label><span>{copy.fields.objective}</span><select value={input.researchObjective} onChange={(event) => update("researchObjective", event.target.value as ResearchObjective)}>{OBJECTIVES.map((objective) => <option key={objective} value={objective}>{OBJECTIVE_LABELS[input.locale][objective]}</option>)}</select></label>
                <label><span>{copy.fields.depth}</span><select value={input.reportDepth} onChange={(event) => update("reportDepth", event.target.value as "Standard" | "Compact")}><option value="Standard">{input.locale === "zh" ? "标准" : "Standard"}</option><option value="Compact">{input.locale === "zh" ? "精简" : "Compact"}</option></select></label>
              </div>
              <button className="clara-primary" disabled={state === "resolving"}>{state === "resolving" ? CLARA_PROGRESS[0][input.locale] : copy.assign}</button>
            </form>}
            {(state === "confirmation" || state === "researching") && <div className="clara-confirmation"><header><span>02</span><h2>{copy.confirmHeading}</h2></header>{candidates.map((candidate) => <CandidateCard key={candidate.candidateId} candidate={candidate} locale={input.locale} onConfirm={() => confirm(candidate)} />)}{confirmedId && <button className="clara-primary" onClick={generate} disabled={state === "researching"}>{state === "researching" ? CLARA_PROGRESS[14][input.locale] : copy.generate}</button>}</div>}
            {error && <p className="clara-error" role="alert">{error}</p>}
            <p className="clara-disclosure">{copy.disclosure}</p>
          </section>
        </div>
      )}
      {state === "report" && report && <ClaraReport report={report} researchId={researchId} onReset={reset} />}
    </main>
  );
}
