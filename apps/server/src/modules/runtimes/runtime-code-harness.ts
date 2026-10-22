import { Script, createContext } from "node:vm";
import type { Capability, GeneratedRuntimeArtifact } from "@mcpsurface/shared";
import { executeRuntimeHttp } from "./runtime-http-client.js";
import type { PendingRuntimeApproval, RuntimeCodeApprovalContext } from "./runtime-adapter.js";

export interface RuntimeCodeHarnessRequest {
    code: string;
    capabilities: Capability[];
    runtimeArtifact: GeneratedRuntimeArtifact;
    executionTarget: string;
    runtimeId: string;
    approvalContext: RuntimeCodeApprovalContext;
    environment?: Record<string, string>;
    fetchImpl?: typeof fetch;
}

export async function executeRuntimeCodeHarness(input: RuntimeCodeHarnessRequest) {
    const logs: string[] = [];

    const runtime = buildRuntimeFacade({
        capabilities: input.capabilities,
        capabilityAccessors: input.runtimeArtifact.capabilityAccessors,
        executionTarget: input.executionTarget,
        runtimeId: input.runtimeId,
        logs,
        approvalContext: input.approvalContext,
        ...(input.environment ? { environment: input.environment } : {}),
        ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
    });

    const sandbox = createContext({
        runtime,
        URL,
        URLSearchParams,
        Headers,
        Request,
        Response,
        FormData,
        Blob,
        fetch: input.fetchImpl ?? fetch,
        console: {
            log: (...args: unknown[]) => {
                logs.push(args.map(formatConsoleValue).join(" "));
            },
        },
    });

    const wrappedCode = `
    (async () => {
${indentCode(input.code)}
    })()
  `;

    const script = new Script(wrappedCode, {
        filename: "runtime-orchestrator.js",
    });
    try {
        const result = await script.runInContext(sandbox, {
            timeout: 10_000,
        });

        return {
            output: normalizeOutput(result),
            logs,
        };
    } catch (error) {
        if (error instanceof RuntimeApprovalRequiredError) {
            return {
                approval: error.approval,
                logs,
            };
        }

        throw error;
    }
}

function buildRuntimeFacade(input: {
    capabilities: Capability[];
    capabilityAccessors: string[];
    executionTarget: string;
    runtimeId: string;
    logs: string[];
    approvalContext: RuntimeCodeApprovalContext;
    environment?: Record<string, string>;
    fetchImpl?: typeof fetch;
}) {
    const capabilitiesByKey = new Map(
        input.capabilities.map((capability) => [capability.key, capability]),
    );
    const accessors = Object.create(null) as Record<
        string,
        (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
    >;

    for (const capability of input.capabilities) {
        accessors[toAccessorName(capability.key)] = async (payload) =>
            executeCapability(
                capability,
                payload,
                input.executionTarget,
                input.runtimeId,
                input.approvalContext,
            );
    }

    return {
        search: async (query: string) =>
            rankCapabilities(query, input.capabilities).map((capability) => ({
                key: capability.key,
                name: capability.name,
                summary: capability.summary,
                method: capability.method,
                path: capability.path,
                parameters: capability.parameters,
            })),
        execute: async (payload: { capabilityKey: string; input?: Record<string, unknown> }) => {
            const capability = capabilitiesByKey.get(payload.capabilityKey);

            if (!capability) {
                throw new Error(
                    `Capability ${payload.capabilityKey} is not available in this runtime.`,
                );
            }

            return executeCapability(
                capability,
                payload.input ?? {},
                input.executionTarget,
                input.runtimeId,
                input.approvalContext,
                input.fetchImpl,
                input.environment,
            );
        },
        capabilities: accessors,
    };
}

function executeCapability(
    capability: Capability,
    payload: Record<string, unknown>,
    executionTarget: string,
    runtimeId: string,
    approvalContext: RuntimeCodeApprovalContext,
    fetchImpl?: typeof fetch,
    environment?: Record<string, string>,
) {
    const executeInput = {
        capability,
        input: payload,
        executionTarget,
        runtimeId,
        ...(environment ? { environment } : {}),
        ...(fetchImpl ? { fetchImpl } : {}),
    };

    if (
        approvalContext.requesterEmail.trim().toLowerCase() !==
            approvalContext.platformOwnerEmail.trim().toLowerCase() &&
        capability.riskLevel !== "read"
    ) {
        throw new RuntimeApprovalRequiredError({
            capabilityKey: capability.key,
            input: payload,
            summary: approvalContext.summary?.trim() || capability.summary || capability.name,
            riskLevel: capability.riskLevel,
        });
    }

    return executeRuntimeHttp(executeInput);
}

class RuntimeApprovalRequiredError extends Error {
    constructor(readonly approval: PendingRuntimeApproval) {
        super("Approval required.");
    }
}

function rankCapabilities(query: string, capabilities: Capability[]) {
    const terms = query
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean);

    if (terms.length === 0) {
        return capabilities.slice(0, 10);
    }

    return [...capabilities]
        .map((capability) => ({
            capability,
            score: terms.reduce(
                (total, term) => total + (capabilityText(capability).includes(term) ? 1 : 0),
                0,
            ),
        }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)
        .map((entry) => entry.capability)
        .slice(0, 10);
}

function capabilityText(capability: Capability) {
    return [
        capability.key,
        capability.name,
        capability.summary,
        capability.description,
        capability.method,
        capability.path,
        capability.tags?.join(" "),
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
}

function toAccessorName(key: string) {
    const camel = key
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map((segment, index) =>
            index === 0
                ? segment.toLowerCase()
                : segment[0]?.toUpperCase() + segment.slice(1).toLowerCase(),
        )
        .join("");

    return camel && !/^\d/.test(camel)
        ? camel
        : `capability${camel[0]?.toUpperCase() ?? ""}${camel.slice(1)}`;
}

function indentCode(value: string) {
    return value
        .split("\n")
        .map((line) => `      ${line}`)
        .join("\n");
}

function normalizeOutput(value: unknown) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    if (Array.isArray(value)) {
        return { value };
    }

    if (typeof value === "undefined") {
        return { ok: true };
    }

    return { value };
}

function formatConsoleValue(value: unknown) {
    if (typeof value === "string") {
        return value;
    }

    return JSON.stringify(value);
}
