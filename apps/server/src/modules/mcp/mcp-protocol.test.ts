import assert from "node:assert/strict";
import test from "node:test";
import type { ApprovalRequest, ExecutionTrace } from "@mcpsurface/shared";
import type { McpJsonRpcResponse } from "./mcp-protocol.js";
import { getSupportedMcpProtocolVersion, handleMcpJsonRpcBody } from "./mcp-protocol.js";

test("initialize returns MCP server capabilities and server info", async () => {
    const response = await handleMcpJsonRpcBody({
        body: {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2025-06-18",
                capabilities: {},
                clientInfo: {
                    name: "test-client",
                    version: "1.0.0",
                },
            },
        },
        platformId: "platform-1",
        userEmail: "user@example.com",
        mcpService: new FakeMcpService(),
    });

    assert.equal(Array.isArray(response), false);
    const rpcResponse = response as McpJsonRpcResponse;
    assert.equal(rpcResponse.jsonrpc, "2.0");
    assert.equal(rpcResponse.id, 1);
    assert.equal(rpcResponse.result?.protocolVersion, getSupportedMcpProtocolVersion());
    assert.deepEqual(rpcResponse.result?.capabilities, {
        tools: {
            listChanged: false,
        },
    });
});

test("tools/list exposes MCP tools", async () => {
    const response = await handleMcpJsonRpcBody({
        body: {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/list",
        },
        platformId: "platform-1",
        userEmail: "user@example.com",
        mcpService: new FakeMcpService(),
    });

    assert.equal(Array.isArray(response), false);
    const tools = (response as McpJsonRpcResponse).result?.tools;
    assert.ok(Array.isArray(tools));
    assert.deepEqual(
        tools.map((tool) => (tool as { name: string }).name),
        ["list_capabilities", "search_capabilities", "execute_capability"],
    );
});

test("search_capabilities returns structured tool content", async () => {
    const response = await handleMcpJsonRpcBody({
        body: {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: {
                name: "search_capabilities",
                arguments: {
                    query: "workers",
                },
            },
        },
        platformId: "platform-1",
        userEmail: "user@example.com",
        mcpService: new FakeMcpService(),
    });

    assert.equal(Array.isArray(response), false);
    const result = (response as McpJsonRpcResponse).result as Record<string, unknown>;
    assert.equal(Array.isArray(result.content), true);
    assert.equal((result.structuredContent as { results: unknown[] }).results.length, 1);
});

test("execute_capability returns approval-required tool result when execution is pending approval", async () => {
    const response = await handleMcpJsonRpcBody({
        body: {
            jsonrpc: "2.0",
            id: 4,
            method: "tools/call",
            params: {
                name: "execute_capability",
                arguments: {
                    capabilityKey: "create-worker",
                    input: {
                        name: "demo",
                    },
                },
            },
        },
        platformId: "platform-1",
        userEmail: "user@example.com",
        mcpService: new FakeMcpService({ pendingApproval: true }),
    });

    assert.equal(Array.isArray(response), false);
    const result = (response as McpJsonRpcResponse).result as Record<string, unknown>;
    assert.equal(result.isError, true);
    assert.equal(
        (result.structuredContent as { status: string; approvalRequestId: string })
            .approvalRequestId,
        "approval-1",
    );
});

test("notifications/initialized is accepted without a JSON-RPC response body", async () => {
    const response = await handleMcpJsonRpcBody({
        body: {
            jsonrpc: "2.0",
            method: "notifications/initialized",
        },
        platformId: "platform-1",
        userEmail: "user@example.com",
        mcpService: new FakeMcpService(),
    });

    assert.equal(response, null);
});

class FakeMcpService {
    constructor(private readonly options: { pendingApproval?: boolean } = {}) {}

    async search() {
        return {
            results: [
                {
                    capability: {
                        key: "list-workers",
                        name: "List workers",
                    },
                    summary: "List workers",
                    findings: [
                        {
                            title: "Workers API",
                            summary: "List worker scripts.",
                            provenanceUrl: "https://developers.example.com/workers",
                        },
                    ],
                },
            ],
        };
    }

    async execute(
        _platformId: string,
        _userEmail: string,
        _request: { capabilityKey: string; input: Record<string, unknown> },
    ): Promise<
        | {
              status: "executed";
              trace: ExecutionTrace;
              output?: Record<string, unknown>;
          }
        | {
              status: "pending_approval";
              approvalRequestId: string;
              approval: ApprovalRequest;
          }
    > {
        if (this.options.pendingApproval) {
            return {
                status: "pending_approval",
                approvalRequestId: "approval-1",
                approval: {
                    id: "approval-1",
                    platformId: "platform-1",
                    runtimeId: "runtime-1",
                    requesterEmail: "user@example.com",
                    approverEmail: "owner@example.com",
                    capabilityKey: "create-worker",
                    input: { name: "demo" },
                    summary: "Create worker",
                    status: "pending",
                    riskLevel: "write",
                    source: "mcp",
                    createdAt: "2026-05-24T00:00:00.000Z",
                },
            };
        }

        return {
            status: "executed",
            trace: {
                id: "trace-1",
                platformId: "platform-1",
                runtimeId: "runtime-1",
                executionTarget: "docker",
                source: "mcp",
                capabilityKey: "list-workers",
                input: {},
                output: { ok: true },
                status: "success",
                startedAt: "2026-05-24T00:00:00.000Z",
                completedAt: "2026-05-24T00:00:01.000Z",
            },
            output: { ok: true },
        };
    }
}
