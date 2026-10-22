import {
    approvalResolutionResponseSchema,
    approvalResponseSchema,
    approvalsResponseSchema,
} from "@mcpsurface/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getRequestUserEmail } from "../../lib/request-user.js";
import { GenerationRepository } from "../generation/generation.repository.js";
import { PlatformsRepository } from "../platforms/platforms.repository.js";
import { ResearchRepository } from "../research/research.repository.js";
import { RuntimesRepository } from "../runtimes/runtimes.repository.js";
import { RuntimesService } from "../runtimes/runtimes.service.js";
import { ApprovalsService } from "./approvals.service.js";

const platformParamsSchema = z.object({
    platformId: z.string().min(1),
});

const approvalParamsSchema = z.object({
    approvalId: z.string().min(1),
});

const approvalsService = new ApprovalsService();
const runtimesService = new RuntimesService(
    new RuntimesRepository(),
    new GenerationRepository(),
    new ResearchRepository(),
    new PlatformsRepository(),
);

export const approvalsRoutes: FastifyPluginAsync = async (app) => {
    app.get("/platforms/:platformId/approvals", async (request, reply) => {
        const params = platformParamsSchema.parse(request.params);
        const userEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userEmail) {
            return reply.code(401).send({ message: "Authenticated user email required." });
        }

        const approvals = await approvalsService.listVisibleApprovals(params.platformId, userEmail);
        return approvalsResponseSchema.parse({ approvals });
    });

    app.get("/approvals/:approvalId", async (request, reply) => {
        const params = approvalParamsSchema.parse(request.params);
        const approval = await approvalsService.getApproval(params.approvalId);
        return approvalResponseSchema.parse({ approval });
    });

    app.post("/approvals/:approvalId/approve", async (request, reply) => {
        const params = approvalParamsSchema.parse(request.params);
        const userEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userEmail) {
            return reply.code(401).send({ message: "Authenticated user email required." });
        }

        try {
            const result = await approvalsService.approveRequest({
                approvalId: params.approvalId,
                currentUserEmail: userEmail,
                executeApprovedCapability: (approval) =>
                    runtimesService.executeApprovedCapability(approval, userEmail),
            });
            return approvalResolutionResponseSchema.parse(result);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to approve request.";
            return reply.code(400).send({ message });
        }
    });

    app.post("/approvals/:approvalId/reject", async (request, reply) => {
        const params = approvalParamsSchema.parse(request.params);
        const userEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userEmail) {
            return reply.code(401).send({ message: "Authenticated user email required." });
        }

        try {
            const approval = await approvalsService.rejectRequest({
                approvalId: params.approvalId,
                currentUserEmail: userEmail,
            });
            return approvalResponseSchema.parse({ approval });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to reject request.";
            return reply.code(400).send({ message });
        }
    });
};
