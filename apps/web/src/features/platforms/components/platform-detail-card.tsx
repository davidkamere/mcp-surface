import type { Platform } from "@mcpsurface/shared";

interface PlatformDetailCardProps {
  platform: Platform;
}

export function PlatformDetailCard({ platform }: PlatformDetailCardProps) {
  return (
    <section className="panel detail-card compact-summary-card">
      <div className="panel-header ">
        <div className="">
          <p className="eyebrow">Control rail</p>
          <h2>{platform.name}</h2>
          <p className="muted-text platform-slug-line">/{platform.slug}</p>
        </div>
      </div>

      <div className="summary-stats">
        <div className="summary-stat">
          <strong>{platform.sourceUrls.length}</strong>
          <span>Source URLs</span>
        </div>
        <div className="summary-stat">
          <strong>{platform.sourceArtifacts.length}</strong>
          <span>Artifacts</span>
        </div>
        <div className="summary-stat">
          <strong>{new Date(platform.updatedAt).toLocaleDateString()}</strong>
          <span>Updated</span>
        </div>
      </div>
    </section>
  );
}
