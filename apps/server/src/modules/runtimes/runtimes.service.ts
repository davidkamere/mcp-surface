import type {
  ApprovalRequest,
  Capability,
  ExecutionTrace,
  ExecutionTraceSource,
  GeneratedMcpArtifact,
  GeneratedRuntimeArtifact,
  Platform,
  RuntimeCodeExecutionInput,
  RuntimeExecutionInput,
  WorkspaceRuntime,
} from "@mcpsurface/shared";
import { createId } from "../../lib/ids.js";
import { ApprovalsRepository } from "../approvals/approvals.repository.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { requiresApprovalForCapability } from "../approvals/approval-policy.js";
import { RuntimeExecutor } from "./runtime-executor.js";
import { RuntimeManager } from "./runtime-manager.js";
import { SharingRepository } from "../sharing/sharing.repository.js";
import { SharingService } from "../sharing/sharing.service.js";
import { RuntimeArtifactsService } from "./runtime-artifacts-service.js";
import { RuntimeLifecycleService } from "./runtime-lifecycle-service.js";

interface RuntimesRepositoryPort {
  listRuntimes(): Promise<WorkspaceRuntime[]>;
  saveRuntimes(runtimes: WorkspaceRuntime[]): Promise<void>;
  listTraces(): Promise<ExecutionTrace[]>;
  saveTraces(traces: ExecutionTrace[]): Promise<void>;
}

interface GenerationRepositoryPort {
  listMcpArtifacts(): Promise<GeneratedMcpArtifact[]>;
  saveMcpArtifacts(artifacts: GeneratedMcpArtifact[]): Promise<void>;
  listRuntimeArtifacts(): Promise<GeneratedRuntimeArtifact[]>;
  saveRuntimeArtifacts(artifacts: GeneratedRuntimeArtifact[]): Promise<void>;
}

interface ResearchRepositoryPort {
  listJobs(): Promise<Array<{ id: string; platformId: string; status: string; updatedAt: string }>>;
  listCapabilities(): Promise<Capability[]>;
}

interface PlatformsRepositoryPort {
  list(): Promise<Platform[]>;
}

export class RuntimesService {
  private readonly runtimeExecutor: RuntimeExecutor;
  private readonly sharingService: SharingService;
  private readonly artifactsService: RuntimeArtifactsService;
  private readonly lifecycleService: RuntimeLifecycleService;

  constructor(
    private readonly runtimesRepository: RuntimesRepositoryPort,
    private readonly generationRepository: GenerationRepositoryPort,
    private readonly researchRepository: ResearchRepositoryPort,
    private readonly platformsRepository: PlatformsRepositoryPort,
    sharingRepository: SharingRepository = new SharingRepository(),
    private readonly approvalsService: ApprovalsService = new ApprovalsService(new ApprovalsRepository(), platformsRepository),
    private readonly runtimeManager: RuntimeManager = new RuntimeManager(),
  ) {
    this.runtimeExecutor = new RuntimeExecutor(this.runtimeManager);
    this.sharingService = new SharingService(sharingRepository, this.platformsRepository as PlatformsRepositoryPort, this);
    this.artifactsService = new RuntimeArtifactsService(this.generationRepository, this.researchRepository);
    this.lifecycleService = new RuntimeLifecycleService(this.runtimesRepository, this.runtimeManager);
  }

