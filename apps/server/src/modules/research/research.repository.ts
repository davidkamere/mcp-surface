import type { Capability, ResearchFinding, ResearchJob, ResearchSource } from "@mcpsurface/shared";
import { readJsonFile, writeJsonFile } from "../../infrastructure/file-store.js";

const JOBS_FILE_NAME = "research-jobs.json";
const SOURCES_FILE_NAME = "research-sources.json";
const FINDINGS_FILE_NAME = "research-findings.json";
const CAPABILITIES_FILE_NAME = "research-capabilities.json";

export class ResearchRepository {
    async listJobs(): Promise<ResearchJob[]> {
        return readJsonFile<ResearchJob[]>(JOBS_FILE_NAME, []);
    }

    async saveJobs(jobs: ResearchJob[]): Promise<void> {
        await writeJsonFile(JOBS_FILE_NAME, jobs);
    }

    async listSources(): Promise<ResearchSource[]> {
        return readJsonFile<ResearchSource[]>(SOURCES_FILE_NAME, []);
    }

    async saveSources(sources: ResearchSource[]): Promise<void> {
        await writeJsonFile(SOURCES_FILE_NAME, sources);
    }

    async listFindings(): Promise<ResearchFinding[]> {
        return readJsonFile<ResearchFinding[]>(FINDINGS_FILE_NAME, []);
    }

    async saveFindings(findings: ResearchFinding[]): Promise<void> {
        await writeJsonFile(FINDINGS_FILE_NAME, findings);
    }

    async listCapabilities(): Promise<Capability[]> {
        return readJsonFile<Capability[]>(CAPABILITIES_FILE_NAME, []);
    }

    async saveCapabilities(capabilities: Capability[]): Promise<void> {
        await writeJsonFile(CAPABILITIES_FILE_NAME, capabilities);
    }
}
