import type {
  ApprovalRequestRiskLevel,
  Capability,
  GeneratedMcpArtifact,
  GeneratedRuntimeArtifact,
  RuntimeExecutionTarget,
  WorkspaceRuntime,
} from "@mcpsurface/shared";

export interface RuntimeExecutionRequest {
  capability: Capability;
  input: Record<string, unknown>;
  runtimeArtifact: GeneratedRuntimeArtifact;
  mcpArtifact: GeneratedMcpArtifact;
  capabilities?: Capability[] | undefined;
}

export interface RuntimeCodeApprovalContext {
  platformOwnerEmail: string;
  requesterEmail: string;
  summary?: string | undefined;
}

export interface RuntimeCodeExecutionRequest {
  code: string;
  summary?: string | undefined;
  runtimeArtifact: GeneratedRuntimeArtifact;
  mcpArtifact: GeneratedMcpArtifact;
  capabilities: Capability[];
  approvalContext: RuntimeCodeApprovalContext;
}

export interface PendingRuntimeApproval {
  capabilityKey: string;
  input: Record<string, unknown>;
  summary: string;
  riskLevel: ApprovalRequestRiskLevel;
}

export interface RuntimeStartResult {
  status: WorkspaceRuntime["status"];
  targetMetadata: Record<string, unknown>;
  startedAt?: string | undefined;
}

export interface RuntimeStopResult {
  status: WorkspaceRuntime["status"];
  targetMetadata: Record<string, unknown>;
  stoppedAt?: string | undefined;
}

export interface RuntimeExecutionResult {
  output?: Record<string, unknown> | undefined;
  error?: string | undefined;
  logs?: string[] | undefined;
  approval?: PendingRuntimeApproval | undefined;
}

export interface RuntimeAdapter {
  readonly target: RuntimeExecutionTarget;
  start(runtime: WorkspaceRuntime): Promise<RuntimeStartResult>;
  stop(runtime: WorkspaceRuntime): Promise<RuntimeStopResult>;
  execute(runtime: WorkspaceRuntime, request: RuntimeExecutionRequest): Promise<RuntimeExecutionResult>;
  executeCode(runtime: WorkspaceRuntime, request: RuntimeCodeExecutionRequest): Promise<RuntimeExecutionResult>;
}
