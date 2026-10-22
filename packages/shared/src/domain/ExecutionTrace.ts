import type { RuntimeExecutionTarget } from "./WorkspaceRuntime";

export const executionTraceStatuses = ["success", "failed"] as const;
export const executionTraceSources = ["chat", "mcp"] as const;

export type ExecutionTraceStatus = (typeof executionTraceStatuses)[number];
export type ExecutionTraceSource = (typeof executionTraceSources)[number];

export interface ExecutionTrace {
    id: string;
    platformId: string;
    runtimeId: string;
    executionTarget: RuntimeExecutionTarget;
    source: ExecutionTraceSource;
    capabilityKey: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown> | undefined;
    error?: string | undefined;
    approvalRequestId?: string | undefined;
    status: ExecutionTraceStatus;
    startedAt: string;
    completedAt: string;
}
