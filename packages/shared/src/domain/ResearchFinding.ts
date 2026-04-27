export const researchFindingKinds = [
  "operation_summary",
  "authentication",
  "example",
  "endpoint",
  "capability_hint",
  "overview",
] as const;

export type ResearchFindingKind = (typeof researchFindingKinds)[number];

export interface ResearchFinding {
  id: string;
  platformId: string;
  researchJobId: string;
  researchSourceId: string;
  kind: ResearchFindingKind;
  title: string;
  summary: string;
  evidence: string[];
  provenanceUrl: string;
  createdAt: string;
}
