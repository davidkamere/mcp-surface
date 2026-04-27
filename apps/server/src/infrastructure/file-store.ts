import { readDocument, writeDocument } from "./sqlite-store.js";

export async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  return readDocument(fileName, fallback);
}

export async function writeJsonFile<T>(fileName: string, value: T): Promise<void> {
  await writeDocument(fileName, value);
}
