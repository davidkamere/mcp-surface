import { useUser } from "@clerk/clerk-react";
import type { Platform } from "@mcpsurface/shared";
import { useEffect, useState } from "react";
import { listPlatforms } from "../api/platforms-api";

export function usePlatforms() {
  const { user, isLoaded } = useUser();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const currentUser = user;

    if (!currentUser) {
      setPlatforms([]);
      setIsLoading(false);
      return;
    }

    const userId = currentUser.id;

    let isActive = true;

    async function run() {
      setIsLoading(true);
      setError(null);

      try {
        const nextPlatforms = await listPlatforms(userId);

        if (isActive) {
          setPlatforms(nextPlatforms);
        }
      } catch (requestError) {
        if (isActive) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load platforms.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void run();

    return () => {
      isActive = false;
    };
  }, [isLoaded, user]);

  return { platforms, isLoading, error };
}
