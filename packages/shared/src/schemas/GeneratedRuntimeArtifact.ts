import { z } from "zod";

export const generatedRuntimeArtifactSchema = z.object({
  id: z.string().min(1),
  platformId: z.string().min(1),
  sourceResearchJobId: z.string().min(1),
  artifactType: z.literal("runtime"),
  version: z.string().min(1),
  capabilityHash: z.string().min(1),
  capabilityCount: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
  exportedSymbols: z.array(z.string().min(1)),
  capabilityAccessors: z.array(z.string().min(1)),
  content: z.string().min(1),
});
