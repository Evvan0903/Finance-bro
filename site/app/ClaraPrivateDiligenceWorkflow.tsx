"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CLARA_COPY, CLARA_PROGRESS } from "./lib/private-diligence/copy";
import { getEntityConfirmationEligibility } from "./lib/private-diligence/entity-resolution/entityMatcher";
import { REPORT_RENDERING_MODEL } from "./lib/report-rendering-model";
import type { ClaraWorkflowMode, DiligenceLocale, EntityCandidate, PrivateCompanyInput, PrivateDiligenceReport, QuickResearchPurpose, ResearchObjective } from "./lib/private-diligence/types";

const OBJECTIVES: ResearchObjective[] = [
  "General diligence", "Investor screening", "Vendor diligence",
  "Acquisition screening", "Partnership review", "Customer review",
];
const QUICK_PURPOSES: QuickResearchPurpose[] = ["Competitor", "Potential Customer", "Vendor", "Partner", "Sales Prospect", "General Research"];

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
  companyName: null, website: null, city: null, state: null, country: "United States",
  founderOrExecutive: null, industry: null, researchObjective: "General diligence",
  locale: "en", reportDepth: "Standard",
};

const QUICK_LABELS: Record<DiligenceLocale, Record<QuickResearchPurpose, string>> = {
  en: Object.fromEntries(QUICK_PURPOSES.map((purpose) => [purpose, purpose])) as Record<QuickResearchPurpose, string>,
  zh: { Competitor: "竞争对手", "Potential Customer": "潜在客户", Vendor: "供应商", Partner: "合作伙伴", "Sales Prospect": "销售线索", "General Research": "通用调查" },
};
const QUICK_PROGRESS = [
  { en: "Finding the company", zh: "正在查找公司" }, { en: "Confirming the target", zh: "正在确认目标" },
  { en: "Reviewing the company website", zh: "正在审查公司网站" }, { en: "Checking leadership and ownership signals", zh: "正在核查管理层和所有权信号" },
  { en: "Reviewing hiring activity", zh: "正在审查招聘活动" }, { en: "Finding offices and business contacts", zh: "正在查找办公室和业务联系方式" },
  { en: "Checking customers and partners", zh: "正在核查客户和合作伙伴" }, { en: "Reviewing recent business activity", zh: "正在审查近期业务动态" },
  { en: "Building the intelligence brief", zh: "正在生成企业调查简报" },
] as const;

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

const SIGNAL_ZH: Record<string, string> = {
  "Exact confirmed domain match": "已确认域名完全匹配",
  "Organization name confirmed on official website": "官方网站已识别组织名称",
  "Legal entity identified in Terms or Privacy": "条款或隐私政策中已识别法律实体",
  "Exact legal name match from official record": "官方记录中的法律名称完全匹配",
  "Location identified on official website": "官方网站已识别地点",
  "Founder or executive identified on official website": "官方网站已识别创始人或高管",
  "Official email domain matches website": "官方邮箱域名与网站匹配",
  "Industry identified on official website": "官方网站已识别行业",
  "Website organization differs from supplied company name": "网站组织名称与输入的公司名称不同",
};

const UNRESOLVED_ZH: Record<string, string> = {
  "Legal entity name": "法律实体名称",
  "Office location": "办公地点",
  Industry: "行业",
  "Founders or executives": "创始人或高管",
  "Registration jurisdiction": "注册辖区",
  "Official registration identifier": "官方注册标识符",
};

