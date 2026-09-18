export type HiringSourceType = "greenhouse" | "lever" | "ashby" | "company_careers" | "unknown";

export type HiringActivityStatus =
  | "success_with_jobs"
  | "success_zero_jobs"
  | "partial"
  | "unsupported_source"
  | "retrieval_failed"
  | "parse_failed"
  | "browser_fallback_failed";

export type JobFunction =
  | "Engineering" | "Product" | "Data / AI" | "Sales" | "Marketing" | "Finance"
  | "Operations" | "HR / People" | "Legal / Compliance" | "Customer Success"
  | "Security" | "Other";
export type JobSeniority = "Intern" | "Entry" | "Mid" | "Senior" | "Lead" | "Manager" | "Director" | "VP" | "Executive" | "Unknown";

export type JobPosting = {
  id: string;
  companyId: string;
  title: string;
  department?: string;
  team?: string;
  location?: string;
  country?: string;
  remote?: boolean;
  employmentType?: string;
  seniority?: JobSeniority;
  function?: JobFunction;
  description?: string;
  sourceUrl: string;
  sourceType: HiringSourceType;
  sourceJobId?: string;
  postedAt?: string;
  retrievedAt: string;
};

export type CareerSourceCandidate = {
  url: string;
  sourceType: HiringSourceType;
  discoveryMethod: "linked_from_website" | "known_path" | "confirmed_source";
  score: number;
};

export type HiringSignal = {
  type: "engineering_expansion" | "ai_ml_hiring" | "enterprise_gtm_hiring" | "international_hiring" | "compliance_investment" | "leadership_hiring" | "finance_team_buildout";
  strength: "low" | "medium" | "high";
  evidenceCount: number;
  supportingJobIds: string[];
  explanation: string;
};

export type HiringIntelligenceSummary = {
  companyId: string;
  totalOpenRoles: number;
  byFunction: Record<JobFunction, number>;
  bySeniority: Record<JobSeniority, number>;
  byLocation: Record<string, number>;
  remoteRoles: number;
  sources: { adapter: string; sourceUrl: string; retrievedAt: string; jobCount: number }[];
  signals: HiringSignal[];
  limitations: string[];
};

export type HiringActivityResult = {
  verification?: import('../verification/types').VerificationResult;
  companyId: string;
  status: HiringActivityStatus;
  sourceCandidates: CareerSourceCandidate[];
  selectedSource: CareerSourceCandidate | null;
  adapter: string | null;
  jobs: JobPosting[];
  summary: HiringIntelligenceSummary;
  limitations: string[];
  failures: { sourceUrl: string; adapter: string | null; status: HiringActivityStatus; reason: string }[];
};

export type SourceAdapter<TInput, TOutput> = {
  name: string;
  sourceType: HiringSourceType;
  canHandle(input: TInput): boolean | Promise<boolean>;
  collect(input: TInput): Promise<TOutput[]>;
  validate(results: TOutput[]): { valid: boolean; limitations: string[] };
};
