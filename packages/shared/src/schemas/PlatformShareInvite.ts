import { z } from "zod";
import { platformShareInviteStatuses } from "../domain/PlatformShareInvite";

export const platformShareInviteSchema = z.object({
    id: z.string().min(1),
    platformId: z.string().min(1),
    inviteToken: z.string().min(1),
    email: z.string().email(),
    invitedByUserId: z.string().min(1),
    status: z.enum(platformShareInviteStatuses),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    acceptedAt: z.string().datetime().optional(),
});
