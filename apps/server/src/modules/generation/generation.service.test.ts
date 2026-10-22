import test from "node:test";
import assert from "node:assert/strict";
import type {
    Capability,
    GenerateArtifactsInput,
    GeneratedMcpArtifact,
    GeneratedRuntimeArtifact,
    Platform,
    ResearchJob,
} from "@mcpsurface/shared";
import {
    GenerationService,
    automaticArtifactGenerationMinimums,
    meetsAutomaticArtifactGenerationMinimums,
} from "./generation.service.js";

test("generates, persists, and retrieves artifacts for a platform", async () => {
    const service = new GenerationService(
        new InMemoryGenerationRepository(),
        new InMemoryResearchRepository([
            {
                id: "job-1",
                platformId: "platform-1",
                status: "completed",
                sourceCount: 1,
                findingCount: 1,
                capabilityCount: 2,
                currentStage: "completed",
                stageMessage: "Completed.",
                createdAt: "2026-04-24T10:00:00.000Z",
                updatedAt: "2026-04-24T10:00:00.000Z",
            },
        ]),
        new InMemoryPlatformsRepository([
            {
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
            },
        ]),
    );

    const generated = await service.generateArtifactsForPlatform(
        "platform-1",
        "user-1",
        {} satisfies GenerateArtifactsInput,
    );
    const latest = await service.getLatestArtifactsForPlatform("platform-1", "user-1");

    assert.deepEqual(generated.mcpArtifact.tools, ["search", "execute"]);
    assert.equal(generated.mcpArtifact.capabilityCount, 1);
    assert.ok(generated.runtimeArtifact.capabilityAccessors.includes("listWorkers"));
    assert.equal(latest.mcpArtifact?.id, generated.mcpArtifact.id);
    assert.equal(latest.runtimeArtifact?.id, generated.runtimeArtifact.id);
});

test("requires useful minimums before automatic artifact generation", () => {
    const belowMinimum = [createCapability("list-workers"), createCapability("get-worker", "read")];
    const eligible = [
        createCapability("list-workers"),
        createCapability("create-worker", "write"),
        createCapability("delete-worker", "destructive"),
    ];

    assert.equal(meetsAutomaticArtifactGenerationMinimums(belowMinimum), false);
    assert.equal(meetsAutomaticArtifactGenerationMinimums(eligible), true);
    assert.equal(automaticArtifactGenerationMinimums.minimumUsefulCapabilities, 3);
});

class InMemoryGenerationRepository {
    public mcpArtifacts: GeneratedMcpArtifact[] = [];
    public runtimeArtifacts: GeneratedRuntimeArtifact[] = [];

    async listMcpArtifacts() {
        return this.mcpArtifacts;
    }

    async saveMcpArtifacts(artifacts: GeneratedMcpArtifact[]) {
        this.mcpArtifacts = artifacts;
    }

    async listRuntimeArtifacts() {
        return this.runtimeArtifacts;
    }

    async saveRuntimeArtifacts(artifacts: GeneratedRuntimeArtifact[]) {
        this.runtimeArtifacts = artifacts;
    }
}

class InMemoryResearchRepository {
    constructor(private readonly jobs: ResearchJob[]) {}

    async listJobs() {
        return this.jobs;
    }

    async listCapabilities(): Promise<Capability[]> {
        return [
            createCapability("list-workers"),
            createCapability("[DEPRECATED]-delete-worker", "destructive"),
        ];
    }
}

class InMemoryPlatformsRepository {
    constructor(private readonly platforms: Platform[]) {}

    async list() {
        return this.platforms;
    }
}

function createCapability(key: string, riskLevel: Capability["riskLevel"] = "read"): Capability {
    return {
        id: key,
        platformId: "platform-1",
        researchJobId: "job-1",
        researchSourceIds: ["source-1"],
        key,
        name: key,
        summary: `${key} summary`,
        description: `${key} description`,
        method: riskLevel === "read" ? "GET" : riskLevel === "destructive" ? "DELETE" : "POST",
        path: `/${key}`,
        parameters: [],
        authRequired: true,
        authSchemes: ["apiKeyAuth"],
        tags: [],
        examples: [],
        riskLevel,
        approvalMode: riskLevel === "read" ? "none" : "root_approval_required",
        provenance: ["https://example.com"],
        createdAt: "2026-04-24T10:00:00.000Z",
        updatedAt: "2026-04-24T10:00:00.000Z",
    };
}
