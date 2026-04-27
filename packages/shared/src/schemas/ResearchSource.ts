import { z } from "zod";
import { researchSourceOrigins, researchSourceTypes } from "../domain/ResearchSource";

export const researchSourceSchema = z.object({
  id: z.string().min(1),
  platformId: z.string().min(1),
  researchJobId: z.string().min(1),
  sourceArtifactId: z.string().min(1).optional(),
  url: z.string().min(1),
  title: z.string().min(1),
  origin: z.enum(researchSourceOrigins),
  sourceType: z.enum(researchSourceTypes),
  contentType: z.string().optional(),
  status: z.enum(["discovered", "parsed", "skipped", "failed"]),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
});