function CandidateCard({ candidate, onConfirm, locale, selected }: {
  candidate: EntityCandidate;
  onConfirm: () => void;
  locale: DiligenceLocale;
  selected: boolean;
}) {
  const copy = CLARA_COPY[locale];
  const eligibility = getEntityConfirmationEligibility(candidate, true);
  const missing = copy.notIdentified;
  const signalLabel = (signal: string) => locale === "zh" ? SIGNAL_ZH[signal] ?? signal : signal;
  const unresolvedLabel = (field: string) => locale === "zh" ? UNRESOLVED_ZH[field] ?? field : field;
  return (
    <article className="clara-candidate-card" data-selected={selected}>
      <header>
        <div><span>{copy.confidence[candidate.matchConfidence]}</span><h3>{candidate.displayName}</h3></div>
        <strong>{candidate.matchScore}/100</strong>
      </header>
      {candidate.websiteReachable && <p className="clara-candidate-provenance">{copy.companyReportedIdentity}</p>}
      <dl>
        <div><dt>{locale === "zh" ? "公司或品牌" : "Company or brand"}</dt><dd>{candidate.displayName || missing}</dd></div>
        <div><dt>{copy.legalName}</dt><dd>{candidate.legalName ?? missing}</dd></div>
        <div><dt>{locale === "zh" ? "网站" : "Website"}</dt><dd>{candidate.website ?? missing}</dd></div>
        <div><dt>{locale === "zh" ? "地点" : "Location"}</dt><dd>{[candidate.city, candidate.state, candidate.country].filter(Boolean).join(", ") || candidate.addresses[0] || missing}</dd></div>
        <div><dt>{locale === "zh" ? "行业" : "Industry"}</dt><dd>{candidate.industry ?? missing}</dd></div>
        <div><dt>{locale === "zh" ? "已知人员" : "Known people"}</dt><dd>{[...candidate.founders, ...candidate.executives].join(", ") || missing}</dd></div>
        <div><dt>{locale === "zh" ? "注册辖区" : "Registration jurisdiction"}</dt><dd>{candidate.registrationJurisdiction ?? missing}</dd></div>
        <div><dt>{locale === "zh" ? "关系类型" : "Relationship type"}</dt><dd>{locale === "zh" ? "目标运营公司" : "Target operating company"}</dd></div>
      </dl>
      <div className="clara-match-signals">
        {candidate.matchSignals.map((signal) => <span key={signal}>{signalLabel(signal)}</span>)}
      </div>
      {candidate.unresolvedIdentityFields.length > 0 && <p className="clara-unresolved"><strong>{copy.unresolved}</strong>{candidate.unresolvedIdentityFields.map(unresolvedLabel).join(" · ")}</p>}
      {candidate.matchConfidence === "Low" && candidate.websiteReachable && <p className="clara-candidate-warning">{copy.lowConfidenceWebsite}</p>}
      {eligibility.canConfirm && <button type="button" onClick={onConfirm} disabled={selected} aria-pressed={selected}>{selected ? copy.targetConfirmed : copy.confirm}</button>}
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

export function ClaraPrivateDiligenceWorkflow({ mode = "deep" }: { mode?: ClaraWorkflowMode }) {
  const [input, setInput] = useState<PrivateCompanyInput>({ ...EMPTY_INPUT, workflowMode: mode, quickResearchPurpose: "General Research" });
  const [state, setState] = useState<WorkflowState>("input");
  const [researchId, setResearchId] = useState("");
  const [candidates, setCandidates] = useState<EntityCandidate[]>([]);
  const [confirmedId, setConfirmedId] = useState("");
  const [report, setReport] = useState<PrivateDiligenceReport | null>(null);
  const [error, setError] = useState("");
  const copy = CLARA_COPY[input.locale];
  const progress = mode === "quick" ? QUICK_PROGRESS : CLARA_PROGRESS;
  const progressIndex = state === "resolving" ? 0 : state === "confirmation" ? 1 : state === "researching" ? 3 : state === "report" ? progress.length : -1;
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
      setConfirmedId(payload.autoConfirmedCandidateId ?? "");
      if (!payload.candidates?.length) { setError(payload.message ?? copy.insufficientIdentity); setState("input"); return; }
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
        <div><span>{mode === "quick" ? (input.locale === "zh" ? "快速企业调查" : "QUICK COMPANY INTELLIGENCE") : "PUBLIC-SOURCE DILIGENCE"}</span><h1>{mode === "quick" ? (input.locale === "zh" ? "快速企业调查" : "Quick Company Intelligence") : copy.heading}</h1><p>{mode === "quick" ? (input.locale === "zh" ? "快速研究竞争对手、客户、供应商、合作伙伴和销售线索的公开商业信息" : "Fast public-source research for competitors, customers, vendors, partners, and sales prospects") : copy.subheading}</p><small>{mode === "quick" ? (input.locale === "zh" ? "仅限公开业务信息 · 并非完整尽调" : "Public business information only · not complete due diligence") : copy.publicOnly}</small></div>
        <Image src="/team/clara-workstation.svg" alt="Clara at a private company diligence workstation" width={560} height={360} priority />
      </section>
      {mode === "quick" && <nav className="clara-workflow-choices" aria-label={input.locale === "zh" ? "Clara 工作流" : "Clara workflows"}>
        <Link href="/workflows/company-intelligence" data-active="true"><strong>{input.locale === "zh" ? "快速企业调查" : "Quick Company Intelligence"}</strong><span>{input.locale === "zh" ? "快速研究竞争对手、客户、供应商、合作伙伴和销售线索" : "Fast competitor, customer, vendor, partner, or prospect research"}</span></Link>
        <span aria-disabled="true"><strong>{input.locale === "zh" ? "外部信息深度尽调" : "Outside-In Due Diligence"}</strong><span>{input.locale === "zh" ? "开发中" : "In Development"}</span></span>
      </nav>}
      {state !== "report" && (
        <div className="clara-workspace">
          <aside className="clara-progress"><span>{input.locale === "zh" ? "工作流程" : "Research workflow"}</span><ol>{progress.map((item, index) => <li key={item.en} data-state={index < progressIndex ? "complete" : index === progressIndex ? "current" : "pending"}>{item[input.locale]}</li>)}</ol></aside>
          <section className="clara-panel">
            {(state === "input" || state === "resolving") && <form onSubmit={discover}>
              <header><span>01</span><h2>{input.locale === "zh" ? "确定目标公司" : "Define the target company"}</h2></header>
              <div className="clara-form-grid">
                <p className="clara-input-hint">{copy.identityInputHint}</p>
                <label><span>{copy.fields.companyName}</span><input required={!input.website} value={input.companyName ?? ""} onChange={(event) => update("companyName", event.target.value || null)} /></label>
                <label><span>{copy.fields.website}</span><input inputMode="url" required={!input.companyName} placeholder="https://example.com" value={input.website ?? ""} onChange={(event) => update("website", event.target.value || null)} /></label>
                <label><span>{copy.fields.city}</span><input value={input.city ?? ""} onChange={(event) => update("city", event.target.value || null)} /></label>
                <label><span>{copy.fields.state}</span><input value={input.state ?? ""} onChange={(event) => update("state", event.target.value || null)} /></label>
                <label><span>{copy.fields.country}</span><input value={input.country ?? ""} onChange={(event) => update("country", event.target.value || null)} /></label>
                <label><span>{copy.fields.founder}</span><input value={input.founderOrExecutive ?? ""} onChange={(event) => update("founderOrExecutive", event.target.value || null)} /></label>
                <label><span>{copy.fields.industry}</span><input value={input.industry ?? ""} onChange={(event) => update("industry", event.target.value || null)} /></label>
                <label><span>{mode === "quick" ? (input.locale === "zh" ? "研究目的" : "Research purpose") : copy.fields.objective}</span>{mode === "quick" ? <select value={input.quickResearchPurpose} onChange={(event) => update("quickResearchPurpose", event.target.value as QuickResearchPurpose)}>{QUICK_PURPOSES.map((purpose) => <option key={purpose} value={purpose}>{QUICK_LABELS[input.locale][purpose]}</option>)}</select> : <select value={input.researchObjective} onChange={(event) => update("researchObjective", event.target.value as ResearchObjective)}>{OBJECTIVES.map((objective) => <option key={objective} value={objective}>{OBJECTIVE_LABELS[input.locale][objective]}</option>)}</select>}</label>
                {mode === "deep" && <label><span>{copy.fields.depth}</span><select value={input.reportDepth} onChange={(event) => update("reportDepth", event.target.value as "Standard" | "Compact")}><option value="Standard">{input.locale === "zh" ? "标准" : "Standard"}</option><option value="Compact">{input.locale === "zh" ? "精简" : "Compact"}</option></select></label>}
              </div>
              <button className="clara-primary" disabled={state === "resolving"}>{state === "resolving" ? progress[0][input.locale] : mode === "quick" ? (input.locale === "zh" ? "查找公司" : "Find Company") : copy.assign}</button>
            </form>}
            {(state === "confirmation" || state === "researching") && <div className="clara-confirmation"><header><span>02</span><h2>{copy.confirmHeading}</h2></header>{candidates.map((candidate) => <CandidateCard key={candidate.candidateId} candidate={candidate} locale={input.locale} selected={candidate.candidateId === confirmedId} onConfirm={() => confirm(candidate)} />)}{confirmedId && <div className="clara-confirm-actions"><button type="button" onClick={reset}>{copy.edit}</button><button className="clara-primary" onClick={generate} disabled={state === "researching"}>{state === "researching" ? progress.at(-1)![input.locale] : mode === "quick" ? (input.locale === "zh" ? "生成企业调查简报" : "Build intelligence brief") : copy.generate}</button></div>}</div>}
            {error && <p className="clara-error" role="alert">{error}</p>}
            <p className="clara-disclosure">{copy.disclosure}</p>
          </section>
        </div>
      )}
      {state === "report" && report && <ClaraReport report={report} researchId={researchId} onReset={reset} />}
    </main>
  );
}
