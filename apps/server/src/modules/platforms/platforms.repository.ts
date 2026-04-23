import type { Platform } from "@mcpsurface/shared";
import { readJsonFile, writeJsonFile } from "../../infrastructure/file-store.js";

const PLATFORMS_FILE_NAME = "platforms.json";

export class PlatformsRepository {
  async list(): Promise<Platform[]> {
    return readJsonFile<Platform[]>(PLATFORMS_FILE_NAME, []);
  }

  async saveAll(platforms: Platform[]): Promise<void> {
    await writeJsonFile(PLATFORMS_FILE_NAME, platforms);
  }
}
