import test from "node:test";
import assert from "node:assert/strict";
import { harvestDocsEndpoints } from "./docs-endpoint-harvester.js";

test("harvests explicit HTTP endpoints from docs content", () => {
    const findings = harvestDocsEndpoints({
        title: "Workers API reference",
        url: "https://developers.example.com/api/workers",
        content: `
      <h2>Create or update Worker script</h2>
      <p>Use your API token to authenticate these requests.</p>
      <pre>PUT /accounts/{account_id}/workers/scripts/{script_name}</pre>
      <p>Upload the script body in the request body.</p>

      <h2>Delete Worker script</h2>
      <pre>DELETE /accounts/{account_id}/workers/scripts/{script_name}</pre>
    `,
    });

    assert.equal(findings.length, 2);
    assert.deepEqual(findings[0], {
        kind: "endpoint",
        title: "PUT /accounts/{account_id}/workers/scripts/{script_name}",
        summary: "Create or update Worker script",
        evidence: [
            "parameters: account_id (path), script_name (path)",
            "security: apiKeyAuth",
            "Upload the script body in the request body.",
        ],
        provenanceUrl: "https://developers.example.com/api/workers",
    });
});
