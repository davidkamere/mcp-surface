import {
  createMcpAccessTokenInputSchema,
  createMcpAccessTokenResponseSchema,
  mcpAccessTokensResponseSchema,
  mcpExecuteResponseSchema,
  mcpRequestSchema,
  mcpSearchResponseSchema,
} from "@mcpsurface/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getRequestUserEmail } from "../../lib/request-user.js";
import { extractBearerToken } from "./mcp-auth.js";
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

    const body = mcpRequestSchema.parse(request.body ?? {});

    if (body.type === "search") {
      const result = await mcpService.search(params.platformId, accessToken.userEmail, body.query?.trim() ?? "");
      return mcpSearchResponseSchema.parse(result);
    }

    if (!body.capabilityKey?.trim()) {
      return reply.code(400).send({ message: "capabilityKey is required for execute requests." });
    }

    const result = await mcpService.execute(params.platformId, accessToken.userEmail, {
      capabilityKey: body.capabilityKey,
      input: body.input ?? {},
    });
    return mcpExecuteResponseSchema.parse(result);
  });
};