  async getOrCreateRuntimeForUser(platformId: string, userId: string, ownerEmail: string) {
    const platform = await this.loadPlatformForUser(platformId, userId, ownerEmail);
    const [runtimes, artifacts] = await Promise.all([
      this.runtimesRepository.listRuntimes(),
      this.artifactsService.resolveLatestArtifacts(platformId),
    ]);

    const existingRuntime = runtimes.find(
      (runtime) => runtime.platformId === platformId && runtime.ownerEmail === ownerEmail.toLowerCase(),
    );

    if (existingRuntime) {
      const reconciledRuntime = await this.lifecycleService.reconcileRuntimeState(existingRuntime);
      return this.syncRuntimeArtifactsAndEnvironment(reconciledRuntime, runtimes, artifacts, buildPlatformExecutionEnvironment(platform));
    }

    if (!artifacts.mcpArtifact || !artifacts.runtimeArtifact) {
      throw new Error("Generated artifacts are required before creating a runtime.");
    }

    const executionTarget = await this.runtimeManager.resolveDefaultExecutionTarget();
    const now = new Date().toISOString();
    const runtime: WorkspaceRuntime = {
      id: createId(),
      platformId,
      ownerEmail: ownerEmail.toLowerCase(),
      status: "created",
      executionTarget,
      generatedMcpArtifactId: artifacts.mcpArtifact.id,
      generatedRuntimeArtifactId: artifacts.runtimeArtifact.id,
      targetMetadata: {
        executionEnvironment: buildPlatformExecutionEnvironment(platform),
      },
      createdAt: now,
      updatedAt: now,
    };

    await this.runtimesRepository.saveRuntimes([...runtimes, runtime]);
    return runtime;
  }

  async createRuntimeForUser(platformId: string, userId: string, ownerEmail: string) {
    return this.getOrCreateRuntimeForUser(platformId, userId, ownerEmail);
  }

  async getRuntime(runtimeId: string, userId: string, ownerEmail: string) {
    return this.loadRuntimeForUser(runtimeId, userId, ownerEmail);
  }

  async startRuntime(runtimeId: string, userId: string, ownerEmail: string) {
    const runtime = await this.loadRuntimeForUser(runtimeId, userId, ownerEmail);
    return this.lifecycleService.startRuntime(runtime);
  }

  async stopRuntime(runtimeId: string, userId: string, ownerEmail: string) {
    const runtime = await this.loadRuntimeForUser(runtimeId, userId, ownerEmail);
    return this.lifecycleService.stopRuntime(runtime);
  }

  async executeRuntime(
    runtimeId: string,
    userId: string,
    ownerEmail: string,
    request: RuntimeExecutionInput,
    source: ExecutionTraceSource = "chat",
  ) {
    let runtime = await this.loadRuntimeForUser(runtimeId, userId, ownerEmail);
    const platform = await this.loadPlatformForUser(runtime.platformId, userId, ownerEmail);
    const dependencies = await this.artifactsService.loadExecutionDependencies(runtime, request.capabilityKey);
    const approvalDecision = requiresApprovalForCapability({
      platform,
      requesterEmail: ownerEmail,
      capability: dependencies.capability,
    });

    if (approvalDecision.requiresApproval) {
      const approval = await this.approvalsService.createApprovalRequest({
        platform,
        runtime,
        requesterEmail: ownerEmail,
        capability: dependencies.capability,
        executionInput: request.input,
        summary: dependencies.capability.summary || dependencies.capability.name,
        source,
      });

      return { outcome: "approval_pending" as const, runtime, approval, message: "This action needs approval from the platform owner." };
    }

    const execute = async () =>
      this.runtimeExecutor.execute({
        runtime,
        capability: dependencies.capability,
        runtimeArtifact: dependencies.runtimeArtifact,
        mcpArtifact: dependencies.mcpArtifact,
        request,
        source,
      });

    const execution = await this.executeWithRestart(execute, async () => {
      runtime = await this.restartRuntimeForUser(runtime, userId, ownerEmail);
    });
    await this.prependTrace(execution.trace);

    return { outcome: "executed" as const, runtime, trace: execution.trace, output: execution.output };
  }

