import { Link } from "@tanstack/react-router";
import { EmptyState } from "../../../components/empty-state";
import { PlatformList } from "../components/platform-list";
import { usePlatforms } from "../hooks/use-platforms";

export function PlatformListPage() {
    const { platforms, isLoading, error } = usePlatforms();

    if (isLoading) {
        return <section className="panel">Loading platforms...</section>;
    }

    if (error) {
        return <section className="panel error-text">{error}</section>;
    }

    if (platforms.length === 0) {
        return (
            <EmptyState
                title="No platforms yet"
                description="Create your first platform to define source URLs and prepare for the upcoming research pipeline."
                action={
                    <Link className="button button-primary" to="/platforms/new">
                        Create platform
                    </Link>
                }
            />
        );
    }

    return (
        <section className="stack">
            <div className="section-header">
                <div>
                    <p className="eyebrow">Platforms</p>
                    <h1>Your platform surfaces</h1>
                </div>
                <Link className="button button-primary" to="/platforms/new">
                    New platform
                </Link>
            </div>
            <PlatformList platforms={platforms} />
        </section>
    );
}
