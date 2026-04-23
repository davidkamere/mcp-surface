import { createRoute } from "@tanstack/react-router";
import { SignInPage } from "../features/auth/pages/sign-in-page";
import { rootRoute } from "./__root";

export const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  component: SignInPage,
});
