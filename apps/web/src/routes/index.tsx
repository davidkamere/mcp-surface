import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { Link, createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";

function HomePage() {
  return (
    <div className="home-grid">
      <section className="hero-card">
        <p className="eyebrow">MCPSurface</p>
        <h1>Define a platform once, then research, generate, run, and share it.</h1>
        <p>
          Phase 1 gives us the clean foundation: auth shell, platform records, and the first
          source input flow that later phases can build on without churn.
        </p>
        <div className="action-row">
          <SignedOut>
            <Link className="button button-primary" to="/sign-in">
              Sign in
            </Link>
          </SignedOut>
          <SignedIn>
            <Link className="button button-primary" to="/platforms">
              Open platforms
            </Link>
          </SignedIn>
          <Link className="button button-secondary" to="/platforms/new">
            Create platform
          </Link>
        </div>
      </section>
      <section className="panel">
        <h2>Phase 1 scope</h2>
        <ul className="token-list">
          <li>Shared domain models and contracts</li>
          <li>Clerk sign-in shell</li>
          <li>Platform create, list, and detail</li>
          <li>File-based persistence for fast iteration</li>
        </ul>
      </section>
    </div>
  );
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});
