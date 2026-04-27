import test from "node:test";
import assert from "node:assert/strict";
import type { ResearchFinding, ResearchSource } from "@mcpsurface/shared";
import { synthesizeCapabilities } from "./capability-synthesizer.js";

test("synthesizes execution-ready capabilities from an OpenAPI source", () => {
  const source = createSource({
    id: "source-openapi",
    sourceType: "openapi",
    url: "https://example.com/openapi.json",
    notes: JSON.stringify({
      openapi: "3.0.0",
      info: { title: "Workers API" },
      paths: {
        "/workers/scripts/{script_name}": {
          get: {
            summary: "Get Worker script",
            parameters: [{ name: "script_name", in: "path", required: true, schema: { type: "string" } }],
            security: [{ apiKeyAuth: [] }],
            tags: ["workers"],
          },
          put: {
            summary: "Create or update Worker script",
            requestBody: {
              required: true,
              description: "Worker script body",
              content: {
                "application/javascript": {
                  schema: { type: "string" },
                },
              },
            },
            security: [{ apiKeyAuth: [] }],
            tags: ["workers"],
          },
          delete: {
            summary: "Delete Worker script",
            security: [{ apiKeyAuth: [] }],
          },
        },
      },
    }),
  });

  const capabilities = synthesizeCapabilities({
    platformId: "platform-1",
    researchJobId: "job-1",
    sources: [source],
    findings: [],
  });

  const getScript = capabilities.find((capability) => capability.method === "GET");
  const putScript = capabilities.find((capability) => capability.method === "PUT");
  const deleteScript = capabilities.find((capability) => capability.method === "DELETE");

  assert.ok(getScript);
  assert.equal(getScript.name, "Get Worker script");
  assert.equal(getScript.path, "/workers/scripts/{script_name}");
  assert.equal(getScript.riskLevel, "read");
  assert.equal(getScript.approvalMode, "none");
  assert.equal(getScript.authRequired, true);
  assert.deepEqual(getScript.authSchemes, ["apiKeyAuth"]);
  assert.deepEqual(getScript.parameters, [
    {
      name: "script_name",
      in: "path",
      required: true,
      type: "string",
      description: undefined,
    },
  ]);

  assert.ok(putScript);
  assert.equal(putScript.riskLevel, "write");
  assert.equal(putScript.approvalMode, "root_approval_required");
  assert.deepEqual(putScript.parameters, [
    {
      name: "body",
      in: "body",
      required: true,
      type: "string",
      description: "Worker script body",
    },
  ]);

  assert.ok(deleteScript);
  assert.equal(deleteScript.riskLevel, "destructive");
  assert.equal(deleteScript.approvalMode, "root_approval_required");
});

test("synthesizes method, path, parameters, and auth from structured endpoint findings", () => {
  const source = createSource({
    id: "source-docs",
    sourceType: "docs",
    url: "https://example.com/reference",
    title: "Reference",
  });

  const findings: ResearchFinding[] = [
    createFinding({
      id: "finding-endpoint",
      researchSourceId: source.id,
      kind: "endpoint",
      title: "POST /accounts/{account_id}/workers/scripts",
      summary: "Create or update Worker script",
      evidence: ["parameters: account_id (path), body (body)", "security: apiKeyAuth"],
      provenanceUrl: source.url,
    }),
    createFinding({
      id: "finding-auth",
      researchSourceId: source.id,
      kind: "authentication",
      title: "Workers API authentication",
      summary: "Authenticated requests require an API token.",
      evidence: ["POST /accounts/{account_id}/workers/scripts: apiKeyAuth"],
      provenanceUrl: source.url,
    }),
  ];

  const capabilities = synthesizeCapabilities({
    platformId: "platform-1",
    researchJobId: "job-2",
    sources: [source],
    findings,
  });
  const capability = capabilities[0];

  assert.equal(capabilities.length, 1);
  assert.ok(capability);
  assert.equal(capability.platformId, "platform-1");
  assert.equal(capability.researchJobId, "job-2");
  assert.deepEqual(capability.researchSourceIds, [source.id]);
  assert.equal(capability.key, "post-accounts-account-id-workers-scripts");
  assert.equal(capability.name, "Create or update Worker script");
  assert.equal(capability.summary, "Create or update Worker script");
  assert.equal(
    capability.description,
    "Create or update Worker script Discovered in Reference. parameters: account_id (path), body (body) | security: apiKeyAuth",
  );
  assert.equal(capability.method, "POST");
  assert.equal(capability.path, "/accounts/{account_id}/workers/scripts");
  assert.deepEqual(capability.parameters, [
    { name: "account_id", in: "path", required: true },
    { name: "body", in: "body", required: false },
  ]);
  assert.equal(capability.authRequired, true);
  assert.deepEqual(capability.authSchemes, ["apiKeyAuth"]);
  assert.deepEqual(capability.tags, ["docs"]);
  assert.deepEqual(capability.examples, []);
  assert.equal(capability.riskLevel, "write");
  assert.equal(capability.approvalMode, "root_approval_required");
  assert.deepEqual(capability.provenance, [source.url]);
  assert.ok(capability.createdAt);
  assert.ok(capability.updatedAt);
});

test("does not turn overview findings into standalone capabilities", () => {
  const source = createSource({
    id: "source-overview",
    sourceType: "docs",
    url: "https://example.com/overview",
    title: "Overview",
  });

  const findings: ResearchFinding[] = [
    createFinding({
      id: "finding-overview",
      researchSourceId: source.id,
      kind: "overview",
      title: "API Reference overview",
      summary: "This page describes the API at a high level.",
      evidence: [],
      provenanceUrl: source.url,
    }),
    createFinding({
      id: "finding-auth",
      researchSourceId: source.id,
      kind: "authentication",
      title: "Authentication guidance detected",
      summary: "Bearer tokens are required.",
      evidence: ["security: bearerAuth"],
      provenanceUrl: source.url,
    }),
  ];

  const capabilities = synthesizeCapabilities({
    platformId: "platform-1",
    researchJobId: "job-3",
    sources: [source],
    findings,
  });

  assert.deepEqual(capabilities, []);
});

function createSource(overrides: Partial<ResearchSource> & Pick<ResearchSource, "id" | "sourceType" | "url">): ResearchSource {
  return {
    id: overrides.id,
    platformId: "platform-1",
    researchJobId: "job-1",
    url: overrides.url,
    title: overrides.title ?? "Source",
    origin: "platform_url",
    sourceType: overrides.sourceType,
    contentType: "application/json",
    status: "parsed",
    notes: overrides.notes,
    createdAt: "2026-04-23T09:00:00.000Z",
  };
}

function createFinding(
  overrides: Partial<ResearchFinding> &
    Pick<ResearchFinding, "id" | "researchSourceId" | "kind" | "title" | "summary" | "provenanceUrl">,
): ResearchFinding {
  return {
    id: overrides.id,
    platformId: "platform-1",
    researchJobId: "job-1",
    researchSourceId: overrides.researchSourceId,
    kind: overrides.kind,
    title: overrides.title,
    summary: overrides.summary,
    evidence: overrides.evidence ?? [],
    provenanceUrl: overrides.provenanceUrl,
    createdAt: "2026-04-23T09:00:00.000Z",
  };
}
