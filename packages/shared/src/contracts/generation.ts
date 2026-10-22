import { z } from "zod";
import { generatedMcpArtifactSchema } from "../schemas/GeneratedMcpArtifact";
import { generatedRuntimeArtifactSchema } from "../schemas/GeneratedRuntimeArtifact";

export const generateArtifactsInputSchema = z.object({
    sourceResearchJobId: z.string().min(1).optional(),
});

export const generationArtifactsResponseSchema = z.object({
    mcpArtifact: generatedMcpArtifactSchema,
    runtimeArtifact: generatedRuntimeArtifactSchema,
});

export const generationArtifactsListResponseSchema = z.object({
    mcpArtifacts: z.array(generatedMcpArtifactSchema),
    runtimeArtifacts: z.array(generatedRuntimeArtifactSchema),
});

export const generationArtifactsLatestResponseSchema = z.object({
    mcpArtifact: generatedMcpArtifactSchema.nullable(),
    runtimeArtifact: generatedRuntimeArtifactSchema.nullable(),
});

export type GenerateArtifactsInput = z.infer<typeof generateArtifactsInputSchema>;
