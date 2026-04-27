export const researchSourceTypes = ["openapi", "docs", "auth", "github_example", "unknown"] as const;
export const researchSourceOrigins = ["platform_url", "artifact", "discovered_link", "github_example", "serper_search"] as const;

export type ResearchSourceType = (typeof researchSourceTypes)[number];
export type ResearchSourceOrigin = (typeof researchSourceOrigins)[number];

export interface ResearchSource {
  id: string;
  platformId: string;
  researchJobId: string;
  sourceArtifactId?: string | undefined;
  url: string;
  title: string;
  origin: ResearchSourceOrigin;
  sourceType: ResearchSourceType;
  contentType?: string | undefined;
  status: "discovered" | "parsed" | "skipped" | "failed";
  notes?: string | undefined;
  createdAt: string;
}
