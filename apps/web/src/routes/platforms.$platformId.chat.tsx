import { createRoute } from "@tanstack/react-router";
import { RequireAuth } from "../features/auth/components/require-auth";
import { PlatformChatPage } from "../features/chat/pages/platform-chat-page";
import { rootRoute } from "./__root";

function PlatformChatRouteComponent() {
  const { platformId } = platformChatRoute.useParams();

  return (
    <RequireAuth>
      <PlatformChatPage platformId={platformId} />
    </RequireAuth>
  );
}

export const platformChatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/platforms/$platformId/chat",
  component: PlatformChatRouteComponent,
});
