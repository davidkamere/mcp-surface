import { createRoute } from "@tanstack/react-router";
import { RequireAuth } from "../features/auth/components/require-auth";
import { CreatePlatformPage } from "../features/platforms/pages/create-platform-page";
import { rootRoute } from "./__root";

function CreatePlatformRouteComponent() {
  return (
    <RequireAuth>
      <CreatePlatformPage />
    </RequireAuth>
  );
}

export const platformsNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/platforms/new",
  component: CreatePlatformRouteComponent,
});
