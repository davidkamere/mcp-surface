import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().url().optional(),
);

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFilePath);
const serverRoot = resolve(currentDir, "../..");
const workspaceRoot = resolve(currentDir, "../../../..");

config({ path: resolve(workspaceRoot, ".env") });
config({ path: resolve(serverRoot, ".env") });
config();

const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATA_DIR: z.string().default(".data"),
  DATABASE_PATH: z.string().default("mcpsurface.db"),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"),
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  API_RATE_LIMIT_WRITE_MAX: z.coerce.number().int().positive().default(30),
  ARTIFACT_UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(2 * 1024 * 1024),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_APP_NAME: z.string().default("MCPSurface"),
  OPENROUTER_HTTP_REFERER: optionalUrl,
  CHAT_MODEL: z.string().default("openai/gpt-4o-mini"),
  SERPER_API_KEY: z.string().optional(),
  SERPER_RESULT_LIMIT: z.coerce.number().int().positive().default(5),
  RESEARCH_MODEL: z.string().default("openai/gpt-4o-mini"),
  LANGSMITH_API_KEY: z.string().optional(),
  LANGSMITH_PROJECT: z.string().default("mcpsurface-research"),
  LANGSMITH_ENDPOINT: optionalUrl,
  LANGSMITH_TRACING: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
  RUNTIME_DOCKER_IMAGE: z.string().default("node:20-alpine"),
  RUNTIME_DOCKER_INTERNAL_PORT: z.coerce.number().int().positive().default(3000),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
});

export const env = envSchema.parse(process.env);
