import { useUser } from "@clerk/clerk-react";
import type { Platform } from "@mcpsurface/shared";
import { useEffect, useState } from "react";
import { getPlatform } from "../api/platforms-api";

export function usePlatformDetail(platformId: string) {
  const { user, isLoaded } = useUser();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [isLoaded, platformId, user]);

  async function refresh() {
    if (!isLoaded) {
      return;
    }

    const currentUser = user;

    if (!currentUser) {
      setPlatform(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextPlatform = await getPlatform(platformId, currentUser.id);
      setPlatform(nextPlatform);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load platform.");
    } finally {
      setIsLoading(false);
    }
  }

  return { platform, isLoading, error, refresh };
}
