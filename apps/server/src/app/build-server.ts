import cors from "@fastify/cors";
import Fastify from "fastify";
import { platformsRoutes } from "../modules/platforms/platforms.routes.js";
import { researchRoutes } from "../modules/research/research.routes.js";

export async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(async (api) => {
    await api.register(platformsRoutes, { prefix: "/platforms" });
    await api.register(researchRoutes, { prefix: "/research" });
  }, { prefix: "/api" });

  return app;
}
