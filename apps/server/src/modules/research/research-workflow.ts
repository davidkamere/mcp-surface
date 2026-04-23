import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type {
  Capability,
  Platform,
  ResearchFinding,
  ResearchJob,
  ResearchSource,
  SourceArtifact,
} from "@mcpsurface/shared";
import { classifySource } from "../parsing-tools/source-classifier.js";
import { parseOpenApiDocument } from "../parsing-tools/openapi-parser.js";
import { fetchSourceDocument } from "./research-fetcher.js";
import { extractDocsFindings, materializeDocsFindings } from "./docs-extractor.js";
import { synthesizeCapabilities } from "./capability-synthesizer.js";
import { createId } from "../../lib/ids.js";

const ResearchWorkflowState = Annotation.Root({
  platform: Annotation<Platform>(),
  job: Annotation<ResearchJob>(),
  pendingArtifacts: Annotation<SourceArtifact[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  sources: Annotation<ResearchSource[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  findings: Annotation<ResearchFinding[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  capabilities: Annotation<Capability[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
});

export async function runResearchWorkflow(input: {
  platform: Platform;
  job: ResearchJob;
}): Promise<{
  sources: ResearchSource[];
  findings: ResearchFinding[];
  capabilities: Capability[];
}> {
  const graph = new StateGraph(ResearchWorkflowState)
    .addNode("source_discovery_agent", discoverSourcesNode)
    .addNode("structured_parser_agent", structuredParsingNode)
    .addNode("docs_extraction_agent", docsExtractionNode)
    .addNode("capability_synthesis_agent", synthesisNode)
    .addEdge(START, "source_discovery_agent")
    .addEdge("source_discovery_agent", "structured_parser_agent")
    .addEdge("structured_parser_agent", "docs_extraction_agent")
    .addEdge("docs_extraction_agent", "capability_synthesis_agent")
    .addEdge("capability_synthesis_agent", END)
    .compile();

  const result = await graph.invoke({
    platform: input.platform,
    job: input.job,
    pendingArtifacts: input.platform.sourceArtifacts,
    sources: [],
    findings: [],
    capabilities: [],
  });

  return {
    sources: result.sources,
    findings: result.findings,
    capabilities: result.capabilities,
  };
}

async function discoverSourcesNode(state: typeof ResearchWorkflowState.State) {
  const now = new Date().toISOString();
  const discoveredSources: ResearchSource[] = [];

  for (const sourceUrl of state.platform.sourceUrls) {
    const document = await fetchSourceDocument(sourceUrl);
    const sourceType = classifySource({
      url: sourceUrl,
      contentType: document.contentType,
      content: document.content,
    });

    discoveredSources.push({
      id: createId(),
      platformId: state.platform.id,
      researchJobId: state.job.id,
      url: sourceUrl,
      title: document.title,
      origin: "platform_url",
      sourceType,
      contentType: document.contentType,
      status: "discovered",
      createdAt: now,
      notes: document.content,
    });
  }

  for (const artifact of state.pendingArtifacts) {
    const document = await fetchSourceDocument(artifact.uri);
    const sourceType = classifySource({
      url: artifact.uri,
      contentType: artifact.mimeType ?? document.contentType,
      content: document.content,
    });

    discoveredSources.push({
      id: createId(),
      platformId: state.platform.id,
      researchJobId: state.job.id,
      sourceArtifactId: artifact.id,
      url: artifact.uri,
      title: artifact.label,
      origin: "artifact",
      sourceType,
      contentType: artifact.mimeType ?? document.contentType,
      status: "discovered",
      createdAt: now,
      notes: document.content,
    });
  }

  return {
    sources: discoveredSources,
  };
}

async function structuredParsingNode(state: typeof ResearchWorkflowState.State) {
  const findings = [...state.findings];
  const nextSources = state.sources.map((source) => ({ ...source }));
  const now = new Date().toISOString();

  for (const source of nextSources) {
    if (source.sourceType !== "openapi" || !source.notes) {
      continue;
    }

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
          operation.parameters.length > 0 ? `parameters: ${operation.parameters.join(", ")}` : "parameters: none",
          operation.security.length > 0 ? `security: ${operation.security.join(", ")}` : "security: none",
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
          .map((operation) => `${operation.method} ${operation.path}: ${operation.security.join(", ")}`),
        provenanceUrl: source.url,
        createdAt: now,
      });
    }
  }

  return {
    sources: nextSources,
    findings,
  };
}

async function docsExtractionNode(state: typeof ResearchWorkflowState.State) {
  const findings = [...state.findings];
  const nextSources = state.sources.map((source) => ({ ...source }));

  for (const source of nextSources) {
    if ((source.sourceType !== "docs" && source.sourceType !== "auth" && source.sourceType !== "unknown") || !source.notes) {
      continue;
    }

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

    source.status = "parsed";
  }

  return {
    sources: nextSources.map(({ notes: _notes, ...source }) => source),
    findings,
  };
}

async function synthesisNode(state: typeof ResearchWorkflowState.State) {
  return {
    capabilities: synthesizeCapabilities({
      platformId: state.platform.id,
      researchJobId: state.job.id,
      findings: state.findings,
      sources: state.sources,
    }),
  };
}
