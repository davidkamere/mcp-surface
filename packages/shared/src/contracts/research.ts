import { z } from "zod";
import { capabilitySchema } from "../schemas/Capability";
import { platformSchema } from "../schemas/Platform";
import { researchFindingSchema } from "../schemas/ResearchFinding";
import { researchJobSchema } from "../schemas/ResearchJob";
import { researchSourceSchema } from "../schemas/ResearchSource";
import { sourceArtifactInputSchema, sourceArtifactSchema } from "../schemas/SourceArtifact";

export const updatePlatformSourcesInputSchema = z.object({
    sourceUrls: z.array(z.string().url()).min(1),
    sourceArtifacts: z.array(sourceArtifactInputSchema).default([]),
});

export const appendPlatformArtifactInputSchema = z.object({
    label: z.string().min(1),
    kind: z.enum(["url", "file", "document", "schema"]).default("file"),
    mimeType: z.string().optional(),
    fileName: z.string().min(1),
    contentBase64: z.string().min(1),
});

export const platformSourcesResponseSchema = z.object({
    platform: platformSchema,
});

export const startResearchJobInputSchema = z.object({
    initiatedByUserId: z.string().min(1).optional(),
});

export const researchJobListResponseSchema = z.object({
    jobs: z.array(researchJobSchema),
});

export const researchJobDetailResponseSchema = z.object({
    job: researchJobSchema,
    sources: z.array(researchSourceSchema),
    findings: z.array(researchFindingSchema),
    capabilities: z.array(capabilitySchema),
});

export const researchFindingsResponseSchema = z.object({
    findings: z.array(researchFindingSchema),
});

export const researchCapabilitiesResponseSchema = z.object({
    capabilities: z.array(capabilitySchema),
});

export const appendPlatformArtifactResponseSchema = z.object({
    artifact: sourceArtifactSchema,
    platform: platformSchema,
});

export type UpdatePlatformSourcesInput = z.infer<typeof updatePlatformSourcesInputSchema>;
export type AppendPlatformArtifactInput = z.infer<typeof appendPlatformArtifactInputSchema>;
export type StartResearchJobInput = z.infer<typeof startResearchJobInputSchema>;
