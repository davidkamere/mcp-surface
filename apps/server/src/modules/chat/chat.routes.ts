import {
    chatContextResponseSchema,
    chatMessagesResponseSchema,
    chatSessionsResponseSchema,
    chatSessionResponseSchema,
    createChatMessageInputSchema,
    createChatSessionInputSchema,
} from "@mcpsurface/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getRequestUserEmail, getRequestUserId } from "../../lib/request-user.js";
import { maskPlatformForResponse } from "../platforms/platform-response.js";
import { beginChatStream } from "./chat-stream.js";
import { ChatService } from "./chat.service.js";

const platformParamsSchema = z.object({
    platformId: z.string().min(1),
});

const sessionParamsSchema = z.object({
    sessionId: z.string().min(1),
});

const chatService = new ChatService();

export const chatRoutes: FastifyPluginAsync = async (app) => {
    app.post("/platforms/:platformId/chat/sessions", async (request, reply) => {
        const params = platformParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);
        const userEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userId || !userEmail) {
            return reply.code(401).send({ message: "Authenticated user id and email required." });
        }

        const session = await chatService.createSession(
            params.platformId,
            userId,
            userEmail,
            createChatSessionInputSchema.parse(request.body ?? {}),
        );

        return chatSessionResponseSchema.parse({ session });
    });

    app.get("/platforms/:platformId/chat/sessions", async (request, reply) => {
        const params = platformParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);
        const userEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userId || !userEmail) {
            return reply.code(401).send({ message: "Authenticated user id and email required." });
        }

        const sessions = await chatService.listSessions(params.platformId, userId, userEmail);
        return chatSessionsResponseSchema.parse({ sessions });
    });

    app.get("/chat/sessions/:sessionId/messages", async (request, reply) => {
        const params = sessionParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);
        const userEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userId || !userEmail) {
            return reply.code(401).send({ message: "Authenticated user id and email required." });
        }

        const messages = await chatService.listMessages(params.sessionId, userId, userEmail);
        return chatMessagesResponseSchema.parse({ messages });
    });

    app.get("/platforms/:platformId/chat/context", async (request, reply) => {
        const params = platformParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);
        const userEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userId || !userEmail) {
            return reply.code(401).send({ message: "Authenticated user id and email required." });
        }

        const context = await chatService.getContext(params.platformId, userId, userEmail);
        return chatContextResponseSchema.parse({
            ...context,
            platform: maskPlatformForResponse(context.platform),
        });
    });

    app.post("/chat/sessions/:sessionId/messages", async (request, reply) => {
        const params = sessionParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);
        const userEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userId || !userEmail) {
            return reply.code(401).send({ message: "Authenticated user id and email required." });
        }

        const stream = beginChatStream(reply);
        const body = createChatMessageInputSchema.parse(request.body ?? {});

        try {
            await chatService.streamTurn({
                sessionId: params.sessionId,
                userId,
                userEmail,
                content: body.content,
                onEvent: (event) => stream.send(event),
            });
        } catch (error) {
            await stream.send({
                type: "error",
                data: {
                    message: error instanceof Error ? error.message : "Chat request failed.",
                },
            });
        } finally {
            stream.end();
        }

        return reply;
    });

    app.post("/chat/sessions/:sessionId/stream", async (request, reply) => {
        const params = sessionParamsSchema.parse(request.params);
        const userId = getRequestUserId(request.headers["x-user-id"]);
        const userEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userId || !userEmail) {
            return reply.code(401).send({ message: "Authenticated user id and email required." });
        }

        const stream = beginChatStream(reply);
        const body = createChatMessageInputSchema.parse(request.body ?? {});

        try {
            await chatService.streamTurn({
                sessionId: params.sessionId,
                userId,
                userEmail,
                content: body.content,
                onEvent: (event) => stream.send(event),
            });
        } catch (error) {
            await stream.send({
                type: "error",
                data: {
                    message: error instanceof Error ? error.message : "Chat request failed.",
                },
            });
        } finally {
            stream.end();
        }

        return reply;
    });
};