  async executeRuntimeCode(
    runtimeId: string,
    userId: string,
    ownerEmail: string,
    request: RuntimeCodeExecutionInput,
    source: ExecutionTraceSource = "chat",
  ) {
    let runtime = await this.loadRuntimeForUser(runtimeId, userId, ownerEmail);
    const platform = await this.loadPlatformForUser(runtime.platformId, userId, ownerEmail);
    const execute = async () => {
      const dependencies = await this.artifactsService.loadRuntimeArtifacts(runtime);
      return this.runtimeExecutor.executeCode({
        runtime,
        runtimeArtifact: dependencies.runtimeArtifact,
        mcpArtifact: dependencies.mcpArtifact,
        capabilities: dependencies.capabilities,
        request,
        requesterEmail: ownerEmail,
        platformOwnerEmail: platform.ownerEmail,
        source,
      });
    };

    const execution = await this.executeWithRestart(execute, async () => {
      runtime = await this.restartRuntimeForUser(runtime, userId, ownerEmail);
    });

    if (execution.approval) {
      const dependencies = await this.artifactsService.loadExecutionDependencies(runtime, execution.approval.capabilityKey);
      const approval = await this.approvalsService.createApprovalRequest({
        platform,
        runtime,
        requesterEmail: ownerEmail,
        capability: dependencies.capability,
        executionInput: execution.approval.input,
        summary: execution.approval.summary,
        source,
      });

      return {
        outcome: "approval_pending" as const,
        runtime,
        approval,
        logs: execution.logs,
        message: "This action needs approval from the platform owner.",
      };
    }

    await this.prependTrace(execution.trace!);
    return { outcome: "executed" as const, runtime, trace: execution.trace!, output: execution.output, logs: execution.logs };
  }

  async executeApprovedCapability(approval: ApprovalRequest, approverEmail: string) {
    const runtime = await this.loadRuntimeForApprover(approval.runtimeId, approverEmail);
    const dependencies = await this.artifactsService.loadExecutionDependencies(runtime, approval.capabilityKey);
    const execution = await this.runtimeExecutor.execute({
      runtime,
      capability: dependencies.capability,
      runtimeArtifact: dependencies.runtimeArtifact,
      mcpArtifact: dependencies.mcpArtifact,
      request: { capabilityKey: approval.capabilityKey, input: approval.input },
      source: approval.source,
    });
    const trace: ExecutionTrace = { ...execution.trace, approvalRequestId: approval.id };
    await this.prependTrace(trace);

    return { runtime, trace, output: execution.output };
  }

  async listRuntimeTraces(runtimeId: string, userId: string, ownerEmail: string) {
    const runtime = await this.loadRuntimeForUser(runtimeId, userId, ownerEmail);
    const traces = await this.runtimesRepository.listTraces();
    return traces.filter((trace) => trace.runtimeId === runtime.id).sort((l, r) => r.startedAt.localeCompare(l.startedAt));
  }

  async getOrCreateRuntimeForExternalAccess(platformId: string, userEmail: string) {
    const platform = await this.loadPlatformById(platformId);
    const runtimes = await this.runtimesRepository.listRuntimes();
    const existingRuntime = runtimes.find(
      (runtime) => runtime.platformId === platformId && runtime.ownerEmail === userEmail.toLowerCase(),
    );

    if (existingRuntime) {
      const reconciledRuntime = await this.lifecycleService.reconcileRuntimeState(existingRuntime);
      return this.syncRuntimeArtifactsAndEnvironment(
        reconciledRuntime,
        runtimes,
        await this.artifactsService.resolveLatestArtifacts(platformId),
        buildPlatformExecutionEnvironment(platform),
        false,
      );
    }

    const artifacts = await this.artifactsService.resolveLatestArtifacts(platformId);

    if (!artifacts.mcpArtifact || !artifacts.runtimeArtifact) {
      throw new Error("Generated artifacts are required before creating a runtime.");
    }

    const executionTarget = await this.runtimeManager.resolveDefaultExecutionTarget();
    const now = new Date().toISOString();
    const runtime: WorkspaceRuntime = {
      id: createId(),
      platformId,
      ownerEmail: userEmail.toLowerCase(),
      status: "created",
      executionTarget,
      generatedMcpArtifactId: artifacts.mcpArtifact.id,
      generatedRuntimeArtifactId: artifacts.runtimeArtifact.id,
      targetMetadata: { executionEnvironment: buildPlatformExecutionEnvironment(platform) },
      createdAt: now,
      updatedAt: now,
    };

    await this.runtimesRepository.saveRuntimes([...runtimes, runtime]);
    return runtime;
  }

