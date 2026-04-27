import { z } from "zod";

export const chatSessionSchema = z.object({
  id: z.string().min(1),
  platformId: z.string().min(1),
  runtimeId: z.string().min(1),
  userEmail: z.string().email(),
  title: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastMessageAt: z.string().datetime().optional(),
});
