import { rootRoute } from "./routes/__root";
import { indexRoute } from "./routes/index";
import { platformsDetailRoute } from "./routes/platforms.$platformId";
import { platformsIndexRoute } from "./routes/platforms.index";
import { platformsNewRoute } from "./routes/platforms.new";
import { signInRoute } from "./routes/sign-in";

export const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  platformsIndexRoute,
  platformsNewRoute,
  platformsDetailRoute,
]);
