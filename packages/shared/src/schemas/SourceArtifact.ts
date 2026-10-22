import { z } from "zod";
import { sourceArtifactKinds } from "../domain/SourceArtifact";

export const sourceArtifactSchema = z.object({
    id: z.string().min(1),
    platformId: z.string().min(1),
    label: z.string().min(1),
    kind: z.enum(sourceArtifactKinds),
    uri: z.string().min(1),
    mimeType: z.string().optional(),
    createdAt: z.string().datetime(),
});

export const sourceArtifactInputSchema = z.object({
    label: z.string().min(1),
    kind: z.enum(sourceArtifactKinds).default("document"),
    uri: z.string().min(1),
    mimeType: z.string().optional(),
});
