import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { env } from "../lib/env.js";

const databases = new Map<string, DatabaseSync>();

export async function readDocument<T>(key: string, fallback: T): Promise<T> {
  const database = await getDatabase();
  const statement = database.prepare("SELECT value FROM documents WHERE key = ?");
  const row = statement.get(key) as { value?: string } | undefined;

  if (!row || typeof row.value !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(row.value) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error.";
    throw new Error(`Unable to parse persisted document ${key}: ${message}`);
  }
}

export async function writeDocument<T>(key: string, value: T): Promise<void> {
  const database = await getDatabase();
  const statement = database.prepare(`
    INSERT INTO documents(key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `);

  statement.run(key, JSON.stringify(value, null, 2));
}

async function getDatabase() {
  const databasePath = await resolveDatabasePath();
  const existing = databases.get(databasePath);

  if (existing) {
    return existing;
  }

  const database = new DatabaseSync(databasePath, {
    open: true,
    readOnly: false,
    enableForeignKeyConstraints: true,
    timeout: 5_000,
    allowExtension: false,
  });

  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS documents (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  databases.set(databasePath, database);
  return database;
}

async function resolveDatabasePath() {
  const dataDirectory = path.resolve(process.cwd(), env.DATA_DIR);
  await mkdir(dataDirectory, { recursive: true });
  return path.resolve(dataDirectory, env.DATABASE_PATH);
}

export function closeAllDatabasesForTests() {
  for (const database of databases.values()) {
    try {
      database.close();
    } catch {
      // Ignore close errors during test cleanup.
    }
  }

  databases.clear();
}

export async function getDatabaseHealth() {
  const databasePath = await resolveDatabasePath();
  const exists = await access(databasePath)
    .then(() => true)
    .catch(() => false);
  const database = await getDatabase();
  const row = database.prepare("SELECT 1 AS ok").get() as { ok?: number } | undefined;

  return {
    driver: "node:sqlite",
    path: databasePath,
    exists,
    ok: row?.ok === 1,
  };
}
