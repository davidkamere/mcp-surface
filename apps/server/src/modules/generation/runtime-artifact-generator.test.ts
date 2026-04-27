import test from "node:test";
import assert from "node:assert/strict";
import type { Capability } from "@mcpsurface/shared";
import { generateRuntimeArtifact } from "./runtime-artifact-generator.js";

test("generates a TypeScript runtime artifact from capabilities", () => {
  const artifact = generateRuntimeArtifact({
    platformId: "platform-1",
    sourceResearchJobId: "job-1",
    capabilities: [createCapability("create-worker-script"), createCapability("list-workers", "read")],
    generatedAt: "2026-04-24T10:00:00.000Z",
  });

  assert.ok(artifact.content.includes("createPlatformRuntime"));
  assert.ok(artifact.content.includes("runtime-v1") === false);
  assert.ok(artifact.capabilityAccessors.includes("createWorkerScript"));
  assert.ok(artifact.capabilityAccessors.includes("listWorkers"));
});

test("generates deterministic runtime source for the same capability set", () => {
  const input = {
    platformId: "platform-1",
    sourceResearchJobId: "job-1",
    capabilities: [createCapability("list-workers", "read"), createCapability("create-worker-script")],
    generatedAt: "2026-04-24T10:00:00.000Z",
  };

  const first = generateRuntimeArtifact(input);
  const second = generateRuntimeArtifact(input);

  assert.equal(first.content, second.content);
  assert.equal(first.capabilityHash, second.capabilityHash);
});

function createCapability(key: string, riskLevel: Capability["riskLevel"] = "write"): Capability {
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
    parameters: [
      {
        name: "account_id",
        in: "path",
        required: true,
        type: "string",
      },
    ],
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
