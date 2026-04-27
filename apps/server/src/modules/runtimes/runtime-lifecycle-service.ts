import type { WorkspaceRuntime } from "@mcpsurface/shared";
import type { RuntimeManager } from "./runtime-manager.js";

interface RuntimesRepositoryPort {
  listRuntimes(): Promise<WorkspaceRuntime[]>;
  saveRuntimes(runtimes: WorkspaceRuntime[]): Promise<void>;
}

export class RuntimeLifecycleService {
  constructor(
    private readonly runtimesRepository: RuntimesRepositoryPort,
    private readonly runtimeManager: RuntimeManager,
  ) {}

  async startRuntime(runtime: WorkspaceRuntime) {
    const runtimes = await this.runtimesRepository.listRuntimes();
    const runtimeIndex = runtimes.findIndex((entry) => entry.id === runtime.id);

    if (runtime.status === "running") {
      return runtime;
    }

    runtimes[runtimeIndex] = { ...runtime, status: "starting", updatedAt: new Date().toISOString() };
    await this.runtimesRepository.saveRuntimes(runtimes);

    try {
      const result = await this.runtimeManager.getAdapter(runtime).start(runtime);
      const startedRuntime: WorkspaceRuntime = {
        ...runtimes[runtimeIndex]!,
        status: result.status,
        targetMetadata: result.targetMetadata,
        lastStartedAt: result.startedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      runtimes[runtimeIndex] = startedRuntime;
      await this.runtimesRepository.saveRuntimes(runtimes);
      return startedRuntime;
    } catch (error) {
      const failedRuntime: WorkspaceRuntime = {
        ...runtimes[runtimeIndex]!,
        status: "failed",
        targetMetadata: {
          ...runtimes[runtimeIndex]!.targetMetadata,
          lastError: error instanceof Error ? error.message : "Runtime failed to start.",
        },
        updatedAt: new Date().toISOString(),
      };
      runtimes[runtimeIndex] = failedRuntime;
      await this.runtimesRepository.saveRuntimes(runtimes);
      return failedRuntime;
    }
  }

  async stopRuntime(runtime: WorkspaceRuntime) {
    if (runtime.status !== "running" && runtime.status !== "starting") {
      return runtime;
    }

    const runtimes = await this.runtimesRepository.listRuntimes();
    const runtimeIndex = runtimes.findIndex((entry) => entry.id === runtime.id);
    const result = await this.runtimeManager.getAdapter(runtime).stop(runtime);
    const stoppedRuntime: WorkspaceRuntime = {
      ...runtime,
      status: result.status,
      targetMetadata: result.targetMetadata,
      lastStoppedAt: result.stoppedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    runtimes[runtimeIndex] = stoppedRuntime;
    await this.runtimesRepository.saveRuntimes(runtimes);
    return stoppedRuntime;
  }

  async restartRuntime(runtime: WorkspaceRuntime) {
    const stoppedRuntime = await this.stopRuntime(runtime);
    return this.startRuntime(stoppedRuntime);
  }

  async reconcileRuntimeState(runtime: WorkspaceRuntime) {
    if (runtime.executionTarget !== "docker" || runtime.status !== "running") {
      return runtime;
    }

    const adapter = this.runtimeManager.getAdapter(runtime);

    if (!("isRuntimeRunning" in adapter) || typeof adapter.isRuntimeRunning !== "function") {
      return runtime;
    }

    const isRunning = await adapter.isRuntimeRunning(runtime);

    if (isRunning) {
      return runtime;
    }

    const runtimes = await this.runtimesRepository.listRuntimes();
    const reconciledRuntime: WorkspaceRuntime = {
      ...runtime,
      status: "stopped",
      lastStoppedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const nextRuntimes = runtimes.map((entry) => (entry.id === runtime.id ? reconciledRuntime : entry));
    await this.runtimesRepository.saveRuntimes(nextRuntimes);
    return reconciledRuntime;
  }
}
