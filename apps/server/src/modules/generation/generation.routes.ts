import {
  generateArtifactsInputSchema,
  generationArtifactsLatestResponseSchema,
  generationArtifactsListResponseSchema,
  generationArtifactsResponseSchema,
} from "@mcpsurface/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getRequestUserId } from "../../lib/request-user.js";
import { PlatformsRepository } from "../platforms/platforms.repository.js";
import { ResearchRepository } from "../research/research.repository.js";
import { GenerationRepository } from "./generation.repository.js";
import { GenerationService } from "./generation.service.js";

const platformParamsSchema = z.object({
  platformId: z.string().min(1),
});

const generationService = new GenerationService(
  new GenerationRepository(),
  new ResearchRepository(),
  new PlatformsRepository(),
);

export const generationRoutes: FastifyPluginAsync = async (app) => {
  app.post("/platforms/:platformId/artifacts", async (request, reply) => {
    const params = platformParamsSchema.parse(request.params);
    const userId = getRequestUserId(request.headers["x-user-id"]);

    if (!userId) {
      return reply.code(401).send({ message: "Authenticated user required." });
    }

    const generatedArtifacts = await generationService.generateArtifactsForPlatform(
      params.platformId,
      userId,
      generateArtifactsInputSchema.parse(request.body ?? {}),
    );

    return generationArtifactsResponseSchema.parse(generatedArtifacts);
  });

  app.get("/platforms/:platformId/artifacts/latest", async (request, reply) => {
    const params = platformParamsSchema.parse(request.params);
    const userId = getRequestUserId(request.headers["x-user-id"]);

    if (!userId) {
      return reply.code(401).send({ message: "Authenticated user required." });
    }

    return generationArtifactsLatestResponseSchema.parse(
      await generationService.getLatestArtifactsForPlatform(params.platformId, userId),
    );
  });

  app.get("/platforms/:platformId/artifacts", async (request, reply) => {
    const params = platformParamsSchema.parse(request.params);
    const userId = getRequestUserId(request.headers["x-user-id"]);

    if (!userId) {
      return reply.code(401).send({ message: "Authenticated user required." });
    }

    return generationArtifactsListResponseSchema.parse(
      await generationService.listArtifactsForPlatform(params.platformId, userId),
    );
  });
};
