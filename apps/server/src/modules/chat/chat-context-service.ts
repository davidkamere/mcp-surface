import type {
    Capability,
    ExecutionTrace,
    GeneratedMcpArtifact,
    GeneratedRuntimeArtifact,
    Platform,
    ResearchFinding,
    WorkspaceRuntime,
} from "@mcpsurface/shared";
import { GenerationRepository } from "../generation/generation.repository.js";
import { PlatformsRepository } from "../platforms/platforms.repository.js";
import { ResearchRepository } from "../research/research.repository.js";
import { RuntimesRepository } from "../runtimes/runtimes.repository.js";
import { RuntimesService } from "../runtimes/runtimes.service.js";
import { SharingRepository } from "../sharing/sharing.repository.js";
import { SharingService } from "../sharing/sharing.service.js";
import type { RuntimeLogEntry } from "./chat-rag.js";

export interface ChatContextSnapshot {
    platform: Platform;
    runtime: WorkspaceRuntime;
    capabilities: Capability[];
    findings: ResearchFinding[];
    traces: ExecutionTrace[];
    logs: RuntimeLogEntry[];
    mcpArtifact: GeneratedMcpArtifact;
    runtimeArtifact: GeneratedRuntimeArtifact;
}

export class ChatContextService {
    private readonly sharingService: SharingService;

    constructor(
        private readonly platformsRepository: PlatformsRepository = new PlatformsRepository(),
        private readonly researchRepository: ResearchRepository = new ResearchRepository(),
        private readonly generationRepository: GenerationRepository = new GenerationRepository(),
        private readonly runtimesRepository: RuntimesRepository = new RuntimesRepository(),
        private readonly runtimesService: RuntimesService = new RuntimesService(
            new RuntimesRepository(),
            new GenerationRepository(),
            new ResearchRepository(),
            new PlatformsRepository(),
            new SharingRepository(),
        ),
        sharingRepository: SharingRepository = new SharingRepository(),
    ) {
        this.sharingService = new SharingService(
            sharingRepository,
            this.platformsRepository,
            this.runtimesService,
        );
    }

    async getPlatformContext(
        platformId: string,
        userId: string,
        userEmail: string,
    ): Promise<ChatContextSnapshot> {
        const platform = await this.sharingService.getAccessiblePlatform(
            platformId,
            userId,
            userEmail,
        );

        if (!platform) {
            throw new Error("Platform not found.");
        }

        const runtime = await this.runtimesService.getOrCreateRuntimeForUser(
            platformId,
            userId,
            userEmail,
        );
        return this.buildSnapshot(platform, runtime);
    }

    async getPlatformContextForEmail(
        platformId: string,
        userEmail: string,
    ): Promise<ChatContextSnapshot> {
        const platforms = await this.platformsRepository.list();
        const platform = platforms.find((entry) => entry.id === platformId);

        if (!platform) {
            throw new Error("Platform not found.");
        }

        const runtime = await this.runtimesService.getOrCreateRuntimeForExternalAccess(
            platformId,
            userEmail,
        );
        return this.buildSnapshot(platform, runtime);
    }

    private async buildSnapshot(
        platform: Platform,
        runtime: WorkspaceRuntime,
    ): Promise<ChatContextSnapshot> {
        const [findings, capabilities, traces, mcpArtifacts, runtimeArtifacts] = await Promise.all([
            this.researchRepository.listFindings(),
            this.researchRepository.listCapabilities(),
            this.runtimesRepository.listTraces(),
            this.generationRepository.listMcpArtifacts(),
            this.generationRepository.listRuntimeArtifacts(),
        ]);
        const mcpArtifact = mcpArtifacts.find(
            (artifact) => artifact.id === runtime.generatedMcpArtifactId,
        );
        const runtimeArtifact = runtimeArtifacts.find(
            (artifact) => artifact.id === runtime.generatedRuntimeArtifactId,
        );

        if (!mcpArtifact || !runtimeArtifact) {
            throw new Error("Generated artifacts are required before chat is available.");
        }

        const surfaceCapabilities = capabilities
            .filter(
                (entry) =>
                    entry.platformId === platform.id &&
                    entry.researchJobId === mcpArtifact.sourceResearchJobId,
            )
            .sort((left, right) => left.key.localeCompare(right.key));
        const surfaceFindings = findings
            .filter(
                (entry) =>
                    entry.platformId === platform.id &&
                    entry.researchJobId === mcpArtifact.sourceResearchJobId,
            )
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        const runtimeTraces = traces
            .filter((entry) => entry.runtimeId === runtime.id)
            .sort((left, right) => right.startedAt.localeCompare(left.startedAt));

        return {
            platform,
            runtime,
            capabilities: surfaceCapabilities,
            findings: surfaceFindings,
            traces: runtimeTraces,
            logs: buildRuntimeLogs(runtime, runtimeTraces),
            mcpArtifact,
            runtimeArtifact,
        };
    }
}

function buildRuntimeLogs(runtime: WorkspaceRuntime, traces: ExecutionTrace[]): RuntimeLogEntry[] {
    const logs: RuntimeLogEntry[] = [];

    if (runtime.lastStartedAt) {
        logs.push({
            id: `${runtime.id}:started`,
            level: "info",
            message: `Runtime ${runtime.id} started on ${runtime.executionTarget}.`,
            createdAt: runtime.lastStartedAt,
        });
    }

    if (runtime.lastStoppedAt) {
        logs.push({
            id: `${runtime.id}:stopped`,
            level: "info",
            message: `Runtime ${runtime.id} stopped.`,
            createdAt: runtime.lastStoppedAt,
        });
    }

    if (typeof runtime.targetMetadata.containerId === "string") {
        logs.push({
            id: `${runtime.id}:container`,
            level: "info",
            message: `Docker container ${runtime.targetMetadata.containerId} is assigned to this runtime.`,
            createdAt: runtime.updatedAt,
        });
    }

    const failedTraces = traces.filter((trace) => trace.status === "failed").slice(0, 3);

    for (const trace of failedTraces) {
        logs.push({
            id: `${trace.id}:error`,
            level: "error",
            message: trace.error ?? `Execution ${trace.capabilityKey} failed.`,
            createdAt: trace.completedAt,
        });
    }

    return logs.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
