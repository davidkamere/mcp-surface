import type {
    Capability,
    Platform,
    ResearchFinding,
    ResearchJob,
    ResearchJobStage,
    ResearchSource,
    SourceArtifact,
} from "@mcpsurface/shared";
import { classifySource } from "../parsing-tools/source-classifier.js";
import { parseOpenApiDocument } from "../parsing-tools/openapi-parser.js";
import { fetchSourceDocument, isResearchableDocument } from "./research-fetcher.js";
import { extractDocsFindings, materializeDocsFindings } from "./docs-extractor.js";
import { synthesizeCapabilities } from "./capability-synthesizer.js";
import { createId } from "../../lib/ids.js";
import { discoverRelatedSources } from "./related-source-discovery.js";

export interface ResearchWorkflowStateShape {
    platform: Platform;
    job: ResearchJob;
    pendingArtifacts: SourceArtifact[];
    sources: ResearchSource[];
    findings: ResearchFinding[];
    capabilities: Capability[];
}

export type ResearchStageUpdater =
    | ((
          stage: ResearchJobStage,
          message: string,
          progress?: { sourceCount?: number; findingCount?: number; capabilityCount?: number },
      ) => Promise<void>)
    | undefined;

export async function discoverSourcesNode(
    state: ResearchWorkflowStateShape,
    onStageUpdate: ResearchStageUpdater,
) {
    const now = new Date().toISOString();
    const discoveredSources: ResearchSource[] = [];
    const queuedUrls = [...state.platform.sourceUrls];
    const seenUrls = new Set<string>();
    const totalSeeds = queuedUrls.length + state.pendingArtifacts.length;
    let processedSeedCount = 0;

    for (const sourceUrl of queuedUrls) {
        if (seenUrls.has(sourceUrl)) {
            continue;
        }

        seenUrls.add(sourceUrl);
        const document = await fetchSourceDocument(sourceUrl);

        if (!isResearchableDocument(document)) {
            continue;
        }

        discoveredSources.push({
            id: createId(),
            platformId: state.platform.id,
            researchJobId: state.job.id,
            url: sourceUrl,
            title: document.title,
            origin: "platform_url",
            sourceType: classifySource({
                url: sourceUrl,
                contentType: document.contentType,
                content: document.content,
            }),
            contentType: document.contentType,
            status: "discovered",
            createdAt: now,
            notes: document.content,
        });
        processedSeedCount += 1;
        await onStageUpdate?.(
            "source_discovery",
            `Discovered source ${processedSeedCount} of ${Math.max(totalSeeds, processedSeedCount)}: ${document.title}`,
            { sourceCount: discoveredSources.length },
        );

        const relatedSources = await discoverRelatedSources({
            sourceUrl,
            title: document.title,
            content: document.content,
        });

        for (const relatedSource of relatedSources) {
            if (seenUrls.has(relatedSource.url)) {
                continue;
            }

            try {
                const relatedDocument = await fetchSourceDocument(relatedSource.url);
                if (!isResearchableDocument(relatedDocument)) {
                    continue;
                }

                seenUrls.add(relatedSource.url);
                discoveredSources.push({
                    id: createId(),
                    platformId: state.platform.id,
                    researchJobId: state.job.id,
                    url: relatedSource.url,
                    title: relatedDocument.title,
                    origin: relatedSource.origin,
                    sourceType: classifySource({
                        url: relatedSource.url,
                        contentType: relatedDocument.contentType,
                        content: relatedDocument.content,
                    }),
                    contentType: relatedDocument.contentType,
                    status: "discovered",
                    createdAt: now,
                    notes: relatedDocument.content,
                });
                await onStageUpdate?.(
                    "source_discovery",
                    `Added related source from ${document.title}: ${relatedDocument.title}`,
                    { sourceCount: discoveredSources.length },
                );
            } catch {
                continue;
            }
        }
    }

    for (const artifact of state.pendingArtifacts) {
        const document = await fetchSourceDocument(artifact.uri);
        if (!isResearchableDocument(document)) {
            continue;
        }

        discoveredSources.push({
            id: createId(),
            platformId: state.platform.id,
            researchJobId: state.job.id,
            sourceArtifactId: artifact.id,
            url: artifact.uri,
            title: artifact.label,
            origin: "artifact",
            sourceType: classifySource({
                url: artifact.uri,
                contentType: artifact.mimeType ?? document.contentType,
                content: document.content,
            }),
            contentType: artifact.mimeType ?? document.contentType,
            status: "discovered",
            createdAt: now,
            notes: document.content,
        });
        processedSeedCount += 1;
        await onStageUpdate?.(
            "source_discovery",
            `Indexed uploaded source ${processedSeedCount} of ${Math.max(totalSeeds, processedSeedCount)}: ${artifact.label}`,
            { sourceCount: discoveredSources.length },
        );
    }

    return { sources: discoveredSources };
}

