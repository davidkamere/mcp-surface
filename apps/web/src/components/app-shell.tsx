import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { Link, Outlet } from "@tanstack/react-router";

export function AppShell() {
    return (
        <div className="app-shell">
            <header className="topbar">
                <div className="brand-lockup">
                    <Link className="brand-mark" to="/platforms" aria-label="MCP Surface home">
                        <span aria-hidden="true">m</span>
                    </Link>
                    <div className="brand-copy">
                        <Link className="brand" to="/platforms">MCP Surface</Link>
                        <span className="brand-caption">Research workspace</span>
                    </div>
                </div>
                <nav className="nav">
                    <Link className="nav-link" activeProps={{ className: "nav-link-active" }} to="/platforms">
                        Platforms
                    </Link>
                    <Link className="nav-link" activeProps={{ className: "nav-link-active" }} to="/platforms/new">
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
