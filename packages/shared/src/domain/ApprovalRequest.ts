import type { ExecutionTraceSource } from "./ExecutionTrace";

export const approvalRequestRiskLevels = ["read", "write", "destructive"] as const;
export const approvalRequestStatuses = ["pending", "approved", "rejected"] as const;

export type ApprovalRequestRiskLevel = (typeof approvalRequestRiskLevels)[number];
export type ApprovalRequestStatus = (typeof approvalRequestStatuses)[number];

export interface ApprovalRequest {
    id: string;
    platformId: string;
    runtimeId: string;
    requesterEmail: string;
    approverEmail: string;
    capabilityKey: string;
    input: Record<string, unknown>;
    summary: string;
    riskLevel: ApprovalRequestRiskLevel;
    source: ExecutionTraceSource;
    status: ApprovalRequestStatus;
    traceId?: string | undefined;
    createdAt: string;
    resolvedAt?: string | undefined;
}
