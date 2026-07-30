"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  COMPARISON_CRITERIA_COPY,
  DEFAULT_COMPARISON_CRITERIA,
  DEFAULT_FOCUS_AREAS,
  FOCUS_AREA_COPY,
  MASON_COPY,
} from "./lib/market-analysis/copy";
import { marketReportToMarkdown } from "./lib/market-analysis/reports/markdown";
import type {
  ClassificationCandidate,
  ComparisonCriterion,
  FocusArea,
  MarketDefinition,
  MarketLocale,
  MarketMode,
  MarketReport,
  MarketScopeInput,
  ProviderPlan,
} from "./lib/market-analysis/types";

type WorkflowState = "draft" | "confirmingScope" | "running" | "complete" | "failed";

const CURRENT_YEAR = new Date().getUTCFullYear();

function initialScope(locale: MarketLocale): MarketScopeInput {
  return {
    mode: "analyze",
    market: "U.S. Data Center Infrastructure",
    geography: "United States",
    startYear: 2019,
    endYear: Math.min(2025, CURRENT_YEAR),
    analysisYear: Math.min(2025, CURRENT_YEAR),
    researchQuestion: "",
    focusAreas: [...DEFAULT_FOCUS_AREAS],
    comparisonCriteria: [...DEFAULT_COMPARISON_CRITERIA],
    leadingIndicators: [],
    tickers: ["EQIX", "DLR", "VRT"],
    locale,
    reportDepth: "standard",
    outputFormat: "web",
  };
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function SegmentedMode({
  mode,
  locale,
  onChange,
}: {
  mode: MarketMode;
  locale: MarketLocale;
  onChange: (mode: MarketMode) => void;
}) {
  return (
    <div className="mason-mode-selector" aria-label="Analysis mode">
      {(["analyze", "trend", "compare"] as MarketMode[]).map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={mode === item}
          onClick={() => onChange(item)}
        >
          {MASON_COPY[locale].modes[item]}
        </button>
      ))}
    </div>
  );
}

function MultiSelect<T extends string>({
  values,
  options,
  locale,
  onChange,
}: {
  values: T[];
  options: Record<T, Record<MarketLocale, string>>;
  locale: MarketLocale;
  onChange: (values: T[]) => void;
}) {
  return (
    <div className="mason-chip-grid">
      {(Object.keys(options) as T[]).map((value) => (
        <button
          type="button"
          key={value}
          aria-pressed={values.includes(value)}
          onClick={() =>
            onChange(values.includes(value)
              ? values.filter((item) => item !== value)
              : [...values, value])
          }
        >
          {options[value][locale]}
        </button>
      ))}
    </div>
  );
}

