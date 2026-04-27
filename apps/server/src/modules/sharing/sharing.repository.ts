import type { PlatformShareInvite } from "@mcpsurface/shared";
import { readJsonFile, writeJsonFile } from "../../infrastructure/file-store.js";

const PLATFORM_SHARE_INVITES_FILE_NAME = "platform-share-invites.json";

export class SharingRepository {
  async listInvites(): Promise<PlatformShareInvite[]> {
    return readJsonFile<PlatformShareInvite[]>(PLATFORM_SHARE_INVITES_FILE_NAME, []);
  }

  async saveInvites(invites: PlatformShareInvite[]): Promise<void> {
    await writeJsonFile(PLATFORM_SHARE_INVITES_FILE_NAME, invites);
  }
}
