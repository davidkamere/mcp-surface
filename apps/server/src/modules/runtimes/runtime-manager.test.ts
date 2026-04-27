import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeManager } from "./runtime-manager.js";
import { LocalRuntimeAdapter } from "./adapters/local-runtime-adapter.js";
import { CloudflareRuntimeAdapter } from "./adapters/cloudflare-runtime-adapter.js";
import { DockerRuntimeAdapter } from "./adapters/docker-runtime-adapter.js";

test("falls back to local when docker is unavailable", async () => {
  const dockerAdapter = new DockerRuntimeAdapter({
    async run() {
      throw new Error("docker unavailable");
    },
  });
  const runtimeManager = new RuntimeManager(dockerAdapter, new LocalRuntimeAdapter(), new CloudflareRuntimeAdapter());

  assert.equal(await runtimeManager.resolveDefaultExecutionTarget(), "local");
});
