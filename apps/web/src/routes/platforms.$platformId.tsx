import { createRoute } from "@tanstack/react-router";
import { RequireAuth } from "../features/auth/components/require-auth";
import { PlatformDetailPage } from "../features/platforms/pages/platform-detail-page";
import { rootRoute } from "./__root";

function PlatformDetailRouteComponent() {
    const { platformId } = platformsDetailRoute.useParams();

    return (
        <RequireAuth>
            <PlatformDetailPage platformId={platformId} />
        </RequireAuth>
    );
}

export const platformsDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/platforms/$platformId",
    component: PlatformDetailRouteComponent,
});
