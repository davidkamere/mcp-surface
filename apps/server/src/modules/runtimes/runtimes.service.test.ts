import assert from "node:assert/strict";
import test from "node:test";
import type {
  ApprovalRequest,
  Capability,
  ExecutionTrace,
  GeneratedMcpArtifact,
  GeneratedRuntimeArtifact,
  Platform,
  WorkspaceRuntime,
} from "@mcpsurface/shared";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { RuntimesService } from "./runtimes.service.js";
import { RuntimeManager } from "./runtime-manager.js";
import { LocalRuntimeAdapter } from "./adapters/local-runtime-adapter.js";
import { CloudflareRuntimeAdapter } from "./adapters/cloudflare-runtime-adapter.js";
import type { RuntimeAdapter } from "./runtime-adapter.js";
import { SharingRepository } from "../sharing/sharing.repository.js";

test("same user reuses the same runtime while different users get isolated runtimes", async () => {
  const service = createService();

  const first = await service.getOrCreateRuntimeForUser("platform-1", "user-1", "one@example.com");
  const second = await service.getOrCreateRuntimeForUser("platform-1", "user-1", "one@example.com");
  const third = await service.getOrCreateRuntimeForUser("platform-1", "user-1", "two@example.com");

  assert.equal(first.id, second.id);
  assert.notEqual(first.id, third.id);
});

test("running docker runtime is reconciled to stopped when its container no longer exists", async () => {
  const dockerAdapter = new RestartAwareDockerAdapter();
  dockerAdapter.running = false;
  const runtimeManager = new RuntimeManager(
    dockerAdapter,
    new LocalRuntimeAdapter(async () =>
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      })),
    new CloudflareRuntimeAdapter(),
  );
  const service = createService(
    {
      runtimes: [
        {
          id: "runtime-1",
          platformId: "platform-1",
          ownerEmail: "one@example.com",
          status: "running",
          executionTarget: "docker",
          generatedMcpArtifactId: "mcp-1",
          generatedRuntimeArtifactId: "runtime-artifact-1",
          targetMetadata: {
            containerId: "missing",
            executionServerVersion: "2026-04-24-runtime-exec-v2",
          },
          createdAt: "2026-04-24T10:00:00.000Z",
          updatedAt: "2026-04-24T10:00:00.000Z",
          lastStartedAt: "2026-04-24T10:00:00.000Z",
        },
      ],
    },
    runtimeManager,
  );

  const runtime = await service.getOrCreateRuntimeForUser("platform-1", "user-1", "one@example.com");

  assert.equal(runtime.status, "stopped");
});

