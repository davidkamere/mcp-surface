import { Link } from "@tanstack/react-router";
import type { WorkspaceRuntime } from "@mcpsurface/shared";

interface RuntimeSummarySectionProps {
  platformId: string;
  runtime: WorkspaceRuntime | null;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  onStart: () => Promise<unknown>;
  onStop: () => Promise<unknown>;
  showDetailLink?: boolean;
}

export function RuntimeSummarySection({
  platformId,
  runtime,
  isLoading,
  isMutating,
  error,
  onStart,
  onStop,
  showDetailLink = true,
}: RuntimeSummarySectionProps) {
  return (
    <section className="panel runtime-summary-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Runtime</p>
          <h2>Execution boundary</h2>
        </div>
        {runtime && showDetailLink ? (
          <Link
            className="button button-secondary"
            params={{ platformId, runtimeId: runtime.id }}
            to="/platforms/$platformId/runtimes/$runtimeId"
          >
            Open runtime
          </Link>
        ) : null}
      </div>

      {isLoading ? <p className="muted-text">Loading runtime...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {runtime ? (
        <>
          <div className="summary-stats">
            <div className="summary-stat">
              <strong>{runtime.status}</strong>
              <span>Status</span>
            </div>
            <div className="summary-stat">
              <strong>{runtime.executionTarget}</strong>
              <span>Target</span>
            </div>
            <div className="summary-stat">
              <strong>{runtime.lastStartedAt ? new Date(runtime.lastStartedAt).toLocaleTimeString() : "Not started"}</strong>
              <span>Last started</span>
            </div>
          </div>

          <div className="runtime-actions-row">
            <button
              className="button button-secondary"
              disabled={isMutating || runtime.status === "running"}
              onClick={() => void onStart()}
              type="button"
            >
              Start
            </button>
            <button
              className="button button-secondary"
              disabled={isMutating || runtime.status !== "running"}
              onClick={() => void onStop()}
              type="button"
            >
              Stop
            </button>
          </div>
        </>
      ) : !isLoading && !error ? (
        <p className="muted-text">Runtime will appear automatically once generated artifacts are available.</p>
      ) : null}
    </section>
  );
}
