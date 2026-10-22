import type {
    Capability,
    GenerateArtifactsInput,
    GeneratedMcpArtifact,
    GeneratedRuntimeArtifact,
    Platform,
    ResearchJob,
} from "@mcpsurface/shared";
import { filterDeprecatedCapabilities } from "./mcp-artifact-generator.js";
import { generateMcpArtifact } from "./mcp-artifact-generator.js";
import { generateRuntimeArtifact } from "./runtime-artifact-generator.js";

export const automaticArtifactGenerationMinimums = {
    minimumUsefulCapabilities: 3,
    minimumEndpointReadyCapabilities: 2,
} as const;

interface GenerationRepositoryPort {
    listMcpArtifacts(): Promise<GeneratedMcpArtifact[]>;
    saveMcpArtifacts(artifacts: GeneratedMcpArtifact[]): Promise<void>;
    listRuntimeArtifacts(): Promise<GeneratedRuntimeArtifact[]>;
    saveRuntimeArtifacts(artifacts: GeneratedRuntimeArtifact[]): Promise<void>;
}

interface ResearchRepositoryPort {
    listJobs(): Promise<ResearchJob[]>;
    listCapabilities(): Promise<Capability[]>;
}

interface PlatformsRepositoryPort {
    list(): Promise<Platform[]>;
}

export function meetsAutomaticArtifactGenerationMinimums(capabilities: Capability[]) {
    const usefulCapabilities = filterDeprecatedCapabilities(capabilities);
    const endpointReadyCount = usefulCapabilities.filter((capability) =>
        Boolean(capability.method && capability.path),
    ).length;

    return (
        usefulCapabilities.length >=
            automaticArtifactGenerationMinimums.minimumUsefulCapabilities &&
        endpointReadyCount >= automaticArtifactGenerationMinimums.minimumEndpointReadyCapabilities
    );
}

export class GenerationService {
    constructor(
        private readonly generationRepository: GenerationRepositoryPort,
        private readonly researchRepository: ResearchRepositoryPort,
        private readonly platformsRepository: PlatformsRepositoryPort,
    ) {}

    async generateArtifactsForPlatform(
        platformId: string,
        userId: string,
        input: GenerateArtifactsInput,
    ): Promise<{
        mcpArtifact: GeneratedMcpArtifact;
        runtimeArtifact: GeneratedRuntimeArtifact;
    }> {
        await this.loadPlatformForUser(platformId, userId);
        const [jobs, capabilities, existingMcpArtifacts, existingRuntimeArtifacts] =
            await Promise.all([
                this.researchRepository.listJobs(),
                this.researchRepository.listCapabilities(),
                this.generationRepository.listMcpArtifacts(),
                this.generationRepository.listRuntimeArtifacts(),
            ]);

        const sourceJob = this.resolveSourceJob(platformId, jobs, input.sourceResearchJobId);
        const sourceCapabilities = capabilities.filter(
            (capability) =>
                capability.platformId === platformId && capability.researchJobId === sourceJob.id,
        );

        if (sourceCapabilities.length === 0) {
            throw new Error("No capabilities available for artifact generation.");
        }

        const mcpArtifact = generateMcpArtifact({
            platformId,
            sourceResearchJobId: sourceJob.id,
            capabilities: sourceCapabilities,
        });
        const runtimeArtifact = generateRuntimeArtifact({
            platformId,
            sourceResearchJobId: sourceJob.id,
            capabilities: sourceCapabilities,
        });

        await this.generationRepository.saveMcpArtifacts([
            ...existingMcpArtifacts.filter(
                (artifact) =>
                    !(
                        artifact.platformId === platformId &&
                        artifact.sourceResearchJobId === sourceJob.id
                    ),
            ),
            mcpArtifact,
        ]);
        await this.generationRepository.saveRuntimeArtifacts([
            ...existingRuntimeArtifacts.filter(
                (artifact) =>
                    !(
                        artifact.platformId === platformId &&
                        artifact.sourceResearchJobId === sourceJob.id
                    ),
            ),
            runtimeArtifact,
        ]);

        return {
            mcpArtifact,
            runtimeArtifact,
        };
    }

    async getLatestArtifactsForPlatform(platformId: string, userId: string) {
        await this.loadPlatformForUser(platformId, userId);
        const [mcpArtifacts, runtimeArtifacts] = await Promise.all([
            this.generationRepository.listMcpArtifacts(),
            this.generationRepository.listRuntimeArtifacts(),
        ]);

        return {
            mcpArtifact: latestArtifactForPlatform(mcpArtifacts, platformId),
            runtimeArtifact: latestArtifactForPlatform(runtimeArtifacts, platformId),
        };
    }

    async listArtifactsForPlatform(platformId: string, userId: string) {
        await this.loadPlatformForUser(platformId, userId);
        const [mcpArtifacts, runtimeArtifacts] = await Promise.all([
            this.generationRepository.listMcpArtifacts(),
            this.generationRepository.listRuntimeArtifacts(),
        ]);

        return {
            mcpArtifacts: mcpArtifacts
                .filter((artifact) => artifact.platformId === platformId)
                .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt)),
            runtimeArtifacts: runtimeArtifacts
                .filter((artifact) => artifact.platformId === platformId)
                .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt)),
        };
    }

    private resolveSourceJob(
        platformId: string,
        jobs: ResearchJob[],
        sourceResearchJobId?: string,
    ) {
        if (sourceResearchJobId) {
            const matchingJob = jobs.find(
                (job) => job.id === sourceResearchJobId && job.platformId === platformId,
            );

            if (!matchingJob) {
                throw new Error("Requested research job not found for this platform.");
            }

            if (matchingJob.status !== "completed") {
                throw new Error("Requested research job is not completed.");
            }

            return matchingJob;
        }

        const latestCompletedJob = jobs
            .filter((job) => job.platformId === platformId && job.status === "completed")
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

        if (!latestCompletedJob) {
            throw new Error("No completed research job available for artifact generation.");
        }

        return latestCompletedJob;
    }

    private async loadPlatformForUser(platformId: string, userId: string): Promise<Platform> {
        const platforms = await this.platformsRepository.list();
        const platform = platforms.find((entry) => entry.id === platformId);

        if (!platform || platform.createdByUserId !== userId) {
            throw new Error("Platform not found.");
        }

        return platform;
    }
}

function latestArtifactForPlatform<T extends { platformId: string; generatedAt: string }>(
    artifacts: T[],
    platformId: string,
) {
    return (
        artifacts
            .filter((artifact) => artifact.platformId === platformId)
            .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))[0] ?? null
    );
}
