import { RedirectToSignIn, useAuth } from "@clerk/clerk-react";
import type { ReactNode } from "react";

interface RequireAuthProps {
    children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
    const { isLoaded, isSignedIn } = useAuth();

    if (!isLoaded) {
        return <section className="panel">Loading account...</section>;
    }

    if (!isSignedIn) {
        return <RedirectToSignIn />;
    }

    return <>{children}</>;
}
