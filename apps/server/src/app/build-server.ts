import cors from "@fastify/cors";
import Fastify from "fastify";
import { getDatabaseHealth } from "../infrastructure/sqlite-store.js";
import { env } from "../lib/env.js";
import { approvalsRoutes } from "../modules/approvals/approvals.routes.js";
import { chatRoutes } from "../modules/chat/chat.routes.js";
import { generationRoutes } from "../modules/generation/generation.routes.js";
import { mcpRoutes } from "../modules/mcp/mcp.routes.js";
import { platformsRoutes } from "../modules/platforms/platforms.routes.js";
import { researchRoutes } from "../modules/research/research.routes.js";
import { runtimesRoutes } from "../modules/runtimes/runtimes.routes.js";
import { sharingRoutes } from "../modules/sharing/sharing.routes.js";
import { enforceSimpleRateLimit } from "./simple-rate-limit.js";

export async function buildServer() {
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const app = Fastify({
    logger: true,
    bodyLimit: env.BODY_LIMIT_BYTES,
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS."), false);
    },
    credentials: true,
  });

  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/health") {
      return;
    }

    const result = enforceSimpleRateLimit(request, {
      windowMs: env.API_RATE_LIMIT_WINDOW_MS,
      maxRequests: env.API_RATE_LIMIT_MAX,
      maxWriteRequests: env.API_RATE_LIMIT_WRITE_MAX,
    });

    if (!result.limited) {
      return;
    }

    reply.header("retry-after", String(result.retryAfterSeconds));
    return reply.code(429).send({
      message: "Too many requests. Please slow down and try again shortly.",
    });
  });

  app.get("/health", async () => ({
    status: "ok",
    database: await getDatabaseHealth(),
  }));
  await app.register(mcpRoutes);

  await app.register(async (api) => {
    await api.register(platformsRoutes, { prefix: "/platforms" });
    await api.register(researchRoutes, { prefix: "/research" });
    await api.register(generationRoutes, { prefix: "/generation" });
    await api.register(runtimesRoutes);
    await api.register(chatRoutes);
    await api.register(approvalsRoutes);
    await api.register(sharingRoutes);
  }, { prefix: "/api" });

  return app;
}