function ScopeForm({
  scope,
  setScope,
  onSubmit,
}: {
  scope: MarketScopeInput;
  setScope: React.Dispatch<React.SetStateAction<MarketScopeInput>>;
  onSubmit: () => void;
}) {
  const copy = MASON_COPY[scope.locale];
  const set = <K extends keyof MarketScopeInput>(key: K, value: MarketScopeInput[K]) =>
    setScope((current) => ({ ...current, [key]: value }));
  return (
    <section className="mason-form-card" aria-labelledby="mason-scope-heading">
      <div className="mason-card-heading">
        <span>01</span>
        <h2 id="mason-scope-heading">{copy.headings.scope}</h2>
      </div>
      <SegmentedMode mode={scope.mode} locale={scope.locale} onChange={(mode) => set("mode", mode)} />
      <div className="mason-field-grid">
        <label>
          <span>{copy.fields.market}</span>
          <input value={scope.market} onChange={(event) => set("market", event.target.value)} />
        </label>
        {scope.mode === "compare" && (
          <label>
            <span>{copy.fields.subjectB}</span>
            <input
              value={scope.subjectB ?? ""}
              placeholder="Texas Data Center Ecosystem"
              onChange={(event) => set("subjectB", event.target.value)}
            />
          </label>
        )}
        <label>
          <span>{copy.fields.geography}</span>
          <input value={scope.geography} onChange={(event) => set("geography", event.target.value)} />
        </label>
        {scope.mode === "compare" && (
          <label>
            <span>{copy.fields.geographyB}</span>
            <input
              value={scope.geographyB ?? ""}
              placeholder="Texas"
              onChange={(event) => set("geographyB", event.target.value)}
            />
          </label>
        )}
        <label>
          <span>{copy.fields.period}</span>
          <div className="mason-year-range">
            <input
              type="number"
              min="1990"
              max={CURRENT_YEAR}
              value={scope.startYear}
              onChange={(event) => set("startYear", Number(event.target.value))}
            />
            <i>→</i>
            <input
              type="number"
              min="1991"
              max={CURRENT_YEAR}
              value={scope.endYear}
              onChange={(event) => set("endYear", Number(event.target.value))}
            />
          </div>
        </label>
        <label>
          <span>{scope.mode === "trend" ? copy.fields.endYear : copy.fields.analysisYear}</span>
          <input
            type="number"
            min="1990"
            max={CURRENT_YEAR}
            value={scope.analysisYear}
            onChange={(event) => set("analysisYear", Number(event.target.value))}
          />
        </label>
        <label className="mason-field-wide">
          <span>{copy.fields.question}</span>
          <textarea
            value={scope.researchQuestion}
            placeholder={scope.locale === "zh" ? "Mason 应重点回答什么问题" : "What should Mason focus on"}
            onChange={(event) => set("researchQuestion", event.target.value)}
          />
        </label>
        {scope.mode === "trend" && (
          <label className="mason-field-wide">
            <span>{copy.fields.leadingIndicators}</span>
            <input
              value={scope.leadingIndicators.join(", ")}
              placeholder="Industrial production, employment, financing conditions"
              onChange={(event) => set(
                "leadingIndicators",
                event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
              )}
            />
          </label>
        )}
        <label className="mason-field-wide">
          <span>{copy.headings.companies}</span>
          <input
            value={scope.tickers.join(", ")}
            placeholder="EQIX, DLR, VRT"
            onChange={(event) => set(
              "tickers",
              event.target.value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean),
            )}
          />
          <small>
            {scope.locale === "zh"
              ? "公司数据仅作为上市公司证据，不代表整个市场"
              : "Company data is public-company evidence and does not represent the entire market"}
          </small>
        </label>
      </div>
      <div className="mason-focus">
        <h3>{scope.mode === "compare" ? copy.fields.criteria : copy.headings.focus}</h3>
        {scope.mode === "compare" ? (
          <MultiSelect<ComparisonCriterion>
            values={scope.comparisonCriteria}
            options={COMPARISON_CRITERIA_COPY}
            locale={scope.locale}
            onChange={(values) => set("comparisonCriteria", values)}
          />
        ) : (
          <MultiSelect<FocusArea>
            values={scope.focusAreas}
            options={FOCUS_AREA_COPY}
            locale={scope.locale}
            onChange={(values) => set("focusAreas", values)}
          />
        )}
      </div>
      <button className="mason-primary-button" type="button" onClick={onSubmit}>
        {copy.buttons.assign}
      </button>
    </section>
  );
}

function groupTitle(candidate: ClassificationCandidate, locale: MarketLocale) {
  const copy = MASON_COPY[locale].headings;
  if (candidate.kind === "naics") return copy.proposedNaics;
  if (candidate.kind === "beaIndustry") return copy.proposedBea;
  if (candidate.kind === "fredSeries") return copy.proposedFred;
  if (candidate.kind === "censusDataset") return copy.proposedCensus;
  return copy.proposedOther;
}

