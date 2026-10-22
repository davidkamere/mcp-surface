import {
    researchCapabilitiesResponseSchema,
    researchFindingsResponseSchema,
    researchJobDetailResponseSchema,
    researchJobListResponseSchema,
    startResearchJobInputSchema,
} from "@mcpsurface/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getRequestUserId } from "../../lib/request-user.js";
import { GenerationRepository } from "../generation/generation.repository.js";
import { GenerationService } from "../generation/generation.service.js";
import { PlatformsRepository } from "../platforms/platforms.repository.js";
import { ResearchRepository } from "./research.repository.js";
import { ResearchService } from "./research.service.js";

const platformParamsSchema = z.object({
    platformId: z.string().min(1),
});

const jobParamsSchema = z.object({
    jobId: z.string().min(1),
});

const sharedResearchRepository = new ResearchRepository();
const sharedPlatformsRepository = new PlatformsRepository();
const generationService = new GenerationService(
    new GenerationRepository(),
    sharedResearchRepository,
    sharedPlatformsRepository,
);
const researchService = new ResearchService(
    sharedResearchRepository,
    sharedPlatformsRepository,
    generationService,
);

export const researchRoutes: FastifyPluginAsync = async (app) => {
    app.get("/platforms/:platformId/jobs", async (request, reply) => {
        const params = platformParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);

        if (!userId) {
            return reply.code(401).send({ message: "Authenticated user required." });
        }

        const jobs = await researchService.listJobsForPlatform(params.platformId, userId);

        return researchJobListResponseSchema.parse({ jobs });
    });

    app.post("/platforms/:platformId/jobs", async (request, reply) => {
        const params = platformParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);
        startResearchJobInputSchema.parse(request.body ?? {});

        if (!userId) {
            return reply.code(401).send({ message: "Authenticated user required." });
        }

        const job = await researchService.createResearchJob(params.platformId, userId);

        void researchService.runResearchJob(job.id);

        const detail = await researchService.getJobDetail(job.id, userId);
        return reply.code(202).send(
            researchJobDetailResponseSchema.parse({
                job,
                sources: detail.sources,
                findings: detail.findings,
                capabilities: detail.capabilities,
            }),
        );
    });

    app.get("/jobs/:jobId", async (request, reply) => {
        const params = jobParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);

        if (!userId) {
            return reply.code(401).send({ message: "Authenticated user required." });
        }

        const detail = await researchService.getJobDetail(params.jobId, userId);

        if (!detail.job) {
            return reply.code(404).send({ message: "Research job not found." });
        }

        return researchJobDetailResponseSchema.parse(detail);
    });

    app.get("/jobs/:jobId/findings", async (request, reply) => {
        const params = jobParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);

        if (!userId) {
            return reply.code(401).send({ message: "Authenticated user required." });
        }

        const findings = await researchService.listFindingsForJob(params.jobId, userId);
        return researchFindingsResponseSchema.parse({ findings });
    });

    app.get("/jobs/:jobId/capabilities", async (request, reply) => {
        const params = jobParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);

        if (!userId) {
            return reply.code(401).send({ message: "Authenticated user required." });
        }

        const capabilities = await researchService.listCapabilitiesForJob(params.jobId, userId);
        return researchCapabilitiesResponseSchema.parse({ capabilities });
    });
};
