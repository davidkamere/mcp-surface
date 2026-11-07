import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { usePlatformResearch } from "../../research/hooks/use-platform-research";
import { usePlatformRuntime } from "../hooks/use-platform-runtime";
import { ResearchUnlockPanel } from "../../platforms/components/research-unlock-panel";

interface RuntimeDetailPageProps {
    platformId: string;
    runtimeId: string;
}

export function RuntimeDetailPage({ platformId, runtimeId }: RuntimeDetailPageProps) {
    const { runtime, traces, isLoading, isMutating, error, start, stop, execute } =
        usePlatformRuntime(platformId, runtimeId);
    const { capabilities, isLoading: isCapabilitiesLoading } = usePlatformResearch(platformId);
    const [capabilityKey, setCapabilityKey] = useState("");
    const [inputText, setInputText] = useState("{}");
    const [executionError, setExecutionError] = useState<string | null>(null);

    const capabilityOptions = useMemo(
        () =>
            capabilities
                .filter(
                    (capability) =>
                        !capability.tags?.some((tag) => tag.toLowerCase().includes("deprecated")),
                )
                .sort((left, right) => left.name.localeCompare(right.name)),
        [capabilities],
    );

    if (
        !isLoading &&
        error?.toLowerCase().includes("generated artifacts are required")
    ) {
        return <ResearchUnlockPanel researchCompleted={false} backToPlatformId={platformId} />;
    }

    async function handleExecute() {
        try {
            const parsedInput = JSON.parse(inputText) as Record<string, unknown>;
            setExecutionError(null);
            await execute({
                capabilityKey,
                input: parsedInput,
            });
        } catch (requestError) {
            setExecutionError(
                requestError instanceof Error ? requestError.message : "Execution failed.",
            );
        }
    }

    if (isLoading) {
        return <section className="panel">Loading runtime...</section>;
    }

    if (error) {
        return <section className="panel error-text">{error}</section>;
    }

    if (!runtime) {
        return <section className="panel">Runtime not found.</section>;
    }

    return (
        <div className="research-page-shell">
            <div className="research-page-header">
                <div>
                    <p className="eyebrow">Runtime</p>
                    <h1>{runtime.id}</h1>
                </div>
                <Link
                    className="button button-secondary"
                    params={{ platformId }}
                    to="/platforms/$platformId"
                >
                    Back to platform
                </Link>
            </div>

            <section className="panel runtime-detail-grid">
                <div className="runtime-detail-main">
                    <div className="setup-block">
                        <div className="panel-header">
                            <div>
                                <p className="eyebrow">Context</p>
                                <h2>Runtime details</h2>
                            </div>
                            <span className="capability-pill">{runtime.executionTarget}</span>
                        </div>

                        <div className="detail-grid">
                            <div className="summary-stat">
                                <strong>{runtime.status}</strong>
                                <span>Status</span>
                            </div>
                            <div className="summary-stat">
                                <strong>{runtime.ownerEmail}</strong>
                                <span>Owner</span>
                            </div>
                            <div className="summary-stat">
                                <strong>
                                    {runtime.lastStartedAt
                                        ? new Date(runtime.lastStartedAt).toLocaleString()
                                        : "Never"}
                                </strong>
                                <span>Last started</span>
                            </div>
                            <div className="summary-stat">
                                <strong>
                                    {runtime.lastStoppedAt
                                        ? new Date(runtime.lastStoppedAt).toLocaleString()
                                        : "Never"}
                                </strong>
                                <span>Last stopped</span>
                            </div>
                        </div>

                        <pre className="runtime-metadata-block">
                            {JSON.stringify(runtime.targetMetadata, null, 2)}
                        </pre>

                        <div className="runtime-actions-row">
                            <button
                                className="button button-secondary"
                                disabled={isMutating || runtime.status === "running"}
                                onClick={() => void start()}
                                type="button"
                            >
                                Start
                            </button>
                            <button
                                className="button button-secondary"
                                disabled={isMutating || runtime.status !== "running"}
                                onClick={() => void stop()}
                                type="button"
                            >
                                Stop
                            </button>
                        </div>
                    </div>

                    <div className="setup-block">
                        <div className="panel-header">
                            <div>
                                <p className="eyebrow">Execute</p>
                                <h2>Test capability execution</h2>
                            </div>
                        </div>

                        <label className="form-field">
                            <span className="form-label">Capability</span>
                            <select
                                className="text-input"
                                onChange={(event) => setCapabilityKey(event.target.value)}
                                value={capabilityKey}
                            >
                                <option value="">Select a capability</option>
                                {capabilityOptions.map((capability) => (
                                    <option key={capability.id} value={capability.key}>
                                        {capability.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <FormJsonField value={inputText} onChange={setInputText} />

                        {executionError ? <p className="error-text">{executionError}</p> : null}

                        <div className="runtime-actions-row">
                            <button
                                className="button button-primary"
                                disabled={isMutating || !capabilityKey || isCapabilitiesLoading}
                                onClick={() => void handleExecute()}
                                type="button"
                            >
                                Execute capability
                            </button>
                        </div>
                    </div>
                </div>

                <aside className="runtime-detail-sidebar">
                    <div className="setup-block">
                        <div className="panel-header">
                            <div>
                                <p className="eyebrow">Traces</p>
                                <h2>Execution history</h2>
                            </div>
                        </div>

                        {traces.length > 0 ? (
                            <ul className="artifact-item-list">
                                {traces.map((trace) => (
                                    <li className="artifact-item trace-item" key={trace.id}>
                                        <div>
                                            <strong>{trace.capabilityKey}</strong>
                                            <p className="muted-text">
                                                {trace.status} • {trace.executionTarget} •{" "}
                                                {new Date(trace.startedAt).toLocaleString()}
                                            </p>
                                            {trace.error ? (
                                                <p className="error-text">{trace.error}</p>
                                            ) : null}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="muted-text">No execution traces yet.</p>
                        )}
                    </div>
                </aside>
            </section>
        </div>
    );
}

function FormJsonField({
    value,
    onChange,
}: {
    value: string;
    onChange: (nextValue: string) => void;
}) {
    return (
        <label className="form-field">
            <span className="form-label">Input JSON</span>
            <textarea
                className="text-area"
                onChange={(event) => onChange(event.target.value)}
                rows={8}
                value={value}
            />
        </label>
    );
}
