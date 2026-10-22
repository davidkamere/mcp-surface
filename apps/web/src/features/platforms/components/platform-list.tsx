import { useUser } from "@clerk/clerk-react";
import type { Platform } from "@mcpsurface/shared";
import { Link } from "@tanstack/react-router";

interface PlatformListProps {
    platforms: Platform[];
}

export function PlatformList({ platforms }: PlatformListProps) {
    const { user } = useUser();

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
                            to={
                                platform.createdByUserId === user?.id
                                    ? "/platforms/$platformId"
                                    : "/platforms/$platformId/chat"
                            }
                            params={{ platformId: platform.id }}
                        >
                            Open
                        </Link>
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
                </article>
            ))}
        </div>
    );
}
