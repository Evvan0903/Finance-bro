import type { EntityIdentityGraph } from '../types';
import type { ClaraToolName } from '../tools/registry';
import type { SerpApiSearchTopic } from '../providers/serpApiWebSearchProvider';
import type { ResearchTopic } from './types';

export type ResearchTargetClassification = 'EXISTING' | 'ADD NOW' | 'DEFER' | 'DO NOT ADD';
export type ResearchTarget = {
  id: string;
  description: string;
  classification: ResearchTargetClassification;
  decision: string;
  priority: 'core' | 'high' | 'optional';
  expectedValue: number;
  expectedCost: number;
  availableTools: ClaraToolName[];
  sourceClasses: string[];
  resultTypes: string[];
  visualizationModes: string[];
  stopRules: string[];
  topic?: ResearchTopic;
  coveredBy?: string;
};
const stopRules = ['useful_evidence_obtained', 'two_empty_attempts', 'provider_unavailable', 'entity_relationship_unresolved', 'low_marginal_value', 'run_budget_reached'];
const web = ['web_research'] as ClaraToolName[];
const owned = ['company_original_page'];
function target(id: string, description: string, classification: ResearchTargetClassification, decision: string,
  options: Partial<Omit<ResearchTarget, 'id' | 'description' | 'classification' | 'decision'>> = {}): ResearchTarget {
  return {id,description,classification,decision,priority:'optional',expectedValue:3,expectedCost:1,availableTools:web,
    sourceClasses:owned,resultTypes:['SourceFact'],visualizationModes:['compact'],stopRules,...options};
}

