"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClaraQuickReportVisuals } from "./ClaraQuickReportVisuals";
import { ClaraFundingResearch } from "./ClaraFundingResearch";
import { ClaraHiringIntelligence } from "./ClaraHiringIntelligence";
import { CLARA_COPY, CLARA_PROGRESS } from "./lib/private-diligence/copy";
import { buildConfirmationPayload, initialSelectedCandidateId, selectCandidateId } from "./lib/private-diligence/entity-resolution/candidateSelection";
import { getEntityConfirmationEligibility } from "./lib/private-diligence/entity-resolution/entityMatcher";
import { quickReportDisclosure, quickReportParagraphs } from "./lib/private-diligence/reports/quickReportPresentation";
import { REPORT_RENDERING_MODEL } from "./lib/report-rendering-model";
import type { ClaraWorkflowMode, DiligenceLocale, EntityCandidate, PrivateCompanyInput, PrivateDiligenceReport, ResearchObjective } from "./lib/private-diligence/types";

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
  companyName: null, website: null, city: null, state: null, country: null,
  founderOrExecutive: null, industry: null, researchObjective: "General diligence",
  locale: "en", reportDepth: "Standard",
};

const QUICK_PROGRESS = [
  { en: "Finding the company", zh: "正在查找公司" }, { en: "Confirming the target", zh: "正在确认目标" },
  { en: "Reviewing the company website", zh: "正在审查公司网站" }, { en: "Checking leadership and ownership signals", zh: "正在核查管理层和所有权信号" },
  { en: "Reviewing hiring activity", zh: "正在审查招聘活动" }, { en: "Finding offices and business contacts", zh: "正在查找办公室和业务联系方式" },
  { en: "Checking customers and partners", zh: "正在核查客户和合作伙伴" }, { en: "Reviewing recent business activity", zh: "正在审查近期业务动态" },
  { en: "Building the intelligence brief", zh: "正在生成企业调查简报" },
] as const;

type WorkflowState = "input" | "resolving" | "confirmation" | "targetSelected" | "researching" | "report" | "needsMoreInformation" | "error";

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
  "Company name supplied by user as discovery lead": "用户提供的公司名称研究线索",
  "Public website discovered for supplied company name": "已根据公司名称发现公开网站",
  "Public entity and official website identified by Wikidata": "Wikidata 已识别公开实体及官方网站",
};

const UNRESOLVED_ZH: Record<string, string> = {
  "Legal entity name": "法律实体名称",
  "Office location": "办公地点",
  Industry: "行业",
  "Founders or executives": "创始人或高管",
  "Registration jurisdiction": "注册辖区",
  "Official registration identifier": "官方注册标识符",
};

function CandidateCard({ candidate, onSelect, locale, selected }: {
  candidate: EntityCandidate;
  onSelect: () => void;
  locale: DiligenceLocale;
  selected: boolean;
}) {
  const copy = CLARA_COPY[locale];
  const eligibility = getEntityConfirmationEligibility(candidate, true);
  const signalLabel = (signal: string) => locale === "zh" ? SIGNAL_ZH[signal] ?? signal : signal;
  const unresolvedLabel = (field: string) => locale === "zh" ? UNRESOLVED_ZH[field] ?? field : field;
  const relationshipLabel = candidate.relationshipType === "Unknown relationship" && locale === "zh"
    ? "关系尚未确认" : candidate.relationshipType ?? (locale === "zh" ? "目标运营公司" : "Target operating company");
  return (
    <article className="clara-candidate-card" data-selected={selected}>
      <header>
        <div><span>{copy.confidence[candidate.matchConfidence]}</span><h3>{candidate.displayName}</h3></div>
        <strong>{candidate.matchScore}/100</strong>
      </header>
      {candidate.websiteReachable && <p className="clara-candidate-provenance">{copy.companyReportedIdentity}</p>}
      <dl>
        {candidate.legalName && <div><dt>{copy.legalName}</dt><dd>{candidate.legalName}</dd></div>}
        {candidate.website && <div><dt>{locale === "zh" ? "网站" : "Website"}</dt><dd><a href={candidate.website} target="_blank" rel="noreferrer">{candidate.domain ?? candidate.website}</a></dd></div>}
        {candidate.description && <div><dt>{copy.businessDescription}</dt><dd>{candidate.description}</dd></div>}
        {([candidate.city, candidate.state, candidate.country].filter(Boolean).join(", ") || candidate.addresses[0]) && <div><dt>{locale === "zh" ? "地点" : "Location"}</dt><dd>{[candidate.city, candidate.state, candidate.country].filter(Boolean).join(", ") || candidate.addresses[0]}</dd></div>}
        {candidate.industry && <div><dt>{locale === "zh" ? "行业" : "Industry"}</dt><dd>{candidate.industry}</dd></div>}
        <div><dt>{locale === "zh" ? "关系类型" : "Relationship type"}</dt><dd>{relationshipLabel}</dd></div>
        {candidate.identitySourceUrl && candidate.identitySourceUrl !== candidate.website && <div><dt>{copy.identitySource}</dt><dd><a href={candidate.identitySourceUrl} target="_blank" rel="noreferrer">{candidate.identitySourceUrl}</a></dd></div>}
      </dl>
      <div className="clara-match-signals">
        {candidate.matchSignals.map((signal) => <span key={signal}>{signalLabel(signal)}</span>)}
      </div>
      {candidate.unresolvedIdentityFields.length > 0 && <p className="clara-unresolved"><strong>{copy.unresolved}</strong>{candidate.unresolvedIdentityFields.map(unresolvedLabel).join(" · ")}</p>}
      {candidate.matchConfidence === "Low" && <p className="clara-candidate-warning">{copy.lowConfidenceWebsite}</p>}
      {eligibility.canConfirm && <button type="button" onClick={onSelect} disabled={selected} aria-pressed={selected}>{selected ? copy.selectedTarget : copy.selectTarget}</button>}
    </article>
  );
}

