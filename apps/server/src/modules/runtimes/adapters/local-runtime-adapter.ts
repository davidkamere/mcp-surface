import type {
    RuntimeAdapter,
    RuntimeExecutionRequest,
    RuntimeExecutionResult,
    RuntimeStartResult,
    RuntimeStopResult,
} from "../runtime-adapter.js";
import type { WorkspaceRuntime } from "@mcpsurface/shared";
import { executeRuntimeCodeHarness } from "../runtime-code-harness.js";
import { executeRuntimeHttp } from "../runtime-http-client.js";

export class LocalRuntimeAdapter implements RuntimeAdapter {
    readonly target = "local" as const;

    constructor(private readonly fetchImpl: typeof fetch = fetch) {}

    async start(runtime: WorkspaceRuntime): Promise<RuntimeStartResult> {
        const startedAt = new Date().toISOString();

        return {
            status: "running",
            targetMetadata: {
                ...runtime.targetMetadata,
                mode: "in-process",
            },
            startedAt,
        };
    }

    async stop(runtime: WorkspaceRuntime): Promise<RuntimeStopResult> {
        const stoppedAt = new Date().toISOString();

        return {
            status: "stopped",
            targetMetadata: {
                ...runtime.targetMetadata,
            },
            stoppedAt,
        };
    }

    async execute(
        runtime: WorkspaceRuntime,
        request: RuntimeExecutionRequest,
    ): Promise<RuntimeExecutionResult> {
        const environment = getRuntimeExecutionEnvironment(runtime);
        const output = await executeRuntimeHttp({
            capability: request.capability,
            input: request.input,
            executionTarget: this.target,
            runtimeId: runtime.id,
            ...(environment ? { environment } : {}),
            fetchImpl: this.fetchImpl,
        });

        return { output };
    }

    async executeCode(
        runtime: WorkspaceRuntime,
        request: import("../runtime-adapter.js").RuntimeCodeExecutionRequest,
    ): Promise<RuntimeExecutionResult> {
        const environment = getRuntimeExecutionEnvironment(runtime);
        const result = await executeRuntimeCodeHarness({
            code: request.code,
            capabilities: request.capabilities,
            runtimeArtifact: request.runtimeArtifact,
            executionTarget: this.target,
            runtimeId: runtime.id,
            approvalContext: request.approvalContext,
            ...(environment ? { environment } : {}),
            fetchImpl: this.fetchImpl,
        });

        return {
            output: result.output,
            logs: result.logs,
            approval: result.approval,
        };
    }
}

function getRuntimeExecutionEnvironment(runtime: WorkspaceRuntime) {
    const environment = runtime.targetMetadata.executionEnvironment;
    return environment && typeof environment === "object" && !Array.isArray(environment)
        ? (environment as Record<string, string>)
        : undefined;
}
