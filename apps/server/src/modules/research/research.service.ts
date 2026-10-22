import type {
    Capability,
    Platform,
    ResearchFinding,
    ResearchJob,
    ResearchJobStage,
    ResearchSource,
} from "@mcpsurface/shared";
import { createId } from "../../lib/ids.js";
import { GenerationService } from "../generation/generation.service.js";
import { PlatformsRepository } from "../platforms/platforms.repository.js";
import { ResearchRepository } from "./research.repository.js";
import { runResearchWorkflow } from "./research-workflow.js";

export class ResearchService {
    constructor(
        private readonly researchRepository: ResearchRepository,
        private readonly platformsRepository: PlatformsRepository,
        private readonly generationService?: GenerationService,
    ) {}

    async listJobsForPlatform(platformId: string, userId: string): Promise<ResearchJob[]> {
        await this.loadPlatformForUser(platformId, userId);
        const jobs = await this.researchRepository.listJobs();

        return jobs
            .filter((job) => job.platformId === platformId)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    }

    async getJobDetail(
        jobId: string,
        userId: string,
    ): Promise<{
        job: ResearchJob | null;
        sources: ResearchSource[];
        findings: ResearchFinding[];
        capabilities: Capability[];
    }> {
        const [jobs, sources, findings, capabilities] = await Promise.all([
            this.researchRepository.listJobs(),
            this.researchRepository.listSources(),
            this.researchRepository.listFindings(),
            this.researchRepository.listCapabilities(),
        ]);

        const job = jobs.find((entry) => entry.id === jobId) ?? null;

        if (!job) {
            return {
                job: null,
                sources: [],
                findings: [],
                capabilities: [],
            };
        }

        await this.loadPlatformForUser(job.platformId, userId);

        return {
            job,
            sources: sources.filter((entry) => entry.researchJobId === jobId),
            findings: findings.filter((entry) => entry.researchJobId === jobId),
            capabilities: capabilities.filter((entry) => entry.researchJobId === jobId),
        };
    }

    async listFindingsForJob(jobId: string, userId: string): Promise<ResearchFinding[]> {
        const detail = await this.getJobDetail(jobId, userId);
        return detail.findings;
    }

    async listCapabilitiesForJob(jobId: string, userId: string): Promise<Capability[]> {
        const detail = await this.getJobDetail(jobId, userId);
        return detail.capabilities;
    }

    async createResearchJob(platformId: string, userId: string): Promise<ResearchJob> {
        await this.loadPlatformForUser(platformId, userId);
        const jobs = await this.researchRepository.listJobs();
        const now = new Date().toISOString();

        const job: ResearchJob = {
            id: createId(),
            platformId,
            status: "queued",
            currentStage: "queued",
            stageMessage: "Queued and waiting to start research.",
            sourceCount: 0,
            findingCount: 0,
            capabilityCount: 0,
            createdAt: now,
            updatedAt: now,
        };

        jobs.unshift(job);
        await this.researchRepository.saveJobs(jobs);

        return job;
    }

    async runResearchJob(jobId: string): Promise<void> {
        const jobs = await this.researchRepository.listJobs();
        const jobIndex = jobs.findIndex((job) => job.id === jobId);

        if (jobIndex < 0) {
            throw new Error("Research job not found.");
        }

        const job = jobs[jobIndex];
        if (!job) {
            throw new Error("Research job not found.");
        }

        const platform = await this.loadPlatform(job.platformId);
        const startedAt = new Date().toISOString();
        const runningJob: ResearchJob = {
            ...job,
            status: "running",
            currentStage: "source_discovery",
            stageMessage: "Discovering and classifying sources.",
            startedAt,
            updatedAt: startedAt,
            errorMessage: undefined,
        };

        jobs[jobIndex] = runningJob;
        await this.researchRepository.saveJobs(jobs);

        try {
            const result = await runResearchWorkflow({
                platform,
                job: runningJob,
                onStageUpdate: async (stage, message, progress) => {
                    await this.updateJobStage(jobId, stage, message, progress);
                },
            });

            await this.persistJobArtifacts(jobId, platform.id, result);

            const completedAt = new Date().toISOString();
            const refreshedJobs = await this.researchRepository.listJobs();
            const refreshedIndex = refreshedJobs.findIndex((entry) => entry.id === jobId);
            const refreshedJob = refreshedJobs[refreshedIndex];

            if (refreshedIndex < 0 || !refreshedJob) {
                throw new Error("Research job not found.");
            }

            refreshedJobs[refreshedIndex] = {
                ...refreshedJob,
                status: "completed",
                currentStage: "completed",
                stageMessage:
                    "Research completed. Review sources, findings, and synthesized capabilities.",
                sourceCount: result.sources.length,
                findingCount: result.findings.length,
                capabilityCount: result.capabilities.length,
                completedAt,
                updatedAt: completedAt,
            };
            await this.researchRepository.saveJobs(refreshedJobs);

            const generationSummary = await this.generateArtifactsIfUseful(
                platform,
                refreshedJobs[refreshedIndex],
                result.capabilities,
            );

            if (generationSummary) {
                const completedJobs = await this.researchRepository.listJobs();
                const completedIndex = completedJobs.findIndex((entry) => entry.id === jobId);
                const completedJob = completedJobs[completedIndex];

                if (completedIndex >= 0 && completedJob) {
                    completedJobs[completedIndex] = {
                        ...completedJob,
                        stageMessage: generationSummary,
                        updatedAt: new Date().toISOString(),
                    };
                    await this.researchRepository.saveJobs(completedJobs);
                }
            }
        } catch (error) {
            const failedAt = new Date().toISOString();
            const refreshedJobs = await this.researchRepository.listJobs();
            const refreshedIndex = refreshedJobs.findIndex((entry) => entry.id === jobId);
            const refreshedJob = refreshedJobs[refreshedIndex];

            if (refreshedIndex < 0 || !refreshedJob) {
                throw new Error("Research job not found.");
            }

            refreshedJobs[refreshedIndex] = {
                ...refreshedJob,
                status: "failed",
                currentStage: "failed",
                errorMessage: error instanceof Error ? error.message : "Research job failed.",
                stageMessage:
                    error instanceof Error
                        ? `Research failed: ${error.message}`
                        : "Research job failed.",
                updatedAt: failedAt,
            };
            await this.researchRepository.saveJobs(refreshedJobs);
        }
    }

