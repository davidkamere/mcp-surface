import { createRoute } from "@tanstack/react-router";
import { RequireAuth } from "../features/auth/components/require-auth";
import { PlatformDetailPage } from "../features/platforms/pages/platform-detail-page";
import { rootRoute } from "./__root";

function PlatformDetailRouteComponent() {
    const { platformId } = platformsDetailRoute.useParams();
    const { startInitialResearch } = platformsDetailRoute.useSearch();

    return (
        <RequireAuth>
            <PlatformDetailPage
                platformId={platformId}
                startInitialResearch={startInitialResearch}
            />
        </RequireAuth>
    );
}

export const platformsDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/platforms/$platformId",
    validateSearch: (search: Record<string, unknown>) =>
        search.startInitialResearch === true || search.startInitialResearch === "true"
            ? { startInitialResearch: true }
            : {},
    component: PlatformDetailRouteComponent,
});
