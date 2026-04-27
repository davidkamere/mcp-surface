import assert from "node:assert/strict";
import test from "node:test";
import type { ExecutionTrace } from "@mcpsurface/shared";
import { resolveTraceCodeReply } from "./chat-intent.js";

test("returns stored runtime code for an execution trace question with a trace id", () => {
  const traces: ExecutionTrace[] = [
    {
      id: "15c83f7a-eee6-4001-b782-0e2809b1bb5c",
      platformId: "platform-1",
      runtimeId: "runtime-1",
      executionTarget: "docker",
      source: "chat",
      capabilityKey: "runtime_code_execution",
      input: {
        code: "const matches = await runtime.search(\"worker\");\nreturn { matches };",
        summary: "Search worker capabilities",
      },
      output: {
        matches: [],
      },
      status: "success",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    },
  ];

  const reply = resolveTraceCodeReply(
    "what code did you write in Execution: 15c83f7a-eee6-4001-b782-0e2809b1bb5c",
    traces,
  );

  assert.ok(reply?.includes("```ts"));
  assert.ok(reply?.includes("runtime.search"));
  assert.ok(reply?.includes("15c83f7a-eee6-4001-b782-0e2809b1bb5c"));
});

test("returns null for non-trace questions", () => {
  const reply = resolveTraceCodeReply("is the runtime running?", []);
  assert.equal(reply, null);
});
