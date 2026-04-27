export const workspaceRuntimeStatuses = [
  "created",
  "starting",
  "running",
  "stopped",
  "failed",
] as const;

export const runtimeExecutionTargets = ["local", "docker", "cloudflare"] as const;

export type WorkspaceRuntimeStatus = (typeof workspaceRuntimeStatuses)[number];
export type RuntimeExecutionTarget = (typeof runtimeExecutionTargets)[number];

export interface WorkspaceRuntime {
  id: string;
  platformId: string;
  ownerEmail: string;
  status: WorkspaceRuntimeStatus;
  executionTarget: RuntimeExecutionTarget;
  generatedMcpArtifactId: string;
  generatedRuntimeArtifactId: string;
  targetMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastStartedAt?: string | undefined;
  lastStoppedAt?: string | undefined;
}
