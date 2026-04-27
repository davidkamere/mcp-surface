import type { FastifyReply } from "fastify";
import type { ChatStreamEvent } from "./chat-types.js";

export function beginChatStream(reply: FastifyReply) {
  reply.raw.setHeader("content-type", "text/event-stream; charset=utf-8");
  reply.raw.setHeader("cache-control", "no-cache, no-transform");
  reply.raw.setHeader("connection", "keep-alive");
  reply.raw.setHeader("access-control-allow-origin", "*");
  reply.raw.setHeader("x-accel-buffering", "no");
  reply.hijack();
  reply.raw.flushHeaders?.();

  return {
    async send(event: ChatStreamEvent) {
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(event.data)}\n\n`);
    },
    end() {
      reply.raw.end();
    },
  };
}
