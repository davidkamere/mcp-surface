import type {
  AppendPlatformArtifactInput,
  CreatePlatformInput,
  Platform,
  PlatformRuntimeConfigEntry,
  SourceArtifact,
  UpdatePlatformRuntimeConfigInput,
  UpdatePlatformSourcesInput,
} from "@mcpsurface/shared";
import { normalizeSlug } from "@mcpsurface/shared";
import { persistArtifactFile } from "../../infrastructure/artifact-store.js";
import { env } from "../../lib/env.js";
import { createId } from "../../lib/ids.js";
import { isMaskedRuntimeConfigValue } from "./platform-response.js";
import { PlatformsRepository } from "./platforms.repository.js";

export class PlatformsService {
  constructor(private readonly repository: PlatformsRepository) {}

  async listPlatforms(userId?: string): Promise<Platform[]> {
    const platforms = await this.repository.list();

    if (!userId) {
      return platforms;
    }

    return platforms.filter((platform) => platform.createdByUserId === userId);
  }

  async getPlatform(platformId: string, userId?: string): Promise<Platform | null> {
    const platforms = await this.listPlatforms(userId);
    return platforms.find((platform) => platform.id === platformId) ?? null;
  }

  async createPlatform(input: CreatePlatformInput, userId: string, ownerEmail: string): Promise<Platform> {
    const platforms = await this.repository.list();
    const slug = normalizeSlug(input.slug);
    const existingPlatform = platforms.find((platform) => platform.slug === slug);

    if (existingPlatform) {
      throw new Error(`A platform with slug "${slug}" already exists.`);
    }

    const now = new Date().toISOString();
    const platformId = createId();
    const sourceArtifacts: SourceArtifact[] = input.sourceArtifacts.map((artifact) => ({
      id: createId(),
      platformId,
      label: artifact.label,
      kind: artifact.kind,
      uri: artifact.uri,
      mimeType: artifact.mimeType,
      createdAt: now,
    }));

    const platform: Platform = {
      id: platformId,
      name: input.name.trim(),
      slug,
      sourceUrls: input.sourceUrls,
      sourceArtifacts,
      runtimeConfig: [],
      createdByUserId: userId,
      ownerEmail: ownerEmail.trim().toLowerCase(),
      createdAt: now,
      updatedAt: now,
    };

    platforms.unshift(platform);
    await this.repository.saveAll(platforms);

    return platform;
  }

  async updatePlatformSources(
    platformId: string,
    input: UpdatePlatformSourcesInput,
    userId: string,
  ): Promise<Platform> {
    const platforms = await this.repository.list();
    const platformIndex = platforms.findIndex(
      (platform) => platform.id === platformId && platform.createdByUserId === userId,
    );

    if (platformIndex < 0) {
      throw new Error("Platform not found.");
    }

    const existingPlatform = platforms[platformIndex];
    if (!existingPlatform) {
      throw new Error("Platform not found.");
    }

    const now = new Date().toISOString();
    const retainedArtifacts = existingPlatform.sourceArtifacts.filter((artifact) =>
      input.sourceArtifacts.some((entry) => entry.uri === artifact.uri && entry.label === artifact.label),
    );
    const appendedArtifacts: SourceArtifact[] = input.sourceArtifacts
      .filter(
        (entry) =>
          !retainedArtifacts.some(
            (artifact) => artifact.uri === entry.uri && artifact.label === entry.label,
          ),
      )
      .map((artifact) => ({
        id: createId(),
        platformId,
        label: artifact.label,
        kind: artifact.kind,
        uri: artifact.uri,
        mimeType: artifact.mimeType,
        createdAt: now,
      }));

    const updatedPlatform: Platform = {
      ...existingPlatform,
      sourceUrls: input.sourceUrls,
      sourceArtifacts: [...retainedArtifacts, ...appendedArtifacts],
      updatedAt: now,
    };

    platforms[platformIndex] = updatedPlatform;
    await this.repository.saveAll(platforms);

    return updatedPlatform;
  }

  async appendArtifact(
    platformId: string,
    input: AppendPlatformArtifactInput,
    userId: string,
  ): Promise<{ platform: Platform; artifact: SourceArtifact }> {
    const platforms = await this.repository.list();
    const platformIndex = platforms.findIndex(
      (platform) => platform.id === platformId && platform.createdByUserId === userId,
    );

    if (platformIndex < 0) {
      throw new Error("Platform not found.");
    }

    const existingPlatform = platforms[platformIndex];
    if (!existingPlatform) {
      throw new Error("Platform not found.");
    }

    const artifactSizeBytes = estimateBase64ByteSize(input.contentBase64);

    if (artifactSizeBytes > env.ARTIFACT_UPLOAD_MAX_BYTES) {
      throw new Error(`Artifact exceeds the ${env.ARTIFACT_UPLOAD_MAX_BYTES} byte upload limit.`);
    }

    const persistedFile = await persistArtifactFile({
      platformId,
      fileName: input.fileName,
      contentBase64: input.contentBase64,
    });

    const now = new Date().toISOString();
    const artifact: SourceArtifact = {
      id: createId(),
      platformId,
      label: input.label,
      kind: input.kind,
      uri: `file://${persistedFile.absolutePath}`,
      mimeType: input.mimeType,
      createdAt: now,
    };

    const updatedPlatform: Platform = {
      ...existingPlatform,
      sourceArtifacts: [...existingPlatform.sourceArtifacts, artifact],
      updatedAt: now,
    };

    platforms[platformIndex] = updatedPlatform;
    await this.repository.saveAll(platforms);

    return {
      platform: updatedPlatform,
      artifact,
    };
  }

  async updatePlatformRuntimeConfig(
    platformId: string,
    input: UpdatePlatformRuntimeConfigInput,
    userId: string,
  ): Promise<Platform> {
    const platforms = await this.repository.list();
    const platformIndex = platforms.findIndex(
      (platform) => platform.id === platformId && platform.createdByUserId === userId,
    );

    if (platformIndex < 0) {
      throw new Error("Platform not found.");
    }

    const existingPlatform = platforms[platformIndex];
    if (!existingPlatform) {
      throw new Error("Platform not found.");
    }

    const existingValuesByKey = new Map(
      existingPlatform.runtimeConfig.map((entry) => [entry.key.trim(), entry.value] as const),
    );
    const dedupedRuntimeConfig = new Map<string, PlatformRuntimeConfigEntry>();

    for (const entry of input.runtimeConfig) {
      const key = entry.key.trim();

      if (!key) {
        continue;
      }

      dedupedRuntimeConfig.set(key, {
        key,
        value:
          isMaskedRuntimeConfigValue(entry.value) && existingValuesByKey.has(key)
            ? existingValuesByKey.get(key) ?? ""
            : entry.value,
      });
    }

    const runtimeConfig = Array.from(dedupedRuntimeConfig.values());

    const updatedPlatform: Platform = {
      ...existingPlatform,
      runtimeConfig,
      updatedAt: new Date().toISOString(),
    };

    platforms[platformIndex] = updatedPlatform;
    await this.repository.saveAll(platforms);
    return updatedPlatform;
  }
}

function estimateBase64ByteSize(value: string) {
  const normalized = value.replace(/\s+/g, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}
