import {
    acceptPlatformShareInviteResponseSchema,
    appendPlatformArtifactInputSchema,
    appendPlatformArtifactResponseSchema,
    createMcpAccessTokenInputSchema,
    createMcpAccessTokenResponseSchema,
    createPlatformShareInviteInputSchema,
    createPlatformInputSchema,
    generationArtifactsLatestResponseSchema,
    mcpAccessTokensResponseSchema,
    platformShareInviteListResponseSchema,
    platformShareInviteResponseSchema,
    platformSourcesResponseSchema,
    platformDetailResponseSchema,
    platformListResponseSchema,
    researchCapabilitiesResponseSchema,
    researchFindingsResponseSchema,
    researchJobDetailResponseSchema,
    researchJobListResponseSchema,
    startResearchJobInputSchema,
    runtimeExecutionInputSchema,
    runtimeExecutionResponseSchema,
    runtimeResponseSchema,
    runtimeTracesResponseSchema,
    shareInviteLookupResponseSchema,
    updatePlatformRuntimeConfigInputSchema,
    updatePlatformSourcesInputSchema,
    type AppendPlatformArtifactInput,
    type CreatePlatformInput,
    type CreateMcpAccessTokenInput,
    type CreatePlatformShareInviteInput,
    type ExecutionTrace,
    type McpAccessToken,
    type Platform,
    type GeneratedMcpArtifact,
    type GeneratedRuntimeArtifact,
    type PlatformShareInvite,
    type ResearchFinding,
    type ResearchJob,
    type ResearchSource,
    type RuntimeExecutionResponse,
    type UpdatePlatformSourcesInput,
    type UpdatePlatformRuntimeConfigInput,
    type Capability,
    type RuntimeExecutionInput,
    type WorkspaceRuntime,
} from "@mcpsurface/shared";
import { getRequiredClientEnv } from "./env";

const apiBaseUrl = getRequiredClientEnv("VITE_API_BASE_URL");

export function getApiBaseUrl() {
    return apiBaseUrl;
}

export async function listPlatforms(userId: string): Promise<Platform[]> {
    const response = await fetch(`${apiBaseUrl}/api/platforms`, {
        headers: {
            "x-user-id": userId,
        },
    });

    if (!response.ok) {
        throw new Error("Unable to load platforms.");
    }

    const json = await response.json();
    return platformListResponseSchema.parse(json).platforms;
}

export async function listPlatformsForEmail(
    userId: string,
    userEmail: string,
): Promise<Platform[]> {
    const response = await fetch(`${apiBaseUrl}/api/platforms`, {
        headers: {
            "x-user-id": userId,
            "x-user-email": userEmail,
        },
    });

    if (!response.ok) {
        throw new Error("Unable to load platforms.");
    }

    const json = await response.json();
    return platformListResponseSchema.parse(json).platforms;
}

export async function getPlatform(
    platformId: string,
    userId: string,
    userEmail?: string,
): Promise<Platform> {
    const response = await fetch(`${apiBaseUrl}/api/platforms/${platformId}`, {
        headers: {
            "x-user-id": userId,
            ...(userEmail ? { "x-user-email": userEmail } : {}),
        },
    });

    if (!response.ok) {
        throw new Error("Unable to load the selected platform.");
    }

    const json = await response.json();
    return platformDetailResponseSchema.parse(json).platform;
}

export async function createPlatformInvite(
    platformId: string,
    input: CreatePlatformShareInviteInput,
    userId: string,
): Promise<PlatformShareInvite> {
    const response = await fetch(`${apiBaseUrl}/api/platforms/${platformId}/invites`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-user-id": userId,
        },
        body: JSON.stringify(createPlatformShareInviteInputSchema.parse(input)),
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to create invite."));
    }

    const json = await response.json();
    return platformShareInviteResponseSchema.parse(json).invite;
}

