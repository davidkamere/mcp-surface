import { z } from "zod";
import { chatMessageSchema } from "../schemas/ChatMessage";
import { chatSessionSchema } from "../schemas/ChatSession";
import { executionTraceSchema } from "../schemas/ExecutionTrace";
import { platformSchema } from "../schemas/Platform";
import { capabilitySchema } from "../schemas/Capability";
import { researchFindingSchema } from "../schemas/ResearchFinding";
import { workspaceRuntimeSchema } from "../schemas/WorkspaceRuntime";

export const createChatSessionInputSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

export const createChatMessageInputSchema = z.object({
  content: z.string().trim().min(1),
});

export const chatSessionResponseSchema = z.object({
  session: chatSessionSchema,
});

export const chatSessionsResponseSchema = z.object({
  sessions: z.array(chatSessionSchema),
});

export const chatMessageResponseSchema = z.object({
  message: chatMessageSchema,
});

export const chatMessagesResponseSchema = z.object({
  messages: z.array(chatMessageSchema),
});

export const chatContextResponseSchema = z.object({
  platform: platformSchema,
  runtime: workspaceRuntimeSchema,
  capabilities: z.array(capabilitySchema),
  findings: z.array(researchFindingSchema),
  traces: z.array(executionTraceSchema),
  logs: z.array(
    z.object({
      id: z.string().min(1),
      level: z.enum(["info", "error"]),
      message: z.string(),
      createdAt: z.string().datetime(),
    }),
  ),
});

export type CreateChatSessionInput = z.infer<typeof createChatSessionInputSchema>;
export type CreateChatMessageInput = z.infer<typeof createChatMessageInputSchema>;
