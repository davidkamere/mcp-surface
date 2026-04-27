import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RuntimeSummarySection } from "./runtime-summary-section";

test("runtime summary section renders runtime status and controls", () => {
  const html = renderToStaticMarkup(
    <RuntimeSummarySection
      error={null}
      isLoading={false}
      isMutating={false}
      onStart={async () => {}}
      onStop={async () => {}}
      platformId="platform-1"
      runtime={{
        id: "runtime-1",
        platformId: "platform-1",
        ownerEmail: "user@example.com",
        status: "running",
        executionTarget: "local",
        generatedMcpArtifactId: "mcp-1",
        generatedRuntimeArtifactId: "runtime-artifact-1",
        targetMetadata: {},
        createdAt: "2026-04-24T10:00:00.000Z",
        updatedAt: "2026-04-24T10:00:00.000Z",
        lastStartedAt: "2026-04-24T10:10:00.000Z",
      }}
      showDetailLink={false}
    />,
  );

  assert.match(html, /Execution boundary/);
  assert.match(html, /running/);
  assert.match(html, /Start/);
});
