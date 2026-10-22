import { Link } from "@tanstack/react-router";
import type { ApprovalRequest, ChatMessage } from "@mcpsurface/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatContextPayload } from "../api/chat-api";
import type { ChatActivityStep } from "../hooks/use-platform-chat";

interface ChatWorkspaceProps {
    platformId: string;
    context: ChatContextPayload | null;
    currentUserEmail: string | null;
    approvals: ApprovalRequest[];
    messages: ChatMessage[];
    isLoading: boolean;
    isStreaming: boolean;
    isApproving: boolean;
    statusLabel: string | null;
    activitySteps: ChatActivityStep[];
    activityStartedAt: number | null;
    hasReceivedTerminalMessage: boolean;
    error: string | null;
    onCreateSession: () => Promise<void>;
    onApprovalAction: (approvalId: string, decision: "approve" | "reject") => Promise<void>;
    onSendMessage: (content: string) => Promise<void>;
    onStartRuntime: () => Promise<void>;
    onStopRuntime: () => Promise<void>;
}

export function ChatWorkspace({
    platformId,
    context,
    currentUserEmail,
    approvals,
    messages,
    isLoading,
    isStreaming,
    isApproving,
    statusLabel,
    activitySteps,
    activityStartedAt,
    hasReceivedTerminalMessage,
    error,
    onCreateSession,
    onApprovalAction,
    onSendMessage,
    onStartRuntime,
    onStopRuntime,
}: ChatWorkspaceProps) {
    const [draft, setDraft] = useState("");
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const threadRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const thread = threadRef.current;

        if (!thread) {
            return;
        }

        thread.scrollTop = thread.scrollHeight;
    }, [messages, statusLabel]);

    useEffect(() => {
        if (!isStreaming || !activityStartedAt) {
            setElapsedSeconds(0);
            return;
        }

        const update = () => {
            setElapsedSeconds(Math.max(0, Math.floor((Date.now() - activityStartedAt) / 1000)));
        };

        update();
        const intervalId = window.setInterval(update, 1000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [activityStartedAt, isStreaming]);

    const isBusy = isStreaming || isApproving || isLoading;
    const canSend = draft.trim().length > 0 && !isBusy;
    const runtime = context?.runtime ?? null;
    const isRootUser =
        Boolean(currentUserEmail) &&
        Boolean(context?.platform.ownerEmail) &&
        currentUserEmail?.trim().toLowerCase() ===
            context?.platform.ownerEmail.trim().toLowerCase();
    const pendingSharedApprovals = useMemo(
        () => approvals.filter((approval) => approval.status === "pending"),
        [approvals, messages],
    );
    const runtimeStatusTone = runtime?.status === "running" ? "success" : "neutral";
    const emptyState = useMemo(
        () =>
            context
                ? `Ask about ${context.platform.name}, the runtime state, or tell it to do work through the generated runtime surface.`
                : "Loading chat context...",
        [context],
    );

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!canSend) {
            return;
        }

        const nextDraft = draft;
        setDraft("");
        await onSendMessage(nextDraft);
    }

    return (
        <section className="chat-page">
            <div className="chat-surface panel">
                <div className="chat-toolbar">
                    <div>
                        <p className="eyebrow">Chat</p>
                        <h1>{context?.platform.name ?? "Platform chat"}</h1>
                    </div>
                    <div className="chat-toolbar-actions">
                        {runtime ? (
                            <span className={`status-pill status-pill-${runtimeStatusTone}`}>
                                {runtime.status}
                            </span>
                        ) : null}
                        {runtime ? (
                            <span className="status-pill">{runtime.executionTarget}</span>
                        ) : null}
                        <button
                            className="button button-secondary"
                            onClick={() => void onCreateSession()}
                            type="button"
                        >
                            New chat
                        </button>
                        {runtime ? (
                            <>
                                <button
                                    className="button button-secondary"
                                    disabled={runtime.status === "running" || isBusy}
                                    onClick={() => void onStartRuntime()}
                                    type="button"
                                >
                                    Start runtime
                                </button>
                                <button
                                    className="button button-secondary"
                                    disabled={runtime.status !== "running" || isBusy}
                                    onClick={() => void onStopRuntime()}
                                    type="button"
                                >
                                    Stop runtime
                                </button>
                                <Link
                                    className="button button-secondary"
                                    params={{ platformId, runtimeId: runtime.id }}
                                    to="/platforms/$platformId/runtimes/$runtimeId"
                                >
                                    Runtime
                                </Link>
                            </>
                        ) : null}
                    </div>
                </div>

                {isRootUser && pendingSharedApprovals.length > 0 ? (
                    <div className="chat-approval-sticky-shell">
                        <div className="chat-approval-inbox chat-approval-inbox-sticky">
                            <div className="chat-approval-inbox-header">
                                <div>
                                    <p className="eyebrow">Pending approvals</p>
                                    <p className="chat-status-line">
                                        {pendingSharedApprovals.length} request
                                        {pendingSharedApprovals.length === 1 ? "" : "s"} waiting
                                        from shared users.
                                    </p>
                                </div>
                                {isApproving ? (
                                    <span className="status-pill">Resolving approval</span>
                                ) : null}
                            </div>
                            <div className="chat-attachments">
                                {pendingSharedApprovals.map((approval) => (
                                    <ChatAttachmentCard
                                        key={approval.id}
                                        attachment={{
                                            id: `approval-${approval.id}`,
                                            type: "approval_request",
                                            title: "Approval required",
                                            body: approval.summary,
                                            metadata: {
                                                approvalId: approval.id,
                                                requesterEmail: approval.requesterEmail,
                                                capabilityKey: approval.capabilityKey,
                                                riskLevel: approval.riskLevel,
                                                inputSummary: Object.entries(approval.input)
                                                    .slice(0, 4)
                                                    .map(
                                                        ([key, value]) =>
                                                            `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`,
                                                    )
                                                    .join(", "),
                                                status: approval.status,
                                                traceId: approval.traceId,
                                                createdAt: approval.createdAt,
                                                source: approval.source,
                                            },
                                        }}
                                        currentUserEmail={currentUserEmail}
                                        platformOwnerEmail={context?.platform.ownerEmail ?? null}
                                        onApprovalAction={onApprovalAction}
                                        onQuickReply={(value) => {
                                            setDraft(value);
                                        }}
                                        isBusy={isBusy}
                                        variant="compact"
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="chat-thread" ref={threadRef}>
                    {isLoading ? (
                        <div className="chat-empty muted-text">Loading chat...</div>
                    ) : null}
                    {!isLoading && messages.length === 0 ? (
                        <div className="chat-empty muted-text">{emptyState}</div>
                    ) : null}

                    {messages.map((message) => (
                        <article
                            className={`chat-message chat-message-${message.role}`}
                            key={message.id}
                        >
                            <div className="chat-message-meta">
                                <span>{message.role === "assistant" ? "Assistant" : "You"}</span>
                                <time>
                                    {new Date(message.createdAt).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </time>
                            </div>
                            <div className="chat-bubble">
                                <p>{message.content}</p>
                                {message.attachments.length > 0 ? (
                                    <div className="chat-attachments">
                                        {message.attachments.map((attachment) => (
                                            <ChatAttachmentCard
                                                attachment={attachment}
                                                key={attachment.id}
                                                currentUserEmail={currentUserEmail}
                                                platformOwnerEmail={
                                                    context?.platform.ownerEmail ?? null
                                                }
                                                onApprovalAction={onApprovalAction}
                                                onQuickReply={(value) => {
                                                    setDraft(value);
                                                }}
                                                isBusy={isBusy}
                                                variant="default"
                                            />
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </article>
                    ))}
                </div>

                <div className="chat-footer">
                    {isStreaming && activitySteps.length > 0 ? (
                        <div className="chat-progress-card">
                            <div className="chat-progress-header">
                                <div className="chat-activity-bar">
                                    <span className="chat-activity-dot" />
                                    <p className="chat-status-line">{statusLabel ?? "Working"}</p>
                                </div>
                                <span className="chat-progress-elapsed">
                                    {formatElapsedTime(elapsedSeconds)}
                                </span>
                            </div>
                            <div className="chat-progress-steps">
                                {activitySteps.slice(-4).map((step, index) => {
                                    const isCurrent = index === activitySteps.slice(-4).length - 1;

                                    return (
                                        <div
                                            className={`chat-progress-step ${isCurrent ? "chat-progress-step-current" : ""}`}
                                            key={`${step.stage}-${step.startedAt}`}
                                        >
                                            <span className="chat-progress-step-dot" />
                                            <span>{step.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                    {!isStreaming && statusLabel && !hasReceivedTerminalMessage ? (
                        <p className="chat-status-line">
                            {statusLabel}. If this takes too long, try asking for a smaller or more
                            specific step.
                        </p>
                    ) : null}
                    {error ? <p className="error-text">{error}</p> : null}
                    <form className="chat-composer" onSubmit={handleSubmit}>
                        <textarea
                            className="chat-input"
                            disabled={isStreaming}
                            onChange={(event) => setDraft(event.target.value)}
                            placeholder="Ask the platform to do work, explain a failure, or inspect the runtime."
                            rows={4}
                            value={draft}
                        />
                        <div className="chat-composer-actions">
                            <span className="muted-text">
                                The assistant orchestrates runtime actions through generated
                                capabilities.
                            </span>
                            <button
                                className="button button-primary"
                                disabled={!canSend}
                                type="submit"
                            >
                                {isApproving ? "Resolving..." : isStreaming ? "Working..." : "Send"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </section>
    );
}

function formatElapsedTime(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes <= 0) {
        return `${seconds}s`;
    }

    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function ChatAttachmentCard({
    attachment,
    currentUserEmail,
    platformOwnerEmail,
    onApprovalAction,
    onQuickReply,
    isBusy,
    variant,
}: {
    attachment: ChatMessage["attachments"][number];
    currentUserEmail: string | null;
    platformOwnerEmail: string | null;
    onApprovalAction: (approvalId: string, decision: "approve" | "reject") => Promise<void>;
    onQuickReply: (value: string) => void;
    isBusy: boolean;
    variant: "compact" | "default";
}) {
    const status =
        typeof attachment.metadata.status === "string" ? attachment.metadata.status : null;
    const requesterEmail =
        typeof attachment.metadata.requesterEmail === "string"
            ? attachment.metadata.requesterEmail
            : null;
    const capabilityKey =
        typeof attachment.metadata.capabilityKey === "string"
            ? attachment.metadata.capabilityKey
            : null;
    const riskLevel =
        typeof attachment.metadata.riskLevel === "string" ? attachment.metadata.riskLevel : null;
    const inputSummary =
        typeof attachment.metadata.inputSummary === "string"
            ? attachment.metadata.inputSummary
            : null;
    const approvalId =
        typeof attachment.metadata.approvalId === "string" ? attachment.metadata.approvalId : null;
    const createdAt =
        typeof attachment.metadata.createdAt === "string" ? attachment.metadata.createdAt : null;
    const source =
        typeof attachment.metadata.source === "string" ? attachment.metadata.source : null;
    const isRootUser =
        Boolean(currentUserEmail) &&
        Boolean(platformOwnerEmail) &&
        currentUserEmail?.trim().toLowerCase() === platformOwnerEmail?.trim().toLowerCase();

    return (
        <div
            className={`chat-attachment chat-attachment-${attachment.type} ${variant === "compact" ? "chat-attachment-compact" : ""}`}
        >
            <div className="chat-attachment-header">
                <strong>{attachment.title}</strong>
            </div>
            {attachment.body ? <p>{attachment.body}</p> : null}
            {attachment.type === "approval_request" ? (
                <div className="chat-attachment-details">
                    {requesterEmail ? (
                        <p>
                            <strong>Requester:</strong> {requesterEmail}
                        </p>
                    ) : null}
                    {capabilityKey ? (
                        <p>
                            <strong>Capability:</strong> {capabilityKey}
                        </p>
                    ) : null}
                    {riskLevel ? (
                        <p>
                            <strong>Risk:</strong> {riskLevel}
                        </p>
                    ) : null}
                    {inputSummary ? (
                        <p>
                            <strong>Input:</strong> {inputSummary}
                        </p>
                    ) : null}
                    {source ? (
                        <p>
                            <strong>Source:</strong> {source}
                        </p>
                    ) : null}
                    {createdAt ? (
                        <p>
                            <strong>Requested:</strong> {new Date(createdAt).toLocaleString()}
                        </p>
                    ) : null}
                    {status ? (
                        <p>
                            <strong>Status:</strong> {status}
                        </p>
                    ) : null}
                </div>
            ) : null}
            {attachment.type === "approval_request" ? (
                <div className="chat-attachment-actions">
                    {status === "pending" && isRootUser && approvalId ? (
                        <>
                            <button
                                className="button button-secondary"
                                disabled={isBusy}
                                onClick={() => void onApprovalAction(approvalId, "approve")}
                                type="button"
                            >
                                Approve
                            </button>
                            <button
                                className="button button-secondary"
                                disabled={isBusy}
                                onClick={() => void onApprovalAction(approvalId, "reject")}
                                type="button"
                            >
                                Reject
                            </button>
                        </>
                    ) : status === "pending" ? (
                        <span className="muted-text">Pending approval</span>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
