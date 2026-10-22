import { createHash } from "node:crypto";
import type { Capability, GeneratedMcpArtifact } from "@mcpsurface/shared";
import { createId } from "../../lib/ids.js";

interface GenerateMcpArtifactInput {
    platformId: string;
    sourceResearchJobId: string;
    capabilities: Capability[];
    generatedAt?: string;
}

export function generateMcpArtifact(input: GenerateMcpArtifactInput): GeneratedMcpArtifact {
    const generatedAt = input.generatedAt ?? new Date().toISOString();
    const capabilities = sortCapabilities(filterDeprecatedCapabilities(input.capabilities));
    const capabilityIndex = capabilities.map((capability) => ({
        id: capability.id,
        key: capability.key,
        name: capability.name,
        summary: capability.summary,
        method: capability.method,
        path: capability.path,
        authRequired: capability.authRequired,
        riskLevel: capability.riskLevel,
        parameterNames: capability.parameters.map((parameter) => parameter.name),
    }));
    const capabilityHash = hashValue(
        capabilityIndex.map((entry) => ({
            ...entry,
            parameterNames: [...entry.parameterNames].sort(),
        })),
    );
    const payload = {
        platformId: input.platformId,
        sourceResearchJobId: input.sourceResearchJobId,
        version: "mcp-v1",
        tools: {
            search: {
                description:
                    "Search the capability set to find the most relevant operation to run.",
                inputSchema: {
                    query: "string",
                    authRequired: "boolean?",
                    riskLevel: '"read" | "write" | "destructive" | undefined',
                    limit: "number?",
                },
            },
            execute: {
                description: "Execute a selected capability by key with structured input.",
                inputSchema: {
                    capabilityKey: "string",
                    input: "Record<string, unknown>",
                },
            },
        },
        capabilityIndex,
    };

    return {
        id: createId(),
        platformId: input.platformId,
        sourceResearchJobId: input.sourceResearchJobId,
        artifactType: "mcp",
        version: "mcp-v1",
        capabilityHash,
        capabilityCount: capabilityIndex.length,
        generatedAt,
        tools: ["search", "execute"],
        capabilityIndex,
        content: stableStringify(payload),
    };
}

export function filterDeprecatedCapabilities(capabilities: Capability[]) {
    return capabilities.filter((capability) => !isDeprecatedCapability(capability));
}

export function isDeprecatedCapability(capability: Capability) {
    const text = [
        capability.key,
        capability.name,
        capability.summary,
        capability.description,
        ...(capability.tags ?? []),
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    return /\[deprecated\]|\bdeprecated\b/.test(text);
}

function sortCapabilities(capabilities: Capability[]) {
    return [...capabilities].sort((left, right) => left.key.localeCompare(right.key));
}

function hashValue(value: unknown) {
    return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown) {
    return JSON.stringify(sortValue(value), null, 2);
}

function sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(sortValue);
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, nested]) => [key, sortValue(nested)]),
        );
    }

    return value;
}