/** Capability catalogue, not an execution checklist. Related signals share one discovery branch. */
export const researchTargetRegistry: readonly ResearchTarget[] = [
  target('identity','User-confirmed brand and domain','EXISTING','Already locked by candidate confirmation; never replaced by a discovered name.',{priority:'core',expectedValue:5,expectedCost:0,availableTools:['company_identity'],resultTypes:['EntityIdentityGraph'],visualizationModes:['header']}),
  target('legal_entity','Supported operator and legal relationships','EXISTING','Existing company-owned legal discovery and SEC candidate gate; reuse its evidence.',{priority:'core',expectedValue:5,resultTypes:['LegalEntityCandidate'],visualizationModes:['compact','unverified']}),
  target('business_description','What the company does','EXISTING','Extract original attributable company statements from baseline pages.',{topic:'overview',priority:'core',expectedValue:5}),
  target('products','Named products and capabilities','EXISTING','Existing extraction; improve depth only when original product evidence is promising.',{topic:'products',priority:'high',expectedValue:5,resultTypes:['ProductRecord']}),
  target('services','Explicit service offerings','EXISTING','Shares product evidence, avoiding another provider or search.',{coveredBy:'products',resultTypes:['ProductRecord']}),
  target('business_model','Explicit commercial model statements','ADD NOW','Retain explicit pricing or offering terms; no inference from industry or funding.',{coveredBy:'pricing'}),
  target('pricing','Published price and commercial terms','ADD NOW','High-density original pricing pages are inexpensive; no estimates or inferred currency.',{topic:'pricing',priority:'high',expectedValue:4,resultTypes:['SourceObservation']}),
  target('founders','Founders with explicit roles','EXISTING','Reuse person-role attribution and current/historical safeguards.',{topic:'people',priority:'high',expectedValue:5,resultTypes:['PersonRole']}),
  target('executives','Attributed executive roles','EXISTING','Same people branch; never infer current roles from dated historical mentions.',{coveredBy:'founders',resultTypes:['PersonRole']}),
  target('board_or_key_people','Explicit board or leadership appointments','ADD NOW','Source-backed director and appointment statements reuse people extraction.',{coveredBy:'founders',resultTypes:['PersonRole']}),
  target('funding','Source-grounded financing events','EXISTING','Use existing bounded announcement and SEC intelligence; no parallel financing provider.',{priority:'high',expectedValue:5,expectedCost:3,availableTools:['funding_search','sec_funding'],sourceClasses:['company_original_page','investor_announcement','sec_original_filing'],resultTypes:['FundingEvent'],visualizationModes:['timeline','compact']}),
  target('investors','Explicit investor participation','EXISTING','Existing field-level financing validation; do not infer from logos.',{coveredBy:'funding',availableTools:['funding_search','sec_funding'],resultTypes:['FundingEvent']}),
  target('valuation','Explicit disclosed valuation','EXISTING','Existing financing fields preserve unspecified basis/currency.',{coveredBy:'funding',availableTools:['funding_search'],resultTypes:['FundingEvent']}),
  target('hiring','Observed original public job postings','EXISTING','Known ATS adapters and confirmed company careers sources already exist.',{priority:'high',expectedValue:5,expectedCost:2,availableTools:['hiring_intelligence'],sourceClasses:['confirmed_ats','company_careers'],resultTypes:['JobPosting'],visualizationModes:['distribution','compact']}),
  target('key_open_roles','Explainable strategic role signals','ADD NOW','Derive from observed job titles without another request or headcount inference.',{coveredBy:'hiring',availableTools:['hiring_intelligence'],resultTypes:['JobPosting'],visualizationModes:['metrics','compact'],expectedCost:0}),
  target('hiring_function_mix','Observed job function distribution','EXISTING','Reuse structured postings and explainable normalized categories.',{coveredBy:'hiring',availableTools:['hiring_intelligence'],resultTypes:['JobPosting'],visualizationModes:['distribution'],expectedCost:0}),
  target('hiring_geography','Observed job location distribution','EXISTING','Snapshot of posting locations, not office or headcount estimates.',{coveredBy:'hiring',availableTools:['hiring_intelligence'],resultTypes:['JobPosting'],visualizationModes:['distribution'],expectedCost:0}),
  target('locations','Explicit operating locations','EXISTING','Website address extraction exists; do not recast job locations as company offices.',{resultTypes:['EntityIdentityGraph.addresses']}),
  target('customers','Explicit attributable customer relationships','ADD NOW','Original case studies are accessible and useful; reject logos and menu lists.',{topic:'customers',priority:'high',expectedValue:4,resultTypes:['CustomerEvidence']}),
  target('customer_evidence','Specific customer use or outcomes','ADD NOW','Shares the customer branch; preserve company-reported attribution, no endorsement inference.',{coveredBy:'customers',resultTypes:['CustomerEvidence']}),
  target('partnerships','Explicit partner relationship statements','ADD NOW','Original announcements can add meaningful context with a bounded follow-up.',{topic:'partnerships',priority:'high',expectedValue:4,resultTypes:['PartnershipEvidence']}),
  target('strategic_relationships','Explicit strategic relationships','ADD NOW','Use the same partnership record; no additional generic relationship search.',{coveredBy:'partnerships',resultTypes:['PartnershipEvidence']}),
  target('recent_developments','Dated concrete company events','EXISTING','Existing source-date rules and verbatim extraction; no retrieval-date substitution.',{topic:'recent',priority:'high',expectedValue:5,resultTypes:['CompanyEvent'],visualizationModes:['timeline','compact']}),
  target('product_launches','Dated major product launches','EXISTING','A recent-development subtype, not a second search branch.',{coveredBy:'recent_developments',resultTypes:['CompanyEvent']}),
  target('m_and_a','Explicit announced acquisitions','EXISTING','Original announcements already supported as recent developments; no deal-size inference.',{coveredBy:'recent_developments',resultTypes:['CompanyEvent']}),
  target('security_compliance','Explicit security/compliance statements','ADD NOW','Public company trust pages are low-cost; support, compliance and certification remain distinct claims.',{topic:'security',expectedValue:4,resultTypes:['SourceObservation']}),
  target('certifications','Explicit certification statements','ADD NOW','Shares security evidence; preserve the precise named standard and asserted scope.',{coveredBy:'security_compliance',resultTypes:['SourceObservation']}),
  target('government_activity','Relevant official federal awards','EXISTING','Existing USAspending provider is gated by government relevance; do not run for every company.',{expectedCost:2,availableTools:[],sourceClasses:['usaspending_official_record'],resultTypes:['RawEvidence.structuredData.award']}),
  target('sec_filings','Original Form D/D-A records','EXISTING','Existing strict issuer association, original parsing and provisional governance.',{coveredBy:'funding',availableTools:['sec_funding'],sourceClasses:['sec_original_filing'],resultTypes:['FundingEvent'],expectedCost:2}),
  target('developer_api_ecosystem','Public API and developer capabilities','ADD NOW','Use explicit company documentation via product discovery; no repo popularity/usage inference.',{coveredBy:'products',resultTypes:['ProductRecord']}),
  target('major_integrations','Explicit supported product integrations','ADD NOW','Explicit integration documentation shares product extraction; logos do not establish partnerships.',{coveredBy:'products',resultTypes:['ProductRecord']}),
  target('geographic_expansion','Dated new-office or market announcements','EXISTING','Use explicit dated recent developments; job counts cannot establish expansion.',{coveredBy:'recent_developments',resultTypes:['CompanyEvent']}),
  target('executive_hiring','Attributed executive appointments','EXISTING','Recent/people evidence or observed job openings already covers this without inferring a vacancy.',{coveredBy:'founders',resultTypes:['PersonRole','CompanyEvent']}),
  target('finance_leadership_hiring','Observed finance leadership openings','ADD NOW','Deterministic title classification over existing postings; zero additional requests.',{coveredBy:'hiring',availableTools:['hiring_intelligence'],resultTypes:['JobPosting'],expectedCost:0}),
  target('regulatory_signals','Entity-specific regulatory records','DEFER','Multiple jurisdictions and entity ambiguity need a dedicated resolver; generic search is unsafe.',{availableTools:[],sourceClasses:['regulator_original_record'],expectedCost:5}),
  target('ip_patents','Entity-linked patent records','DEFER','Assignee/parent resolution is expensive and usually low-density for this general Quick objective.',{availableTools:[],sourceClasses:['patent_office_record'],expectedCost:5}),
  target('legal_events','Entity-linked court events','DEFER','Court coverage and namesake risk require jurisdiction-specific matching and careful event semantics.',{availableTools:[],sourceClasses:['court_original_record'],expectedCost:5}),
  target('sam_gov','Federal registration and opportunities','DEFER','USAspending already covers public awards; SAM registration is not an awarded contract.',{availableTools:[],sourceClasses:['sam_gov_record'],expectedCost:4}),
  target('state_registries','Multi-state registry status','DEFER','Fragmented access and legal-name ambiguity; company-owned legal sources suffice for this iteration.',{availableTools:[],sourceClasses:['state_registry_record'],expectedCost:5}),
  target('certification_databases','Third-party certification registries','DEFER','Scope/entity matching and heterogeneous access exceed incremental value; preserve first-party claims.',{availableTools:[],sourceClasses:['certification_registry'],expectedCost:4}),
  target('public_pricing_changes','Longitudinal price changes','DEFER','A single current page cannot prove a change; would require dated comparable snapshots.',{availableTools:[],expectedCost:4}),
  target('revenue_estimates','Inferred private-company revenue','DO NOT ADD','No supported source means no estimate; speculative financial precision is outside scope.',{availableTools:[],sourceClasses:[],expectedCost:5}),
  target('logo_relationships','Customer/partner inference from logos','DO NOT ADD','A logo is not an attributable relationship statement.',{availableTools:[],sourceClasses:[],expectedCost:0}),
  target('hiring_growth','Headcount growth inferred from openings','DO NOT ADD','One observed job snapshot cannot establish growth, health, existing staffing or IPO preparation.',{availableTools:[],sourceClasses:[],expectedCost:0}),
];

export function activeResearchTargets() { return researchTargetRegistry.filter(t=>t.classification==='EXISTING'||t.classification==='ADD NOW'); }
export function researchTargetForTopic(topic: ResearchTopic) { return activeResearchTargets().find(t=>t.topic===topic)!; }
export function searchTopicForResearch(topic: ResearchTopic): SerpApiSearchTopic {
  return topic==='people'?'leadership':topic==='recent'?'recentActivity':topic==='customers'||topic==='partnerships'?'customersPartners':'overviewProducts';
}
export function baselineResearchQueries(graph: EntityIdentityGraph, _now: Date = new Date()) {
  void _now;
  const domain=graph.domains[0],name=graph.canonicalName.replace(/["\\]/g,' ');
  // Preserve the two-search baseline cap while covering multiple inexpensive directions.
  return [
    {topic:'leadership' as const,query:`site:${domain} "${name}" (leadership OR founders OR products OR services)`},
    {topic:'recentActivity' as const,query:`site:${domain} "${name}" (announces OR customers OR partners OR news)`},
  ];
}
