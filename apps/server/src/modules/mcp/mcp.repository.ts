import type { McpAccessToken } from "@mcpsurface/shared";
import { readJsonFile, writeJsonFile } from "../../infrastructure/file-store.js";

const MCP_ACCESS_TOKENS_FILE_NAME = "mcp-access-tokens.json";

export class McpRepository {
  async listTokens(): Promise<McpAccessToken[]> {
    return readJsonFile<McpAccessToken[]>(MCP_ACCESS_TOKENS_FILE_NAME, []);
  }

  async saveTokens(tokens: McpAccessToken[]): Promise<void> {
    await writeJsonFile(MCP_ACCESS_TOKENS_FILE_NAME, tokens);
  }
}
