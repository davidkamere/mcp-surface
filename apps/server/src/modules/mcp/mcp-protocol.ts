import type { ApprovalRequest, ExecutionTrace } from "@mcpsurface/shared";
import { z } from "zod";
import type { McpService } from "./mcp.service.js";

const MCP_PROTOCOL_VERSION = "2025-06-18";
const LEGACY_MCP_PROTOCOL_VERSION = "2025-03-26";
const SUPPORTED_PROTOCOL_VERSIONS = new Set([MCP_PROTOCOL_VERSION, LEGACY_MCP_PROTOCOL_VERSION]);

const jsonRpcIdSchema = z.union([z.string(), z.number(), z.null()]);

const initializeRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: jsonRpcIdSchema,
  method: z.literal("initialize"),
  params: z.object({
    protocolVersion: z.string().min(1),
    capabilities: z.record(z.unknown()).default({}),
    clientInfo: z.object({
      name: z.string().min(1),
      version: z.string().min(1),
    }),
  }),
});

const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: jsonRpcIdSchema.optional(),
  method: z.string().min(1),
  params: z.unknown().optional(),
});

const toolCallParamsSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.unknown()).optional(),
});

const listCapabilitiesToolArgsSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
});

const searchCapabilitiesToolArgsSchema = z.object({
  query: z.string().trim().optional(),
});

const executeCapabilityToolArgsSchema = z.object({
  capabilityKey: z.string().min(1),
  input: z.record(z.unknown()).optional(),
});

export interface McpJsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: Record<string, unknown>;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type McpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export async function handleMcpJsonRpcBody(input: {
  body: unknown;
  platformId: string;
  userEmail: string;
  mcpService: McpServicePort;
}) {
  if (Array.isArray(input.body)) {
    const responses = (
      await Promise.all(
        input.body.map((entry) =>
          handleSingleJsonRpcRequest({
            request: entry,
            platformId: input.platformId,
            userEmail: input.userEmail,
            mcpService: input.mcpService,
          }),
        ),
      )
    ).filter((entry): entry is McpJsonRpcResponse => entry !== null);

    return responses;
  }

  const response = await handleSingleJsonRpcRequest({
    request: input.body,
    platformId: input.platformId,
    userEmail: input.userEmail,
    mcpService: input.mcpService,
  });

  return response;
}

export function validateRequestedProtocolVersion(headerValue: string | undefined) {
  if (!headerValue) {
    return;
  }

  if (!SUPPORTED_PROTOCOL_VERSIONS.has(headerValue)) {
    throw new Error(`Unsupported MCP protocol version: ${headerValue}`);
  }
}

export function getSupportedMcpProtocolVersion() {
  return MCP_PROTOCOL_VERSION;
}

async function handleSingleJsonRpcRequest(input: {
  request: unknown;
  platformId: string;
  userEmail: string;
  mcpService: McpServicePort;
}): Promise<McpJsonRpcResponse | null> {
  const initializeRequest = initializeRequestSchema.safeParse(input.request);

  if (initializeRequest.success) {
    return successResponse(initializeRequest.data.id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      serverInfo: {
        name: "MCPSurface",
        version: "0.1.0",
      },
      instructions:
        "Use search_capabilities to discover relevant platform operations, then execute_capability to run an operation with structured inputs. Write and destructive operations may return approval-required results.",
    });
  }

  const request = jsonRpcRequestSchema.safeParse(input.request);

  if (!request.success) {
    return errorResponse(null, -32600, "Invalid JSON-RPC request.");
  }

  if (typeof request.data.id === "undefined") {
    await handleNotification(request.data.method);
    return null;
  }

  try {
    switch (request.data.method) {
      case "ping":
        return successResponse(request.data.id, {});
      case "tools/list":
        return successResponse(request.data.id, {
          tools: buildMcpTools(),
        });
      case "tools/call":
        return successResponse(
          request.data.id,
          await handleToolCall({
            params: request.data.params,
            platformId: input.platformId,
            userEmail: input.userEmail,
            mcpService: input.mcpService,
          }),
        );
      default:
        return errorResponse(request.data.id, -32601, `Method not found: ${request.data.method}`);
    }
  } catch (error) {
    return errorResponse(
      request.data.id ?? null,
      -32603,
      error instanceof Error ? error.message : "MCP request failed.",
    );
  }
}

async function handleNotification(method: string) {
  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return;
  }

  throw new Error(`Unsupported MCP notification: ${method}`);
}