function ClaraReport({ report, researchId, onReset, locale }: {
  report: PrivateDiligenceReport;
  researchId: string;
  onReset: () => void;
  locale: DiligenceLocale;
}) {
  const copy = CLARA_COPY[locale];
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const localizedQuickSections = useMemo(() => new Map(
    quickReportParagraphs(report, locale).map((section) => [section.sectionId, section]),
  ), [report, locale]);
  const coverageLabel = locale === "zh"
    ? ({
        "Strong public-source coverage": "公开来源覆盖较强",
        "Moderate public-source coverage": "公开来源覆盖中等",
        "Limited public-source coverage": "公开来源覆盖有限",
        "Insufficient entity resolution": "实体识别信息不足",
      } as const)[report.coverageStatus]
    : report.coverageStatus;
  const identityLabel = locale === "zh"
    ? ({ High: "高", Medium: "中", Low: "低" } as const)[report.entity.identityConfidence]
    : report.entity.identityConfidence;

  async function exportServer(type: "report" | "evidence" | "claims" | "risks", format: "markdown" | "csv" | "xlsx") {
    const response = await fetch("/api/private-diligence/export", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ researchId, type, format, locale }),
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
        filename: `finbro-clara-${report.entity.canonicalName}-${report.generatedAt.slice(0, 10)}-${locale}.pdf`,
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
      <div className="clara-report" ref={reportRef} data-rendering-model={REPORT_RENDERING_MODEL.pdf} data-report-locale={locale}>
        <header className="clara-report-cover" data-pdf-block>
          <span>FINBRO · CLARA</span>
          <h1>{report.entity.canonicalName}</h1>
          <h2>{report.reportVersion === "clara-quick-v1"
            ? locale === "zh" ? "快速企业调查简报" : "Quick Company Intelligence Brief"
            : locale === "zh" ? "公开来源私营公司尽调" : "Public-Source Private Company Due Diligence"}</h2>
          <dl>
            <div><dt>{locale === "zh" ? "研究日期" : "Research date"}</dt><dd>{report.generatedAt.slice(0, 10)}</dd></div>
            <div><dt>{locale === "zh" ? "身份置信度" : "Identity confidence"}</dt><dd>{identityLabel}</dd></div>
            <div><dt>{locale === "zh" ? "证据覆盖" : "Evidence coverage"}</dt><dd>{coverageLabel}</dd></div>
            <div><dt>{locale === "zh" ? "报告版本" : "Report version"}</dt><dd>{report.reportVersion}</dd></div>
          </dl>
          <p>{report.reportVersion === "clara-quick-v1" ? quickReportDisclosure(report, locale) : report.disclosure}</p>
        </header>
        {report.reportVersion === "clara-quick-v1" && <ClaraQuickReportVisuals report={report} locale={locale} />}
        {report.reportVersion !== "clara-quick-v1" && <ClaraHiringIntelligence report={report} locale={locale} />}
        <ClaraFundingResearch report={report} locale={locale} />
        {report.sections.filter((section) => section.sectionId !== "funding").map((section) => (
          <section className="clara-report-section" key={section.sectionId} data-pdf-block>
            <header><span>{section.number}</span><h2>{section.title[locale]}</h2></header>
            {(report.reportVersion === "clara-quick-v1" ? localizedQuickSections.get(section.sectionId)?.paragraphs ?? section.paragraphs : section.paragraphs).map((paragraph, index) => <p key={`${section.sectionId}-${index}`}>{paragraph}</p>)}
            {report.adaptiveResearch && section.claimIds?.some(id=>report.claims.find(c=>c.claimId===id)?.researchFact) && <ul className="clara-reference-list">{section.claimIds.flatMap(id=>{
              const fact=report.claims.find(c=>c.claimId===id)?.researchFact;
              return fact ? [<li key={id}><a href={fact.sourceUrl} target="_blank" rel="noreferrer">{locale === "zh" ? "原始证据" : "Original evidence"}</a><span>{fact.excerpt}</span></li>] : [];
            })}</ul>}
            {section.sectionId === "17" && (
              <div className="clara-table-wrap"><table><thead><tr><th>{locale === "zh" ? "优先级" : "Priority"}</th><th>{locale === "zh" ? "缺失信息" : "Missing information"}</th><th>{locale === "zh" ? "建议证据" : "Recommended evidence"}</th></tr></thead><tbody>{report.informationGaps.map((gap) => <tr key={gap.gapId}><td>{gap.priority}</td><td>{gap.missingInformation}</td><td>{gap.recommendedEvidence.join("; ")}</td></tr>)}</tbody></table></div>
            )}
            {section.sectionId === "18" && (
              <div className="clara-question-list">{report.questions.map((question) => <article key={question.questionId}><span>{question.priority}</span><h3>{question.question}</h3><p>{question.reason}</p><small>{question.recommendedEvidence.join("; ")}</small></article>)}</div>
            )}
            {section.sectionId === "20" && (
              <ol className="clara-reference-list">{report.references.map((reference) => <li key={reference.evidenceId}><a href={reference.sourceUrl} target="_blank" rel="noreferrer">{reference.sourceTitle}</a><span>Tier {reference.sourceTier} · {reference.publicationDate ?? reference.retrievedAt.slice(0, 10)}</span></li>)}</ol>
            )}
          </section>
        ))}
        {report.reportVersion === "clara-quick-v1" && <section className="clara-report-section clara-source-register" data-pdf-block>
          <header><span>SRC</span><h2>{locale === "zh" ? "证据与来源" : "Evidence and Sources"}</h2></header>
          {report.references.length ? <ol className="clara-reference-list">{report.references.map((reference) => {
            const evidence = report.evidence.find((item) => item.evidenceId === reference.evidenceId);
            const status = evidence?.officialRecord
              ? (locale === "zh" ? "已验证" : "Verified")
              : evidence?.companyReported
                ? (locale === "zh" ? "公司自行披露" : "Management Reported")
                : evidence?.independentlyPublished
                  ? (locale === "zh" ? "部分验证" : "Partially Verified")
                  : (locale === "zh" ? "未验证" : "Unverified");
            return <li key={reference.evidenceId}><a href={reference.sourceUrl} target="_blank" rel="noreferrer">{reference.sourceTitle}</a><span>{status} · {locale === "zh" ? "来源层级" : "Tier"} {reference.sourceTier} · {reference.publicationDate ?? reference.retrievedAt.slice(0, 10)}</span></li>;
          })}</ol> : <p>{locale === "zh" ? "未识别可展示的公开来源" : "No displayable public sources were identified"}</p>}
        </section>}
      </div>
    </div>
  );
}

