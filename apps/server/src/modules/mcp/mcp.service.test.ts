import assert from "node:assert/strict";
import test from "node:test";
import type { ApprovalRequest, ExecutionTrace, Platform, WorkspaceRuntime } from "@mcpsurface/shared";
import type { ChatContextSnapshot } from "../chat/chat-context-service.js";
import { McpService } from "./mcp.service.js";

test("root user can create an MCP token and the stored value is hashed", async () => {
  const repository = new InMemoryMcpRepository();
  const service = createService({ repository });

  const result = await service.createToken("platform-1", "owner@example.com", {
    userEmail: "Reader@Example.com",
  });

  assert.ok(result.token.length > 20);
  assert.equal(result.accessToken.userEmail, "reader@example.com");
  assert.equal(repository.tokens.length, 1);
  assert.notEqual(repository.tokens[0]?.token, result.token);
});

test("search returns relevant capabilities and matching findings", async () => {
  const service = createService({
    chatContext: {
      platform: createPlatform(),
      runtime: createRuntime(),
      capabilities: [
        createCapability("list-workers", "List workers", ["https://docs.example.com/workers"]),
        createCapability("list-zones", "List zones", ["https://docs.example.com/zones"]),
      ],
      findings: [
        {
          id: "finding-1",
          platformId: "platform-1",
          researchJobId: "job-1",
          researchSourceId: "source-1",
          kind: "operation_summary",
          title: "Workers API",
          summary: "List worker scripts from the Workers API.",
          evidence: ["GET /workers/scripts"],
          provenanceUrl: "https://docs.example.com/workers",
          createdAt: "2026-04-24T10:00:00.000Z",
        },
      ],
      traces: [],
      logs: [],
      mcpArtifact: {
        id: "mcp-1",
        platformId: "platform-1",
        sourceResearchJobId: "job-1",
        artifactType: "mcp",
        version: "mcp-v1",
        capabilityHash: "hash",
        capabilityCount: 2,
        generatedAt: "2026-04-24T10:00:00.000Z",
        tools: ["search", "execute"],
        capabilityIndex: [],
        content: "{}",
      },
      runtimeArtifact: {
        id: "runtime-artifact-1",
        platformId: "platform-1",
        sourceResearchJobId: "job-1",
        artifactType: "runtime",
        version: "runtime-v1",
        capabilityHash: "hash",
        capabilityCount: 2,
        generatedAt: "2026-04-24T10:00:00.000Z",
        exportedSymbols: ["createPlatformRuntime"],
        capabilityAccessors: ["listWorkers"],
        content: "export const createPlatformRuntime = () => null;",
      },
    },
  });

  const result = await service.search("platform-1", "owner@example.com", "workers");

  assert.equal(result.results[0]?.capability.key, "list-workers");
  assert.equal(result.results[0]?.findings[0]?.title, "Workers API");
});

test("execute reuses runtime execution and records MCP as the source", async () => {
  const runtimesService = new FakeRuntimesService({
    outcome: "executed",
    runtime: createRuntime(),
    trace: createTrace("mcp"),
    output: { ok: true },
  });
  const service = createService({ runtimesService });

  const result = await service.execute("platform-1", "owner@example.com", {
    capabilityKey: "list-workers",
    input: {},
  });

  assert.equal(runtimesService.lastCall?.source, "mcp");
  assert.equal(result.status, "executed");
  assert.equal(result.trace.source, "mcp");
});

test("non-root write execution returns a pending approval instead of bypassing governance", async () => {
  const runtimesService = new FakeRuntimesService({
    outcome: "approval_pending",
    runtime: createRuntime(),
    approval: createApproval("mcp"),
    message: "This action needs approval from the platform owner.",
  });
  const service = createService({ runtimesService });

  const result = await service.execute("platform-1", "reader@example.com", {
    capabilityKey: "update-worker",
    input: {
      body: { html: "<button>test</button>" },
    },
  });

  assert.equal(result.status, "pending_approval");
  assert.equal(result.approval.source, "mcp");
});

test("revoked MCP tokens are no longer valid", async () => {
  const repository = new InMemoryMcpRepository();
  const service = createService({ repository });

  const created = await service.createToken("platform-1", "owner@example.com", {
    userEmail: "reader@example.com",
  });
  await service.revokeToken(created.accessToken.id, "owner@example.com");

  const token = await service.getValidTokenForPlatform("platform-1", created.token);

  assert.equal(token, null);
});

