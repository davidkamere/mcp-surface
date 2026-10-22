import { useUser } from "@clerk/clerk-react";
import type { ApprovalRequest, ChatMessage, ChatSession } from "@mcpsurface/shared";
import { useEffect, useMemo, useState } from "react";
import { startRuntime, stopRuntime } from "../../runtimes/api/runtimes-api";
import {
    approvePlatformApproval,
    createChatSession,
    getChatContext,
    listPlatformApprovals,
    listChatMessages,
    listChatSessions,
    rejectPlatformApproval,
    streamChatTurn,
    type ChatContextPayload,
} from "../api/chat-api";

export interface ChatActivityStep {
    stage: string;
    label: string;
    startedAt: number;
}

export function usePlatformChat(platformId: string) {
    const { user, isLoaded } = useUser();
    const currentUserEmail = resolveUserEmail(user);
    const [context, setContext] = useState<ChatContextPayload | null>(null);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isStreaming, setIsStreaming] = useState(false);
    const [statusLabel, setStatusLabel] = useState<string | null>(null);
    const [activitySteps, setActivitySteps] = useState<ChatActivityStep[]>([]);
    const [activityStartedAt, setActivityStartedAt] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasReceivedTerminalMessage, setHasReceivedTerminalMessage] = useState(true);
    const [isApproving, setIsApproving] = useState(false);
    const [reloadToken, setReloadToken] = useState(0);

    useEffect(() => {
        if (!isLoaded) {
            return;
        }

        const userId = user?.id;
        const userEmail = resolveUserEmail(user);

        if (!userId || !userEmail) {
            setIsLoading(false);
            return;
        }

        const resolvedUserId = userId;
        const resolvedUserEmail = userEmail;
        let cancelled = false;

        async function load() {
            setIsLoading(true);

            try {
                const nextContext = await getChatContext(
                    platformId,
                    resolvedUserId,
                    resolvedUserEmail,
                );
                const nextApprovals = await listPlatformApprovals(
                    platformId,
                    resolvedUserId,
                    resolvedUserEmail,
                );
                const nextSessions = await listChatSessions(
                    platformId,
                    resolvedUserId,
                    resolvedUserEmail,
                );
                const activeSession =
                    nextSessions[0] ??
                    (await createChatSession(
                        platformId,
                        { title: `${nextContext.platform.name} chat` },
                        resolvedUserId,
                        resolvedUserEmail,
                    ));
                const nextMessages = await listChatMessages(
                    activeSession.id,
                    resolvedUserId,
                    resolvedUserEmail,
                );

                if (!cancelled) {
                    setContext(nextContext);
                    setSessions(nextSessions.length > 0 ? nextSessions : [activeSession]);
                    setActiveSessionId(activeSession.id);
                    setMessages(nextMessages);
                    setApprovals(nextApprovals);
                    setError(null);
                }
            } catch (requestError) {
                if (!cancelled) {
                    setError(
                        requestError instanceof Error
                            ? requestError.message
                            : "Unable to load chat.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        void load();

        return () => {
            cancelled = true;
        };
    }, [isLoaded, platformId, reloadToken, user]);

    const activeSession = useMemo(
        () => sessions.find((session) => session.id === activeSessionId) ?? null,
        [activeSessionId, sessions],
    );

    async function createNewSession() {
        const userId = user?.id;
        const userEmail = resolveUserEmail(user);

        if (!userId || !userEmail || !context) {
            return;
        }

        const session = await createChatSession(
            platformId,
            { title: `${context.platform.name} chat` },
            userId,
            userEmail,
        );
        setSessions((current) => [session, ...current]);
        setActiveSessionId(session.id);
        setMessages([]);
    }

    async function refresh() {
        setReloadToken((value) => value + 1);
    }

    async function refreshChatState(userId: string, userEmail: string, sessionId: string | null) {
        const [nextContext, nextApprovals, nextSessions, nextMessages] = await Promise.all([
            getChatContext(platformId, userId, userEmail),
            listPlatformApprovals(platformId, userId, userEmail),
            listChatSessions(platformId, userId, userEmail),
            sessionId ? listChatMessages(sessionId, userId, userEmail) : Promise.resolve(messages),
        ]);

        setContext(nextContext);
        setApprovals(nextApprovals);
        setSessions(nextSessions);
        if (sessionId) {
            setMessages(nextMessages);
        }
    }

    async function sendMessage(content: string) {
        const trimmedContent = content.trim();
        const userId = user?.id;
        const userEmail = resolveUserEmail(user);
        const session = activeSession;
        const snapshot = context;

        if (!trimmedContent || !userId || !userEmail || !session || !snapshot) {
            return;
        }

        setIsStreaming(true);
        setError(null);
        setStatusLabel("Thinking");
        setActivityStartedAt(Date.now());
        setActivitySteps([
            {
                stage: "thinking",
                label: "Thinking",
                startedAt: Date.now(),
            },
        ]);
        setHasReceivedTerminalMessage(false);
        let receivedTerminalMessage = false;

        const optimisticUserMessage: ChatMessage = {
            id: `optimistic-user-${Date.now()}`,
            sessionId: session.id,
            platformId,
            runtimeId: snapshot.runtime.id,
            userEmail,
            role: "user",
            content: trimmedContent,
            attachments: [],
            createdAt: new Date().toISOString(),
        };
        const optimisticAssistantId = `optimistic-assistant-${Date.now()}`;
        const optimisticAssistant: ChatMessage = {
            id: optimisticAssistantId,
            sessionId: session.id,
            platformId,
            runtimeId: snapshot.runtime.id,
            userEmail,
            role: "assistant",
            content: "",
            attachments: [],
            createdAt: new Date().toISOString(),
        };

        setMessages((current) => [...current, optimisticUserMessage, optimisticAssistant]);

        try {
            await streamChatTurn({
                sessionId: session.id,
                content: trimmedContent,
                userId,
                userEmail,
                handlers: {
                    onStatus: ({ stage, label }) => {
                        setStatusLabel(label);
                        setActivitySteps((current) => {
                            const last = current[current.length - 1];

                            if (last?.stage === stage && last.label === label) {
                                return current;
                            }

                            return [
                                ...current,
                                {
                                    stage,
                                    label,
                                    startedAt: Date.now(),
                                },
                            ];
                        });
                    },
                    onDelta: (text) => {
                        setMessages((current) =>
                            current.map((message) =>
                                message.id === optimisticAssistantId
                                    ? {
                                          ...message,
                                          content: `${message.content}${text}`,
                                      }
                                    : message,
                            ),
                        );
                    },
                    onMessage: (message) => {
                        receivedTerminalMessage = true;
                        setHasReceivedTerminalMessage(true);
                        setMessages((current) =>
                            current.map((entry) =>
                                entry.id === optimisticAssistantId ? message : entry,
                            ),
                        );
                        setActivitySteps((current) =>
                            current.length > 0
                                ? [
                                      ...current,
                                      {
                                          stage: "completed",
                                          label: "Completed",
                                          startedAt: Date.now(),
                                      },
                                  ]
                                : current,
                        );
                    },
                    onError: (message) => {
                        setError(message);
                        receivedTerminalMessage = true;
                        setHasReceivedTerminalMessage(true);
                        setActivitySteps((current) => [
                            ...current,
                            {
                                stage: "failed",
                                label: "Failed",
                                startedAt: Date.now(),
                            },
                        ]);
                    },
                },
            });

            await refreshChatState(userId, userEmail, session.id);
        } catch (requestError) {
            const message =
                requestError instanceof Error ? requestError.message : "Unable to send message.";
            setError(message);
            receivedTerminalMessage = true;
            setHasReceivedTerminalMessage(true);
            setActivitySteps((current) => [
                ...current,
                {
                    stage: "failed",
                    label: "Failed",
                    startedAt: Date.now(),
                },
            ]);
            setMessages((current) =>
                current.map((entry) =>
                    entry.id === optimisticAssistantId
                        ? {
                              ...entry,
                              content:
                                  entry.content.trim().length > 0
                                      ? `${entry.content.trim()}\n\n${message}`
                                      : message,
                          }
                        : entry,
                ),
            );
        } finally {
            setIsStreaming(false);
            setStatusLabel((current) => (receivedTerminalMessage ? null : current));
        }
    }

    async function runRuntimeAction(action: "start" | "stop") {
        const userId = user?.id;
        const userEmail = resolveUserEmail(user);
        const runtime = context?.runtime;

        if (!userId || !userEmail || !runtime) {
            return;
        }

        setError(null);

        try {
            const nextRuntime =
                action === "start"
                    ? await startRuntime(runtime.id, userId, userEmail)
                    : await stopRuntime(runtime.id, userId, userEmail);
            setContext((current) => (current ? { ...current, runtime: nextRuntime } : current));
            const nextApprovals = await listPlatformApprovals(platformId, userId, userEmail);
            setApprovals(nextApprovals);
        } catch (requestError) {
            setError(
                requestError instanceof Error ? requestError.message : "Runtime action failed.",
            );
        }
    }

    async function resolveApproval(approvalId: string, decision: "approve" | "reject") {
        const userEmail = resolveUserEmail(user);
        const userId = user?.id;

        if (!userEmail || !userId) {
            return;
        }

        setIsApproving(true);
        setError(null);

        try {
            if (decision === "approve") {
                await approvePlatformApproval(approvalId, userEmail);
            } else {
                await rejectPlatformApproval(approvalId, userEmail);
            }

            await refreshChatState(userId, userEmail, activeSessionId);
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "Unable to resolve approval.",
            );
        } finally {
            setIsApproving(false);
        }
    }

    return {
        context,
        currentUserEmail,
        approvals,
        messages,
        activeSession,
        sessions,
        isLoading,
        isStreaming,
        statusLabel,
        activitySteps,
        activityStartedAt,
        hasReceivedTerminalMessage,
        error,
        isApproving,
        refresh,
        createNewSession,
        sendMessage,
        resolveApproval,
        startRuntime: () => runRuntimeAction("start"),
        stopRuntime: () => runRuntimeAction("stop"),
    };
}

function resolveUserEmail(
    user:
        | {
              primaryEmailAddress?: { emailAddress: string | null } | null;
              emailAddresses?: Array<{ emailAddress: string | null }>;
          }
        | null
        | undefined,
) {
    return (
        user?.primaryEmailAddress?.emailAddress ??
        user?.emailAddresses?.find((entry) => Boolean(entry.emailAddress))?.emailAddress ??
        null
    );
}
