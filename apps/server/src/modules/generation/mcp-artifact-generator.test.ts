import test from "node:test";
import assert from "node:assert/strict";
import type { Capability } from "@mcpsurface/shared";
import { generateMcpArtifact } from "./mcp-artifact-generator.js";

test("generates a compressed MCP artifact with search and execute only", () => {
  const artifact = generateMcpArtifact({
    platformId: "platform-1",
    sourceResearchJobId: "job-1",
    capabilities: [createCapability("listWorkers"), createCapability("createWorker", "write")],
    generatedAt: "2026-04-24T10:00:00.000Z",
  });

  assert.deepEqual(artifact.tools, ["search", "execute"]);
  assert.equal(artifact.capabilityCount, 2);
  assert.equal(artifact.capabilityIndex.length, 2);
  assert.ok(artifact.content.includes('"search"'));
  assert.ok(artifact.content.includes('"execute"'));
});

test("generates the same MCP content and hash for the same capability set", () => {
  const input = {
    platformId: "platform-1",
    sourceResearchJobId: "job-1",
    capabilities: [createCapability("createWorker", "write"), createCapability("listWorkers")],
    generatedAt: "2026-04-24T10:00:00.000Z",
  };

  const first = generateMcpArtifact(input);
  const second = generateMcpArtifact(input);

  assert.equal(first.content, second.content);
  assert.equal(first.capabilityHash, second.capabilityHash);
});

function createCapability(key: string, riskLevel: Capability["riskLevel"] = "read"): Capability {
  return {
    id: key,
    platformId: "platform-1",
    researchJobId: "job-1",
    researchSourceIds: ["source-1"],
    key,
    name: key,
    summary: `${key} summary`,
    description: `${key} description`,
    method: riskLevel === "read" ? "GET" : "POST",
    path: `/${key}`,
    parameters: [],
    authRequired: true,
    authSchemes: ["apiKeyAuth"],
    tags: [],
    examples: [],
    riskLevel,
    approvalMode: riskLevel === "read" ? "none" : "root_approval_required",
    provenance: ["https://example.com"],
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
  };
}
