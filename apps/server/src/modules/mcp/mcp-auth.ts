import { createHash } from "node:crypto";
import type { McpAccessToken } from "@mcpsurface/shared";

export function createRawMcpToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export function hashMcpToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function extractBearerToken(headerValue: string | string[] | undefined) {
  if (typeof headerValue !== "string") {
    return null;
  }

  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export function findValidMcpToken(
  rawToken: string,
  platformId: string,
  tokens: McpAccessToken[],
) {
  const hashed = hashMcpToken(rawToken);
  return (
    tokens.find(
      (token) =>
        token.platformId === platformId &&
        token.token === hashed &&
        !token.revokedAt,
    ) ?? null
  );
}
