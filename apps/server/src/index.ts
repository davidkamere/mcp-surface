import { buildServer } from "./app/build-server.js";
import { env } from "./lib/env.js";

const app = await buildServer();

try {
  await app.listen({
    host: env.HOST,
    port: env.PORT,
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
