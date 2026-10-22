import { useUser } from "@clerk/clerk-react";
import type { CreatePlatformInput, Platform } from "@mcpsurface/shared";
import { useState } from "react";
import { createPlatform } from "../api/platforms-api";

export function useCreatePlatform() {
    const { user } = useUser();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function submit(input: CreatePlatformInput): Promise<Platform> {
        const userEmail =
            user?.primaryEmailAddress?.emailAddress ??
            user?.emailAddresses[0]?.emailAddress ??
            null;

        if (!user || !userEmail) {
            throw new Error("You must be signed in to create a platform.");
        }

        setIsSubmitting(true);
        setError(null);

        try {
            return await createPlatform(input, user.id, userEmail);
        } catch (requestError) {
            const message =
                requestError instanceof Error
                    ? requestError.message
                    : "Unable to create the platform.";
            setError(message);
            throw requestError;
        } finally {
            setIsSubmitting(false);
        }
    }

    return {
        submit,
        isSubmitting,
        error,
    };
}
