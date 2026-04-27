export const generatedArtifactToolNames = ["search", "execute"] as const;

export type GeneratedArtifactToolName = (typeof generatedArtifactToolNames)[number];

export interface GeneratedArtifactCapabilityIndexEntry {
  id: string;
  key: string;
  name: string;
  summary: string;
  method?: string | undefined;
  path?: string | undefined;
  authRequired: boolean;
  riskLevel: "read" | "write" | "destructive";
  parameterNames: string[];
}

export interface GeneratedMcpArtifact {
  id: string;
  platformId: string;
  sourceResearchJobId: string;
  artifactType: "mcp";
  version: string;
  capabilityHash: string;
  capabilityCount: number;
  generatedAt: string;
  tools: GeneratedArtifactToolName[];
  capabilityIndex: GeneratedArtifactCapabilityIndexEntry[];
  content: string;
}
