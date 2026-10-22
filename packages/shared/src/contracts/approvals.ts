import { z } from "zod";
import { approvalRequestSchema } from "../schemas/ApprovalRequest";
import { executionTraceSchema } from "../schemas/ExecutionTrace";
import { workspaceRuntimeSchema } from "../schemas/WorkspaceRuntime";

export const approvalsResponseSchema = z.object({
    approvals: z.array(approvalRequestSchema),
});

export const approvalResponseSchema = z.object({
    approval: approvalRequestSchema,
});

export const approvalResolutionResponseSchema = z.object({
    approval: approvalRequestSchema,
    trace: executionTraceSchema.optional(),
    runtime: workspaceRuntimeSchema.optional(),
    output: z.record(z.unknown()).optional(),
});

export type ApprovalsResponse = z.infer<typeof approvalsResponseSchema>;
export type ApprovalResponse = z.infer<typeof approvalResponseSchema>;
export type ApprovalResolutionResponse = z.infer<typeof approvalResolutionResponseSchema>;
