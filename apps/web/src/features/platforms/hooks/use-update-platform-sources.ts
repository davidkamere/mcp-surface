import { useUser } from "@clerk/clerk-react";
import type { Platform, UpdatePlatformSourcesInput } from "@mcpsurface/shared";
import { useState } from "react";
import { updatePlatformSources } from "../api/platforms-api";

export function useUpdatePlatformSources() {
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(platformId: string, input: UpdatePlatformSourcesInput): Promise<Platform> {
    if (!user) {
      throw new Error("You must be signed in to update platform sources.");
    }

    setIsSubmitting(true);
    setError(null);

    try {
      return await updatePlatformSources(platformId, input, user.id);
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Unable to update platform sources.";
      setError(message);
      throw requestError;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { submit, isSubmitting, error };
}