function createService(overrides: {
  repository?: InMemoryMcpRepository;
  runtimesService?: FakeRuntimesService;
  chatContext?: ChatContextSnapshot;
  platforms?: Platform[];
} = {}) {
  const repository = overrides.repository ?? new InMemoryMcpRepository();
  const platformsRepository = new InMemoryPlatformsRepository(overrides.platforms ?? [createPlatform()]);
  const runtimesService = overrides.runtimesService ?? new FakeRuntimesService({
    outcome: "executed",
    runtime: createRuntime(),
    trace: createTrace("mcp"),
    output: { ok: true },
  });
  const chatContextService = new FakeChatContextService(
    overrides.chatContext ?? {
      platform: createPlatform(),
      runtime: createRuntime(),
      capabilities: [createCapability("list-workers", "List workers", ["https://docs.example.com/workers"])],
      findings: [],
      traces: [],
      logs: [],
      mcpArtifact: {
        id: "mcp-1",
        platformId: "platform-1",
        sourceResearchJobId: "job-1",
        artifactType: "mcp",
        version: "mcp-v1",
        capabilityHash: "hash",
        capabilityCount: 1,
        generatedAt: "2026-04-24T10:00:00.000Z",
        tools: ["search", "execute"],
        capabilityIndex: [],
        content: "{}",
      },
      runtimeArtifact: {
        id: "runtime-artifact-1",
        platformId: "platform-1",
        sourceResearchJobId: "job-1",
        artifactType: "runtime",
        version: "runtime-v1",
        capabilityHash: "hash",
        capabilityCount: 1,
        generatedAt: "2026-04-24T10:00:00.000Z",
        exportedSymbols: ["createPlatformRuntime"],
        capabilityAccessors: ["listWorkers"],
        content: "export const createPlatformRuntime = () => null;",
      },
    },
  );

  return new McpService(
    repository,
    platformsRepository,
    runtimesService as unknown as ConstructorParameters<typeof McpService>[2],
    chatContextService as unknown as ConstructorParameters<typeof McpService>[3],
  );
}

class InMemoryMcpRepository {
  tokens: Array<{
    id: string;
    platformId: string;
    userEmail: string;
    token: string;
    createdAt: string;
    revokedAt?: string | undefined;
  }> = [];

  async listTokens() {
    return this.tokens;
  }

  async saveTokens(tokens: typeof this.tokens) {
    this.tokens = tokens;
  }
}

class InMemoryPlatformsRepository {
  constructor(private readonly platforms: Platform[]) {}

  async list() {
    return this.platforms;
  }
}

class FakeChatContextService {
  constructor(private readonly context: ChatContextSnapshot) {}

  async getPlatformContextForEmail() {
    return this.context;
  }
}

class FakeRuntimesService {
  lastCall:
    | {
        platformId: string;
        userEmail: string;
        capabilityKey: string;
        input: Record<string, unknown>;
        source: "mcp";
      }
    | null = null;

  constructor(
    private readonly result:
      | {
          outcome: "executed";
          runtime: WorkspaceRuntime;
          trace: ExecutionTrace;
          output?: Record<string, unknown> | undefined;
        }
      | {
          outcome: "approval_pending";
          runtime: WorkspaceRuntime;
          approval: ApprovalRequest;
          message?: string | undefined;
        },
  ) {}

  async executeRuntimeForExternal(
    platformId: string,
    userEmail: string,
    request: { capabilityKey: string; input: Record<string, unknown> },
    source: "mcp",
  ) {
    this.lastCall = {
      platformId,
      userEmail,
      capabilityKey: request.capabilityKey,
      input: request.input,
      source,
    };
    return this.result;
  }
}

function createPlatform(): Platform {
  return {
    id: "platform-1",
    name: "Cloudflare",
    slug: "cloudflare",
    sourceUrls: [],
    sourceArtifacts: [],
    runtimeConfig: [],
    createdByUserId: "user-1",
    ownerEmail: "owner@example.com",
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
  };
}

function createRuntime(): WorkspaceRuntime {
  return {
    id: "runtime-1",
    platformId: "platform-1",
    ownerEmail: "owner@example.com",
    status: "running",
    executionTarget: "local",
    generatedMcpArtifactId: "mcp-1",
    generatedRuntimeArtifactId: "runtime-artifact-1",
    targetMetadata: {},
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
  };
}

function createCapability(key: string, summary: string, provenance: string[]) {
  return {
    id: `cap-${key}`,
    platformId: "platform-1",
    researchJobId: "job-1",
    researchSourceIds: ["source-1"],
    key,
    name: key,
    summary,
    method: "GET",
    path: `/${key}`,
    parameters: [],
    authRequired: false,
    authSchemes: [],
    tags: ["workers"],
    examples: [],
    riskLevel: "read" as const,
    approvalMode: "none" as const,
    provenance,
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
  };
}

function createTrace(source: "mcp" | "chat"): ExecutionTrace {
  return {
    id: "trace-1",
    platformId: "platform-1",
    runtimeId: "runtime-1",
    executionTarget: "local",
    source,
    capabilityKey: "list-workers",
    input: {},
    output: { ok: true },
    status: "success",
    startedAt: "2026-04-24T10:00:00.000Z",
    completedAt: "2026-04-24T10:00:01.000Z",
  };
}

function createApproval(source: "mcp" | "chat"): ApprovalRequest {
  return {
    id: "approval-1",
    platformId: "platform-1",
    runtimeId: "runtime-1",
    requesterEmail: "reader@example.com",
    approverEmail: "owner@example.com",
    capabilityKey: "update-worker",
    input: {
      body: { html: "<button>test</button>" },
    },
    summary: "Update worker",
    riskLevel: "write",
    source,
    status: "pending",
    createdAt: "2026-04-24T10:00:00.000Z",
  };
}
