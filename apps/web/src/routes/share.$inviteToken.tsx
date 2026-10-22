import { createRoute } from "@tanstack/react-router";
import { ShareInvitePage } from "../features/sharing/pages/share-invite-page";
import { rootRoute } from "./__root";

function ShareInviteRouteComponent() {
    const { inviteToken } = shareInviteRoute.useParams();
    return <ShareInvitePage inviteToken={inviteToken} />;
}

export const shareInviteRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/share/$inviteToken",
    component: ShareInviteRouteComponent,
});
