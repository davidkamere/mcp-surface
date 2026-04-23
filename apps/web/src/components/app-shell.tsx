import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { Link, Outlet } from "@tanstack/react-router";

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <Link className="brand" to="/">
            MCPSurface
          </Link>
          <p className="tagline">Fresh MVP for creator-defined MCP platforms.</p>
        </div>
        <nav className="nav">
          <Link className="nav-link" to="/platforms">
            Platforms
          </Link>
          <Link className="nav-link" to="/platforms/new">
            Create
          </Link>
          <SignedOut>
            <Link className="nav-link nav-link-primary" to="/sign-in">
              Sign in
            </Link>
          </SignedOut>
          <SignedIn>
            <div className="user-chip">
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          </SignedIn>
        </nav>
      </header>
      <main className="page-frame">
        <Outlet />
      </main>
    </div>
  );
}
