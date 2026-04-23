import type { Capability, ResearchFinding, ResearchSource } from "@mcpsurface/shared";

interface ResearchResultsPanelProps {
  sources: ResearchSource[];
  findings: ResearchFinding[];
  capabilities: Capability[];
}

export function ResearchResultsPanel({
  sources,
  findings,
  capabilities,
}: ResearchResultsPanelProps) {
  return (
    <div className="stack">
      <section className="panel">
        <p className="eyebrow">Discovered sources</p>
        <h2>What the workflow classified</h2>
        {sources.length > 0 ? (
          <ul className="result-list">
            {sources.map((source) => (
              <li key={source.id}>
                <div className="result-row">
                  <strong>{source.title}</strong>
                  <span className={`status-badge status-${source.status}`}>{source.sourceType}</span>
                </div>
                <p className="muted-text">{source.url}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted-text">No sources discovered yet.</p>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Findings</p>
        <h2>Research output</h2>
        {findings.length > 0 ? (
          <ul className="result-list">
            {findings.map((finding) => (
              <li key={finding.id}>
                <div className="result-row">
                  <strong>{finding.title}</strong>
                  <span className="result-kind">{finding.kind}</span>
                </div>
                <p>{finding.summary}</p>
                <p className="muted-text">{finding.provenanceUrl}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted-text">No findings yet.</p>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Capabilities</p>
        <h2>Synthesized graph seed</h2>
        {capabilities.length > 0 ? (
          <ul className="result-list">
            {capabilities.map((capability) => (
              <li key={capability.id}>
                <div className="result-row">
                  <strong>{capability.title}</strong>
                  <span className="result-kind">{capability.key}</span>
                </div>
                <p>{capability.description}</p>
                <p className="muted-text">{capability.provenance.join(" • ")}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted-text">No capabilities synthesized yet.</p>
        )}
      </section>
    </div>
  );
}
