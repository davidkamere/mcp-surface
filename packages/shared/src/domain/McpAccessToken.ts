export interface McpAccessToken {
  id: string;
  platformId: string;
  userEmail: string;
  token: string;
  createdAt: string;
  revokedAt?: string | undefined;
}
