import {
  appendPlatformArtifactInputSchema,
  appendPlatformArtifactResponseSchema,
  createPlatformInputSchema,
  platformDetailResponseSchema,
  platformListResponseSchema,
  platformSourcesResponseSchema,
  updatePlatformSourcesInputSchema,
} from "@mcpsurface/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getRequestUserId } from "../../lib/request-user.js";
import { PlatformsRepository } from "./platforms.repository.js";
import { PlatformsService } from "./platforms.service.js";

const paramsSchema = z.object({
  platformId: z.string().min(1),
});

const platformsRepository = new PlatformsRepository();
const platformsService = new PlatformsService(platformsRepository);

export const platformsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request) => {
    const userId = getRequestUserId(request.headers["x-user-id"]);
    const platforms = await platformsService.listPlatforms(userId);

    return platformListResponseSchema.parse({ platforms });
  });

  app.get("/:platformId", async (request, reply) => {
    const params = paramsSchema.parse(request.params);
    const userId = getRequestUserId(request.headers["x-user-id"]);
    const platform = await platformsService.getPlatform(params.platformId, userId);

    if (!platform) {
      return reply.code(404).send({ message: "Platform not found." });
    }

    return platformDetailResponseSchema.parse({ platform });
  });

  app.post("/", async (request, reply) => {
    const body = createPlatformInputSchema.parse(request.body);
    const userId = getRequestUserId(request.headers["x-user-id"]);

    if (!userId) {
      return reply.code(401).send({ message: "Authenticated user required." });
    }

    try {
      const platform = await platformsService.createPlatform(body, userId);
      return reply.code(201).send(platformDetailResponseSchema.parse({ platform }));
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
      return platformSourcesResponseSchema.parse({ platform });
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
      return reply.code(201).send(appendPlatformArtifactResponseSchema.parse(result));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload artifact.";
      return reply.code(400).send({ message });
    }
  });
};
