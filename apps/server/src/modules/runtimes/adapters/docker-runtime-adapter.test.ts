import assert from "node:assert/strict";
import test from "node:test";
import type { WorkspaceRuntime } from "@mcpsurface/shared";
import { DockerRuntimeAdapter } from "./docker-runtime-adapter.js";

test("docker adapter start and stop wire container metadata through the lifecycle", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const adapter = new DockerRuntimeAdapter(
        {
            async run(command, args) {
                calls.push({ command, args });

                if (args[0] === "run") {
                    return { stdout: "container-123\n", stderr: "" };
                }

                return { stdout: "stopped\n", stderr: "" };
            },
        },
        async () => 43123,
    );

    const runtime: WorkspaceRuntime = {
        id: "runtime-1",
        platformId: "platform-1",
        ownerEmail: "user@example.com",
        status: "created",
        executionTarget: "docker",
        generatedMcpArtifactId: "mcp-1",
        generatedRuntimeArtifactId: "runtime-artifact-1",
        targetMetadata: {},
        createdAt: "2026-04-24T10:00:00.000Z",
        updatedAt: "2026-04-24T10:00:00.000Z",
    };

    const started = await adapter.start(runtime);
    assert.equal(started.status, "running");
    assert.equal(started.targetMetadata.containerId, "container-123");
    assert.match(String(started.targetMetadata.endpoint), /^http:\/\/127\.0\.0\.1:/);

    const stopped = await adapter.stop({
        ...runtime,
        targetMetadata: started.targetMetadata,
    });
    assert.equal(stopped.status, "stopped");
    assert.equal(calls.length, 2);
});

test("docker adapter treats missing containers as already stopped", async () => {
    const adapter = new DockerRuntimeAdapter({
        async run(_command, args) {
            if (args[0] === "stop") {
                throw new Error("Error response from daemon: No such container: missing-container");
            }

            return { stdout: "", stderr: "" };
        },
    });

    const stopped = await adapter.stop({
        id: "runtime-1",
        platformId: "platform-1",
        ownerEmail: "user@example.com",
        status: "running",
        executionTarget: "docker",
        generatedMcpArtifactId: "mcp-1",
        generatedRuntimeArtifactId: "runtime-artifact-1",
        targetMetadata: {
            containerId: "missing-container",
        },
        createdAt: "2026-04-24T10:00:00.000Z",
        updatedAt: "2026-04-24T10:00:00.000Z",
    });

    assert.equal(stopped.status, "stopped");
});
