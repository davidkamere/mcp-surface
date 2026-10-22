import assert from "node:assert/strict";
import test from "node:test";
import type { Capability, GeneratedRuntimeArtifact } from "@mcpsurface/shared";
import { executeRuntimeCodeHarness } from "./runtime-code-harness.js";

test("runtime code harness executes real capability HTTP calls through the generated runtime surface", async () => {
    const capabilities: Capability[] = [
        {
            id: "cap-1",
            platformId: "platform-1",
            researchJobId: "job-1",
            researchSourceIds: ["source-1"],
            key: "get-accounts-account-id-workers-scripts-script-name",
            name: "Get Worker script",
            summary: "Get Worker script",
            method: "GET",
            path: "/accounts/{account_id}/workers/scripts/{script_name}",
            parameters: [
                { name: "account_id", in: "path", required: true, type: "string" },
                { name: "script_name", in: "path", required: true, type: "string" },
            ],
            authRequired: false,
            authSchemes: [],
            tags: ["workers"],
            riskLevel: "read",
            approvalMode: "none",
            provenance: ["https://developers.cloudflare.com/api/"],
            createdAt: "2026-04-24T12:00:00.000Z",
            updatedAt: "2026-04-24T12:00:00.000Z",
        },
    ];
    const runtimeArtifact: GeneratedRuntimeArtifact = {
        id: "runtime-artifact-1",
        platformId: "platform-1",
        sourceResearchJobId: "job-1",
        artifactType: "runtime",
        version: "runtime-v1",
        capabilityHash: "hash-1",
        capabilityCount: 0,
        generatedAt: "2026-04-24T12:00:00.000Z",
        exportedSymbols: [],
        capabilityAccessors: [],
        content: "",
    };

    const result = await executeRuntimeCodeHarness({
        code: [
            `const output = await runtime.execute({`,
            `  capabilityKey: "get-accounts-account-id-workers-scripts-script-name",`,
            `  input: { account_id: "account-123", script_name: "demo-html" },`,
            `});`,
            `return output;`,
        ].join("\n"),
        capabilities,
        runtimeArtifact,
        executionTarget: "local",
        runtimeId: "runtime-1",
        approvalContext: {
            platformOwnerEmail: "owner@example.com",
            requesterEmail: "owner@example.com",
            summary: "Read worker script",
        },
        fetchImpl: async (url) =>
            new Response(
                "export default { fetch() { return new Response('<body>Hello</body>'); } }",
                {
                    status: 200,
                    headers: {
                        "content-type": "application/javascript",
                    },
                },
            ),
    });

    assert.ok(result.output);
    assert.equal(
        result.output.capabilityKey,
        "get-accounts-account-id-workers-scripts-script-name",
    );
    assert.equal(result.output.statusCode, 200);
    assert.equal(typeof result.output.response, "string");
});

test("runtime code harness exposes URL globals to generated code", async () => {
    const runtimeArtifact: GeneratedRuntimeArtifact = {
        id: "runtime-artifact-1",
        platformId: "platform-1",
        sourceResearchJobId: "job-1",
        artifactType: "runtime",
        version: "runtime-v1",
        capabilityHash: "hash-1",
        capabilityCount: 0,
        generatedAt: "2026-04-24T12:00:00.000Z",
        exportedSymbols: [],
        capabilityAccessors: [],
        content: "",
    };

    const result = await executeRuntimeCodeHarness({
        code: [
            `const url = new URL("https://demo-html.davidkamere.workers.dev");`,
            `return { hostname: url.hostname, scriptName: url.hostname.split(".")[0] };`,
        ].join("\n"),
        capabilities: [],
        runtimeArtifact,
        executionTarget: "local",
        runtimeId: "runtime-1",
        approvalContext: {
            platformOwnerEmail: "owner@example.com",
            requesterEmail: "owner@example.com",
            summary: "Parse URL",
        },
    });

    assert.ok(result.output);
    assert.equal(result.output.hostname, "demo-html.davidkamere.workers.dev");
    assert.equal(result.output.scriptName, "demo-html");
});

test("runtime code harness returns approval pending for non-root write capability execution", async () => {
    const capabilities: Capability[] = [
        {
            id: "cap-2",
            platformId: "platform-1",
            researchJobId: "job-1",
            researchSourceIds: ["source-1"],
            key: "put-worker",
            name: "Put Worker",
            summary: "Update Worker",
            method: "PUT",
            path: "/workers/demo",
            parameters: [],
            authRequired: false,
            authSchemes: [],
            tags: ["workers"],
            riskLevel: "write",
            approvalMode: "root_approval_required",
            provenance: ["https://developers.cloudflare.com/api/"],
            createdAt: "2026-04-24T12:00:00.000Z",
            updatedAt: "2026-04-24T12:00:00.000Z",
        },
    ];
    const runtimeArtifact: GeneratedRuntimeArtifact = {
        id: "runtime-artifact-1",
        platformId: "platform-1",
        sourceResearchJobId: "job-1",
        artifactType: "runtime",
        version: "runtime-v1",
        capabilityHash: "hash-1",
        capabilityCount: 0,
        generatedAt: "2026-04-24T12:00:00.000Z",
        exportedSymbols: [],
        capabilityAccessors: [],
        content: "",
    };

    const result = await executeRuntimeCodeHarness({
        code: `return runtime.execute({ capabilityKey: "put-worker", input: { body: "next" } });`,
        capabilities,
        runtimeArtifact,
        executionTarget: "local",
        runtimeId: "runtime-1",
        approvalContext: {
            platformOwnerEmail: "owner@example.com",
            requesterEmail: "member@example.com",
            summary: "Update the worker",
        },
    });

    assert.equal(result.approval?.capabilityKey, "put-worker");
    assert.equal(result.approval?.riskLevel, "write");
});
