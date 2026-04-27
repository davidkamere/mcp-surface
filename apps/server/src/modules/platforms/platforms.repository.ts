import type { Platform } from "@mcpsurface/shared";
import { readJsonFile, writeJsonFile } from "../../infrastructure/file-store.js";

const PLATFORMS_FILE_NAME = "platforms.json";
const RUNTIMES_FILE_NAME = "workspace-runtimes.json";

export class PlatformsRepository {
  async list(): Promise<Platform[]> {
    const [platforms, runtimes] = await Promise.all([
      readJsonFile<Array<Platform & { ownerEmail?: string }>>(PLATFORMS_FILE_NAME, []),
      readJsonFile<Array<{ platformId: string; ownerEmail: string; createdAt: string }>>(RUNTIMES_FILE_NAME, []),
    ]);
    let changed = false;
    const normalized = platforms.map((platform) => {
      const hasRuntimeConfig = Array.isArray(
        (platform as Platform & { runtimeConfig?: Platform["runtimeConfig"] }).runtimeConfig,
      );
      const normalizedPlatform = {
        ...platform,
        runtimeConfig: hasRuntimeConfig ? (platform as Platform).runtimeConfig : [],
      };

      if (platform.ownerEmail) {
        if (!hasRuntimeConfig) {
          changed = true;
        }
        return normalizedPlatform as Platform;
      }

      const runtimeOwnerEmail =
        runtimes
          .filter((runtime) => runtime.platformId === platform.id && Boolean(runtime.ownerEmail))
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0]
          ?.ownerEmail ?? "unknown-owner@example.com";

      changed = true;
      return {
        ...normalizedPlatform,
        ownerEmail: runtimeOwnerEmail,
      } as Platform;
    });

    if (changed) {
      await this.saveAll(normalized);
    }

    return normalized;
  }

  async saveAll(platforms: Platform[]): Promise<void> {
    await writeJsonFile(PLATFORMS_FILE_NAME, platforms);
  }
}
