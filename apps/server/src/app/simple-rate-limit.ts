import type { FastifyRequest } from "fastify";

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  maxWriteRequests: number;
}

const buckets = new Map<string, number[]>();

export function enforceSimpleRateLimit(
  request: FastifyRequest,
  options: RateLimitOptions,
): { limited: false } | { limited: true; retryAfterSeconds: number } {
  const now = Date.now();
  const method = request.method.toUpperCase();
  const limit = method === "GET" || method === "HEAD" || method === "OPTIONS" ? options.maxRequests : options.maxWriteRequests;
  const ip = request.ip || "unknown";
  const routeKey = `${method}:${request.routeOptions.url ?? request.url}`;
  const bucketKey = `${ip}:${routeKey}`;
  const existing = buckets.get(bucketKey) ?? [];
  const windowStart = now - options.windowMs;
  const next = existing.filter((timestamp) => timestamp > windowStart);

  if (next.length >= limit) {
    const oldestInWindow = next[0] ?? now;
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((oldestInWindow + options.windowMs - now) / 1000)),
    };
  }

  next.push(now);
  buckets.set(bucketKey, next);
  pruneBuckets(windowStart);
  return { limited: false };
}

function pruneBuckets(windowStart: number) {
  for (const [key, timestamps] of buckets.entries()) {
    const next = timestamps.filter((timestamp) => timestamp > windowStart);

    if (next.length === 0) {
      buckets.delete(key);
      continue;
    }

    buckets.set(key, next);
  }
}
