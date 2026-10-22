import type {
    Capability,
    ExecutionTrace,
    ExecutionTraceSource,
    GeneratedMcpArtifact,
    GeneratedRuntimeArtifact,
    RuntimeCodeExecutionInput,
    RuntimeExecutionInput,
    WorkspaceRuntime,
} from "@mcpsurface/shared";
import { createId } from "../../lib/ids.js";
import type { RuntimeManager } from "./runtime-manager.js";

export class RuntimeExecutor {
    constructor(private readonly runtimeManager: RuntimeManager) {}

    async execute(input: {
        runtime: WorkspaceRuntime;
        capability: Capability;
        runtimeArtifact: GeneratedRuntimeArtifact;
        mcpArtifact: GeneratedMcpArtifact;
        request: RuntimeExecutionInput;
        source: ExecutionTraceSource;
    }): Promise<{
        trace: ExecutionTrace;
        output?: Record<string, unknown> | undefined;
    }> {
        if (input.runtime.status !== "running") {
            throw new Error("Runtime must be running before execution.");
        }

        validateCapabilityInput(input.capability, input.request.input);

        const startedAt = new Date().toISOString();
        const adapter = this.runtimeManager.getAdapter(input.runtime);
        const executionResult = await adapter.execute(input.runtime, {
            capability: input.capability,
            input: input.request.input,
            runtimeArtifact: input.runtimeArtifact,
            mcpArtifact: input.mcpArtifact,
        });
        const completedAt = new Date().toISOString();

        const trace: ExecutionTrace = {
            id: createId(),
            platformId: input.runtime.platformId,
            runtimeId: input.runtime.id,
            executionTarget: input.runtime.executionTarget,
            source: input.source,
            capabilityKey: input.capability.key,
            input: input.request.input,
            output: executionResult.output,
            error: executionResult.error,
            status: executionResult.error ? "failed" : "success",
            startedAt,
            completedAt,
        };

        return {
            trace,
            output: executionResult.output,
        };
    }

    async executeCode(input: {
        runtime: WorkspaceRuntime;
        runtimeArtifact: GeneratedRuntimeArtifact;
        mcpArtifact: GeneratedMcpArtifact;
        capabilities: Capability[];
        request: RuntimeCodeExecutionInput;
        requesterEmail: string;
        platformOwnerEmail: string;
        source: ExecutionTraceSource;
    }): Promise<{
        trace?: ExecutionTrace | undefined;
        output?: Record<string, unknown> | undefined;
        logs: string[];
        approval?: import("./runtime-adapter.js").PendingRuntimeApproval | undefined;
    }> {
        if (input.runtime.status !== "running") {
            throw new Error("Runtime must be running before execution.");
        }

        const startedAt = new Date().toISOString();
        const adapter = this.runtimeManager.getAdapter(input.runtime);
        const executionResult = await adapter.executeCode(input.runtime, {
            code: input.request.code,
            summary: input.request.summary,
            runtimeArtifact: input.runtimeArtifact,
            mcpArtifact: input.mcpArtifact,
            capabilities: input.capabilities,
            approvalContext: {
                platformOwnerEmail: input.platformOwnerEmail,
                requesterEmail: input.requesterEmail,
                summary: input.request.summary,
            },
        });
        const completedAt = new Date().toISOString();

        if (executionResult.approval) {
            return {
                approval: executionResult.approval,
                logs: executionResult.logs ?? [],
            };
        }

        const trace: ExecutionTrace = {
            id: createId(),
            platformId: input.runtime.platformId,
            runtimeId: input.runtime.id,
            executionTarget: input.runtime.executionTarget,
            source: input.source,
            capabilityKey: resolveTraceCapabilityKey(executionResult.output),
            input: {
                code: input.request.code,
                summary: input.request.summary ?? "Runtime code execution",
            },
            output: executionResult.output,
            error: executionResult.error,
            status: executionResult.error ? "failed" : "success",
            startedAt,
            completedAt,
        };

        return {
            trace,
            output: executionResult.output,
            logs: executionResult.logs ?? [],
        };
    }
}

function validateCapabilityInput(capability: Capability, input: Record<string, unknown>) {
    const missingRequired = capability.parameters
        .filter((parameter) => parameter.required)
        .map((parameter) => parameter.name)
        .filter((name) => !(name in input));

    if (missingRequired.length > 0) {
        throw new Error(`Missing required input: ${missingRequired.join(", ")}`);
    }
}

function resolveTraceCapabilityKey(output: Record<string, unknown> | undefined) {
    const capabilityKey = output?.capabilityKey;
    return typeof capabilityKey === "string" && capabilityKey.trim().length > 0
        ? capabilityKey
        : "runtime_code_execution";
}