export async function revokePlatformInvite(
    inviteId: string,
    userId: string,
): Promise<PlatformShareInvite> {
    const response = await fetch(`${apiBaseUrl}/api/invites/${inviteId}`, {
        method: "DELETE",
        headers: {
            "x-user-id": userId,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to revoke invite."));
    }

    const json = await response.json();
    return platformShareInviteResponseSchema.parse(json).invite;
}

export async function createMcpToken(
    platformId: string,
    input: CreateMcpAccessTokenInput,
    userEmail: string,
) {
    const response = await fetch(`${apiBaseUrl}/api/platforms/${platformId}/mcp/tokens`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-user-email": userEmail,
        },
        body: JSON.stringify(createMcpAccessTokenInputSchema.parse(input)),
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to create MCP token."));
    }

    const json = await response.json();
    return createMcpAccessTokenResponseSchema.parse(json);
}

export async function listMcpTokens(
    platformId: string,
    userEmail: string,
): Promise<Array<Omit<McpAccessToken, "token">>> {
    const response = await fetch(`${apiBaseUrl}/api/platforms/${platformId}/mcp/tokens`, {
        headers: {
            "x-user-email": userEmail,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to load MCP tokens."));
    }

    const json = await response.json();
    return mcpAccessTokensResponseSchema.parse(json).tokens;
}

export async function revokeMcpToken(tokenId: string, userEmail: string) {
    const response = await fetch(`${apiBaseUrl}/api/mcp/tokens/${tokenId}`, {
        method: "DELETE",
        headers: {
            "x-user-email": userEmail,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to revoke MCP token."));
    }
}

export async function listPlatformInvites(
    platformId: string,
    userId: string,
): Promise<PlatformShareInvite[]> {
    const response = await fetch(`${apiBaseUrl}/api/platforms/${platformId}/invites`, {
        headers: {
            "x-user-id": userId,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to load invites."));
    }

    const json = await response.json();
    return platformShareInviteListResponseSchema.parse(json).invites;
}

export async function getShareInvite(inviteToken: string) {
    const response = await fetch(`${apiBaseUrl}/api/share/${inviteToken}`);

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to load share invite."));
    }

    const json = await response.json();
    return shareInviteLookupResponseSchema.parse(json);
}

export async function acceptShareInvite(inviteToken: string, userId: string, userEmail: string) {
    const response = await fetch(`${apiBaseUrl}/api/share/${inviteToken}/accept`, {
        method: "POST",
        headers: {
            "x-user-id": userId,
            "x-user-email": userEmail,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to accept invite."));
    }

    const json = await response.json();
    return acceptPlatformShareInviteResponseSchema.parse(json);
}

export async function createPlatform(
    input: CreatePlatformInput,
    userId: string,
    userEmail: string,
): Promise<Platform> {
    const validatedInput = createPlatformInputSchema.parse(input);
    const response = await fetch(`${apiBaseUrl}/api/platforms`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-user-id": userId,
            "x-user-email": userEmail,
        },
        body: JSON.stringify(validatedInput),
    });

    if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(json?.message ?? "Unable to create the platform.");
    }

    const json = await response.json();
    return platformDetailResponseSchema.parse(json).platform;
}

export async function updatePlatformSources(
    platformId: string,
    input: UpdatePlatformSourcesInput,
    userId: string,
): Promise<Platform> {
    const validatedInput = updatePlatformSourcesInputSchema.parse(input);
    const response = await fetch(`${apiBaseUrl}/api/platforms/${platformId}/sources`, {
        method: "PATCH",
        headers: {
            "content-type": "application/json",
            "x-user-id": userId,
        },
        body: JSON.stringify(validatedInput),
    });

    if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(json?.message ?? "Unable to update platform sources.");
    }

    const json = await response.json();
    return platformSourcesResponseSchema.parse(json).platform;
}

export async function updatePlatformRuntimeConfig(
    platformId: string,
    input: UpdatePlatformRuntimeConfigInput,
    userId: string,
): Promise<Platform> {
    const validatedInput = updatePlatformRuntimeConfigInputSchema.parse(input);
    const response = await fetch(`${apiBaseUrl}/api/platforms/${platformId}/runtime-config`, {
        method: "PATCH",
        headers: {
            "content-type": "application/json",
            "x-user-id": userId,
        },
        body: JSON.stringify(validatedInput),
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to update runtime config."));
    }

    const json = await response.json();
    return platformDetailResponseSchema.parse(json).platform;
}

export async function uploadPlatformArtifact(
    platformId: string,
    input: AppendPlatformArtifactInput,
    userId: string,
): Promise<Platform> {
    const validatedInput = appendPlatformArtifactInputSchema.parse(input);
    const response = await fetch(`${apiBaseUrl}/api/platforms/${platformId}/artifacts`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-user-id": userId,
        },
        body: JSON.stringify(validatedInput),
    });

    if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(json?.message ?? "Unable to upload artifact.");
    }

    const json = await response.json();
    return appendPlatformArtifactResponseSchema.parse(json).platform;
}

export async function getLatestPlatformArtifacts(
    platformId: string,
    userId: string,
): Promise<{
    mcpArtifact: GeneratedMcpArtifact | null;
    runtimeArtifact: GeneratedRuntimeArtifact | null;
}> {
    const response = await fetch(
        `${apiBaseUrl}/api/generation/platforms/${platformId}/artifacts/latest`,
        { headers: { "x-user-id": userId } },
    );

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to check generated artifacts."));
    }

    return generationArtifactsLatestResponseSchema.parse(await response.json());
}

export async function listResearchJobs(platformId: string, userId: string): Promise<ResearchJob[]> {
    const response = await fetch(`${apiBaseUrl}/api/research/platforms/${platformId}/jobs`, {
        headers: {
            "x-user-id": userId,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to load research jobs."));
    }

    const json = await response.json();
    return researchJobListResponseSchema.parse(json).jobs;
}

export async function startResearchJob(
    platformId: string,
    userId: string,
): Promise<{
    job: ResearchJob;
    sources: ResearchSource[];
    findings: ResearchFinding[];
    capabilities: Capability[];
}> {
    const response = await fetch(`${apiBaseUrl}/api/research/platforms/${platformId}/jobs`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-user-id": userId,
        },
        body: JSON.stringify(startResearchJobInputSchema.parse({ initiatedByUserId: userId })),
    });

    if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(json?.message ?? "Unable to start research.");
    }

    const json = await response.json();
    return researchJobDetailResponseSchema.parse(json);
}

