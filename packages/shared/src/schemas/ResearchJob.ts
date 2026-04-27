import { z } from "zod";
import { researchStatusSchema } from "./ResearchStatus";
import { researchJobStages } from "../domain/ResearchJob";

export const researchJobSchema = z.object({
  id: z.string().min(1),
  platformId: z.string().min(1),
  status: researchStatusSchema,
  currentStage: z.enum(researchJobStages),
  stageMessage: z.string().min(1),
  sourceCount: z.number().int().nonnegative(),
  findingCount: z.number().int().nonnegative(),
  capabilityCount: z.number().int().nonnegative(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
