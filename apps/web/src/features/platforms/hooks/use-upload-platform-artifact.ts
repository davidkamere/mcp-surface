import { useUser } from "@clerk/clerk-react";
import type { AppendPlatformArtifactInput, Platform } from "@mcpsurface/shared";
import { useState } from "react";
import { uploadPlatformArtifact } from "../api/platforms-api";

export function useUploadPlatformArtifact() {
  const { user } = useUser();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(platformId: string, input: AppendPlatformArtifactInput): Promise<Platform> {
    if (!user) {
      throw new Error("You must be signed in to upload artifacts.");
    }

    setIsUploading(true);
    setError(null);

    try {
      return await uploadPlatformArtifact(platformId, input, user.id);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to upload artifact.";
      setError(message);
      throw requestError;
    } finally {
      setIsUploading(false);
    }
  }

  return { submit, isUploading, error };
}
