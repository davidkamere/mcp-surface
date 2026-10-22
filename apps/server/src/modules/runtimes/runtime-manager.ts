import type { RuntimeExecutionTarget, WorkspaceRuntime } from "@mcpsurface/shared";
import { DockerRuntimeAdapter } from "./adapters/docker-runtime-adapter.js";
import { LocalRuntimeAdapter } from "./adapters/local-runtime-adapter.js";
import { CloudflareRuntimeAdapter } from "./adapters/cloudflare-runtime-adapter.js";
import type { RuntimeAdapter } from "./runtime-adapter.js";

interface DockerRuntimeAdapterPort extends RuntimeAdapter {
    isAvailable(): Promise<boolean>;
    isRuntimeRunning(runtime: WorkspaceRuntime): Promise<boolean>;
}

export class RuntimeManager {
    constructor(
        private readonly dockerAdapter: DockerRuntimeAdapterPort = new DockerRuntimeAdapter(),
        private readonly localAdapter: RuntimeAdapter = new LocalRuntimeAdapter(),
        private readonly cloudflareAdapter: RuntimeAdapter = new CloudflareRuntimeAdapter(),
    ) {}

    async resolveDefaultExecutionTarget(): Promise<RuntimeExecutionTarget> {
        return (await this.dockerAdapter.isAvailable()) ? "docker" : "local";
    }

    getAdapter(runtimeOrTarget: WorkspaceRuntime | RuntimeExecutionTarget): RuntimeAdapter {
        const target =
            typeof runtimeOrTarget === "string" ? runtimeOrTarget : runtimeOrTarget.executionTarget;

        switch (target) {
            case "docker":
                return this.dockerAdapter;
            case "local":
                return this.localAdapter;
            case "cloudflare":
                return this.cloudflareAdapter;
            default:
                throw new Error(`Unsupported execution target: ${String(target)}`);
        }
    }
}
