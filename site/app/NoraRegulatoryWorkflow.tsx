"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ANSWER_OPTIONS,
  COMPARISON_LABELS,
  CREDIT_OPTIONS,
  INDUSTRY_OPTIONS,
  NORA_COPY,
  OBJECTIVE_OPTIONS,
  PLAN_OPTIONS,
  PRODUCT_OPTIONS,
  RESULT_SECTION_TITLES,
  ROLE_OPTIONS,
  SCENARIO_QUESTION_COPY,
  TARGET_YEAR_OPTIONS,
  type LocalizedOption,
} from "./lib/regulatory/copy";
import {
  generateRegulatoryProposal,
  referencedSourceNumbers,
} from "./lib/regulatory/engine";
import { regulatoryReportToMarkdown } from "./lib/regulatory/markdown";
import { dynamicScenarioQuestions, identifiedUncertaintyIds, requiredStepIsComplete } from "./lib/regulatory/scenario";
import { emptyRegulatoryScenario, validateRegulatoryScenario } from "./lib/regulatory/schema";
import type {
  CreditId,
  IndustryId,
  ObjectiveId,
  PlanId,
  ProductId,
  RegulatoryLocale,
  RegulatoryProposalReport,
  RegulatoryScenario,
  RoleId,
  ScenarioAnswerValue,
  ScenarioQuestionId,
} from "./lib/regulatory/types";

const STEP_KEYS = [
  "industry", "role", "plan", "objective", "product", "credit",
  "year", "questions", "review", "generate",
] as const;

function labelFor<T extends string>(
  options: LocalizedOption<T>[],
  id: T | null,
  locale: RegulatoryLocale,
) {
  return options.find((option) => option.id === id)?.label[locale] ?? "—";
}

