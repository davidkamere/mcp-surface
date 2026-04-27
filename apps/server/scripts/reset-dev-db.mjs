import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const serverRoot = path.resolve(currentDir, "..");
const workspaceRoot = path.resolve(serverRoot, "../..");

config({ path: path.resolve(workspaceRoot, ".env") });
config({ path: path.resolve(serverRoot, ".env") });
config();

const dataDir = process.env.DATA_DIR ?? ".data";
const databasePath = process.env.DATABASE_PATH ?? "mcpsurface.db";
const resolvedDataDir = path.resolve(serverRoot, dataDir);
const resolvedDatabasePath = path.resolve(resolvedDataDir, databasePath);
const resolvedWalPath = `${resolvedDatabasePath}-wal`;
const resolvedShmPath = `${resolvedDatabasePath}-shm`;

await mkdir(resolvedDataDir, { recursive: true });
await rm(resolvedDatabasePath, { force: true });
await rm(resolvedWalPath, { force: true });
await rm(resolvedShmPath, { force: true });

console.log(`Reset dev database at ${resolvedDatabasePath}`);
