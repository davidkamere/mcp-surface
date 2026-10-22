import { z } from "zod";
import { platformSchema } from "../schemas/Platform";
import { platformShareInviteSchema } from "../schemas/PlatformShareInvite";
import { workspaceRuntimeSchema } from "../schemas/WorkspaceRuntime";

export const createPlatformShareInviteInputSchema = z.object({
    email: z.string().trim().email(),
});

export const platformShareInviteResponseSchema = z.object({
    invite: platformShareInviteSchema,
});

export const platformShareInviteListResponseSchema = z.object({
    invites: z.array(platformShareInviteSchema),
});

export const shareInviteLookupResponseSchema = z.object({
    invite: platformShareInviteSchema,
    platform: platformSchema,
    requiresEmailMatch: z.literal(true),
});

export const acceptPlatformShareInviteResponseSchema = z.object({
    invite: platformShareInviteSchema,
    platform: platformSchema,
    runtime: workspaceRuntimeSchema,
});

export type CreatePlatformShareInviteInput = z.infer<typeof createPlatformShareInviteInputSchema>;
