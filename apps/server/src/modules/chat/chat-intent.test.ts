import assert from "node:assert/strict";
import test from "node:test";
import type { Capability, ChatMessage } from "@mcpsurface/shared";
import {
    buildLowConfidenceClarification,
    rankCapabilitiesForSearch,
    resolveEffectiveUserMessage,
    shouldClarifyLowConfidenceExecution,
} from "./chat-intent.js";

test("resolves workers follow-up messages against the most recent workers.dev URL", () => {
    const history: ChatMessage[] = [
        {
            id: "m1",
            sessionId: "s1",
            platformId: "p1",
            runtimeId: "r1",
            userEmail: "user@example.com",
            role: "user",
            content: "Add a button to https://demo-html.example.workers.dev that says hello",
            attachments: [],
            createdAt: "2026-04-25T10:00:00.000Z",
        },
    ];

    assert.equal(
        resolveEffectiveUserMessage("make the button red", history),
        "For https://demo-html.example.workers.dev, make the button red",
    );
});

test("low-confidence execution requests ask for clarification", () => {
    const capabilities = [
        createCapability("cap-1", {
            name: "Worker overview",
            summary: "General worker overview",
        }),
    ];

    assert.equal(shouldClarifyLowConfidenceExecution("update the worker", capabilities), true);
    assert.match(
        buildLowConfidenceClarification("update the worker", capabilities),
        /low-confidence/i,
    );
});

test("search ranking prefers execution-ready capabilities", () => {
    const ranked = rankCapabilitiesForSearch("worker script", [
        createCapability("worker-overview", {
            name: "Worker script overview",
            summary: "Overview of worker scripts",
        }),
        createCapability("current-worker", {
            name: "Worker script",
            summary: "Current worker script endpoint",
            method: "GET",
            path: "/accounts/{account_id}/workers/scripts/{script_name}",
            parameters: [{ name: "script_name", in: "path", required: true }],
        }),
    ]);

    assert.equal(ranked[0]?.key, "current-worker");
});

function createCapability(key: string, overrides: Partial<Capability> = {}): Capability {
    return {
        id: `cap-${key}`,
        platformId: "platform-1",
        researchJobId: "job-1",
        researchSourceIds: ["source-1"],
        key,
        name: overrides.name ?? key,
        summary: overrides.summary ?? key,
        description: overrides.description,
        method: overrides.method,
        path: overrides.path,
        parameters: overrides.parameters ?? [],
        authRequired: overrides.authRequired ?? false,
        authSchemes: overrides.authSchemes ?? [],
        tags: overrides.tags ?? [],
        examples: overrides.examples ?? [],
        riskLevel: overrides.riskLevel ?? "read",
        approvalMode: overrides.approvalMode ?? "none",
        provenance: overrides.provenance ?? ["https://example.com"],
        createdAt: "2026-04-25T10:00:00.000Z",
        updatedAt: "2026-04-25T10:00:00.000Z",
    };
}
