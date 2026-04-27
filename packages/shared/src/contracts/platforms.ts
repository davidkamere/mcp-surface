import { z } from "zod";
import { platformRuntimeConfigEntrySchema, platformSchema } from "../schemas/Platform";
import { sourceArtifactInputSchema } from "../schemas/SourceArtifact";

export const createPlatformInputSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must contain lowercase letters, numbers, and dashes."),
  sourceUrls: z.array(z.string().url()).min(1),
  sourceArtifacts: z.array(sourceArtifactInputSchema).default([]),
});

export const updatePlatformRuntimeConfigInputSchema = z.object({
  runtimeConfig: z.array(platformRuntimeConfigEntrySchema).default([]),
});

export const platformListResponseSchema = z.object({
  platforms: z.array(platformSchema),
});

export const platformDetailResponseSchema = z.object({
  platform: platformSchema,
});

export type CreatePlatformInput = z.infer<typeof createPlatformInputSchema>;
export type UpdatePlatformRuntimeConfigInput = z.infer<typeof updatePlatformRuntimeConfigInputSchema>;
export type PlatformListResponse = z.infer<typeof platformListResponseSchema>;
export type PlatformDetailResponse = z.infer<typeof platformDetailResponseSchema>;
