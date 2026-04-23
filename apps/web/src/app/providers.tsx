import { ClerkProvider } from "@clerk/clerk-react";
import type { ReactNode } from "react";
import { getRequiredClientEnv } from "../lib/env";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const publishableKey = getRequiredClientEnv("VITE_CLERK_PUBLISHABLE_KEY");

  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/sign-in">
      {children}
    </ClerkProvider>
  );
}
