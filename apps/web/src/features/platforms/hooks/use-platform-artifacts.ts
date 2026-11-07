import { useUser } from "@clerk/clerk-react";
import { useCallback, useEffect, useState } from "react";
import type { GeneratedMcpArtifact, GeneratedRuntimeArtifact } from "@mcpsurface/shared";
import { getLatestPlatformArtifacts } from "../../../lib/api-client";

interface PlatformArtifacts {
    mcpArtifact: GeneratedMcpArtifact | null;
    runtimeArtifact: GeneratedRuntimeArtifact | null;
}

export function usePlatformArtifacts(platformId: string) {
    const { user, isLoaded } = useUser();
    const [artifacts, setArtifacts] = useState<PlatformArtifacts>({
        mcpArtifact: null,
        runtimeArtifact: null,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);

    useEffect(() => {
        if (!isLoaded) return;
        if (!user) {
            setArtifacts({ mcpArtifact: null, runtimeArtifact: null });
            setIsLoading(false);
            return;
        }

        let isActive = true;
        setIsLoading(true);

        void getLatestPlatformArtifacts(platformId, user.id)
            .then((result) => {
                if (isActive) {
                    setArtifacts(result);
                    setError(null);
                }
            })
            .catch((requestError) => {
                if (isActive) {
                    setError(
                        requestError instanceof Error
                            ? requestError.message
                            : "Unable to check generated artifacts.",
                    );
                }
            })
            .finally(() => {
                if (isActive) setIsLoading(false);
            });

        return () => {
            isActive = false;
        };
    }, [isLoaded, platformId, reloadToken, user]);

    const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

    return { ...artifacts, isLoading, error, refresh };
}