  async executeRuntimeForExternal(
    platformId: string,
    userEmail: string,
    request: RuntimeExecutionInput,
    source: ExecutionTraceSource,
  ) {
    let runtime = await this.getOrCreateRuntimeForExternalAccess(platformId, userEmail);

    if (runtime.status !== "running") {
      runtime = await this.startRuntimeForExternal(runtime.id, userEmail);
    }

    return this.executeRuntimeForResolvedIdentity(runtime, userEmail, request, source);
  }

  private async executeRuntimeForResolvedIdentity(
    runtime: WorkspaceRuntime,
    requesterEmail: string,
    request: RuntimeExecutionInput,
    source: ExecutionTraceSource,
  ) {
    const platform = await this.loadPlatformById(runtime.platformId);
    const dependencies = await this.artifactsService.loadExecutionDependencies(runtime, request.capabilityKey);
    const approvalDecision = requiresApprovalForCapability({
      platform,
      requesterEmail,
      capability: dependencies.capability,
    });

    if (approvalDecision.requiresApproval) {
      const approval = await this.approvalsService.createApprovalRequest({
        platform,
        runtime,
        requesterEmail,
        capability: dependencies.capability,
        executionInput: request.input,
        summary: dependencies.capability.summary || dependencies.capability.name,
        source,
      });

      return { outcome: "approval_pending" as const, runtime, approval, message: "This action needs approval from the platform owner." };
    }

    let resolvedRuntime = runtime;
    const execute = async () =>
      this.runtimeExecutor.execute({
        runtime: resolvedRuntime,
        capability: dependencies.capability,
        runtimeArtifact: dependencies.runtimeArtifact,
        mcpArtifact: dependencies.mcpArtifact,
        request,
        source,
      });

    const execution = await this.executeWithRestart(execute, async () => {
      resolvedRuntime = await this.startRuntimeForExternal(runtime.id, requesterEmail);
    });
    await this.prependTrace(execution.trace);

    return { outcome: "executed" as const, runtime: resolvedRuntime, trace: execution.trace, output: execution.output };
  }

  private async syncRuntimeArtifactsAndEnvironment(
    runtime: WorkspaceRuntime,
    runtimes: WorkspaceRuntime[],
    artifacts: { mcpArtifact: GeneratedMcpArtifact | null; runtimeArtifact: GeneratedRuntimeArtifact | null },
    executionEnvironment: Record<string, string>,
    requireArtifacts = true,
  ) {
    if (!artifacts.mcpArtifact || !artifacts.runtimeArtifact) {
      if (requireArtifacts) {
        throw new Error("Generated artifacts are required before creating a runtime.");
      }
      return runtime;
    }

    if (
      runtime.generatedMcpArtifactId !== artifacts.mcpArtifact.id ||
      runtime.generatedRuntimeArtifactId !== artifacts.runtimeArtifact.id ||
      !isSameExecutionEnvironment(runtime.targetMetadata.executionEnvironment, executionEnvironment)
    ) {
      const updatedRuntime: WorkspaceRuntime = {
        ...runtime,
        generatedMcpArtifactId: artifacts.mcpArtifact.id,
        generatedRuntimeArtifactId: artifacts.runtimeArtifact.id,
        targetMetadata: { ...runtime.targetMetadata, executionEnvironment },
        updatedAt: new Date().toISOString(),
      };
      const nextRuntimes = runtimes.map((entry) => (entry.id === runtime.id ? updatedRuntime : entry));
      await this.runtimesRepository.saveRuntimes(nextRuntimes);
      return updatedRuntime;
    }

    return runtime;
  }

