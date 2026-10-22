import { z } from "zod";
import { generatedArtifactToolNames } from "../domain/GeneratedMcpArtifact";
import { capabilityRiskLevels } from "../domain/Capability";

export const generatedArtifactCapabilityIndexEntrySchema = z.object({
    id: z.string().min(1),
    key: z.string().min(1),
    name: z.string().min(1),
    summary: z.string().min(1),
    method: z.string().min(1).optional(),
    path: z.string().min(1).optional(),
    authRequired: z.boolean(),
    riskLevel: z.enum(capabilityRiskLevels),
    parameterNames: z.array(z.string().min(1)),
});

export const generatedMcpArtifactSchema = z.object({
    id: z.string().min(1),
    platformId: z.string().min(1),
    sourceResearchJobId: z.string().min(1),
    artifactType: z.literal("mcp"),
    version: z.string().min(1),
    capabilityHash: z.string().min(1),
    capabilityCount: z.number().int().nonnegative(),
    generatedAt: z.string().datetime(),
    tools: z.array(z.enum(generatedArtifactToolNames)).length(2),
    capabilityIndex: z.array(generatedArtifactCapabilityIndexEntrySchema),
    content: z.string().min(1),
});
