import { useNavigate } from "@tanstack/react-router";
import type { CreatePlatformInput } from "@mcpsurface/shared";
import { CreatePlatformForm } from "../components/create-platform-form";
import { useCreatePlatform } from "../hooks/use-create-platform";

export function CreatePlatformPage() {
    const navigate = useNavigate();
    const { submit, isSubmitting, error } = useCreatePlatform();

    async function handleSubmit(input: CreatePlatformInput) {
        const platform = await submit(input);
        await navigate({
            to: "/platforms/$platformId",
            params: { platformId: platform.id },
        });
    }

    return <CreatePlatformForm isSubmitting={isSubmitting} error={error} onSubmit={handleSubmit} />;
}
