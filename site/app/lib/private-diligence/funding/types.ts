export type FundingField = {
  verification?: import('../verification/types').VerificationResult;
  value: string | number;
  evidenceId: string;
  sourceUrl: string;
  excerpt: string;
  locator: string;
  publicationDate: string | null;
  retrievedAt: string;
};
export type FundingEvent = {
  verification?: import('../verification/types').VerificationResult;
  eventId: string;
  entityId: string;
  sourceKind: "announcement" | "formD";
  fields: Record<string, FundingField>;
  limitations: string[];
};
export type FundingStatus = "supported" | "partial" | "no_information" | "inaccessible" | "issuer_unresolved" | "not_performed" | "budget_exhausted";
export type FundingResearch = {
  issuerAssociations?: import("../entity-resolution/secIssuerResolution").SecIssuerAssociation[];
  events: FundingEvent[];
  announcementStatus: FundingStatus;
  secStatus: FundingStatus;
  gaps: string[];
  limitations: string[];
  modelRuns?: Array<{ task: string; status: string; acceptedEvents?: number; code?: string }>;
  actions: Array<{ action: string; input: Record<string, string>; targetGap: string; reasonCode: string; status: string }>;
  requests: Record<"search" | "fetch" | "sec" | "model", number>;
  researchStateId?: string;
};
