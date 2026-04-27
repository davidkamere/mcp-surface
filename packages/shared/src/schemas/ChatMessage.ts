import { z } from "zod";
import { chatAttachmentTypes, chatMessageRoles } from "../domain/ChatMessage";

export const chatAttachmentSchema = z.object({
  id: z.string().min(1),
  type: z.enum(chatAttachmentTypes),
  title: z.string().min(1),
  body: z.string().optional(),
  metadata: z.record(z.unknown()),
});

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  platformId: z.string().min(1),
  runtimeId: z.string().min(1),
  userEmail: z.string().email(),
  role: z.enum(chatMessageRoles),
  content: z.string(),
  attachments: z.array(chatAttachmentSchema),
  createdAt: z.string().datetime(),
});
