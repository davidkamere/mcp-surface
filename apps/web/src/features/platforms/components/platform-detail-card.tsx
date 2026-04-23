import type { Platform } from "@mcpsurface/shared";

interface PlatformDetailCardProps {
  platform: Platform;
}

export function PlatformDetailCard({ platform }: PlatformDetailCardProps) {
  return (
    <section className="panel detail-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{platform.slug}</p>
          <h1>{platform.name}</h1>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <h2>Source URLs</h2>
          <ul className="token-list">
            {platform.sourceUrls.map((sourceUrl) => (
              <li key={sourceUrl}>{sourceUrl}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2>Artifacts</h2>
          {platform.sourceArtifacts.length > 0 ? (
            <ul className="token-list">
              {platform.sourceArtifacts.map((artifact) => (
                <li key={artifact.id}>
                  {artifact.label} • {artifact.kind} • {artifact.uri}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-text">No optional artifacts added yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
