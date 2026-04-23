import {
  appendPlatformArtifactInputSchema,
  appendPlatformArtifactResponseSchema,
  createPlatformInputSchema,
  platformSourcesResponseSchema,
  platformDetailResponseSchema,
  platformListResponseSchema,
  researchCapabilitiesResponseSchema,
  researchFindingsResponseSchema,
  researchJobDetailResponseSchema,
  researchJobListResponseSchema,
  startResearchJobInputSchema,
  updatePlatformSourcesInputSchema,
  type AppendPlatformArtifactInput,
  type CreatePlatformInput,
  type Platform,
  type ResearchFinding,
  type ResearchJob,
  type ResearchSource,
  type UpdatePlatformSourcesInput,
  type Capability,
} from "@mcpsurface/shared";
import { getRequiredClientEnv } from "./env";

const apiBaseUrl = getRequiredClientEnv("VITE_API_BASE_URL");

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

export async function getPlatform(platformId: string, userId: string): Promise<Platform> {
  const response = await fetch(`${apiBaseUrl}/api/platforms/${platformId}`, {
    headers: {
      "x-user-id": userId,
    },
  });

  if (!response.ok) {
    throw new Error("Unable to load the selected platform.");
  }

  const json = await response.json();
  return platformDetailResponseSchema.parse(json).platform;
}

export async function createPlatform(input: CreatePlatformInput, userId: string): Promise<Platform> {
  const validatedInput = createPlatformInputSchema.parse(input);
  const response = await fetch(`${apiBaseUrl}/api/platforms`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-id": userId,
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

export async function listResearchJobs(platformId: string, userId: string): Promise<ResearchJob[]> {
  const response = await fetch(`${apiBaseUrl}/api/research/platforms/${platformId}/jobs`, {
    headers: {
      "x-user-id": userId,
    },
  });

  if (!response.ok) {
    throw new Error("Unable to load research jobs.");
  }

  const json = await response.json();
  return researchJobListResponseSchema.parse(json).jobs;
}

export async function startResearchJob(platformId: string, userId: string): Promise<{
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

export async function getResearchJob(jobId: string, userId: string): Promise<{
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
    throw new Error("Unable to load research job.");
  }

  const json = await response.json();
  return researchJobDetailResponseSchema.parse(json);
}

export async function getResearchFindings(jobId: string, userId: string): Promise<ResearchFinding[]> {
  const response = await fetch(`${apiBaseUrl}/api/research/jobs/${jobId}/findings`, {
    headers: {
      "x-user-id": userId,
    },
  });

  if (!response.ok) {
    throw new Error("Unable to load research findings.");
  }

  const json = await response.json();
  return researchFindingsResponseSchema.parse(json).findings;
}

export async function getResearchCapabilities(jobId: string, userId: string): Promise<Capability[]> {
  const response = await fetch(`${apiBaseUrl}/api/research/jobs/${jobId}/capabilities`, {
    headers: {
      "x-user-id": userId,
    },
  });

  if (!response.ok) {
    throw new Error("Unable to load research capabilities.");
  }

  const json = await response.json();
  return researchCapabilitiesResponseSchema.parse(json).capabilities;
}
