import { z } from "zod";
import { approvalRequestSchema } from "../schemas/ApprovalRequest";
import { capabilitySchema } from "../schemas/Capability";
import { executionTraceSchema } from "../schemas/ExecutionTrace";
import { mcpAccessTokenSchema } from "../schemas/McpAccessToken";

export const createMcpAccessTokenInputSchema = z.object({
    userEmail: z.string().email(),
});

export const mcpAccessTokenMetadataSchema = mcpAccessTokenSchema.omit({
    token: true,
});

export const createMcpAccessTokenResponseSchema = z.object({
    token: z.string().min(1),
    accessToken: mcpAccessTokenMetadataSchema,
});

export const mcpAccessTokensResponseSchema = z.object({
    tokens: z.array(mcpAccessTokenMetadataSchema),
});

export const mcpRequestSchema = z.object({
    type: z.enum(["search", "execute"]),
    query: z.string().trim().optional(),
    capabilityKey: z.string().trim().optional(),
    input: z.record(z.unknown()).optional(),
});

export const mcpSearchResponseSchema = z.object({
    results: z.array(
        z.object({
            capability: capabilitySchema,
            summary: z.string(),
            findings: z
                .array(
                    z.object({
                        title: z.string(),
                        summary: z.string(),
                        provenanceUrl: z.string().url(),
                    }),
                )
                .default([]),
        }),
    ),
});

export const mcpExecuteResponseSchema = z.discriminatedUnion("status", [
    z.object({
        status: z.literal("executed"),
        trace: executionTraceSchema,
        output: z.record(z.unknown()).optional(),
    }),
    z.object({
        status: z.literal("pending_approval"),
        approvalRequestId: z.string().min(1),
        approval: approvalRequestSchema,
    }),
]);

export type CreateMcpAccessTokenInput = z.infer<typeof createMcpAccessTokenInputSchema>;
export type McpRequest = z.infer<typeof mcpRequestSchema>;