function MappingConfirmation({
  scope,
  candidates,
  setCandidates,
  limitations,
  onConfirm,
  onCancel,
  busy,
}: {
  scope: MarketScopeInput;
  candidates: ClassificationCandidate[];
  setCandidates: React.Dispatch<React.SetStateAction<ClassificationCandidate[]>>;
  limitations: string[];
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const copy = MASON_COPY[scope.locale];
  const groups = Map.groupBy(candidates, (candidate) => groupTitle(candidate, scope.locale));
  const [newCode, setNewCode] = useState("");
  return (
    <section className="mason-confirmation" aria-labelledby="mason-confirm-heading">
      <div className="mason-card-heading">
        <span>02</span>
        <h2 id="mason-confirm-heading">{copy.headings.confirm}</h2>
      </div>
      <p>{scope.locale === "zh"
        ? "Mason 不会静默猜测行业范围。请确认、移除或添加官方分类后再检索数据"
        : "Mason does not silently guess an industry boundary. Confirm, remove, or add official mappings before data retrieval"}</p>
      {[...groups.entries()].map(([title, items]) => (
        <div className="mason-mapping-group" key={title}>
          <h3>{title}</h3>
          {items.map((candidate) => (
            <article key={candidate.mappingId} data-selected={candidate.selected}>
              <label>
                <input
                  type="checkbox"
                  checked={candidate.selected}
                  onChange={() => setCandidates((current) =>
                    current.map((item) => item.mappingId === candidate.mappingId
                      ? { ...item, selected: !item.selected }
                      : item))}
                />
                <span>
                  <strong>{candidate.code} · {candidate.officialLabel}</strong>
                  <small>{candidate.description}</small>
                </span>
              </label>
              <dl>
                <div><dt>{copy.mapping.provider}</dt><dd>{candidate.providerId}</dd></div>
                <div><dt>{copy.mapping.confidence}</dt><dd>{candidate.confidence}</dd></div>
                <div><dt>{copy.mapping.included}</dt><dd>{candidate.includedScope}</dd></div>
                <div><dt>{copy.mapping.exclusions}</dt><dd>{candidate.knownExclusions}</dd></div>
                <div><dt>{copy.mapping.reason}</dt><dd>{candidate.reason}</dd></div>
              </dl>
              <span className="mason-proxy-label" data-proxy={candidate.isProxy}>
                {candidate.isProxy ? copy.mapping.proxy : copy.mapping.direct}
              </span>
            </article>
          ))}
        </div>
      ))}
      <div className="mason-add-mapping">
        <input
          value={newCode}
          placeholder="NAICS code"
          onChange={(event) => setNewCode(event.target.value.replace(/[^A-Za-z0-9.-]/g, ""))}
        />
        <button
          type="button"
          disabled={!newCode}
          onClick={() => {
            const code = newCode;
            setCandidates((current) => [...current, {
              mappingId: `user-naics-${code}-${Date.now()}`,
              kind: "naics",
              code,
              officialLabel: "User-added official code",
              description: "Code added by the user for confirmation and provider validation.",
              providerId: "census",
              includedScope: "Scope represented by the confirmed code",
              knownExclusions: "Definition must be reviewed against official metadata",
              confidence: "low",
              reason: "Added by user",
              selected: true,
              isProxy: true,
            }]);
            setNewCode("");
          }}
        >
          {copy.buttons.addMapping}
        </button>
      </div>
      <div className="mason-limitations">
        {limitations.map((item) => <p key={item}>{item}</p>)}
      </div>
      <div className="mason-confirm-actions">
        <button type="button" onClick={onCancel}>{copy.buttons.cancel}</button>
        <button
          className="mason-primary-button"
          type="button"
          disabled={busy || !candidates.some((candidate) => candidate.selected && candidate.code !== "USER-REVIEW")}
          onClick={onConfirm}
        >
          {busy ? copy.progress.providerPlanning : copy.buttons.confirm}
        </button>
      </div>
    </section>
  );
}

function MarketChart({ report }: { report: MarketReport }) {
  const group = useMemo(() => {
    const numerical = report.metrics.filter(
      (metric) => typeof metric.value === "number" && /^\d{4}/.test(metric.period),
    );
    const groups = Map.groupBy(numerical, (metric) =>
      `${metric.canonicalLabel}|${metric.unit}|${metric.geography}`);
    return [...groups.values()].find((items) => items.length >= 2) ?? [];
  }, [report]);
  if (group.length < 2) return null;
  const ordered = [...group].sort((left, right) => left.period.localeCompare(right.period));
  const maximum = Math.max(...ordered.map((item) => Math.abs(Number(item.value))), 1);
  return (
    <figure className="mason-chart" data-pdf-block>
      <figcaption>
        <strong>{ordered[0].displayLabel}</strong>
        <span>{ordered[0].unit} · {ordered[0].geography} · {ordered[0].period}–{ordered.at(-1)?.period}</span>
      </figcaption>
      <div>
        {ordered.map((metric) => (
          <i key={metric.metricId} style={{ height: `${Math.max(4, Math.abs(Number(metric.value)) / maximum * 100)}%` }}>
            <span>{metric.period.slice(0, 4)}</span>
          </i>
        ))}
      </div>
      <small>
        {ordered[0].isProxy ? "Proxy · " : ""}Evidence: {ordered.flatMap((item) => item.evidenceIds).join(", ")}
      </small>
    </figure>
  );
}

function MasonReportView({
  report,
  onEdit,
}: {
  report: MarketReport;
  onEdit: () => void;
}) {
  const copy = MASON_COPY[report.locale];
  const ref = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const metricById = new Map(report.metrics.map((metric) => [metric.metricId, metric]));

  async function exportPdf() {
    if (!ref.current || exporting) return;
    setExporting(true);
    try {
      const { exportReportPdf } = await import("./lib/pdf-export");
      await exportReportPdf(ref.current, {
        ticker: "MASON",
        agentId: "mason",
        subject: report.marketDefinition.marketName,
        researchDate: report.generatedAt.slice(0, 10),
        filename: `finbro-mason-${report.mode}-${report.generatedAt.slice(0, 10)}-${report.locale}.pdf`,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="mason-results">
      <div className="mason-report-actions">
        <button type="button" onClick={onEdit}>{copy.buttons.edit}</button>
        <button type="button" onClick={() =>
          downloadText(
            `finbro-mason-${report.mode}-${report.locale}.md`,
            marketReportToMarkdown(report),
          )}>{copy.buttons.markdown}</button>
        <button type="button" onClick={exportPdf} disabled={exporting}>
          {exporting ? copy.buttons.downloadingPdf : copy.buttons.pdf}
        </button>
        <button type="button" onClick={() => window.print()}>{copy.buttons.print}</button>
      </div>
      <div className="mason-report" ref={ref} data-rendering-model="shared-research-report-dom-v1">
        <header className="mason-report-cover" data-pdf-block>
          <span>FINBRO · MASON</span>
          <h1>{report.title}</h1>
          <p>{copy.workflow}</p>
          <dl>
            <div><dt>{copy.reportLabels.generatedAt}</dt><dd>{report.generatedAt}</dd></div>
            <div><dt>{copy.headings.dataCoverage}</dt><dd>{report.dataCoverage.status}</dd></div>
          </dl>
          {report.disclosures.map((item) => <small key={item}>{item}</small>)}
        </header>
        <MarketChart report={report} />
        {report.sections.map((section) => {
          const metrics = section.metricIds.flatMap((id) => {
            const metric = metricById.get(id);
            return metric ? [metric] : [];
          });
          const isCoverage = /Data Coverage|数据覆盖/.test(section.title);
          const isReferences = /References|参考资料/.test(section.title);
          const isMarketDefinition = section.number === "02";
          const isScorecard = /Comparison Scorecard|比较评分卡/.test(section.title);
          return (
            <section className="mason-report-section" data-pdf-block key={section.number}>
              <header><span>{section.number}</span><h2>{section.title}</h2></header>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {isMarketDefinition && (
                <dl className="mason-definition-grid">
                  <div>
                    <dt>{report.locale === "zh" ? "商业定义" : "Commercial definition"}</dt>
                    <dd>{report.marketDefinition.commercialDefinition}</dd>
                  </div>
                  <div>
                    <dt>{report.locale === "zh" ? "地理范围" : "Geography"}</dt>
                    <dd>{report.marketDefinition.geography}</dd>
                  </div>
                  <div>
                    <dt>{report.locale === "zh" ? "纳入活动" : "Included activities"}</dt>
                    <dd>{report.marketDefinition.includedActivities.join(" · ")}</dd>
                  </div>
                  <div>
                    <dt>{report.locale === "zh" ? "排除活动" : "Excluded activities"}</dt>
                    <dd>{report.marketDefinition.excludedActivities.join(" · ")}</dd>
                  </div>
                  <div>
                    <dt>{report.locale === "zh" ? "官方分类与序列" : "Official classifications and series"}</dt>
                    <dd>{report.marketDefinition.officialClassificationMappings.map((mapping) =>
                      `${mapping.kind.toUpperCase()} ${mapping.code} — ${mapping.officialLabel}`,
                    ).join(" · ")}</dd>
                  </div>
                  <div>
                    <dt>{report.locale === "zh" ? "代理指标与限制" : "Proxies and limitations"}</dt>
                    <dd>{[
                      ...report.marketDefinition.selectedProxies,
                      ...report.marketDefinition.definitionLimitations,
                    ].join(" · ")}</dd>
                  </div>
                </dl>
              )}
              {metrics.length > 0 && (
                <div className="mason-table-wrap">
                  <table>
                    <thead><tr>
                      <th>{copy.reportLabels.evidence}</th>
                      <th>{copy.reportLabels.reported}</th>
                      <th>{copy.reportLabels.unit}</th>
                      <th>{copy.reportLabels.period}</th>
                      <th>{copy.reportLabels.geography}</th>
                    </tr></thead>
                    <tbody>{metrics.map((metric) => (
                      <tr key={metric.metricId}>
                        <td><strong>{metric.displayLabel}</strong><small>{metric.isCalculated ? copy.reportLabels.calculated : copy.reportLabels.reported}{metric.isProxy ? ` · ${copy.reportLabels.proxy}` : ""}<br />{metric.evidenceIds.join(", ")}</small></td>
                        <td>{typeof metric.value === "number" ? metric.value.toLocaleString(report.locale === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 3 }) : metric.value}</td>
                        <td>{metric.unit}</td>
                        <td>{metric.period}</td>
                        <td>{metric.geography}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              {isCoverage && (
                <div className="mason-provider-grid">
                  {report.providerResults.map((result) => (
                    <article key={result.providerId}>
                      <strong>{result.providerName}</strong>
                      <span data-status={result.status}>{copy.providerStatus[result.status]}</span>
                      <small>{result.evidence.length} evidence records</small>
                      {result.limitations.map((item) => <p key={item}>{item}</p>)}
                    </article>
                  ))}
                </div>
              )}
              {isScorecard && report.comparisonScorecard.length > 0 && (
                <div className="mason-table-wrap">
                  <table className="mason-scorecard">
                    <thead><tr>
                      <th>{report.locale === "zh" ? "比较维度" : "Dimension"}</th>
                      <th>{report.locale === "zh" ? "评估" : "Assessment"}</th>
                      <th>{report.locale === "zh" ? "证据与解释" : "Evidence and explanation"}</th>
                    </tr></thead>
                    <tbody>{report.comparisonScorecard.map((item) => (
                      <tr key={item.dimension}>
                        <td><strong>{item.dimension}</strong></td>
                        <td>{item.assessment}</td>
                        <td>{item.explanation}<small>{item.evidenceIds.join(", ")}</small></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              {isReferences && (
                <div className="mason-reference-list">
                  {report.references.map((reference) => (
                    <article key={`${reference.number}-${reference.seriesOrTableId}`}>
                      <span>[{reference.number}]</span>
                      <h3>{reference.providerName} · {reference.officialTitle}</h3>
                      <p>{reference.dataset} · {reference.seriesOrTableId}</p>
                      <small>{reference.geography} · {reference.observationPeriod} · {reference.units}<br />Retrieved {reference.retrievedAt}</small>
                      <a href={reference.officialSourceUrl} target="_blank" rel="noopener noreferrer">Open official source ↗</a>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
        <footer className="mason-report-footer" data-pdf-block>
          <strong>Generated with FinBro · Evidence-backed public-data market research</strong>
          <span>Research workflow assisted by Mason</span>
        </footer>
      </div>
    </section>
  );
}

export function MasonMarketAnalysisWorkflow() {
  const [locale, setLocale] = useState<MarketLocale>("en");
  const [scope, setScope] = useState<MarketScopeInput>(() => initialScope("en"));
  const [state, setState] = useState<WorkflowState>("draft");
  const [candidates, setCandidates] = useState<ClassificationCandidate[]>([]);
  const [limitations, setLimitations] = useState<string[]>([]);
  const [plan, setPlan] = useState<ProviderPlan | null>(null);
  const [definition, setDefinition] = useState<MarketDefinition | null>(null);
  const [report, setReport] = useState<MarketReport | null>(null);
  const [error, setError] = useState("");
  const copy = MASON_COPY[locale];

  useEffect(() => {
    const stored = window.localStorage.getItem("scopeline-locale");
    if (stored !== "zh" && stored !== "en") return;
    const frame = window.requestAnimationFrame(() => {
      setLocale(stored);
      setScope((current) => ({ ...current, locale: stored }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function switchLocale(next: MarketLocale) {
    setLocale(next);
    setScope((current) => ({ ...current, locale: next }));
    window.localStorage.setItem("scopeline-locale", next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
  }

  async function findClassifications() {
    setError("");
    try {
      const response = await fetch("/api/market-analysis/classifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: { ...scope, locale } }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? copy.errors.classification);
      setScope(payload.scope);
      setCandidates(payload.candidates);
      setLimitations(payload.limitations);
      setState("confirmingScope");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.errors.generic);
      setState("failed");
    }
  }

  async function confirmAndRun() {
    setError("");
    setState("running");
    try {
      const planResponse = await fetch("/api/market-analysis/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, candidates, limitations }),
      });
      const planPayload = await planResponse.json();
      if (!planResponse.ok) throw new Error(planPayload.message ?? copy.errors.validation);
      setDefinition(planPayload.marketDefinition);
      setPlan(planPayload.providerPlan);
      const runResponse = await fetch("/api/market-analysis/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          marketDefinition: planPayload.marketDefinition,
        }),
      });
      const runPayload = await runResponse.json();
      if (!runResponse.ok) throw new Error(runPayload.message ?? copy.errors.unavailable);
      setReport(runPayload.report);
      setState("complete");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.errors.generic);
      setState("failed");
    }
  }

  if (state === "complete" && report) {
    return (
      <main className="mason-shell">
        <MasonHeader locale={locale} switchLocale={switchLocale} />
        <MasonReportView report={report} onEdit={() => setState("draft")} />
      </main>
    );
  }

  return (
    <main className="mason-shell">
      <MasonHeader locale={locale} switchLocale={switchLocale} />
      <section className="mason-hero">
        <div>
          <span>FINBRO · OFFICIAL DATA WORKFLOW</span>
          <h1>{copy.heroTitle}</h1>
          <p>{copy.heroSubheading}</p>
          {copy.disclosure.map((item) => <small key={item}>{item}</small>)}
        </div>
        <Image src="/team/mason-workstation.svg" alt="Mason at a market-analysis workstation" width={560} height={360} priority />
      </section>
      <div className="mason-workflow">
        {(state === "draft" || state === "failed") && (
          <ScopeForm scope={{ ...scope, locale }} setScope={setScope} onSubmit={findClassifications} />
        )}
        {state === "confirmingScope" && (
          <MappingConfirmation
            scope={scope}
            candidates={candidates}
            setCandidates={setCandidates}
            limitations={limitations}
            onConfirm={confirmAndRun}
            onCancel={() => setState("draft")}
            busy={false}
          />
        )}
        {state === "running" && (
          <section className="mason-running" aria-live="polite">
            <span>{copy.progress.dataRetrieval}</span>
            <h2>{copy.progress.sourceNormalization}</h2>
            <p>{copy.progress.compatibilityReview}</p>
            {plan && (
              <div className="mason-plan-preview">
                {plan.items.filter((item) => item.selected).map((item) => (
                  <span key={item.providerId}>{item.providerName} · {item.configurationStatus}</span>
                ))}
              </div>
            )}
          </section>
        )}
        {error && (
          <section className="mason-error" role="alert">
            <h2>{error === "Current official data unavailable" ? copy.headings.currentUnavailable : copy.errors.generic}</h2>
            <p>{error}</p>
            {definition && <small>{definition.marketName}</small>}
            <button type="button" onClick={() => definition ? confirmAndRun() : findClassifications()}>
              {copy.buttons.retry}
            </button>
          </section>
        )}
      </div>
      <footer className="mason-boundary">
        {copy.disclosure.map((item) => <p key={item}>{item}</p>)}
      </footer>
    </main>
  );
}

function MasonHeader({
  locale,
  switchLocale,
}: {
  locale: MarketLocale;
  switchLocale: (locale: MarketLocale) => void;
}) {
  const copy = MASON_COPY[locale];
  return (
    <header className="mason-header">
      <Link href="/" aria-label="Return to FinBro team workspace"><span>F</span> FINBRO</Link>
      <div><strong>{copy.agent}</strong><small>{copy.role}</small></div>
      <div className="mason-locale">
        <button type="button" aria-pressed={locale === "zh"} onClick={() => switchLocale("zh")}>中文</button>
        <button type="button" aria-pressed={locale === "en"} onClick={() => switchLocale("en")}>EN</button>
      </div>
    </header>
  );
}
