import { z } from "zod";
import { approvalRequestSchema } from "../schemas/ApprovalRequest";
import { executionTraceSchema } from "../schemas/ExecutionTrace";
import { workspaceRuntimeSchema } from "../schemas/WorkspaceRuntime";

export const createRuntimeInputSchema = z.object({});

export const runtimeExecutionInputSchema = z.object({
  capabilityKey: z.string().min(1),
  input: z.record(z.unknown()).default({}),
});

export const runtimeCodeExecutionInputSchema = z.object({
  code: z.string().trim().min(1),
  summary: z.string().trim().min(1).max(200).optional(),
});

export const runtimeResponseSchema = z.object({
  runtime: workspaceRuntimeSchema,
});

export const runtimeExecutedResponseSchema = z.object({
  outcome: z.literal("executed"),
  runtime: workspaceRuntimeSchema,
  trace: executionTraceSchema,
  output: z.record(z.unknown()).optional(),
});

export const runtimeApprovalPendingResponseSchema = z.object({
  outcome: z.literal("approval_pending"),
  runtime: workspaceRuntimeSchema,
  approval: approvalRequestSchema,
  message: z.string().min(1),
  logs: z.array(z.string()).default([]),
});

export const runtimeExecutionResponseSchema = z.discriminatedUnion("outcome", [
  runtimeExecutedResponseSchema,
  runtimeApprovalPendingResponseSchema,
]);

export const runtimeCodeExecutionResponseSchema = z.discriminatedUnion("outcome", [
  runtimeExecutedResponseSchema.extend({
    logs: z.array(z.string()).default([]),
  }),
  runtimeApprovalPendingResponseSchema,
]);

export const runtimeTracesResponseSchema = z.object({
  traces: z.array(executionTraceSchema),
});

export type CreateRuntimeInput = z.infer<typeof createRuntimeInputSchema>;
export type RuntimeExecutionInput = z.infer<typeof runtimeExecutionInputSchema>;
export type RuntimeCodeExecutionInput = z.infer<typeof runtimeCodeExecutionInputSchema>;
export type RuntimeExecutionResponse = z.infer<typeof runtimeExecutionResponseSchema>;
export type RuntimeCodeExecutionResponse = z.infer<typeof runtimeCodeExecutionResponseSchema>;
