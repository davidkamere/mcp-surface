import { createRoute } from "@tanstack/react-router";
import { RequireAuth } from "../features/auth/components/require-auth";
import { PlatformListPage } from "../features/platforms/pages/platform-list-page";
import { rootRoute } from "./__root";

function PlatformsRouteComponent() {
  return (
    <RequireAuth>
      <PlatformListPage />
    </RequireAuth>
  );
}

export const platformsIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/platforms",
  component: PlatformsRouteComponent,
});
