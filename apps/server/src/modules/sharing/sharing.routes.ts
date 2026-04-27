import {
  acceptPlatformShareInviteResponseSchema,
  createPlatformShareInviteInputSchema,
  platformShareInviteListResponseSchema,
  platformShareInviteResponseSchema,
  shareInviteLookupResponseSchema,
} from "@mcpsurface/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getRequestUserEmail, getRequestUserId } from "../../lib/request-user.js";
import { SharingService } from "./sharing.service.js";

const sharingService = new SharingService();

const platformParamsSchema = z.object({
  platformId: z.string().min(1),
});

const inviteParamsSchema = z.object({
  inviteId: z.string().min(1),
});

const shareParamsSchema = z.object({
  inviteToken: z.string().min(1),
});

export const sharingRoutes: FastifyPluginAsync = async (app) => {
  app.post("/platforms/:platformId/invites", async (request, reply) => {
    const params = platformParamsSchema.parse(request.params);
    const body = createPlatformShareInviteInputSchema.parse(request.body ?? {});
    const userId = getRequestUserId(request.headers["x-user-id"]);

    if (!userId) {
      return reply.code(401).send({ message: "Authenticated user required." });
    }

    try {
      const invite = await sharingService.createInvite(params.platformId, body.email, userId);
      return reply.code(201).send(platformShareInviteResponseSchema.parse({ invite }));
    } catch (error) {
      return reply.code(400).send({ message: error instanceof Error ? error.message : "Unable to create invite." });
    }
  });

  app.get("/platforms/:platformId/invites", async (request, reply) => {
    const params = platformParamsSchema.parse(request.params);
    const userId = getRequestUserId(request.headers["x-user-id"]);

    if (!userId) {
      return reply.code(401).send({ message: "Authenticated user required." });
    }

    try {
      const invites = await sharingService.listPlatformInvites(params.platformId, userId);
      return platformShareInviteListResponseSchema.parse({ invites });
    } catch (error) {
      return reply.code(400).send({ message: error instanceof Error ? error.message : "Unable to load invites." });
    }
  });

  app.delete("/invites/:inviteId", async (request, reply) => {
    const params = inviteParamsSchema.parse(request.params);
    const userId = getRequestUserId(request.headers["x-user-id"]);

    if (!userId) {
      return reply.code(401).send({ message: "Authenticated user required." });
    }

    try {
      const invite = await sharingService.revokeInvite(params.inviteId, userId);
      return platformShareInviteResponseSchema.parse({ invite });
    } catch (error) {
      return reply.code(400).send({ message: error instanceof Error ? error.message : "Unable to revoke invite." });
    }
  });

  app.get("/share/:inviteToken", async (request, reply) => {
    const params = shareParamsSchema.parse(request.params);

    try {
      const result = await sharingService.getInviteByToken(params.inviteToken);
      return shareInviteLookupResponseSchema.parse({
        invite: result.invite,
        platform: result.platform,
        requiresEmailMatch: true,
      });
    } catch (error) {
      return reply.code(404).send({ message: error instanceof Error ? error.message : "Invite not found." });
    }
  });

  app.post("/share/:inviteToken/accept", async (request, reply) => {
    const params = shareParamsSchema.parse(request.params);
    const userId = getRequestUserId(request.headers["x-user-id"]);
    const userEmail = getRequestUserEmail(request.headers["x-user-email"]);

    if (!userId || !userEmail) {
      return reply.code(401).send({ message: "Authenticated user id and email required." });
    }

    try {
      const result = await sharingService.acceptInvite(params.inviteToken, userId, userEmail);
      return acceptPlatformShareInviteResponseSchema.parse(result);
    } catch (error) {
      return reply.code(400).send({ message: error instanceof Error ? error.message : "Unable to accept invite." });
    }
  });
};