test("existing runtime is refreshed to the latest generated artifacts for the platform", async () => {
  const service = createService({
    runtimes: [
      {
        id: "runtime-1",
        platformId: "platform-1",
        ownerEmail: "one@example.com",
        status: "created",
        executionTarget: "local",
        generatedMcpArtifactId: "mcp-old",
        generatedRuntimeArtifactId: "runtime-artifact-old",
        targetMetadata: {},
        createdAt: "2026-04-24T10:00:00.000Z",
        updatedAt: "2026-04-24T10:00:00.000Z",
      },
    ],
    mcpArtifacts: [
      {
        id: "mcp-old",
        platformId: "platform-1",
        sourceResearchJobId: "job-old",
        artifactType: "mcp",
        version: "mcp-v0",
        capabilityHash: "hash-old",
        capabilityCount: 1,
        generatedAt: "2026-04-24T09:00:00.000Z",
        tools: ["search", "execute"],
        capabilityIndex: [],
        content: "{}",
      },
      {
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
    ],
    runtimeArtifacts: [
      {
        id: "runtime-artifact-old",
        platformId: "platform-1",
        sourceResearchJobId: "job-old",
        artifactType: "runtime",
        version: "runtime-v0",
        capabilityHash: "hash-old",
        capabilityCount: 1,
        generatedAt: "2026-04-24T09:00:00.000Z",
        exportedSymbols: ["createPlatformRuntime"],
        capabilityAccessors: ["listWorkers"],
        content: "export const createPlatformRuntime = () => null;",
      },
      {
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
    ],
  });

  const runtime = await service.getOrCreateRuntimeForUser("platform-1", "user-1", "one@example.com");

  assert.equal(runtime.id, "runtime-1");
  assert.equal(runtime.generatedMcpArtifactId, "mcp-1");
  assert.equal(runtime.generatedRuntimeArtifactId, "runtime-artifact-1");
});

test("runtime creation backfills missing artifacts from the latest completed research job", async () => {
  const service = createService({
    mcpArtifacts: [],
    runtimeArtifacts: [],
    capabilities: [
      {
        ...createCapability("list-workers", "GET", "read"),
        researchJobId: "job-2",
      },
    ],
    jobs: [
      {
        id: "job-2",
        platformId: "platform-1",
        status: "completed",
        currentStage: "completed",
        stageMessage: "done",
        sourceCount: 1,
        findingCount: 1,
        capabilityCount: 1,
        createdAt: "2026-04-24T11:00:00.000Z",
        updatedAt: "2026-04-24T11:00:00.000Z",
      },
    ],
  });

  const runtime = await service.getOrCreateRuntimeForUser("platform-1", "user-1", "one@example.com");

  assert.equal(runtime.platformId, "platform-1");
  assert.notEqual(runtime.generatedMcpArtifactId, "");
  assert.notEqual(runtime.generatedRuntimeArtifactId, "");
});

test("runtime starts, executes when running, records traces, and stops", async () => {
  const service = createService();
  const runtime = await service.getOrCreateRuntimeForUser("platform-1", "user-1", "one@example.com");
  const started = await service.startRuntime(runtime.id, "user-1", "one@example.com");

  assert.equal(started.status, "running");

  const execution = await service.executeRuntime(runtime.id, "user-1", "one@example.com", {
    capabilityKey: "list-workers",
    input: {},
  });

  assert.equal(execution.outcome, "executed");
  assert.ok(execution.trace);
  assert.equal(execution.trace.status, "success");
  assert.equal(execution.trace.executionTarget, started.executionTarget);
  assert.equal(execution.trace.source, "chat");

  const traces = await service.listRuntimeTraces(runtime.id, "user-1", "one@example.com");
  assert.equal(traces.length, 1);

  const stopped = await service.stopRuntime(runtime.id, "user-1", "one@example.com");
  assert.equal(stopped.status, "stopped");
});

test("execution fails when runtime is stopped", async () => {
  const service = createService();
  const runtime = await service.getOrCreateRuntimeForUser("platform-1", "user-1", "one@example.com");

  await assert.rejects(
    () =>
      service.executeRuntime(runtime.id, "user-1", "one@example.com", {
        capabilityKey: "list-workers",
        input: {},
      }),
    /Runtime must be running/,
  );
});

test("non-root user executes read capability immediately", async () => {
  const service = createService({
    platforms: [
      createPlatform("owner@example.com", "user-2"),
    ],
    runtimes: [
      createRuntime("runtime-2", "reader@example.com", "running"),
    ],
    capabilities: [
      createCapability("read-workers", "GET", "read"),
    ],
  });

  const execution = await service.executeRuntime("runtime-2", "user-2", "reader@example.com", {
    capabilityKey: "read-workers",
    input: {},
  });

  assert.equal(execution.outcome, "executed");
  assert.equal(execution.trace?.status, "success");
});

test("non-root user executing write capability creates pending approval without trace", async () => {
  const service = createService({
    platforms: [
      createPlatform("owner@example.com", "user-2"),
    ],
    runtimes: [
      createRuntime("runtime-2", "writer@example.com", "running"),
    ],
    capabilities: [
      createCapability("update-worker", "PUT", "write"),
    ],
  });

  const result = await service.executeRuntime("runtime-2", "user-2", "writer@example.com", {
    capabilityKey: "update-worker",
    input: {
      body: { ok: true },
    },
  });

  assert.equal(result.outcome, "approval_pending");
  assert.equal(result.approval?.status, "pending");
  const traces = await service.listRuntimeTraces("runtime-2", "user-2", "writer@example.com");
  assert.equal(traces.length, 0);
});

test("root approval executes pending request in requester runtime and links trace", async () => {
  const approvalsRepository = new InMemoryApprovalsRepository();
  const service = createService(
    {
      platforms: [
        createPlatform("owner@example.com", "user-2"),
      ],
      runtimes: [
        createRuntime("runtime-owner", "owner@example.com", "running"),
        createRuntime("runtime-requester", "writer@example.com", "running"),
      ],
      capabilities: [
        createCapability("update-worker", "PUT", "write"),
      ],
    },
    undefined,
    approvalsRepository,
  );
  const approvalsService = new ApprovalsService(
    approvalsRepository,
    new InMemoryPlatformsRepository([createPlatform("owner@example.com", "user-2")]),
  );

  const pending = await service.executeRuntime("runtime-requester", "user-2", "writer@example.com", {
    capabilityKey: "update-worker",
    input: {
      body: { ok: true },
    },
  });

  assert.equal(pending.outcome, "approval_pending");
  const approvalId = pending.approval?.id;
  assert.ok(approvalId);

  const approved = await approvalsService.approveRequest({
    approvalId,
    currentUserEmail: "owner@example.com",
    executeApprovedCapability: (approval) => service.executeApprovedCapability(approval, "owner@example.com"),
  });

  assert.equal(approved.approval.status, "approved");
  assert.equal(approved.runtime.ownerEmail, "writer@example.com");
  assert.equal(approved.trace.runtimeId, "runtime-requester");
  assert.equal(approved.approval.traceId, approved.trace.id);
  assert.equal(approved.trace.approvalRequestId, approved.approval.id);
});

test("root rejection marks request rejected without execution", async () => {
  const approvalsRepository = new InMemoryApprovalsRepository();
  const service = createService(
    {
      platforms: [
        createPlatform("owner@example.com", "user-2"),
      ],
      runtimes: [
        createRuntime("runtime-requester", "writer@example.com", "running"),
      ],
      capabilities: [
        createCapability("update-worker", "PUT", "write"),
      ],
    },
    undefined,
    approvalsRepository,
  );
  const approvalsService = new ApprovalsService(
    approvalsRepository,
    new InMemoryPlatformsRepository([createPlatform("owner@example.com", "user-2")]),
  );

  const pending = await service.executeRuntime("runtime-requester", "user-2", "writer@example.com", {
    capabilityKey: "update-worker",
    input: {
      body: { ok: true },
    },
  });

  const rejected = await approvalsService.rejectRequest({
    approvalId: pending.approval!.id,
    currentUserEmail: "owner@example.com",
  });

  assert.equal(rejected.status, "rejected");
  const traces = await service.listRuntimeTraces("runtime-requester", "user-2", "writer@example.com");
  assert.equal(traces.length, 0);
});

test("non-root user cannot approve or reject", async () => {
  const approvalsRepository = new InMemoryApprovalsRepository();
  const platform = createPlatform("owner@example.com");
  const approvalsService = new ApprovalsService(approvalsRepository, new InMemoryPlatformsRepository([platform]));

  await approvalsRepository.saveApprovals([
    {
      id: "approval-1",
      platformId: platform.id,
      runtimeId: "runtime-requester",
      requesterEmail: "writer@example.com",
      approverEmail: "owner@example.com",
      capabilityKey: "update-worker",
      input: {},
      summary: "Update worker",
      riskLevel: "write",
      source: "chat",
      status: "pending",
      createdAt: "2026-04-24T10:00:00.000Z",
    },
  ]);

  await assert.rejects(
    () =>
      approvalsService.approveRequest({
        approvalId: "approval-1",
        currentUserEmail: "writer@example.com",
        executeApprovedCapability: async () => {
          throw new Error("should not execute");
        },
      }),
    /Only the platform owner can approve requests/,
  );

  await assert.rejects(
    () => approvalsService.rejectRequest({
      approvalId: "approval-1",
      currentUserEmail: "writer@example.com",
    }),
    /Only the platform owner can reject requests/,
  );
});

test("cloudflare adapter is present and stubbed", async () => {
  const adapter = new CloudflareRuntimeAdapter();

  await assert.rejects(
    () =>
      adapter.start({
        id: "runtime-1",
        platformId: "platform-1",
        ownerEmail: "user@example.com",
        status: "created",
        executionTarget: "cloudflare",
        generatedMcpArtifactId: "mcp-1",
        generatedRuntimeArtifactId: "runtime-artifact-1",
        targetMetadata: {},
        createdAt: "2026-04-24T10:00:00.000Z",
        updatedAt: "2026-04-24T10:00:00.000Z",
      }),
    /not implemented/,
  );
});

test("runtime code execution restarts an outdated docker runtime and retries once", async () => {
  const dockerAdapter = new RestartAwareDockerAdapter();
  const runtimeManager = new RuntimeManager(
    dockerAdapter,
    new LocalRuntimeAdapter(async () =>
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      })),
    new CloudflareRuntimeAdapter(),
  );
  const service = createService(
    {
      runtimes: [
        {
          id: "runtime-1",
          platformId: "platform-1",
          ownerEmail: "one@example.com",
          status: "running",
          executionTarget: "docker",
          generatedMcpArtifactId: "mcp-1",
          generatedRuntimeArtifactId: "runtime-artifact-1",
          targetMetadata: {
            executionServerVersion: "old-version",
          },
          createdAt: "2026-04-24T10:00:00.000Z",
          updatedAt: "2026-04-24T10:00:00.000Z",
          lastStartedAt: "2026-04-24T10:00:00.000Z",
        },
      ],
    },
    runtimeManager,
  );

  const execution = await service.executeRuntimeCode("runtime-1", "user-1", "one@example.com", {
    code: "return { ok: true };",
    summary: "Retry outdated runtime",
  });

  assert.equal(execution.outcome, "executed");
  assert.ok(execution.trace);
  assert.equal(execution.trace.status, "success");
  assert.equal(dockerAdapter.startCalls, 1);
  assert.equal(dockerAdapter.stopCalls, 1);
});

