import type { ResearchStatus } from "./ResearchStatus";

export const researchJobStages = [
  "queued",
  "source_discovery",
  "structured_parsing",
  "docs_extraction",
  "capability_synthesis",
  "completed",
  "failed",
] as const;

export type ResearchJobStage = (typeof researchJobStages)[number];

export interface ResearchJob {
  id: string;
  platformId: string;
  status: ResearchStatus;
  currentStage: ResearchJobStage;
  stageMessage: string;
  sourceCount: number;
  findingCount: number;
  capabilityCount: number;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
  errorMessage?: string | undefined;
  createdAt: string;
  updatedAt: string;
}