export async function structuredParsingNode(
    state: ResearchWorkflowStateShape,
    onStageUpdate: ResearchStageUpdater,
) {
    const findings = [...state.findings];
    const nextSources = state.sources.map((source) => ({ ...source }));
    const now = new Date().toISOString();
    const structuredSources = nextSources.filter(
        (source) => source.sourceType === "openapi" && source.notes,
    );
    let parsedStructuredCount = 0;

    for (const source of nextSources) {
        if (source.sourceType !== "openapi" || !source.notes) {
            continue;
        }

        parsedStructuredCount += 1;
        await onStageUpdate?.(
            "structured_parsing",
            `Parsing structured source ${parsedStructuredCount} of ${structuredSources.length}: ${source.title}`,
            { findingCount: findings.length, sourceCount: nextSources.length },
        );

        const parsed = parseOpenApiDocument(source.notes);
        if (!parsed) {
            source.status = "failed";
            continue;
        }

        source.status = "parsed";
        findings.push(
            ...parsed.operations.map((operation) => ({
                id: createId(),
                platformId: source.platformId,
                researchJobId: source.researchJobId,
                researchSourceId: source.id,
                kind: "endpoint" as const,
                title: `${operation.method} ${operation.path}`,
                summary: operation.summary,
                evidence: [
                    `operationId: ${operation.operationId}`,
                    operation.parameters.length > 0
                        ? `parameters: ${operation.parameters.map((parameter) => `${parameter.name} (${parameter.in})`).join(", ")}`
                        : "parameters: none",
                    operation.security.length > 0
                        ? `security: ${operation.security.join(", ")}`
                        : "security: none",
                    operation.tags.length > 0 ? `tags: ${operation.tags.join(", ")}` : "tags: none",
                ],
                provenanceUrl: source.url,
                createdAt: now,
            })),
        );

        if (parsed.operations.some((operation) => operation.security.length > 0)) {
            findings.push({
                id: createId(),
                platformId: source.platformId,
                researchJobId: source.researchJobId,
                researchSourceId: source.id,
                kind: "authentication",
                title: `${parsed.title} authentication`,
                summary: "The structured specification declares one or more secured operations.",
                evidence: parsed.operations
                    .filter((operation) => operation.security.length > 0)
                    .slice(0, 3)
                    .map(
                        (operation) =>
                            `${operation.method} ${operation.path}: ${operation.security.join(", ")}`,
                    ),
                provenanceUrl: source.url,
                createdAt: now,
            });
        }
    }

    return { sources: nextSources, findings };
}

export async function docsExtractionNode(
    state: ResearchWorkflowStateShape,
    onStageUpdate: ResearchStageUpdater,
) {
    const findings = [...state.findings];
    const nextSources = state.sources.map((source) => ({ ...source }));
    const docSources = nextSources.filter(
        (source) =>
            (source.sourceType === "docs" ||
                source.sourceType === "auth" ||
                source.sourceType === "unknown" ||
                source.sourceType === "github_example") &&
            source.notes,
    );
    let extractedSourceCount = 0;

    for (const source of nextSources) {
        if (
            (source.sourceType !== "docs" &&
                source.sourceType !== "auth" &&
                source.sourceType !== "unknown" &&
                source.sourceType !== "github_example") ||
            !source.notes
        ) {
            continue;
        }

        extractedSourceCount += 1;
        await onStageUpdate?.(
            "docs_extraction",
            `Extracting findings from source ${extractedSourceCount} of ${docSources.length}: ${source.title}`,
            { findingCount: findings.length, sourceCount: nextSources.length },
        );

        const extractedFindings = await extractDocsFindings({
            platformId: source.platformId,
            researchJobId: source.researchJobId,
            researchSourceId: source.id,
            url: source.url,
            title: source.title,
            content: source.notes,
        });

        findings.push(
            ...materializeDocsFindings(
                {
                    platformId: source.platformId,
                    researchJobId: source.researchJobId,
                    researchSourceId: source.id,
                    url: source.url,
                    title: source.title,
                    content: source.notes,
                },
                extractedFindings,
            ),
        );
        await onStageUpdate?.("docs_extraction", `Captured findings from ${source.title}.`, {
            findingCount: findings.length,
            sourceCount: nextSources.length,
        });

        source.status = "parsed";
    }

    return { sources: nextSources.map(({ notes: _notes, ...source }) => source), findings };
}

export async function synthesisNode(
    state: ResearchWorkflowStateShape,
    onStageUpdate: ResearchStageUpdater,
) {
    await onStageUpdate?.(
        "capability_synthesis",
        `Synthesizing capabilities from ${state.findings.length} findings across ${state.sources.length} sources.`,
        { sourceCount: state.sources.length, findingCount: state.findings.length },
    );

    const capabilities = synthesizeCapabilities({
        platformId: state.platform.id,
        researchJobId: state.job.id,
        findings: state.findings,
        sources: state.sources,
    });
    const endpointFindingCount = state.findings.filter(
        (finding) => finding.kind === "endpoint",
    ).length;
    const endpointReadyCapabilityCount = capabilities.filter(
        (capability) => capability.method && capability.path,
    ).length;

    await onStageUpdate?.(
        "capability_synthesis",
        `Synthesized ${capabilities.length} candidate capabilities from ${endpointFindingCount} explicit operations. ${endpointReadyCapabilityCount} are execution-ready.`,
        {
            sourceCount: state.sources.length,
            findingCount: state.findings.length,
            capabilityCount: capabilities.length,
        },
    );

    return { capabilities };
}
