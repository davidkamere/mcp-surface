import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../lib/env.js";
import { createId } from "../lib/ids.js";

interface PersistArtifactFileInput {
  platformId: string;
  fileName: string;
  contentBase64: string;
}

export async function persistArtifactFile(input: PersistArtifactFileInput) {
  const extension = path.extname(input.fileName);
  const safeBaseName = path.basename(input.fileName, extension).replace(/[^a-zA-Z0-9_-]+/g, "-");
  const storedFileName = `${safeBaseName || "artifact"}-${createId()}${extension}`;
  const directory = path.resolve(process.cwd(), env.DATA_DIR, "artifacts", input.platformId);
  const absolutePath = path.resolve(directory, storedFileName);

  await mkdir(directory, { recursive: true });
  await writeFile(absolutePath, Buffer.from(input.contentBase64, "base64"));

  return {
    absolutePath,
    relativePath: path.relative(process.cwd(), absolutePath),
  };
}
