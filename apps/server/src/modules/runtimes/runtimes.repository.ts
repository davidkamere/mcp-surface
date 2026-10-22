import type { ExecutionTrace, WorkspaceRuntime } from "@mcpsurface/shared";
import { readJsonFile, writeJsonFile } from "../../infrastructure/file-store.js";

const RUNTIMES_FILE_NAME = "workspace-runtimes.json";
const EXECUTION_TRACES_FILE_NAME = "execution-traces.json";

export class RuntimesRepository {
    async listRuntimes(): Promise<WorkspaceRuntime[]> {
        return readJsonFile<WorkspaceRuntime[]>(RUNTIMES_FILE_NAME, []);
    }

    async saveRuntimes(runtimes: WorkspaceRuntime[]): Promise<void> {
        await writeJsonFile(RUNTIMES_FILE_NAME, runtimes);
    }

    async listTraces(): Promise<ExecutionTrace[]> {
        return readJsonFile<ExecutionTrace[]>(EXECUTION_TRACES_FILE_NAME, []);
    }

    async saveTraces(traces: ExecutionTrace[]): Promise<void> {
        await writeJsonFile(EXECUTION_TRACES_FILE_NAME, traces);
    }
}
