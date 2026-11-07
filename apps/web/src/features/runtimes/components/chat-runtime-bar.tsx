import { Link } from "@tanstack/react-router";
import type { WorkspaceRuntime } from "@mcpsurface/shared";
import { useState } from "react";

interface ChatRuntimeBarProps {
    platformId: string;
    runtime: WorkspaceRuntime | null;
    isLoading: boolean;
    isBusy: boolean;
    error: string | null;
    onStart: () => Promise<unknown>;
    onStop: () => Promise<unknown>;
}

export function ChatRuntimeBar({
    platformId,
    runtime,
    isLoading,
    isBusy,
    error,
    onStart,
    onStop,
}: ChatRuntimeBarProps) {
    const isRunning = runtime?.status === "running";
    const [isMutating, setIsMutating] = useState(false);

    async function handleRuntimeToggle() {
        setIsMutating(true);
        try {
            await (isRunning ? onStop() : onStart());
        } finally {
            setIsMutating(false);
        }
    }

    return (
        <section className="chat-runtime-bar" aria-label="Platform runtime">
            <div className="chat-runtime-main">
                <span className="chat-runtime-mark" aria-hidden="true">R</span>
                <div className="chat-runtime-copy">
                    <span className="eyebrow">Runtime</span>
                    <strong>
                        {runtime
                            ? runtime.executionTarget
                            : isLoading
                              ? "Connecting to runtime…"
                              : "Runtime unavailable"}
                    </strong>
                </div>
                {runtime ? (
                    <span className="chat-runtime-meta">
                        <span
                            className={`chat-runtime-dot${isRunning ? " chat-runtime-dot-running" : ""}`}
                        />
                        {runtime.status}
                        {runtime.lastStartedAt
                            ? ` · started ${new Date(runtime.lastStartedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : " · not started"}
                    </span>
                ) : error && !isLoading ? (
                    <span className="chat-runtime-loading">{error}</span>
                ) : null}
            </div>

            {runtime ? (
                <div className="chat-runtime-actions">
                    <button
                        className={`button${isRunning ? " button-secondary" : " button-primary"}`}
                        disabled={isBusy || isMutating}
                        onClick={() => void handleRuntimeToggle()}
                        type="button"
                    >
                        {isBusy || isMutating
                            ? "Updating…"
                            : isRunning
                              ? "Stop runtime"
                              : "Start runtime"}
                    </button>
                    <Link
                        className="chat-runtime-detail-link"
                        params={{ platformId, runtimeId: runtime.id }}
                        to="/platforms/$platformId/runtimes/$runtimeId"
                    >
                        Runtime details
                    </Link>
                </div>
            ) : null}
        </section>
    );
}
