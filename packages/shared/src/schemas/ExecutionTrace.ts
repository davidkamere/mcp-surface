import { z } from "zod";
import { executionTraceSources, executionTraceStatuses } from "../domain/ExecutionTrace";
import { runtimeExecutionTargets } from "../domain/WorkspaceRuntime";

export const executionTraceSchema = z.object({
  id: z.string().min(1),
  platformId: z.string().min(1),
  runtimeId: z.string().min(1),
  executionTarget: z.enum(runtimeExecutionTargets),
  source: z.enum(executionTraceSources),
  capabilityKey: z.string().min(1),
  input: z.record(z.unknown()),
  output: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  approvalRequestId: z.string().min(1).optional(),
  status: z.enum(executionTraceStatuses),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
});