function createService(overrides: {
  runtimes?: WorkspaceRuntime[];
  mcpArtifacts?: GeneratedMcpArtifact[];
  runtimeArtifacts?: GeneratedRuntimeArtifact[];
  capabilities?: Capability[];
  jobs?: Array<{
    id: string;
    platformId: string;
    status: "completed";
    currentStage: "completed";
    stageMessage: string;
    sourceCount: number;
    findingCount: number;
    capabilityCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  platforms?: Platform[];
} = {}, runtimeManager?: RuntimeManager, approvalsRepository?: InMemoryApprovalsRepository) {
  const runtimesRepository = new InMemoryRuntimesRepository(overrides.runtimes);
  const generationRepository = new InMemoryGenerationRepository(
    overrides.mcpArtifacts,
    overrides.runtimeArtifacts,
  );
  const researchRepository = new InMemoryResearchRepository(overrides.capabilities, overrides.jobs);
  const platformsRepository = new InMemoryPlatformsRepository(overrides.platforms);
  const resolvedApprovalsRepository = approvalsRepository ?? new InMemoryApprovalsRepository();
  const approvalsService = new ApprovalsService(resolvedApprovalsRepository, platformsRepository);
  const resolvedRuntimeManager =
    runtimeManager ??
    new RuntimeManager(
      { target: "docker", isAvailable: async () => false } as DockerAdapterStub,
      new LocalRuntimeAdapter(async () =>
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        })),
      new CloudflareRuntimeAdapter(),
    );

  return new RuntimesService(
    runtimesRepository,
    generationRepository,
    researchRepository,
    platformsRepository,
    new SharingRepository(),
    approvalsService,
    resolvedRuntimeManager,
  );
}

