import {
  appendPlatformArtifactInputSchema,
  appendPlatformArtifactResponseSchema,
  createPlatformInputSchema,
  platformDetailResponseSchema,
  platformListResponseSchema,
  platformSourcesResponseSchema,
  updatePlatformRuntimeConfigInputSchema,
  updatePlatformSourcesInputSchema,
} from "@mcpsurface/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getRequestUserEmail, getRequestUserId } from "../../lib/request-user.js";
import { SharingService } from "../sharing/sharing.service.js";
import { maskPlatformForResponse } from "./platform-response.js";
import { PlatformsRepository } from "./platforms.repository.js";
import { PlatformsService } from "./platforms.service.js";

const paramsSchema = z.object({
  platformId: z.string().min(1),
});

const platformsRepository = new PlatformsRepository();
const platformsService = new PlatformsService(platformsRepository);
const sharingService = new SharingService();

export const platformsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request) => {
    const userId = getRequestUserId(request.headers["x-user-id"]);
    const userEmail = getRequestUserEmail(request.headers["x-user-email"]);
    const platforms =
      userId && userEmail ? await sharingService.listAccessiblePlatforms(userId, userEmail) : await platformsService.listPlatforms(userId);

    return platformListResponseSchema.parse({ platforms: platforms.map(maskPlatformForResponse) });
  });

  app.get("/:platformId", async (request, reply) => {
    const params = paramsSchema.parse(request.params);
    const userId = getRequestUserId(request.headers["x-user-id"]);
    const platform = await platformsService.getPlatform(params.platformId, userId);

    if (!platform) {
      return reply.code(404).send({ message: "Platform not found." });
    }

    return platformDetailResponseSchema.parse({ platform: maskPlatformForResponse(platform) });
  });

  app.post("/", async (request, reply) => {
    const body = createPlatformInputSchema.parse(request.body);
    const userId = getRequestUserId(request.headers["x-user-id"]);
    const userEmail = getRequestUserEmail(request.headers["x-user-email"]);

    if (!userId || !userEmail) {
      return reply.code(401).send({ message: "Authenticated user id and email required." });
    }

    try {
      const platform = await platformsService.createPlatform(body, userId, userEmail);
      return reply.code(201).send(platformDetailResponseSchema.parse({ platform: maskPlatformForResponse(platform) }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create platform.";
      return reply.code(400).send({ message });
    }
  });

  app.patch("/:platformId/sources", async (request, reply) => {
    const params = paramsSchema.parse(request.params);
    const body = updatePlatformSourcesInputSchema.parse(request.body);
    const userId = getRequestUserId(request.headers["x-user-id"]);

    if (!userId) {
      return reply.code(401).send({ message: "Authenticated user required." });
    }

    try {
      const platform = await platformsService.updatePlatformSources(params.platformId, body, userId);
      return platformSourcesResponseSchema.parse({ platform: maskPlatformForResponse(platform) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update platform sources.";
      return reply.code(400).send({ message });
    }
  });

  app.post("/:platformId/artifacts", async (request, reply) => {
    const params = paramsSchema.parse(request.params);
    const body = appendPlatformArtifactInputSchema.parse(request.body);
    const userId = getRequestUserId(request.headers["x-user-id"]);

    if (!userId) {
      return reply.code(401).send({ message: "Authenticated user required." });
    }

    try {
      const result = await platformsService.appendArtifact(params.platformId, body, userId);
      return reply.code(201).send(
        appendPlatformArtifactResponseSchema.parse({
          ...result,
          platform: maskPlatformForResponse(result.platform),
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload artifact.";
      return reply.code(400).send({ message });
    }
  });

  app.patch("/:platformId/runtime-config", async (request, reply) => {
    const params = paramsSchema.parse(request.params);
    const body = updatePlatformRuntimeConfigInputSchema.parse(request.body);
    const userId = getRequestUserId(request.headers["x-user-id"]);

    if (!userId) {
      return reply.code(401).send({ message: "Authenticated user required." });
    }

    try {
      const platform = await platformsService.updatePlatformRuntimeConfig(params.platformId, body, userId);
      return platformDetailResponseSchema.parse({ platform: maskPlatformForResponse(platform) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update runtime config.";
      return reply.code(400).send({ message });
    }
  });
};
