import { createHash } from "node:crypto";
import type { Capability, GeneratedRuntimeArtifact } from "@mcpsurface/shared";
import { createId } from "../../lib/ids.js";
import { filterDeprecatedCapabilities } from "./mcp-artifact-generator.js";

interface GenerateRuntimeArtifactInput {
  platformId: string;
  sourceResearchJobId: string;
  capabilities: Capability[];
  generatedAt?: string;
}

export function generateRuntimeArtifact(input: GenerateRuntimeArtifactInput): GeneratedRuntimeArtifact {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const capabilities = [...filterDeprecatedCapabilities(input.capabilities)].sort((left, right) =>
    left.key.localeCompare(right.key),
  );
  const capabilityAccessors = capabilities.map((capability) => toAccessorName(capability.key));
  const content = renderRuntimeSource(input.platformId, capabilities);
  const capabilityHash = createHash("sha256").update(content).digest("hex");

  return {
    id: createId(),
    platformId: input.platformId,
    sourceResearchJobId: input.sourceResearchJobId,
    artifactType: "runtime",
    version: "runtime-v1",
    capabilityHash,
    capabilityCount: capabilities.length,
    generatedAt,
    exportedSymbols: [
      "CapabilityKey",
      "PlatformRuntime",
      "PlatformRuntimeAdapter",
      "SearchInput",
      "ExecuteInput",
      "createPlatformRuntime",
    ],
    capabilityAccessors,
    content,
  };
}

function renderRuntimeSource(platformId: string, capabilities: Capability[]) {
  const capabilityKeyUnion =
    capabilities.length > 0
      ? capabilities.map((capability) => `'${capability.key}'`).join(" | ")
      : "never";
  const typeBlocks = capabilities.map((capability) => renderCapabilityInputType(capability)).join("\n\n");
  const accessorBlocks = capabilities
    .map((capability) => {
      const accessorName = toAccessorName(capability.key);
      return `      ${accessorName}: (input: CapabilityInputMap['${capability.key}']) =>
        adapter.execute({ capabilityKey: '${capability.key}', input }),`;
    })
    .join("\n");

  return `// Generated runtime artifact for ${platformId}
export type CapabilityKey = ${capabilityKeyUnion};

export interface SearchInput {
  query?: string;
  authRequired?: boolean;
  riskLevel?: 'read' | 'write' | 'destructive';
  limit?: number;
}

export interface ExecuteInput<K extends CapabilityKey = CapabilityKey> {
  capabilityKey: K;
  input: CapabilityInputMap[K];
}

export interface PlatformRuntimeAdapter {
  search(input: SearchInput): Promise<Array<{ key: CapabilityKey; score: number }>>;
  execute<K extends CapabilityKey>(input: ExecuteInput<K>): Promise<unknown>;
}

${typeBlocks}

export interface CapabilityInputMap {
${capabilities.map((capability) => `  '${capability.key}': ${renderCapabilityTypeName(capability.key)};`).join("\n")}
}

export interface PlatformRuntime {
  search(input: SearchInput): Promise<Array<{ key: CapabilityKey; score: number }>>;
  execute<K extends CapabilityKey>(input: ExecuteInput<K>): Promise<unknown>;
  capabilities: {
${capabilities
  .map(
    (capability) =>
      `    ${toAccessorName(capability.key)}(input: CapabilityInputMap['${capability.key}']): Promise<unknown>;`,
  )
  .join("\n")}
  };
}

export function createPlatformRuntime(adapter: PlatformRuntimeAdapter): PlatformRuntime {
  return {
    search: (input) => adapter.search(input),
    execute: (input) => adapter.execute(input),
    capabilities: {
${accessorBlocks}
    },
  };
}`;
}

function renderCapabilityInputType(capability: Capability) {
  const typeName = renderCapabilityTypeName(capability.key);

  if (capability.parameters.length === 0) {
    return `export interface ${typeName} {}`;
  }

  const fields = capability.parameters
    .map((parameter) => {
      const propertyName = isValidIdentifier(parameter.name) ? parameter.name : `'${parameter.name}'`;
      const optionalMarker = parameter.required ? "" : "?";
      const typeName = toTypeScriptType(parameter.type);
      const comment = parameter.description ? `  /** ${parameter.description} */\n` : "";
      return `${comment}  ${propertyName}${optionalMarker}: ${typeName};`;
    })
    .join("\n");

  return `export interface ${typeName} {\n${fields}\n}`;
}

function renderCapabilityTypeName(key: string) {
  return `${toAccessorName(key)}Input`.replace(/^[a-z]/, (value) => value.toUpperCase());
}

function toAccessorName(key: string) {
  const camel = key
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment, index) =>
      index === 0 ? segment.toLowerCase() : segment[0]?.toUpperCase() + segment.slice(1).toLowerCase(),
    )
    .join("");

  return camel && !/^\d/.test(camel) ? camel : `capability${camel[0]?.toUpperCase() ?? ""}${camel.slice(1)}`;
}

function toTypeScriptType(value: string | undefined) {
  switch (value) {
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return "unknown[]";
    case "object":
      return "Record<string, unknown>";
    default:
      return "unknown";
  }
}

function isValidIdentifier(value: string) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}
