import { z } from "zod";
import { runtimeExecutionTargets, workspaceRuntimeStatuses } from "../domain/WorkspaceRuntime";

export const workspaceRuntimeSchema = z.object({
  id: z.string().min(1),
  platformId: z.string().min(1),
  ownerEmail: z.string().email(),
  status: z.enum(workspaceRuntimeStatuses),
  executionTarget: z.enum(runtimeExecutionTargets),
  generatedMcpArtifactId: z.string().min(1),
  generatedRuntimeArtifactId: z.string().min(1),
  targetMetadata: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastStartedAt: z.string().datetime().optional(),
  lastStoppedAt: z.string().datetime().optional(),
});
