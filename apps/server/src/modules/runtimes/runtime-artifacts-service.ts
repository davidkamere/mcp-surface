import type {
    Capability,
    GeneratedMcpArtifact,
    GeneratedRuntimeArtifact,
    WorkspaceRuntime,
} from "@mcpsurface/shared";
import { generateMcpArtifact } from "../generation/mcp-artifact-generator.js";
import { generateRuntimeArtifact } from "../generation/runtime-artifact-generator.js";

interface GenerationRepositoryPort {
    listMcpArtifacts(): Promise<GeneratedMcpArtifact[]>;
    saveMcpArtifacts(artifacts: GeneratedMcpArtifact[]): Promise<void>;
    listRuntimeArtifacts(): Promise<GeneratedRuntimeArtifact[]>;
    saveRuntimeArtifacts(artifacts: GeneratedRuntimeArtifact[]): Promise<void>;
}

interface ResearchRepositoryPort {
    listJobs(): Promise<
        Array<{ id: string; platformId: string; status: string; updatedAt: string }>
    >;
    listCapabilities(): Promise<Capability[]>;
}

export class RuntimeArtifactsService {
    constructor(
        private readonly generationRepository: GenerationRepositoryPort,
        private readonly researchRepository: ResearchRepositoryPort,
    ) {}

    async loadExecutionDependencies(runtime: WorkspaceRuntime, capabilityKey: string) {
        const dependencies = await this.loadRuntimeArtifacts(runtime);
        const capability = dependencies.capabilities.find((entry) => entry.key === capabilityKey);

        if (!capability) {
            throw new Error("Capability not found in the runtime surface.");
        }

        return { ...dependencies, capability };
    }

    async loadRuntimeArtifacts(runtime: WorkspaceRuntime) {
        const [mcpArtifacts, runtimeArtifacts, capabilities] = await Promise.all([
            this.generationRepository.listMcpArtifacts(),
            this.generationRepository.listRuntimeArtifacts(),
            this.researchRepository.listCapabilities(),
        ]);

        const mcpArtifact = mcpArtifacts.find(
            (artifact) => artifact.id === runtime.generatedMcpArtifactId,
        );
        const runtimeArtifact = runtimeArtifacts.find(
            (artifact) => artifact.id === runtime.generatedRuntimeArtifactId,
        );

        if (!mcpArtifact || !runtimeArtifact) {
            throw new Error("Runtime artifacts are unavailable.");
        }

        return {
            mcpArtifact,
            runtimeArtifact,
            capabilities: capabilities.filter(
                (entry) =>
                    entry.platformId === runtime.platformId &&
                    entry.researchJobId === mcpArtifact.sourceResearchJobId,
            ),
        };
    }

    async resolveLatestArtifacts(platformId: string): Promise<{
        mcpArtifact: GeneratedMcpArtifact | null;
        runtimeArtifact: GeneratedRuntimeArtifact | null;
    }> {
        const [mcpArtifacts, runtimeArtifacts, jobs, capabilities] = await Promise.all([
            this.generationRepository.listMcpArtifacts(),
            this.generationRepository.listRuntimeArtifacts(),
            this.researchRepository.listJobs(),
            this.researchRepository.listCapabilities(),
        ]);
        const latestMcpArtifact =
            mcpArtifacts
                .filter((artifact) => artifact.platformId === platformId)
                .sort((l, r) => r.generatedAt.localeCompare(l.generatedAt))[0] ?? null;
        const latestRuntimeArtifact =
            runtimeArtifacts
                .filter((artifact) => artifact.platformId === platformId)
                .sort((l, r) => r.generatedAt.localeCompare(l.generatedAt))[0] ?? null;

        if (latestMcpArtifact && latestRuntimeArtifact) {
            return { mcpArtifact: latestMcpArtifact, runtimeArtifact: latestRuntimeArtifact };
        }

        const latestCompletedJob = jobs
            .filter((job) => job.platformId === platformId && job.status === "completed")
            .sort((l, r) => r.updatedAt.localeCompare(l.updatedAt))[0];

        if (!latestCompletedJob) {
            return { mcpArtifact: latestMcpArtifact, runtimeArtifact: latestRuntimeArtifact };
        }

        const sourceCapabilities = capabilities.filter(
            (capability) =>
                capability.platformId === platformId &&
                capability.researchJobId === latestCompletedJob.id,
        );

        if (sourceCapabilities.length === 0) {
            return { mcpArtifact: latestMcpArtifact, runtimeArtifact: latestRuntimeArtifact };
        }

        const generatedMcpArtifact = generateMcpArtifact({
            platformId,
            sourceResearchJobId: latestCompletedJob.id,
            capabilities: sourceCapabilities,
        });
        const generatedRuntimeArtifact = generateRuntimeArtifact({
            platformId,
            sourceResearchJobId: latestCompletedJob.id,
            capabilities: sourceCapabilities,
        });

        await Promise.all([
            this.generationRepository.saveMcpArtifacts([
                ...mcpArtifacts.filter(
                    (artifact) =>
                        !(
                            artifact.platformId === platformId &&
                            artifact.sourceResearchJobId === latestCompletedJob.id
                        ),
                ),
                generatedMcpArtifact,
            ]),
            this.generationRepository.saveRuntimeArtifacts([
                ...runtimeArtifacts.filter(
                    (artifact) =>
                        !(
                            artifact.platformId === platformId &&
                            artifact.sourceResearchJobId === latestCompletedJob.id
                        ),
                ),
                generatedRuntimeArtifact,
            ]),
        ]);

        return { mcpArtifact: generatedMcpArtifact, runtimeArtifact: generatedRuntimeArtifact };
    }
}
