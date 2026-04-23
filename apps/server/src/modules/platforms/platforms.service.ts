import type {
  AppendPlatformArtifactInput,
  CreatePlatformInput,
  Platform,
  SourceArtifact,
  UpdatePlatformSourcesInput,
} from "@mcpsurface/shared";
import { normalizeSlug } from "@mcpsurface/shared";
import { persistArtifactFile } from "../../infrastructure/artifact-store.js";
import { createId } from "../../lib/ids.js";
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

  async createPlatform(input: CreatePlatformInput, userId: string): Promise<Platform> {
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
      createdByUserId: userId,
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
}