export function ClaraPrivateDiligenceWorkflow({ mode = "deep" }: { mode?: ClaraWorkflowMode }) {
  const [input, setInput] = useState<PrivateCompanyInput>({ ...EMPTY_INPUT, workflowMode: mode, quickResearchPurpose: "General Research" });
  const [state, setState] = useState<WorkflowState>("input");
  const [researchId, setResearchId] = useState("");
  const [candidates, setCandidates] = useState<EntityCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState("");
  const [report, setReport] = useState<PrivateDiligenceReport | null>(null);
  const [error, setError] = useState("");
  const copy = CLARA_COPY[input.locale];
  const progress = mode === "quick" ? QUICK_PROGRESS : CLARA_PROGRESS;
  const progressIndex = state === "resolving" || state === "needsMoreInformation" ? 0 : state === "confirmation" ? 1 : state === "targetSelected" ? 2 : state === "researching" ? 3 : state === "report" ? progress.length : -1;
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
      const discoveredCandidates: EntityCandidate[] = payload.candidates ?? [];
      const initialSelection = initialSelectedCandidateId(discoveredCandidates);
      setResearchId(payload.researchRequestId);
      setCandidates(discoveredCandidates);
      setSelectedCandidateId(initialSelection);
      setConfirmedId(payload.autoConfirmedCandidateId ?? "");
      if (process.env.NODE_ENV !== "production") console.info(JSON.stringify({ event: "clara_candidate_selection_state", researchRequestId: payload.researchRequestId, candidatesLength: discoveredCandidates.length, candidateId: discoveredCandidates[0]?.candidateId ?? null, candidateResearchRequestId: discoveredCandidates[0]?.researchRequestId ?? null, selectedCandidateId: initialSelection }));
      if (!discoveredCandidates.length) { setError(copy.discoveryNoMatch); setState("needsMoreInformation"); return; }
      setState("confirmation");
    } catch (problem) { setError(problem instanceof Error ? problem.message : copy.insufficientIdentity); setState("error"); }
  }

  function selectCandidate(candidateId: string) {
    const selection = selectCandidateId(candidates, candidateId);
    setSelectedCandidateId(selection);
    if (selection !== confirmedId) setConfirmedId("");
  }

  async function confirmSelected() {
    const confirmationPayload = buildConfirmationPayload(researchId, selectedCandidateId);
    if (!confirmationPayload) return;
    setError("");
    try {
      if (process.env.NODE_ENV !== "production") console.info(JSON.stringify({ event: "clara_confirmation_request", researchRequestId: confirmationPayload.researchRequestId, candidateId: confirmationPayload.candidateId, selectedCandidateId, explicitUserConfirmation: true }));
      await jsonRequest("/api/private-diligence/confirm-entity", confirmationPayload);
      setConfirmedId(confirmationPayload.candidateId);
      setState("targetSelected");
      if (mode === "quick") await runResearch();
    } catch (problem) { setError(problem instanceof Error ? problem.message : copy.insufficientIdentity); }
  }

  async function runResearch(activeResearchId = researchId) {
    setState("researching"); setError("");
    try {
      await jsonRequest("/api/private-diligence/plan", { researchId: activeResearchId });
      const payload = await jsonRequest("/api/private-diligence/run", { researchId: activeResearchId });
      setReport(payload.report); setState("report");
    } catch (problem) { setError(problem instanceof Error ? problem.message : copy.insufficientEvidence); setState("confirmation"); }
  }

  async function generate() {
    if (!confirmedId) return;
    await runResearch();
  }

  function reset() {
    setInput({ ...EMPTY_INPUT, locale: input.locale, workflowMode: mode, quickResearchPurpose: "General Research" });
    setState("input"); setResearchId(""); setCandidates([]); setSelectedCandidateId(null); setConfirmedId(""); setReport(null); setError("");
  }

  function requestDifferentCompany() {
    setInput((current) => ({ ...current, website: null }));
    setCandidates([]); setSelectedCandidateId(null); setConfirmedId(""); setError("");
    setState("needsMoreInformation");
  }

  const activeTarget = candidates.find((candidate) => candidate.candidateId === confirmedId) ?? null;

  return (
    <main className="clara-shell">
      <header className="clara-header"><Link href="/" aria-label={copy.back}><span>F</span> FINBRO</Link><div><strong>CLARA</strong><span>{copy.role}</span></div><button type="button" data-testid="clara-locale-toggle" onClick={() => update("locale", input.locale === "en" ? "zh" : "en")}>{input.locale === "en" ? "中文" : "EN"}</button></header>
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
            {(state === "input" || state === "resolving" || state === "needsMoreInformation" || state === "error") && <form onSubmit={discover}>
              <header><span>01</span><h2>{input.locale === "zh" ? "确定目标公司" : "Define the target company"}</h2></header>
              <div className="clara-form-grid" data-quick-minimal={mode === "quick"}>
                <p className="clara-input-hint">{mode === "quick" ? copy.quickInputHint : copy.identityInputHint}</p>
                <label><span>{copy.fields.companyName}</span><input required={!input.website} value={input.companyName ?? ""} onChange={(event) => update("companyName", event.target.value || null)} /></label>
                <label><span>{copy.fields.website}</span><input inputMode="url" required={!input.companyName} placeholder="https://example.com" value={input.website ?? ""} onChange={(event) => update("website", event.target.value || null)} /></label>
                {mode === "quick" && state === "needsMoreInformation" && <div className="clara-narrow-fields"><h3>{copy.narrowHeading}</h3><label><span>{copy.fields.location}</span><input value={input.city ?? ""} onChange={(event) => update("city", event.target.value || null)} /></label><label><span>{copy.fields.founder}</span><input value={input.founderOrExecutive ?? ""} onChange={(event) => update("founderOrExecutive", event.target.value || null)} /></label></div>}
                {mode === "deep" && <>
                  <label><span>{copy.fields.city}</span><input value={input.city ?? ""} onChange={(event) => update("city", event.target.value || null)} /></label>
                  <label><span>{copy.fields.state}</span><input value={input.state ?? ""} onChange={(event) => update("state", event.target.value || null)} /></label>
                  <label><span>{copy.fields.country}</span><input value={input.country ?? ""} onChange={(event) => update("country", event.target.value || null)} /></label>
                  <label><span>{copy.fields.founder}</span><input value={input.founderOrExecutive ?? ""} onChange={(event) => update("founderOrExecutive", event.target.value || null)} /></label>
                  <label><span>{copy.fields.industry}</span><input value={input.industry ?? ""} onChange={(event) => update("industry", event.target.value || null)} /></label>
                  <label><span>{copy.fields.objective}</span><select value={input.researchObjective} onChange={(event) => update("researchObjective", event.target.value as ResearchObjective)}>{OBJECTIVES.map((objective) => <option key={objective} value={objective}>{OBJECTIVE_LABELS[input.locale][objective]}</option>)}</select></label>
                </>}
                {mode === "deep" && <label><span>{copy.fields.depth}</span><select value={input.reportDepth} onChange={(event) => update("reportDepth", event.target.value as "Standard" | "Compact")}><option value="Standard">{input.locale === "zh" ? "标准" : "Standard"}</option><option value="Compact">{input.locale === "zh" ? "精简" : "Compact"}</option></select></label>}
              </div>
              <button className="clara-primary" disabled={state === "resolving"}>{state === "resolving" ? progress[0][input.locale] : mode === "quick" ? (input.locale === "zh" ? "查找公司" : "Find Company") : copy.assign}</button>
            </form>}
            {(state === "confirmation" || state === "targetSelected" || state === "researching") && <div className="clara-confirmation"><header><span>02</span><h2>{copy.confirmHeading}</h2></header>{activeTarget && <div className="clara-active-target"><span>{copy.activeTarget}</span><strong>{activeTarget.displayName}</strong><small>{activeTarget.domain}</small></div>}{candidates.map((candidate) => <CandidateCard key={candidate.candidateId} candidate={candidate} locale={input.locale} selected={candidate.candidateId === selectedCandidateId} onSelect={() => selectCandidate(candidate.candidateId)} />)}<div className="clara-confirm-actions"><button type="button" onClick={requestDifferentCompany}>{copy.notMyCompany}</button><small>{copy.provideWebsite}</small>{confirmedId && mode === "deep" ? <button className="clara-primary" onClick={generate} disabled={state === "researching"}>{state === "researching" ? progress.at(-1)![input.locale] : copy.generate}</button> : <button className="clara-primary" onClick={confirmSelected} disabled={!selectedCandidateId || state === "researching"}>{copy.confirm}</button>}</div></div>}
            {error && <p className="clara-error" role="alert">{error}</p>}
            <p className="clara-disclosure">{copy.disclosure}</p>
          </section>
        </div>
      )}
      {state === "report" && report && <ClaraReport report={report} researchId={researchId} onReset={reset} locale={report.reportVersion === "clara-quick-v1" ? input.locale : report.locale} />}
    </main>
  );
}
