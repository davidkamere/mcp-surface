import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATA_DIR: z.string().default(".data"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_APP_NAME: z.string().default("MCPSurface"),
  OPENROUTER_HTTP_REFERER: z.string().url().optional(),
  RESEARCH_MODEL: z.string().default("openai/gpt-4o-mini"),
});

export const env = envSchema.parse(process.env);