function citations(report: RegulatoryProposalReport, sourceIds: string[]) {
  const numbers = referencedSourceNumbers(report, sourceIds);
  return numbers.length ? `[${numbers.join(", ")}]` : "";
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function OptionGrid<T extends string>({
  options,
  value,
  locale,
  onSelect,
}: {
  options: LocalizedOption<T>[];
  value: T | null;
  locale: RegulatoryLocale;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="nora-option-grid">
      {options.map((option) => {
        const planned = option.status === "Planned";
        return (
          <button
            type="button"
            className="nora-option"
            data-selected={value === option.id}
            data-planned={planned}
            key={option.id}
            onClick={() => onSelect(option.id)}
            aria-pressed={value === option.id}
          >
            <span>{option.label[locale]}</span>
            {option.status && (
              <small>{planned ? NORA_COPY[locale].status.planned : NORA_COPY[locale].status.supported}</small>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ReportSection({
  index,
  locale,
  children,
}: {
  index: number;
  locale: RegulatoryLocale;
  children: React.ReactNode;
}) {
  const title = RESULT_SECTION_TITLES[index];
  return (
    <section className="nora-report-section" data-pdf-block>
      <header>
        <span>{title.number}</span>
        <h2>{title[locale]}</h2>
      </header>
      {children}
    </section>
  );
}

function ScenarioSummary({
  scenario,
  locale,
}: {
  scenario: RegulatoryScenario;
  locale: RegulatoryLocale;
}) {
  const copy = NORA_COPY[locale];
  const rows = [
    [copy.reviewLabels.industry, labelFor(INDUSTRY_OPTIONS, scenario.industry, locale)],
    [copy.reviewLabels.role, labelFor(ROLE_OPTIONS, scenario.role, locale)],
    [copy.reviewLabels.plan, labelFor(PLAN_OPTIONS, scenario.plan, locale)],
    [copy.reviewLabels.objective, labelFor(OBJECTIVE_OPTIONS, scenario.objective, locale)],
    [copy.reviewLabels.product, labelFor(PRODUCT_OPTIONS, scenario.product, locale)],
    [copy.reviewLabels.credit, labelFor(CREDIT_OPTIONS, scenario.credit, locale)],
    [copy.reviewLabels.year, String(scenario.year ?? "—")],
  ];
  return (
    <>
      <dl className="nora-summary-grid">
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="nora-answer-summary">
        <h3>{copy.reviewLabels.responses}</h3>
        {scenario.answers.map((answer) => (
          <p key={answer.questionId}>
            <span>{SCENARIO_QUESTION_COPY[answer.questionId][locale]}</span>
            <strong>{labelFor(ANSWER_OPTIONS, answer.value, locale)}</strong>
          </p>
        ))}
      </div>
    </>
  );
}

function NoraReport({
  report,
  onEdit,
}: {
  report: RegulatoryProposalReport;
  onEdit: () => void;
}) {
  const { locale, scenario } = report;
  const copy = NORA_COPY[locale];
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const entityRules = report.applicableRules.filter((rule) => !rule.topic.includes("macr"));

  async function exportPdf() {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      const { exportReportPdf } = await import("./lib/pdf-export");
      await exportReportPdf(reportRef.current, {
        ticker: "NORA",
        agentId: "nora",
        subject: copy.workflowName,
        researchDate: report.generatedAt,
        filename: `finbro-nora-pfe-${report.generatedAt}-${locale}.pdf`,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="nora-results">
      <div className="nora-report-actions" aria-label="Report actions">
        <button type="button" onClick={onEdit}>{copy.buttons.editScenario}</button>
        <button type="button" onClick={() =>
          downloadText(
            `finbro-nora-pfe-${report.generatedAt}-${locale}.md`,
            regulatoryReportToMarkdown(report),
            "text/markdown;charset=utf-8",
          )
        }>{copy.buttons.downloadMarkdown}</button>
        <button type="button" onClick={exportPdf} disabled={exporting}>
          {exporting ? copy.buttons.downloadingPdf : copy.buttons.downloadPdf}
        </button>
        <button type="button" onClick={() => window.print()}>{copy.buttons.print}</button>
      </div>

      <div
        className="nora-report"
        ref={reportRef}
        data-rendering-model="shared-research-report-dom-v1"
      >
        <header className="nora-report-cover" data-pdf-block>
          <span>FINBRO · NORA</span>
          <h1>{copy.workflowName}</h1>
          <p>{copy.reportLabels.proposedStructureForReview}</p>
          <dl>
            <div><dt>{copy.reportLabels.generatedAt}</dt><dd>{report.generatedAt}</dd></div>
            <div><dt>{copy.reportLabels.sourceCoverage}</dt><dd>{report.sourceCoverage.status}</dd></div>
          </dl>
          <div className="nora-disclaimer">
            {report.disclaimer.map((line) => <p key={line}>{line}</p>)}
          </div>
        </header>

        <ReportSection index={0} locale={locale}>
          <ScenarioSummary scenario={scenario} locale={locale} />
          {report.uncertainties.length > 0 && (
            <div className="nora-callout">
              <h3>{copy.reviewLabels.uncertainties}</h3>
              <ul>{report.uncertainties.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
        </ReportSection>

        <ReportSection index={1} locale={locale}>
          <p>{copy.reportLabels.potentialPrograms}</p>
          <div className="nora-program-grid">
            {(["45X", "45Y", "48E"] as CreditId[]).map((credit) => (
              <article key={credit} data-active={scenario.credit === credit || scenario.credit === "not-sure" || scenario.credit === "downstream"}>
                <strong>Section {credit}</strong>
                <span>{labelFor(CREDIT_OPTIONS, credit, locale)}</span>
              </article>
            ))}
          </div>
          {(scenario.credit === "not-sure" || scenario.credit === "downstream") && <p>{copy.informational.notSureCredit}</p>}
        </ReportSection>

        <ReportSection index={2} locale={locale}>
          <div className="nora-issue-grid">
            {report.applicableRules.map((rule) => (
              <article key={rule.ruleId}>
                <span>{rule.ruleStatus}</span>
                <h3>{rule.label[locale]}</h3>
                <p>{rule.description[locale]} <b>{citations(report, rule.sourceIds)}</b></p>
                <small>{rule.caveats[locale]}</small>
              </article>
            ))}
          </div>
          {scenario.plan === "license-technology" && (
            <div className="nora-warning">
              <strong>{copy.status.highReviewPriority}</strong>
              <p>{copy.informational.licensingWarning}</p>
            </div>
          )}
        </ReportSection>

        <ReportSection index={3} locale={locale}>
          <div className="nora-structure-grid">
            {report.structures.map((structure) => (
              <article key={structure.structureId}>
                <span>0{structure.rank}</span>
                <h3>{structure.name[locale]}</h3>
                <p>{structure.description[locale]}</p>
                <strong>{structure.riskLabel[locale]}</strong>
                <ul>{structure.considerations.map((item) => <li key={item.en}>{item[locale]}</li>)}</ul>
              </article>
            ))}
          </div>
        </ReportSection>

        <ReportSection index={4} locale={locale}>
          <p className="nora-table-note">{copy.informational.proposedValuesNote}</p>
          {report.structures.map((structure) => (
            <div className="nora-table-group" key={structure.structureId}>
              <h3>{structure.name[locale]}</h3>
              <div className="nora-table-wrap">
                <table>
                  <thead><tr>
                    <th>{copy.tableLabels.parameter}</th>
                    <th>{copy.tableLabels.proposedValue}</th>
                    <th>{copy.tableLabels.legalTrigger}</th>
                    <th>{copy.tableLabels.whyItMatters}</th>
                    <th>{copy.tableLabels.referenceNumber}</th>
                  </tr></thead>
                  <tbody>{structure.parameters.map((parameter) => (
                    <tr key={parameter.parameter.en}>
                      <td>{parameter.parameter[locale]}</td>
                      <td><strong>{parameter.proposedValue[locale]}</strong></td>
                      <td>{parameter.legalTrigger[locale]}</td>
                      <td>{parameter.whyItMatters[locale]}</td>
                      <td>{citations(report, parameter.referenceSourceIds)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          ))}
        </ReportSection>

        <ReportSection index={5} locale={locale}>
          <p className="nora-table-note">{copy.informational.screeningFiguresNote}</p>
          <div className="nora-table-wrap">
            <table>
              <thead><tr>
                <th>{copy.tableLabels.topic}</th>
                <th>{copy.tableLabels.currentTrigger}</th>
                <th>{copy.tableLabels.relevantEvent}</th>
                <th>{copy.tableLabels.applicableYear}</th>
                <th>{copy.tableLabels.ruleStatus}</th>
                <th>{copy.tableLabels.reference}</th>
              </tr></thead>
              <tbody>{entityRules.map((rule) => (
                <tr key={rule.ruleId}>
                  <td>{rule.label[locale]}</td>
                  <td><strong>{String(rule.triggerValue)}{rule.unit === "percent" ? "%" : ""}</strong></td>
                  <td>{rule.applicableEvent[locale]}</td>
                  <td>{String(rule.applicableYear)}</td>
                  <td>{rule.ruleStatus}</td>
                  <td>{citations(report, rule.sourceIds)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </ReportSection>

        <ReportSection index={6} locale={locale}>
          {report.applicableMacrRule ? (
            <>
              <div className="nora-table-wrap">
                <table>
                  <thead><tr>
                    <th>{copy.tableLabels.program}</th>
                    <th>{copy.tableLabels.productOrProject}</th>
                    <th>{copy.tableLabels.relevantEvent}</th>
                    <th>{copy.tableLabels.applicableYear}</th>
                    <th>{copy.tableLabels.percentage}</th>
                    <th>{copy.tableLabels.ruleStatus}</th>
                    <th>{copy.tableLabels.lastVerified}</th>
                    <th>{copy.tableLabels.reference}</th>
                  </tr></thead>
                  <tbody><tr>
                    <td>{report.applicableMacrRule.applicableCredit.join("/")}</td>
                    <td>{report.applicableMacrRule.label[locale]}</td>
                    <td>{report.applicableMacrRule.applicableEvent[locale]}</td>
                    <td>{scenario.year}</td>
                    <td><strong>{report.applicableMacrRule.triggerValue}%</strong></td>
                    <td>{report.applicableMacrRule.ruleStatus}</td>
                    <td>{report.applicableMacrRule.lastVerifiedAt}</td>
                    <td>{citations(report, report.applicableMacrRule.sourceIds)}</td>
                  </tr></tbody>
                </table>
              </div>
              {scenario.product === "applicable-critical-mineral" && <p>{copy.informational.mineralThresholdCaveat}</p>}
            </>
          ) : <p>{copy.informational.notSureCredit}</p>}
          <div className="nora-formulas">
            <article>
              <h3>{copy.reportLabels.formula} · Eligible Component MACR</h3>
              <code>(total direct material costs − PFE-attributable direct material costs) ÷ total direct material costs</code>
            </article>
            <article>
              <h3>{copy.reportLabels.formula} · Clean Electricity MACR</h3>
              <code>(total manufactured-product costs − PFE-attributable manufactured-product costs) ÷ total manufactured-product costs</code>
            </article>
          </div>
          <p>{copy.informational.macrDataCaveat}</p>
        </ReportSection>

        <ReportSection index={7} locale={locale}>
          <div className="nora-table-wrap">
            <table>
              <thead><tr>
                <th>{copy.tableLabels.dimension}</th>
                {report.structures.map((structure) => <th key={structure.structureId}>{structure.name[locale]}</th>)}
              </tr></thead>
              <tbody>{report.comparison.map((row) => (
                <tr key={row.dimension.en}>
                  <td>{row.dimension[locale]}</td>
                  {report.structures.map((structure) => (
                    <td key={structure.structureId}>{COMPARISON_LABELS[locale][row.values[structure.structureId]]}</td>
                  ))}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </ReportSection>

        <ReportSection index={8} locale={locale}>
          <span className="nora-proposal-label">{copy.reportLabels.proposedStructureForReview}</span>
          {report.proposedDirection.map((paragraph) => <p key={paragraph}>{paragraph} <b>{citations(report, ["PL119-21", "NOTICE-2026-15"])}</b></p>)}
          <strong>{copy.reportLabels.actualDetermination}</strong>
        </ReportSection>

        <ReportSection index={9} locale={locale}>
          <ul className="nora-check-list">{report.informationNeeded.map((item) => <li key={item}>{item}</li>)}</ul>
        </ReportSection>

        <ReportSection index={10} locale={locale}>
          <div className="nora-question-list">
            {report.professionalQuestions.map((item) => (
              <article key={item.question.en}>
                <strong>{item.audience[locale]}</strong>
                <p>{item.question[locale]} <b>{citations(report, item.sourceIds)}</b></p>
              </article>
            ))}
          </div>
        </ReportSection>

        <ReportSection index={11} locale={locale}>
          <p>{copy.informational.methodology}</p>
          <p>{copy.informational.limitations}</p>
          <p>{copy.informational.freshness}</p>
          <div className="nora-coverage">
            <h3>{copy.reportLabels.sourceCoverage}</h3>
            <dl>
              <div><dt>{copy.reportLabels.rulesLastVerified}</dt><dd>{report.sourceCoverage.rulesLastVerified}</dd></div>
              <div><dt>{copy.reportLabels.officialSourcesReviewed}</dt><dd>{report.sourceCoverage.officialSourcesReviewed}</dd></div>
              <div><dt>{copy.reportLabels.interimGuidance}</dt><dd>{report.sourceCoverage.interimOrProposedGuidance.join("; ")}</dd></div>
              <div><dt>{copy.reportLabels.supersedingGuidance}</dt><dd>{report.sourceCoverage.potentiallySupersedingGuidance.join("; ") || (locale === "zh" ? "在已审阅的官方来源中未发现" : "None identified in reviewed official sources")}</dd></div>
              <div><dt>{copy.reportLabels.sourceGaps}</dt><dd>{report.sourceCoverage.unresolvedGaps.join("; ")}</dd></div>
            </dl>
          </div>
        </ReportSection>

        <ReportSection index={12} locale={locale}>
          <div className="nora-reference-list">
            {report.references.map((reference) => (
              <article key={reference.source.sourceId}>
                <span>[{reference.number}]</span>
                <h3>{reference.source.title}</h3>
                <dl>
                  <div><dt>{copy.reportLabels.issuingAuthority}</dt><dd>{reference.source.issuingAuthority}</dd></div>
                  <div><dt>{copy.reportLabels.sourceType}</dt><dd>{reference.source.sourceType}</dd></div>
                  <div><dt>{copy.reportLabels.publicationDate}</dt><dd>{reference.source.publicationDate}</dd></div>
                  <div><dt>{copy.reportLabels.effectiveDate}</dt><dd>{reference.source.effectiveDate ?? "—"}</dd></div>
                  <div><dt>{copy.tableLabels.ruleStatus}</dt><dd>{reference.source.status}</dd></div>
                  <div><dt>{copy.reportLabels.relevantSections}</dt><dd>{reference.source.relevantSections.join("; ")}</dd></div>
                  <div><dt>{copy.tableLabels.lastVerified}</dt><dd>{reference.source.lastVerifiedAt}</dd></div>
                </dl>
                <p>{reference.source.summary[locale]}</p>
                <a href={reference.source.url} target="_blank" rel="noopener noreferrer">
                  {copy.buttons.openOfficialSource}
                </a>
              </article>
            ))}
          </div>
        </ReportSection>

        <footer className="nora-report-footer" data-pdf-block>
          <strong>{copy.footer}</strong>
          <span>{copy.footerSecondary}</span>
          {report.disclaimer.map((line) => <p key={line}>{line}</p>)}
        </footer>
      </div>
    </div>
  );
}

export function NoraRegulatoryWorkflow() {
  const [locale, setLocale] = useState<RegulatoryLocale>(() => {
    if (typeof window === "undefined") return "en";
    const stored = window.localStorage.getItem("scopeline-locale");
    return stored === "zh" || stored === "en" ? stored : "en";
  });
  const [step, setStep] = useState(0);
  const [scenario, setScenario] = useState<RegulatoryScenario>(emptyRegulatoryScenario);
  const [report, setReport] = useState<RegulatoryProposalReport | null>(null);
  const [error, setError] = useState("");
  const copy = NORA_COPY[locale];
  const questionIds = useMemo(() => dynamicScenarioQuestions(scenario), [scenario]);

  useEffect(() => {
    window.localStorage.setItem("scopeline-locale", locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  function changeLocale(nextLocale: RegulatoryLocale) {
    setLocale(nextLocale);
    setReport((current) =>
      current
        ? generateRegulatoryProposal(scenario, nextLocale, current.generatedAt)
        : current,
    );
  }

  function select<T extends keyof RegulatoryScenario>(key: T, value: RegulatoryScenario[T]) {
    setScenario((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function next() {
    if (!requiredStepIsComplete(step, scenario)) {
      setError(step === 7 ? copy.validation.answerAll : copy.validation.required);
      return;
    }
    if (step === 0 && scenario.industry !== "ev-battery-materials") {
      setError(copy.validation.unsupported);
      return;
    }
    setError("");
    setStep((current) => Math.min(9, current + 1));
  }

  function generate() {
    const validation = validateRegulatoryScenario(scenario);
    if (!validation.success) {
      setError(validation.errors.includes("Industry is planned but not supported")
        ? copy.validation.unsupported
        : copy.validation.invalidScenario);
      return;
    }
    setReport(generateRegulatoryProposal(scenario, locale));
    setStep(9);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setAnswer(questionId: ScenarioQuestionId, value: ScenarioAnswerValue) {
    setScenario((current) => ({
      ...current,
      answers: [
        ...current.answers.filter((answer) => answer.questionId !== questionId),
        { questionId, value },
      ],
    }));
    setError("");
  }

  function renderStep() {
    if (step === 0) return <OptionGrid options={INDUSTRY_OPTIONS} value={scenario.industry} locale={locale} onSelect={(id: IndustryId) => select("industry", id)} />;
    if (step === 1) return <OptionGrid options={ROLE_OPTIONS} value={scenario.role} locale={locale} onSelect={(id: RoleId) => select("role", id)} />;
    if (step === 2) return <OptionGrid options={PLAN_OPTIONS} value={scenario.plan} locale={locale} onSelect={(id: PlanId) => select("plan", id)} />;
    if (step === 3) return <OptionGrid options={OBJECTIVE_OPTIONS} value={scenario.objective} locale={locale} onSelect={(id: ObjectiveId) => select("objective", id)} />;
    if (step === 4) return <OptionGrid options={PRODUCT_OPTIONS} value={scenario.product} locale={locale} onSelect={(id: ProductId) => select("product", id)} />;
    if (step === 5) return <OptionGrid options={CREDIT_OPTIONS} value={scenario.credit} locale={locale} onSelect={(id: CreditId) => select("credit", id)} />;
    if (step === 6) return (
      <div className="nora-year-grid">
        {TARGET_YEAR_OPTIONS.map((year) => (
          <button type="button" key={year} data-selected={scenario.year === year} onClick={() => select("year", year)}>{year}</button>
        ))}
        <p>{scenario.credit === "45X" ? copy.yearContext.sale : scenario.credit === "45Y" || scenario.credit === "48E" ? copy.yearContext.construction : copy.yearContext.transaction}</p>
      </div>
    );
    if (step === 7) return (
      <div className="nora-questionnaire">
        {questionIds.map((questionId, index) => (
          <fieldset key={questionId}>
            <legend><span>{String(index + 1).padStart(2, "0")}</span>{SCENARIO_QUESTION_COPY[questionId][locale]}</legend>
            <div>
              {ANSWER_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  data-selected={scenario.answers.find((answer) => answer.questionId === questionId)?.value === option.id}
                  onClick={() => setAnswer(questionId, option.id)}
                >{option.label[locale]}</button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    );
    return (
      <div className="nora-review">
        <ScenarioSummary scenario={scenario} locale={locale} />
        <div className="nora-callout">
          <h3>{copy.reviewLabels.uncertainties}</h3>
          {identifiedUncertaintyIds(scenario).length
            ? <ul>{identifiedUncertaintyIds(scenario).map((id) => <li key={id}>{id in SCENARIO_QUESTION_COPY ? SCENARIO_QUESTION_COPY[id as ScenarioQuestionId][locale] : id}</li>)}</ul>
            : <p>{locale === "zh" ? "用户回答中未标记不确定事项" : "No uncertainty was marked in the user responses"}</p>}
        </div>
      </div>
    );
  }

  if (report && step === 9) {
    return (
      <main className="nora-shell">
        <NoraHeader locale={locale} setLocale={changeLocale} />
        <NoraReport report={report} onEdit={() => { setReport(null); setStep(8); }} />
      </main>
    );
  }

  return (
    <main className="nora-shell">
      <NoraHeader locale={locale} setLocale={changeLocale} />
      <section className="nora-hero">
        <div>
          <span>{copy.workflowType}</span>
          <h1>{copy.heroTitle}</h1>
          <p>{copy.heroSubheading}</p>
          <small>{copy.workflowName}</small>
        </div>
        <Image src="/team/nora-workstation.svg" alt="Nora at her regulatory research workstation" width={560} height={360} priority />
      </section>
      <section className="nora-workflow-panel">
        <div className="nora-progress">
          <span>{copy.stepLabel} {step + 1} {copy.ofLabel} 10</span>
          <div><i style={{ width: `${((step + 1) / 10) * 100}%` }} /></div>
          <strong>{copy.steps[STEP_KEYS[step]]}</strong>
        </div>
        <div className="nora-step">
          <h2>{copy.steps[STEP_KEYS[step]]}</h2>
          {renderStep()}
          {error && <p className="nora-error" role="alert">{error}</p>}
          <div className="nora-step-actions">
            <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>{copy.buttons.back}</button>
            {step < 8
              ? <button type="button" onClick={next}>{step === 7 ? copy.buttons.review : copy.buttons.next}</button>
              : <button type="button" onClick={generate}>{copy.buttons.generate}</button>}
          </div>
        </div>
      </section>
      <aside className="nora-boundary">
        {copy.disclaimer.map((line) => <p key={line}>{line}</p>)}
      </aside>
    </main>
  );
}

function NoraHeader({
  locale,
  setLocale,
}: {
  locale: RegulatoryLocale;
  setLocale: (locale: RegulatoryLocale) => void;
}) {
  const copy = NORA_COPY[locale];
  return (
    <header className="nora-header">
      <Link href="/" aria-label={copy.brandHome}><span>F</span>FINBRO</Link>
      <div><strong>{copy.headerName}</strong><small>{copy.headerTitle}</small></div>
      <div className="nora-locale" aria-label={copy.languagePicker}>
        <button type="button" aria-pressed={locale === "zh"} onClick={() => setLocale("zh")}>中文</button>
        <button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>EN</button>
      </div>
    </header>
  );
}
