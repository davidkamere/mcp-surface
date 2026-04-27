import { z } from "zod";
import { sourceArtifactSchema } from "./SourceArtifact";

export const platformRuntimeConfigEntrySchema = z.object({
  key: z.string().trim().min(1),
  value: z.string(),
});

export const platformSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  sourceUrls: z.array(z.string().url()).min(1),
  sourceArtifacts: z.array(sourceArtifactSchema),
  runtimeConfig: z.array(platformRuntimeConfigEntrySchema).default([]),
  createdByUserId: z.string().min(1),
  ownerEmail: z.string().email(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
