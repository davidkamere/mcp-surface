import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type {
  Capability,
  Platform,
  ResearchFinding,
  ResearchJob,
  ResearchJobStage,
  ResearchSource,
  SourceArtifact,
} from "@mcpsurface/shared";
import {
  discoverSourcesNode,
  docsExtractionNode,
  type ResearchStageUpdater,
  synthesisNode,
  structuredParsingNode,
} from "./research-workflow-nodes.js";

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
  onStageUpdate?: ResearchStageUpdater;
}): Promise<{
  sources: ResearchSource[];
  findings: ResearchFinding[];
  capabilities: Capability[];
}> {
  const graph = new StateGraph(ResearchWorkflowState)
    .addNode("source_discovery_agent", async (state) => {
      await input.onStageUpdate?.("source_discovery", "Fetching provided URLs and classifying source types.");
      return discoverSourcesNode(state, input.onStageUpdate);
    })
    .addNode("structured_parser_agent", async (state) => {
      await input.onStageUpdate?.("structured_parsing", "Parsing structured specs like OpenAPI documents.");
      return structuredParsingNode(state, input.onStageUpdate);
    })
    .addNode("docs_extraction_agent", async (state) => {
      await input.onStageUpdate?.("docs_extraction", "Extracting findings from documentation and setup guides.");
      return docsExtractionNode(state, input.onStageUpdate);
    })
    .addNode("capability_synthesis_agent", async (state) => {
      await input.onStageUpdate?.("capability_synthesis", "Merging findings into normalized capabilities.");
      return synthesisNode(state, input.onStageUpdate);
    })
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
