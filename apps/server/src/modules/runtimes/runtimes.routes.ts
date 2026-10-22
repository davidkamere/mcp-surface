import {
    createRuntimeInputSchema,
    runtimeCodeExecutionInputSchema,
    runtimeCodeExecutionResponseSchema,
    runtimeExecutionInputSchema,
    runtimeExecutionResponseSchema,
    runtimeResponseSchema,
    runtimeTracesResponseSchema,
} from "@mcpsurface/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getRequestUserEmail, getRequestUserId } from "../../lib/request-user.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { GenerationRepository } from "../generation/generation.repository.js";
import { PlatformsRepository } from "../platforms/platforms.repository.js";
import { ResearchRepository } from "../research/research.repository.js";
import { SharingRepository } from "../sharing/sharing.repository.js";
import { RuntimesRepository } from "./runtimes.repository.js";
import { RuntimesService } from "./runtimes.service.js";

const platformParamsSchema = z.object({
    platformId: z.string().min(1),
});

const runtimeParamsSchema = z.object({
    runtimeId: z.string().min(1),
});

const runtimesService = new RuntimesService(
    new RuntimesRepository(),
    new GenerationRepository(),
    new ResearchRepository(),
    new PlatformsRepository(),
    new SharingRepository(),
    new ApprovalsService(),
);

export const runtimesRoutes: FastifyPluginAsync = async (app) => {
    app.post("/platforms/:platformId/runtimes", async (request, reply) => {
        const params = platformParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);
        const ownerEmail = getRequestUserEmail(request.headers["x-user-email"]);
        createRuntimeInputSchema.parse(request.body ?? {});

        if (!userId || !ownerEmail) {
            return reply.code(401).send({ message: "Authenticated user id and email required." });
        }

        const runtime = await runtimesService.createRuntimeForUser(
            params.platformId,
            userId,
            ownerEmail,
        );
        return runtimeResponseSchema.parse({ runtime });
    });

    app.get("/platforms/:platformId/runtime/me", async (request, reply) => {
        const params = platformParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);
        const ownerEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userId || !ownerEmail) {
            return reply.code(401).send({ message: "Authenticated user id and email required." });
        }

        const runtime = await runtimesService.getOrCreateRuntimeForUser(
            params.platformId,
            userId,
            ownerEmail,
        );
        return runtimeResponseSchema.parse({ runtime });
    });

    app.get("/runtimes/:runtimeId", async (request, reply) => {
        const params = runtimeParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);
        const ownerEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userId || !ownerEmail) {
            return reply.code(401).send({ message: "Authenticated user id and email required." });
        }

        const runtime = await runtimesService.getRuntime(params.runtimeId, userId, ownerEmail);
        return runtimeResponseSchema.parse({ runtime });
    });

    app.post("/runtimes/:runtimeId/start", async (request, reply) => {
        const params = runtimeParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);
        const ownerEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userId || !ownerEmail) {
            return reply.code(401).send({ message: "Authenticated user id and email required." });
        }

        const runtime = await runtimesService.startRuntime(params.runtimeId, userId, ownerEmail);
        return runtimeResponseSchema.parse({ runtime });
    });

    app.post("/runtimes/:runtimeId/stop", async (request, reply) => {
        const params = runtimeParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);
        const ownerEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userId || !ownerEmail) {
            return reply.code(401).send({ message: "Authenticated user id and email required." });
        }

        const runtime = await runtimesService.stopRuntime(params.runtimeId, userId, ownerEmail);
        return runtimeResponseSchema.parse({ runtime });
    });

    app.post("/runtimes/:runtimeId/execute", async (request, reply) => {
        const params = runtimeParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);
        const ownerEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userId || !ownerEmail) {
            return reply.code(401).send({ message: "Authenticated user id and email required." });
        }

        const result = await runtimesService.executeRuntime(
            params.runtimeId,
            userId,
            ownerEmail,
            runtimeExecutionInputSchema.parse(request.body ?? {}),
        );

        return runtimeExecutionResponseSchema.parse(result);
    });

    app.post("/runtimes/:runtimeId/execute-code", async (request, reply) => {
        const params = runtimeParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);
        const ownerEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userId || !ownerEmail) {
            return reply.code(401).send({ message: "Authenticated user id and email required." });
        }

        const result = await runtimesService.executeRuntimeCode(
            params.runtimeId,
            userId,
            ownerEmail,
            runtimeCodeExecutionInputSchema.parse(request.body ?? {}),
        );

        return runtimeCodeExecutionResponseSchema.parse(result);
    });

    app.get("/runtimes/:runtimeId/traces", async (request, reply) => {
        const params = runtimeParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);
        const ownerEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userId || !ownerEmail) {
            return reply.code(401).send({ message: "Authenticated user id and email required." });
        }

        const traces = await runtimesService.listRuntimeTraces(
            params.runtimeId,
            userId,
            ownerEmail,
        );
        return runtimeTracesResponseSchema.parse({ traces });
    });
};
