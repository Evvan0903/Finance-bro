export type CustomConceptMapping = {
  issuerCik: string;
  taxonomy: string;
  concept: string;
  metricId: string;
  definitionId: string;
  status: "candidate" | "validated" | "rejected";
  validationNote: string;
};

export const CUSTOM_CONCEPT_MAPPINGS: CustomConceptMapping[] = [];

export function publishableCustomMappings(issuerCik: string) {
  return CUSTOM_CONCEPT_MAPPINGS.filter(
    (mapping) => mapping.issuerCik === issuerCik && mapping.status === "validated",
  );
}
