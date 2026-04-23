import type { ResearchJob } from "@mcpsurface/shared";

interface ResearchStatusCardProps {
  job: ResearchJob | null;
  isStarting: boolean;
  error: string | null;
  onStart: () => Promise<void>;
}

export function ResearchStatusCard({ job, isStarting, error, onStart }: ResearchStatusCardProps) {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Research</p>
          <h2>Run the ingestion workflow</h2>
        </div>
        <button className="button button-primary" disabled={isStarting} onClick={() => void onStart()} type="button">
          {isStarting ? "Starting..." : "Start research"}
        </button>
      </div>

      {job ? (
        <div className="stats-grid">
          <div className="stat-card">
            <span className={`status-badge status-${job.status}`}>{job.status}</span>
            <p className="muted-text">Latest job status</p>
          </div>
          <div className="stat-card">
            <strong>{job.sourceCount}</strong>
            <p className="muted-text">Discovered sources</p>
          </div>
          <div className="stat-card">
            <strong>{job.findingCount}</strong>
            <p className="muted-text">Findings</p>
          </div>
          <div className="stat-card">
            <strong>{job.capabilityCount}</strong>
            <p className="muted-text">Capabilities</p>
          </div>
        </div>
      ) : (
        <p className="muted-text">No research job yet. Save sources, then run the workflow.</p>
      )}

      {job?.errorMessage ? <p className="error-text">{job.errorMessage}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
}
