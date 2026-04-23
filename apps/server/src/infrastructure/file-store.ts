import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../lib/env.js";

export async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  const filePath = path.resolve(process.cwd(), env.DATA_DIR, fileName);

  try {
    const contents = await readFile(filePath, "utf8");
    return JSON.parse(contents) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile<T>(fileName: string, value: T): Promise<void> {
  const directory = path.resolve(process.cwd(), env.DATA_DIR);
  const filePath = path.resolve(directory, fileName);

  await mkdir(directory, { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}
