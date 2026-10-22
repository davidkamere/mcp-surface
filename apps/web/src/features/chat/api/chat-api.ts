import type {
    ApprovalRequest,
    ChatMessage,
    ChatSession,
    CreateChatSessionInput,
    Platform,
    ResearchFinding,
    WorkspaceRuntime,
    Capability,
    ExecutionTrace,
} from "@mcpsurface/shared";
import {
    approvalResolutionResponseSchema,
    approvalsResponseSchema,
    approvalResponseSchema,
    chatContextResponseSchema,
    chatMessagesResponseSchema,
    chatSessionResponseSchema,
    chatSessionsResponseSchema,
    createChatMessageInputSchema,
    createChatSessionInputSchema,
} from "@mcpsurface/shared";
import { buildApiError, getApiBaseUrl } from "../../../lib/api-client";

const apiBaseUrl = getApiBaseUrl();

export interface ChatContextPayload {
    platform: Platform;
    runtime: WorkspaceRuntime;
    capabilities: Capability[];
    findings: ResearchFinding[];
    traces: ExecutionTrace[];
    logs: Array<{
        id: string;
        level: "info" | "error";
        message: string;
        createdAt: string;
    }>;
}

export async function listPlatformApprovals(
    platformId: string,
    userId: string,
    userEmail: string,
): Promise<ApprovalRequest[]> {
    const response = await fetch(`${apiBaseUrl}/api/platforms/${platformId}/approvals`, {
        headers: {
            "x-user-id": userId,
            "x-user-email": userEmail,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to load approvals."));
    }

    const json = await response.json();
    return approvalsResponseSchema.parse(json).approvals;
}

export async function approvePlatformApproval(
    approvalId: string,
    userEmail: string,
): Promise<void> {
    const response = await fetch(`${apiBaseUrl}/api/approvals/${approvalId}/approve`, {
        method: "POST",
        headers: {
            "x-user-email": userEmail,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to approve request."));
    }

    approvalResolutionResponseSchema.parse(await response.json());
}

export async function rejectPlatformApproval(approvalId: string, userEmail: string): Promise<void> {
    const response = await fetch(`${apiBaseUrl}/api/approvals/${approvalId}/reject`, {
        method: "POST",
        headers: {
            "x-user-email": userEmail,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to reject request."));
    }

    approvalResponseSchema.parse(await response.json());
}

export interface ChatStreamHandlers {
    onStatus?: (payload: { stage: string; label: string }) => void;
    onDelta?: (text: string) => void;
    onMessage?: (message: ChatMessage) => void;
    onError?: (message: string) => void;
}

const CHAT_STREAM_TIMEOUT_MS = 20_000;

export async function listChatSessions(
    platformId: string,
    userId: string,
    userEmail: string,
): Promise<ChatSession[]> {
    const response = await fetch(`${apiBaseUrl}/api/platforms/${platformId}/chat/sessions`, {
        headers: {
            "x-user-id": userId,
            "x-user-email": userEmail,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to load chat sessions."));
    }

    const json = await response.json();
    return chatSessionsResponseSchema.parse(json).sessions;
}

export async function createChatSession(
    platformId: string,
    input: CreateChatSessionInput,
    userId: string,
    userEmail: string,
): Promise<ChatSession> {
    const response = await fetch(`${apiBaseUrl}/api/platforms/${platformId}/chat/sessions`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-user-id": userId,
            "x-user-email": userEmail,
        },
        body: JSON.stringify(createChatSessionInputSchema.parse(input)),
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to create chat session."));
    }

    const json = await response.json();
    return chatSessionResponseSchema.parse(json).session;
}

export async function listChatMessages(
    sessionId: string,
    userId: string,
    userEmail: string,
): Promise<ChatMessage[]> {
    const response = await fetch(`${apiBaseUrl}/api/chat/sessions/${sessionId}/messages`, {
        headers: {
            "x-user-id": userId,
            "x-user-email": userEmail,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to load chat messages."));
    }

    const json = await response.json();
    return chatMessagesResponseSchema.parse(json).messages;
}

export async function getChatContext(
    platformId: string,
    userId: string,
    userEmail: string,
): Promise<ChatContextPayload> {
    const response = await fetch(`${apiBaseUrl}/api/platforms/${platformId}/chat/context`, {
        headers: {
            "x-user-id": userId,
            "x-user-email": userEmail,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to load chat context."));
    }

    const json = await response.json();
    return chatContextResponseSchema.parse(json);
}

export async function streamChatTurn(input: {
    sessionId: string;
    content: string;
    userId: string;
    userEmail: string;
    handlers: ChatStreamHandlers;
}) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
        () => controller.abort(new Error("CHAT_STREAM_TIMEOUT")),
        CHAT_STREAM_TIMEOUT_MS,
    );

    const response = await fetch(`${apiBaseUrl}/api/chat/sessions/${input.sessionId}/stream`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-user-id": input.userId,
            "x-user-email": input.userEmail,
        },
        body: JSON.stringify(createChatMessageInputSchema.parse({ content: input.content })),
        signal: controller.signal,
    });

    if (!response.ok || !response.body) {
        window.clearTimeout(timeoutId);
        throw new Error(await buildApiError(response, "Unable to stream chat response."));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";

            for (const eventText of events) {
                const eventName = matchField(eventText, "event");
                const dataValue = matchField(eventText, "data");

                if (!eventName || !dataValue) {
                    continue;
                }

                const parsed = JSON.parse(dataValue) as unknown;

                switch (eventName) {
                    case "status":
                        input.handlers.onStatus?.(parsed as { stage: string; label: string });
                        break;
                    case "assistant_delta":
                        input.handlers.onDelta?.((parsed as { text?: string }).text ?? "");
                        break;
                    case "assistant_message":
                        input.handlers.onMessage?.((parsed as { message: ChatMessage }).message);
                        break;
                    case "error":
                        input.handlers.onError?.(
                            (parsed as { message?: string }).message ?? "Chat request failed.",
                        );
                        break;
                    default:
                        break;
                }
            }
        }
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw new Error(
                "This took longer than expected and was stopped after 20 seconds. The platform may still be busy, or the runtime may need a smaller, more specific step.",
            );
        }

        throw error;
    } finally {
        window.clearTimeout(timeoutId);
    }
}

function matchField(eventText: string, fieldName: string) {
    const line = eventText.split("\n").find((entry) => entry.startsWith(`${fieldName}:`));

    return line ? line.slice(fieldName.length + 1).trim() : null;
}
