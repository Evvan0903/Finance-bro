import { AshbyAdapter, GenericCareersAdapter, GreenhouseAdapter, LeverAdapter, type CareersAdapterInput } from "./adapters";
import { deduplicateJobs, finalHiringFailureStatus, summarizeHiring } from "./core";
import { discoverCareerSources } from "./discovery";
import { SourceAdapterRegistry } from "./registry";
import { createPlaywrightBrowserRenderer } from "./playwrightFallback";
import type { HiringActivityResult, JobPosting } from "./types";

export const hiringSourceAdapterRegistry = new SourceAdapterRegistry<CareersAdapterInput, JobPosting>()
  .register(GreenhouseAdapter)
  .register(LeverAdapter)
  .register(AshbyAdapter)
  .register(GenericCareersAdapter);

function empty(companyId: string, status: HiringActivityResult["status"], limitations: string[] = []): HiringActivityResult {
  return { companyId, status, sourceCandidates: [], selectedSource: null, adapter: null, jobs: [], summary: summarizeHiring(companyId, [], null, limitations), limitations, failures: [] };
}

function failureStatus(error: unknown, adapter: string) {
  const message = error instanceof Error ? error.message : "Careers source did not return usable public job data";
  if (/malformed|contain jobs|JSON/i.test(message)) return { status: "parse_failed" as const, message };
  if (adapter === "GenericCareersAdapter" && /Browser fallback/i.test(message)) return { status: "browser_fallback_failed" as const, message };
  return { status: "retrieval_failed" as const, message };
}

export async function researchHiringActivity(input: {
  companyId: string;
  officialUrl: string;
  retrievedAt?: string;
  fetchImpl?: typeof fetch;
  resolveHost?: CareersAdapterInput["resolveHost"];
  browserRenderer?: CareersAdapterInput["browserRenderer"];
}): Promise<HiringActivityResult> {
  let candidates;
  try {
    candidates = await discoverCareerSources({ officialUrl: input.officialUrl, fetchImpl: input.fetchImpl, resolveHost: input.resolveHost });
  } catch { return empty(input.companyId, "retrieval_failed", ["The confirmed company website could not be searched for a public careers source."]); }
  if (!candidates.length) {
    const result = empty(input.companyId, "unsupported_source", ["No supported public careers source was discovered on the confirmed company website."]);
    result.sourceCandidates = candidates;
    return result;
  }
  const failures: HiringActivityResult["failures"] = [];
  for (const source of candidates) {
    const adapterInput: CareersAdapterInput = {
      companyId: input.companyId, sourceUrl: source.url, officialHostname: new URL(input.officialUrl).hostname,
      retrievedAt: input.retrievedAt ?? new Date().toISOString(), fetchImpl: input.fetchImpl, resolveHost: input.resolveHost,
      browserRenderer: input.browserRenderer ?? createPlaywrightBrowserRenderer(new URL(input.officialUrl).hostname),
    };
    const adapter = await hiringSourceAdapterRegistry.select(adapterInput);
    if (!adapter) continue;
    try {
      const collected = deduplicateJobs(await adapter.collect(adapterInput));
      const validation = adapter.validate(collected);
      if (!validation.valid) throw new Error("Adapter returned invalid normalized job data");
      const limitations = validation.limitations;
      const summary = summarizeHiring(input.companyId, collected, { adapter: adapter.name, sourceUrl: source.url, retrievedAt: adapterInput.retrievedAt }, limitations);
      return { companyId: input.companyId, status: collected.length ? "success_with_jobs" : "success_zero_jobs", sourceCandidates: candidates, selectedSource: source, adapter: adapter.name, jobs: collected, summary, limitations, failures };
    } catch (error) {
      const mapped = failureStatus(error, adapter.name);
      failures.push({ sourceUrl: source.url, adapter: adapter.name, status: mapped.status, reason: mapped.message });
    }
  }
  const status = finalHiringFailureStatus(failures);
  const result = empty(input.companyId, status, ["A public careers source was discovered but did not return usable job data."]);
  result.sourceCandidates = candidates;
  result.failures = failures;
  return result;
}

/** A narrow provenance payload for parent integration with Clara evidence/claim registries. */
export function hiringObservationPayload(result: HiringActivityResult) {
  return {
    companyId: result.companyId,
    status: result.status,
    selectedSource: result.selectedSource?.url ?? null,
    adapter: result.adapter,
    retrievedAt: result.summary.sources[0]?.retrievedAt ?? null,
    totalOpenRoles: result.summary.totalOpenRoles,
    signals: result.summary.signals.map((signal) => ({ ...signal, supportingJobs: result.jobs.filter((job) => signal.supportingJobIds.includes(job.id)).map((job) => ({ id: job.id, title: job.title, sourceUrl: job.sourceUrl, sourceType: job.sourceType, retrievedAt: job.retrievedAt })) })),
  };
}

export * from "./types";
export { deduplicateJobs, classifyJobFunction, classifyJobSeniority, detectHiringSourceType, finalHiringFailureStatus, rankCareerSources, summarizeHiring } from "./core";
