import { rootRoute } from "./routes/__root";
import { indexRoute } from "./routes/index";
import { platformChatRoute } from "./routes/platforms.$platformId.chat";
import { platformsDetailRoute } from "./routes/platforms.$platformId";
import { platformRuntimeDetailRoute } from "./routes/platforms.$platformId.runtimes.$runtimeId";
import { platformsIndexRoute } from "./routes/platforms.index";
import { platformsNewRoute } from "./routes/platforms.new";
import { shareInviteRoute } from "./routes/share.$inviteToken";
import { signInRoute } from "./routes/sign-in";

export const routeTree = rootRoute.addChildren([
    indexRoute,
    signInRoute,
    platformsIndexRoute,
    platformsNewRoute,
    shareInviteRoute,
    platformsDetailRoute,
    platformChatRoute,
    platformRuntimeDetailRoute,
]);
