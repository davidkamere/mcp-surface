import {
    createMcpAccessTokenInputSchema,
    createMcpAccessTokenResponseSchema,
    mcpAccessTokensResponseSchema,
} from "@mcpsurface/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getRequestUserEmail } from "../../lib/request-user.js";
import { extractBearerToken } from "./mcp-auth.js";
import {
    getSupportedMcpProtocolVersion,
    handleMcpJsonRpcBody,
    validateRequestedProtocolVersion,
} from "./mcp-protocol.js";
import { McpService } from "./mcp.service.js";

const platformParamsSchema = z.object({
    platformId: z.string().min(1),
});

const tokenParamsSchema = z.object({
    tokenId: z.string().min(1),
});

const mcpService = new McpService();

export const mcpRoutes: FastifyPluginAsync = async (app) => {
    app.post("/api/platforms/:platformId/mcp/tokens", async (request, reply) => {
        const params = platformParamsSchema.parse(request.params);
        const userEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userEmail) {
            return reply.code(401).send({ message: "Authenticated user email required." });
        }

        try {
            const result = await mcpService.createToken(
                params.platformId,
                userEmail,
                createMcpAccessTokenInputSchema.parse(request.body ?? {}),
            );
            return reply.code(201).send(createMcpAccessTokenResponseSchema.parse(result));
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to create MCP token.";
            return reply.code(400).send({ message });
        }
    });

    app.get("/api/platforms/:platformId/mcp/tokens", async (request, reply) => {
        const params = platformParamsSchema.parse(request.params);
        const userEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userEmail) {
            return reply.code(401).send({ message: "Authenticated user email required." });
        }

        try {
            const tokens = await mcpService.listTokensForPlatform(params.platformId, userEmail);
            return mcpAccessTokensResponseSchema.parse({ tokens });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to list MCP tokens.";
            return reply.code(400).send({ message });
        }
    });

    app.delete("/api/mcp/tokens/:tokenId", async (request, reply) => {
        const params = tokenParamsSchema.parse(request.params);
        const userEmail = getRequestUserEmail(request.headers["x-user-email"]);

        if (!userEmail) {
            return reply.code(401).send({ message: "Authenticated user email required." });
        }

        try {
            const token = await mcpService.revokeToken(params.tokenId, userEmail);
            return reply.send({ token });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to revoke MCP token.";
            return reply.code(400).send({ message });
        }
    });

    app.post("/mcp/:platformId", async (request, reply) => {
        const params = platformParamsSchema.parse(request.params);
        const rawToken = extractBearerToken(request.headers.authorization);

        if (!rawToken) {
            return reply.code(401).send({ message: "Bearer token required." });
        }

        const accessToken = await mcpService.getValidTokenForPlatform(params.platformId, rawToken);

        if (!accessToken) {
            return reply.code(401).send({ message: "Invalid MCP token." });
        }

        try {
            const requestedVersionHeader = request.headers["mcp-protocol-version"];
            validateRequestedProtocolVersion(
                typeof requestedVersionHeader === "string" ? requestedVersionHeader : undefined,
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Unsupported MCP protocol version.";
            return reply.code(400).send({ message });
        }

        const responseBody = await handleMcpJsonRpcBody({
            body: request.body ?? {},
            platformId: params.platformId,
            userEmail: accessToken.userEmail,
            mcpService,
        });

        reply.header("mcp-protocol-version", getSupportedMcpProtocolVersion());

        if (responseBody === null) {
            return reply.code(202).send();
        }

        if (Array.isArray(responseBody) && responseBody.length === 0) {
            return reply.code(202).send();
        }

        return reply.send(responseBody);
    });
};
