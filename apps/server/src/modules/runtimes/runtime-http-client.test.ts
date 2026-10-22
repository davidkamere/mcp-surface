import assert from "node:assert/strict";
import test from "node:test";
import type { Capability } from "@mcpsurface/shared";
import { executeRuntimeHttp } from "./runtime-http-client.js";

test("executes a real GET capability request with auto-filled account_id", async () => {
    const capability: Capability = {
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
    };

    const output = await executeRuntimeHttp({
        capability,
        input: {
            account_id: "account-123",
            script_name: "demo-html",
        },
        executionTarget: "local",
        runtimeId: "runtime-1",
        fetchImpl: async (url) => {
            assert.equal(
                String(url),
                "https://api.cloudflare.com/client/v4/accounts/account-123/workers/scripts/demo-html",
            );

            return new Response("worker-script", {
                status: 200,
                headers: {
                    "content-type": "application/javascript",
                },
            });
        },
    });

    assert.equal(output.ok, true);
    assert.equal(output.statusCode, 200);
    assert.equal(output.response, "worker-script");
});

test("executes a Worker script update as multipart form data", async () => {
    const capability: Capability = {
        id: "cap-2",
        platformId: "platform-1",
        researchJobId: "job-1",
        researchSourceIds: ["source-1"],
        key: "put-accounts-account-id-workers-scripts-script-name",
        name: "Create or update Worker script",
        summary: "Create or update Worker script",
        method: "PUT",
        path: "/accounts/{account_id}/workers/scripts/{script_name}",
        parameters: [
            { name: "account_id", in: "path", required: true, type: "string" },
            { name: "script_name", in: "path", required: true, type: "string" },
            { name: "body", in: "body", required: true, type: "string" },
        ],
        authRequired: false,
        authSchemes: [],
        tags: ["workers"],
        riskLevel: "write",
        approvalMode: "root_approval_required",
        provenance: ["https://developers.cloudflare.com/api/"],
        createdAt: "2026-04-24T12:00:00.000Z",
        updatedAt: "2026-04-24T12:00:00.000Z",
    };

    let capturedBody: unknown;
    const output = await executeRuntimeHttp({
        capability,
        input: {
            account_id: "account-123",
            script_name: "demo-html",
            body: "export default { fetch() { return new Response('<body>Hello</body>'); } }",
        },
        executionTarget: "local",
        runtimeId: "runtime-1",
        fetchImpl: async (_url, init) => {
            capturedBody = init?.body;
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: {
                    "content-type": "application/json",
                },
            });
        },
    });

    assert.ok(capturedBody instanceof FormData);
    const files = (capturedBody as FormData).get("files");
    const metadata = (capturedBody as FormData).get("metadata");
    assert.ok(files instanceof File);
    assert.equal(files.name, "worker.js");
    assert.equal(typeof metadata, "string");
    assert.match(String(metadata), /main_module/);
    assert.equal(output.statusCode, 200);
    assert.deepEqual(output.response, { success: true });
});
