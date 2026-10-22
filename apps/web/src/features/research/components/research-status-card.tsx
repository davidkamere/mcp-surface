import { useEffect, useState } from "react";
import type { ResearchJob } from "@mcpsurface/shared";

interface ResearchStatusCardProps {
    job: ResearchJob | null;
    isStarting: boolean;
    isPolling: boolean;
    lastSyncedAt: number | null;
    error: string | null;
    onStart: () => Promise<void>;
}

export function ResearchStatusCard({
    job,
    isStarting,
    isPolling,
    lastSyncedAt,
    error,
    onStart,
}: ResearchStatusCardProps) {
    const [now, setNow] = useState(Date.now());
    const stages = [
        { key: "source_discovery", label: "Discovery" },
        { key: "structured_parsing", label: "Structured parsing" },
        { key: "docs_extraction", label: "Docs extraction" },
        { key: "capability_synthesis", label: "Synthesis" },
    ] as const;
    const isRunning = job?.status === "running" || job?.status === "queued";
    const startedAtMs = job?.startedAt ? Date.parse(job.startedAt) : null;
    const updatedAtMs = job?.updatedAt ? Date.parse(job.updatedAt) : null;
    const runningForSeconds = startedAtMs ? Math.max(0, Math.floor((now - startedAtMs) / 1000)) : 0;
    const secondsSinceUpdate = updatedAtMs
        ? Math.max(0, Math.floor((now - updatedAtMs) / 1000))
        : 0;
    const secondsSinceSync = lastSyncedAt
        ? Math.max(0, Math.floor((now - lastSyncedAt) / 1000))
        : 0;

    useEffect(() => {
        if (!isRunning) {
            return;
        }

        const intervalId = window.setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [isRunning]);

    return (
        <section className="panel research-hero-card">
            <div className="research-hero-top">
                <div>
                    <p className="eyebrow">Research</p>
                    <h2>Build the operation inventory</h2>
                </div>
            </div>

            {job ? (
                <>
                    <div className="stats-grid compact-stats-grid">
                        <div className="stat-card">
                            <span className={`status-badge status-${job.status}`}>
                                {job.status}
                            </span>
                            <p className="muted-text">Run status</p>
                        </div>
                        <div className="stat-card">
                            <strong>
                                {isRunning ? formatElapsedTime(runningForSeconds) : "Done"}
                            </strong>
                            <p className="muted-text">Elapsed</p>
                        </div>
                        <div className="stat-card">
                            <strong>{job.sourceCount}</strong>
                            <p className="muted-text">Discovered sources</p>
                        </div>
                        <div className="stat-card">
                            <strong>{job.findingCount}</strong>
                            <p className="muted-text">Research notes</p>
                        </div>
                        <div className="stat-card">
                            <strong>{job.capabilityCount}</strong>
                            <p className="muted-text">Operations synthesized</p>
                        </div>
                    </div>

                    <div className="stage-panel research-stage-panel">
                        {isRunning ? (
                            <div className="research-live-banner">
                                <div className="research-live-banner-main">
                                    <span className="research-live-dot" />
                                    <strong>
                                        {job.status === "queued"
                                            ? "Queued and waiting to start"
                                            : "Research is still running"}
                                    </strong>
                                </div>
                                <div className="research-live-banner-meta">
                                    <span>
                                        Last job update {formatRelativeSeconds(secondsSinceUpdate)}
                                    </span>
                                    <span>
                                        Last UI check {formatRelativeSeconds(secondsSinceSync)}
                                    </span>
                                    {isPolling ? <span>Polling automatically</span> : null}
                                </div>
                            </div>
                        ) : null}
                        <div className="result-row">
                            <strong>Current stage</strong>
                            <span className={`status-badge status-${job.status}`}>
                                {job.currentStage}
                            </span>
                        </div>
                        <p>{job.stageMessage}</p>
                        {isRunning ? (
                            <p className="muted-text">
                                The page polls automatically while research is running. Counts,
                                stage messages, and source-level progress should update without a
                                refresh.
                            </p>
                        ) : null}
                        <div className="stage-list">
                            {stages.map((stage) => {
                                const isActive = job.currentStage === stage.key;
                                const isDone =
                                    job.currentStage === "completed" ||
                                    stages.findIndex((entry) => entry.key === job.currentStage) >
                                        stages.findIndex((entry) => entry.key === stage.key);

                                return (
                                    <div
                                        className={`stage-item${isActive ? " stage-item-active" : ""}${isDone ? " stage-item-done" : ""}`}
                                        key={stage.key}
                                    >
                                        <span className="stage-dot" />
                                        <span>{stage.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            ) : (
                <div className="stage-panel research-stage-panel">
                    <p className="muted-text">
                        No research job yet. Save sources, then run the workflow.
                    </p>
                </div>
            )}

            <div className="research-hero-actions">
                <button
                    className="button button-primary"
                    disabled={isStarting || isRunning}
                    onClick={() => void onStart()}
                    type="button"
                >
                    {isStarting
                        ? "Starting..."
                        : isRunning
                          ? "Research running..."
                          : "Start research"}
                </button>
            </div>

            {job?.errorMessage ? <p className="error-text">{job.errorMessage}</p> : null}
            {error ? <p className="error-text">{error}</p> : null}
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

function formatRelativeSeconds(totalSeconds: number) {
    if (totalSeconds <= 1) {
        return "just now";
    }

    return `${totalSeconds}s ago`;
}