async function handleToolCall(input: {
  params: unknown;
  platformId: string;
  userEmail: string;
  mcpService: McpServicePort;
}): Promise<McpToolResult> {
  const parsed = toolCallParamsSchema.safeParse(input.params ?? {});

  if (!parsed.success) {
    return toolError("Invalid tool call parameters.");
  }

  const args = parsed.data.arguments ?? {};

  switch (parsed.data.name) {
    case "list_capabilities": {
      const parsedArgs = listCapabilitiesToolArgsSchema.safeParse(args);

      if (!parsedArgs.success) {
        return toolError("Invalid arguments for list_capabilities.");
      }

      const result = await input.mcpService.search(input.platformId, input.userEmail, "");
      const limited = result.results.slice(0, parsedArgs.data.limit ?? 25);
      return toolSuccess(
        `Listed ${limited.length} capabilities.`,
        {
          results: limited,
        },
      );
    }
    case "search_capabilities": {
      const parsedArgs = searchCapabilitiesToolArgsSchema.safeParse(args);

      if (!parsedArgs.success) {
        return toolError("Invalid arguments for search_capabilities.");
      }

      const result = await input.mcpService.search(
        input.platformId,
        input.userEmail,
        parsedArgs.data.query?.trim() ?? "",
      );

      return toolSuccess(
        result.results.length > 0
          ? `Found ${result.results.length} matching capabilities.`
          : "No matching capabilities found.",
        result,
      );
    }
    case "execute_capability": {
      const parsedArgs = executeCapabilityToolArgsSchema.safeParse(args);

      if (!parsedArgs.success) {
        return toolError("Invalid arguments for execute_capability.");
      }

      const result = await input.mcpService.execute(input.platformId, input.userEmail, {
        capabilityKey: parsedArgs.data.capabilityKey,
        input: parsedArgs.data.input ?? {},
      });

      if (result.status === "pending_approval") {
        return {
          content: [
            {
              type: "text",
              text: `Execution requires approval. Approval request ${result.approvalRequestId} is pending.`,
            },
          ],
          structuredContent: result,
          isError: true,
        };
      }

      return toolSuccess(`Executed ${parsedArgs.data.capabilityKey}.`, result);
    }
    default:
      return toolError(`Unknown tool: ${parsed.data.name}`);
  }
}

function buildMcpTools() {
  return [
    {
      name: "list_capabilities",
      title: "List Capabilities",
      description: "List the platform capabilities currently exposed by this MCPSurface server.",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of capabilities to return.",
          },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          results: {
            type: "array",
          },
        },
        required: ["results"],
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    {
      name: "search_capabilities",
      title: "Search Capabilities",
      description: "Search for relevant platform capabilities and supporting findings.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural-language or API-focused search query.",
          },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          results: {
            type: "array",
          },
        },
        required: ["results"],
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    {
      name: "execute_capability",
      title: "Execute Capability",
      description: "Execute a specific platform capability with structured inputs.",
      inputSchema: {
        type: "object",
        properties: {
          capabilityKey: {
            type: "string",
            description: "The exact capability key to execute.",
          },
          input: {
            type: "object",
            description: "Input object for the capability.",
            additionalProperties: true,
          },
        },
        required: ["capabilityKey"],
      },
      outputSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
          },
        },
        required: ["status"],
      },
      annotations: {
        openWorldHint: true,
      },
    },
  ];
}

function successResponse(id: string | number | null, result: Record<string, unknown>): McpJsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function errorResponse(id: string | number | null, code: number, message: string, data?: unknown): McpJsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(typeof data === "undefined" ? {} : { data }),
    },
  };
}

function toolSuccess(summary: string, structuredContent: Record<string, unknown>): McpToolResult {
  return {
    content: [
      {
        type: "text",
        text: `${summary}\n\n${JSON.stringify(structuredContent, null, 2)}`,
      },
    ],
    structuredContent,
  };
}

function toolError(message: string): McpToolResult {
  return {
    content: [
      {
        type: "text",
        text: message,
      },
    ],
    isError: true,
  };
}

interface McpServicePort {
  search(platformId: string, userEmail: string, query: string): Promise<{
    results: Array<{
      capability: unknown;
      summary: string;
      findings: Array<{
        title: string;
        summary: string;
        provenanceUrl: string;
      }>;
    }>;
  }>;
  execute(
    platformId: string,
    userEmail: string,
    request: { capabilityKey: string; input: Record<string, unknown> },
  ): Promise<
    | {
        status: "executed";
        trace: ExecutionTrace;
        output?: Record<string, unknown> | undefined;
      }
    | {
        status: "pending_approval";
        approvalRequestId: string;
        approval: ApprovalRequest;
      }
  >;
}
