import type { GeneratedMcpArtifact, GeneratedRuntimeArtifact } from "@mcpsurface/shared";
import { readJsonFile, writeJsonFile } from "../../infrastructure/file-store.js";

const MCP_ARTIFACTS_FILE_NAME = "generated-mcp-artifacts.json";
const RUNTIME_ARTIFACTS_FILE_NAME = "generated-runtime-artifacts.json";

export class GenerationRepository {
  async listMcpArtifacts(): Promise<GeneratedMcpArtifact[]> {
    return readJsonFile<GeneratedMcpArtifact[]>(MCP_ARTIFACTS_FILE_NAME, []);
  }

  async saveMcpArtifacts(artifacts: GeneratedMcpArtifact[]): Promise<void> {
    await writeJsonFile(MCP_ARTIFACTS_FILE_NAME, artifacts);
  }

  async listRuntimeArtifacts(): Promise<GeneratedRuntimeArtifact[]> {
    return readJsonFile<GeneratedRuntimeArtifact[]>(RUNTIME_ARTIFACTS_FILE_NAME, []);
  }

  async saveRuntimeArtifacts(artifacts: GeneratedRuntimeArtifact[]): Promise<void> {
    await writeJsonFile(RUNTIME_ARTIFACTS_FILE_NAME, artifacts);
  }
}
