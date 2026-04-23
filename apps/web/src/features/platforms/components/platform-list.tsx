import type { Platform } from "@mcpsurface/shared";
import { Link } from "@tanstack/react-router";

interface PlatformListProps {
  platforms: Platform[];
}

export function PlatformList({ platforms }: PlatformListProps) {
  return (
    <div className="platform-grid">
      {platforms.map((platform) => (
        <article className="panel platform-card" key={platform.id}>
          <div className="platform-card-header">
            <div>
              <p className="eyebrow">{platform.slug}</p>
              <h2>{platform.name}</h2>
            </div>
            <Link
              className="button button-secondary"
              to="/platforms/$platformId"
              params={{ platformId: platform.id }}
            >
              Open
            </Link>
          </div>
          <p className="meta-line">{platform.sourceUrls.length} source URL(s)</p>
          <ul className="token-list">
            {platform.sourceUrls.map((sourceUrl) => (
              <li key={sourceUrl}>{sourceUrl}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
