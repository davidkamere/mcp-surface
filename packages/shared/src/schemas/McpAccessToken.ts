import { z } from "zod";

export const mcpAccessTokenSchema = z.object({
  id: z.string().min(1),
  platformId: z.string().min(1),
  userEmail: z.string().email(),
  token: z.string().min(1),
  createdAt: z.string().datetime(),
  revokedAt: z.string().datetime().optional(),
});
