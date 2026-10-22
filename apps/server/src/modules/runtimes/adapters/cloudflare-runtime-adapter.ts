import type { WorkspaceRuntime } from "@mcpsurface/shared";
import type {
    RuntimeAdapter,
    RuntimeCodeExecutionRequest,
    RuntimeExecutionRequest,
    RuntimeExecutionResult,
    RuntimeStartResult,
    RuntimeStopResult,
} from "../runtime-adapter.js";

export interface CloudflareRuntimeTargetMetadata {
    accountId?: string;
    apiToken?: string;
    workerName?: string;
}

export class CloudflareRuntimeAdapter implements RuntimeAdapter {
    readonly target = "cloudflare" as const;

    async start(runtime: WorkspaceRuntime): Promise<RuntimeStartResult> {
        throw new Error(
            `Cloudflare runtime adapter is not implemented. Expected target metadata: ${JSON.stringify(
                runtime.targetMetadata satisfies CloudflareRuntimeTargetMetadata,
            )}`,
        );
    }

    async stop(_runtime: WorkspaceRuntime): Promise<RuntimeStopResult> {
        throw new Error("Cloudflare runtime adapter is not implemented.");
    }

    async execute(
        _runtime: WorkspaceRuntime,
        _request: RuntimeExecutionRequest,
    ): Promise<RuntimeExecutionResult> {
        throw new Error("Cloudflare runtime adapter is not implemented.");
    }

    async executeCode(
        _runtime: WorkspaceRuntime,
        _request: RuntimeCodeExecutionRequest,
    ): Promise<RuntimeExecutionResult> {
        throw new Error("Cloudflare runtime adapter is not implemented.");
    }
}