    private async generateArtifactsIfUseful(
        platform: Platform,
        job: ResearchJob,
        capabilities: Capability[],
    ): Promise<string | null> {
        if (!this.generationService) {
            return null;
        }

        if (capabilities.length === 0) {
            return "Research completed. No capabilities were synthesized yet, so artifacts could not be generated.";
        }

        try {
            await this.generationService.generateArtifactsForPlatform(
                platform.id,
                platform.createdByUserId,
                {
                    sourceResearchJobId: job.id,
                },
            );
            return "Research completed. Artifacts were generated automatically from the current operation surface.";
        } catch {
            return "Research completed. Automatic artifact generation was skipped because compilation did not complete.";
        }
    }

    private async loadPlatform(platformId: string): Promise<Platform> {
        const platforms = await this.platformsRepository.list();
        const platform = platforms.find((entry) => entry.id === platformId);

        if (!platform) {
            throw new Error("Platform not found.");
        }

        return platform;
    }

    private async loadPlatformForUser(platformId: string, userId: string): Promise<Platform> {
        const platform = await this.loadPlatform(platformId);

        if (platform.createdByUserId !== userId) {
            throw new Error("Platform not found.");
        }

        return platform;
    }

    private async persistJobArtifacts(
        jobId: string,
        platformId: string,
        result: {
            sources: ResearchSource[];
            findings: ResearchFinding[];
            capabilities: Capability[];
        },
    ) {
        const [sources, findings, capabilities] = await Promise.all([
            this.researchRepository.listSources(),
            this.researchRepository.listFindings(),
            this.researchRepository.listCapabilities(),
        ]);

        await this.researchRepository.saveSources([
            ...sources.filter((entry) => entry.researchJobId !== jobId),
            ...result.sources,
        ]);
        await this.researchRepository.saveFindings([
            ...findings.filter((entry) => entry.researchJobId !== jobId),
            ...result.findings,
        ]);
        await this.researchRepository.saveCapabilities([
            ...capabilities.filter(
                (entry) => !(entry.researchJobId === jobId || entry.platformId === platformId),
            ),
            ...result.capabilities,
        ]);
    }

    private async updateJobStage(
        jobId: string,
        stage: ResearchJobStage,
        stageMessage: string,
        progress?: {
            sourceCount?: number;
            findingCount?: number;
            capabilityCount?: number;
        },
    ): Promise<void> {
        const jobs = await this.researchRepository.listJobs();
        const jobIndex = jobs.findIndex((entry) => entry.id === jobId);
        const job = jobs[jobIndex];

        if (jobIndex < 0 || !job) {
            return;
        }

        jobs[jobIndex] = {
            ...job,
            currentStage: stage,
            stageMessage,
            sourceCount: progress?.sourceCount ?? job.sourceCount,
            findingCount: progress?.findingCount ?? job.findingCount,
            capabilityCount: progress?.capabilityCount ?? job.capabilityCount,
            updatedAt: new Date().toISOString(),
        };

        await this.researchRepository.saveJobs(jobs);
    }
}