  private async prependTrace(trace: ExecutionTrace) {
    const traces = await this.runtimesRepository.listTraces();
    await this.runtimesRepository.saveTraces([trace, ...traces]);
  }

  private async executeWithRestart<T>(execute: () => Promise<T>, restart: () => Promise<void>) {
    try {
      return await execute();
    } catch (error) {
      if (!isRuntimeRestartRequired(error)) {
        throw error;
      }

      await restart();
      return execute();
    }
  }

  private async loadRuntimeForUser(runtimeId: string, userId: string, ownerEmail: string) {
    const runtimes = await this.runtimesRepository.listRuntimes();
    const runtime = runtimes.find((entry) => entry.id === runtimeId);

    if (!runtime) {
      throw new Error("Runtime not found.");
    }

    await this.loadPlatformForUser(runtime.platformId, userId, ownerEmail);

    if (runtime.ownerEmail !== ownerEmail.toLowerCase()) {
      throw new Error("Runtime not found.");
    }

    return this.lifecycleService.reconcileRuntimeState(runtime);
  }

  private async loadPlatformForUser(platformId: string, userId: string, ownerEmail: string): Promise<Platform> {
    return this.sharingService.assertPlatformAccess(platformId, userId, ownerEmail);
  }

  private async loadPlatformById(platformId: string) {
    const platforms = await this.platformsRepository.list();
    const platform = platforms.find((entry) => entry.id === platformId);
    if (!platform) {
      throw new Error("Platform not found.");
    }
    return platform;
  }

  private async loadRuntimeForApprover(runtimeId: string, approverEmail: string) {
    const runtimes = await this.runtimesRepository.listRuntimes();
    const runtime = runtimes.find((entry) => entry.id === runtimeId);

    if (!runtime) {
      throw new Error("Runtime not found.");
    }

    const platform = await this.loadPlatformById(runtime.platformId);
    if (platform.ownerEmail.trim().toLowerCase() !== approverEmail.trim().toLowerCase()) {
      throw new Error("Only the platform owner can approve requests.");
    }

    return this.lifecycleService.reconcileRuntimeState(runtime);
  }

  private async loadRuntimeForExternal(runtimeId: string, ownerEmail: string) {
    const runtimes = await this.runtimesRepository.listRuntimes();
    const runtime = runtimes.find((entry) => entry.id === runtimeId);

    if (!runtime || runtime.ownerEmail !== ownerEmail.toLowerCase()) {
      throw new Error("Runtime not found.");
    }

    return this.lifecycleService.reconcileRuntimeState(runtime);
  }

  private async restartRuntimeForUser(runtime: WorkspaceRuntime, userId: string, ownerEmail: string) {
    await this.loadPlatformForUser(runtime.platformId, userId, ownerEmail);
    return this.lifecycleService.restartRuntime(runtime);
  }

  private async startRuntimeForExternal(runtimeId: string, ownerEmail: string) {
    const runtime = await this.loadRuntimeForExternal(runtimeId, ownerEmail);
    return this.lifecycleService.startRuntime(runtime);
  }
}

function isRuntimeRestartRequired(error: unknown) {
  return error instanceof Error && /restart required|out of date/i.test(error.message);
}

function buildPlatformExecutionEnvironment(platform: Platform) {
  return Object.fromEntries(
    platform.runtimeConfig.map((entry) => [entry.key.trim(), entry.value] as const).filter(([key]) => key.length > 0),
  );
}

function isSameExecutionEnvironment(current: unknown, next: Record<string, string>) {
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    return Object.keys(next).length === 0;
  }

  const normalizedCurrent = Object.fromEntries(
    Object.entries(current as Record<string, unknown>).filter(([, value]) => typeof value === "string"),
  );

  return JSON.stringify(normalizedCurrent) === JSON.stringify(next);
}
