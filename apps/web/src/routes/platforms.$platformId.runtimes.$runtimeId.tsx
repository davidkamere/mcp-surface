import { createRoute } from "@tanstack/react-router";
import { RequireAuth } from "../features/auth/components/require-auth";
import { RuntimeDetailPage } from "../features/runtimes/pages/runtime-detail-page";
import { rootRoute } from "./__root";

function PlatformRuntimeDetailRouteComponent() {
  const { platformId, runtimeId } = platformRuntimeDetailRoute.useParams();

  return (
    <RequireAuth>
      <RuntimeDetailPage platformId={platformId} runtimeId={runtimeId} />
    </RequireAuth>
  );
}

export const platformRuntimeDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/platforms/$platformId/runtimes/$runtimeId",
  component: PlatformRuntimeDetailRouteComponent,
});