interface DockerAdapterStub extends RuntimeAdapter {
  isAvailable(): Promise<boolean>;
  isRuntimeRunning(runtime: WorkspaceRuntime): Promise<boolean>;
}

class InMemoryRuntimesRepository {
  runtimes: WorkspaceRuntime[];
  traces: ExecutionTrace[] = [];

  constructor(runtimes: WorkspaceRuntime[] = []) {
    this.runtimes = runtimes;
  }

  async listRuntimes() {
    return this.runtimes;
  }

  async saveRuntimes(runtimes: WorkspaceRuntime[]) {
    this.runtimes = runtimes;
  }

  async listTraces() {
    return this.traces;
  }

  async saveTraces(traces: ExecutionTrace[]) {
    this.traces = traces;
  }
}

class InMemoryGenerationRepository {
  constructor(
    private mcpArtifacts: GeneratedMcpArtifact[] = [
      {
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
    ],
    private runtimeArtifacts: GeneratedRuntimeArtifact[] = [
      {
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
    ],
  ) {}

  async listMcpArtifacts(): Promise<GeneratedMcpArtifact[]> {
    return this.mcpArtifacts;
  }

  async saveMcpArtifacts(artifacts: GeneratedMcpArtifact[]): Promise<void> {
    this.mcpArtifacts = artifacts;
  }

  async listRuntimeArtifacts(): Promise<GeneratedRuntimeArtifact[]> {
    return this.runtimeArtifacts;
  }

  async saveRuntimeArtifacts(artifacts: GeneratedRuntimeArtifact[]): Promise<void> {
    this.runtimeArtifacts = artifacts;
  }
}

class InMemoryResearchRepository {
  constructor(
    private readonly capabilities: Capability[] = [createCapability("list-workers", "GET", "read")],
    private readonly jobs = [
      {
        id: "job-1",
        platformId: "platform-1",
        status: "completed" as const,
        currentStage: "completed" as const,
        stageMessage: "done",
        sourceCount: 1,
        findingCount: 1,
        capabilityCount: 1,
        createdAt: "2026-04-24T10:00:00.000Z",
        updatedAt: "2026-04-24T10:00:00.000Z",
      },
    ],
    private readonly sources = [],
    private readonly findings = [],
  ) {}

  async listJobs() {
    return this.jobs;
  }

  async listSources() {
    return this.sources;
  }

  async saveSources() {}

  async listFindings() {
    return this.findings;
  }

  async saveFindings() {}

  async listCapabilities(): Promise<Capability[]> {
    return this.capabilities;
  }

  async saveCapabilities() {}
}

class InMemoryPlatformsRepository {
  constructor(private readonly platforms: Platform[] = [createPlatform("one@example.com")]) {}

  async list(): Promise<Platform[]> {
    return this.platforms;
  }
}

class InMemoryApprovalsRepository {
  approvals: ApprovalRequest[] = [];

  async listApprovals() {
    return this.approvals;
  }

  async saveApprovals(approvals: ApprovalRequest[]) {
    this.approvals = approvals;
  }
}

class RestartAwareDockerAdapter implements RuntimeAdapter {
  readonly target = "docker" as const;
  startCalls = 0;
  stopCalls = 0;
  running = true;

  async isAvailable() {
    return true;
  }

  async isRuntimeRunning() {
    return this.running;
  }

  async start(runtime: WorkspaceRuntime) {
    this.startCalls += 1;
    return {
      status: "running" as const,
      targetMetadata: {
        ...runtime.targetMetadata,
        executionServerVersion: "2026-04-24-runtime-exec-v2",
      },
      startedAt: "2026-04-24T10:05:00.000Z",
    };
  }

  async stop(runtime: WorkspaceRuntime) {
    this.stopCalls += 1;
    return {
      status: "stopped" as const,
      targetMetadata: {
        ...runtime.targetMetadata,
      },
      stoppedAt: "2026-04-24T10:04:00.000Z",
    };
  }

  async execute() {
    return {
      output: {
        ok: true,
      },
    };
  }

  async executeCode(runtime: WorkspaceRuntime) {
    if (runtime.targetMetadata.executionServerVersion !== "2026-04-24-runtime-exec-v2") {
      throw new Error("Docker runtime execution server is out of date; restart required.");
    }

    return {
      output: {
        ok: true,
      },
      logs: [],
    };
  }
}

function createPlatform(ownerEmail: string, createdByUserId = "user-1"): Platform {
  return {
    id: "platform-1",
    name: "Cloudflare",
    slug: "cloudflare",
    sourceUrls: [],
    sourceArtifacts: [],
    runtimeConfig: [],
    createdByUserId,
    ownerEmail,
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
  };
}

function createRuntime(id: string, ownerEmail: string, status: WorkspaceRuntime["status"]): WorkspaceRuntime {
  return {
    id,
    platformId: "platform-1",
    ownerEmail,
    status,
    executionTarget: "local",
    generatedMcpArtifactId: "mcp-1",
    generatedRuntimeArtifactId: "runtime-artifact-1",
    targetMetadata: {},
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
  };
}

function createCapability(key: string, method: string, riskLevel: Capability["riskLevel"]): Capability {
  return {
    id: `cap-${key}`,
    platformId: "platform-1",
    researchJobId: "job-1",
    researchSourceIds: ["source-1"],
    key,
    name: key,
    summary: key,
    method,
    path: `/capabilities/${key}`,
    parameters: [],
    authRequired: false,
    authSchemes: [],
    tags: [],
    examples: [],
    riskLevel,
    approvalMode: riskLevel === "read" ? "none" : "root_approval_required",
    provenance: ["https://example.com"],
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:00:00.000Z",
  };
}
