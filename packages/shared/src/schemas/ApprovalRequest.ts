import { z } from "zod";
import { approvalRequestRiskLevels, approvalRequestStatuses } from "../domain/ApprovalRequest";
import { executionTraceSources } from "../domain/ExecutionTrace";

export const approvalRequestSchema = z.object({
    id: z.string().min(1),
    platformId: z.string().min(1),
    runtimeId: z.string().min(1),
    requesterEmail: z.string().email(),
    approverEmail: z.string().email(),
    capabilityKey: z.string().min(1),
    input: z.record(z.unknown()),
    summary: z.string().min(1),
    riskLevel: z.enum(approvalRequestRiskLevels),
    source: z.enum(executionTraceSources),
    status: z.enum(approvalRequestStatuses),
    traceId: z.string().min(1).optional(),
    createdAt: z.string().datetime(),
    resolvedAt: z.string().datetime().optional(),
});