export async function getResearchJob(
    jobId: string,
    userId: string,
): Promise<{
    job: ResearchJob;
    sources: ResearchSource[];
    findings: ResearchFinding[];
    capabilities: Capability[];
}> {
    const response = await fetch(`${apiBaseUrl}/api/research/jobs/${jobId}`, {
        headers: {
            "x-user-id": userId,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to load research job."));
    }

    const json = await response.json();
    return researchJobDetailResponseSchema.parse(json);
}

export async function getResearchFindings(
    jobId: string,
    userId: string,
): Promise<ResearchFinding[]> {
    const response = await fetch(`${apiBaseUrl}/api/research/jobs/${jobId}/findings`, {
        headers: {
            "x-user-id": userId,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to load research findings."));
    }

    const json = await response.json();
    return researchFindingsResponseSchema.parse(json).findings;
}

export async function getResearchCapabilities(
    jobId: string,
    userId: string,
): Promise<Capability[]> {
    const response = await fetch(`${apiBaseUrl}/api/research/jobs/${jobId}/capabilities`, {
        headers: {
            "x-user-id": userId,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to load research capabilities."));
    }

    const json = await response.json();
    return researchCapabilitiesResponseSchema.parse(json).capabilities;
}

export async function getOrCreateMyRuntime(
    platformId: string,
    userId: string,
    userEmail: string,
): Promise<WorkspaceRuntime> {
    const response = await fetch(`${apiBaseUrl}/api/platforms/${platformId}/runtime/me`, {
        headers: {
            "x-user-id": userId,
            "x-user-email": userEmail,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to load runtime."));
    }

    const json = await response.json();
    return runtimeResponseSchema.parse(json).runtime;
}

export async function getRuntime(
    runtimeId: string,
    userId: string,
    userEmail: string,
): Promise<WorkspaceRuntime> {
    const response = await fetch(`${apiBaseUrl}/api/runtimes/${runtimeId}`, {
        headers: {
            "x-user-id": userId,
            "x-user-email": userEmail,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to load runtime."));
    }

    const json = await response.json();
    return runtimeResponseSchema.parse(json).runtime;
}

export async function startRuntime(
    runtimeId: string,
    userId: string,
    userEmail: string,
): Promise<WorkspaceRuntime> {
    const response = await fetch(`${apiBaseUrl}/api/runtimes/${runtimeId}/start`, {
        method: "POST",
        headers: {
            "x-user-id": userId,
            "x-user-email": userEmail,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to start runtime."));
    }

    const json = await response.json();
    return runtimeResponseSchema.parse(json).runtime;
}

export async function stopRuntime(
    runtimeId: string,
    userId: string,
    userEmail: string,
): Promise<WorkspaceRuntime> {
    const response = await fetch(`${apiBaseUrl}/api/runtimes/${runtimeId}/stop`, {
        method: "POST",
        headers: {
            "x-user-id": userId,
            "x-user-email": userEmail,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to stop runtime."));
    }

    const json = await response.json();
    return runtimeResponseSchema.parse(json).runtime;
}

export async function executeRuntime(
    runtimeId: string,
    input: RuntimeExecutionInput,
    userId: string,
    userEmail: string,
): Promise<RuntimeExecutionResponse> {
    const response = await fetch(`${apiBaseUrl}/api/runtimes/${runtimeId}/execute`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-user-id": userId,
            "x-user-email": userEmail,
        },
        body: JSON.stringify(runtimeExecutionInputSchema.parse(input)),
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to execute capability."));
    }

    const json = await response.json();
    return runtimeExecutionResponseSchema.parse(json);
}

export async function listRuntimeTraces(
    runtimeId: string,
    userId: string,
    userEmail: string,
): Promise<ExecutionTrace[]> {
    const response = await fetch(`${apiBaseUrl}/api/runtimes/${runtimeId}/traces`, {
        headers: {
            "x-user-id": userId,
            "x-user-email": userEmail,
        },
    });

    if (!response.ok) {
        throw new Error(await buildApiError(response, "Unable to load runtime traces."));
    }

    const json = await response.json();
    return runtimeTracesResponseSchema.parse(json).traces;
}

export async function buildApiError(response: Response, fallbackMessage: string): Promise<string> {
    const text = await response.text().catch(() => "");

    if (!text) {
        return `${fallbackMessage} (${response.status})`;
    }

    try {
        const json = JSON.parse(text) as { message?: string };
        return json.message
            ? `${fallbackMessage}: ${json.message}`
            : `${fallbackMessage} (${response.status})`;
    } catch {
        return `${fallbackMessage} (${response.status}): ${text}`;
    }
}
