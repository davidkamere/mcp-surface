export interface GeneratedRuntimeArtifact {
  id: string;
  platformId: string;
  sourceResearchJobId: string;
  artifactType: "runtime";
  version: string;
  capabilityHash: string;
  capabilityCount: number;
  generatedAt: string;
  exportedSymbols: string[];
  capabilityAccessors: string[];
  content: string;
}
