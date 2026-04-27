import type { Capability, ExecutionTrace, GeneratedMcpArtifact, GeneratedRuntimeArtifact, ResearchFinding } from "@mcpsurface/shared";

export interface RuntimeLogEntry {
  id: string;
  level: "info" | "error";
  message: string;
  createdAt: string;
}

export interface ChatRagSourceSet {
  capabilities: Capability[];
  findings: ResearchFinding[];
  traces: ExecutionTrace[];
  logs: RuntimeLogEntry[];
  runtimeArtifact: GeneratedRuntimeArtifact;
  mcpArtifact: GeneratedMcpArtifact;
}

export interface RetrievedChatContext {
  capabilities: Capability[];
  findings: ResearchFinding[];
  traces: ExecutionTrace[];
  logs: RuntimeLogEntry[];
  artifactSummary: {
    runtimeGeneratedAt: string;
    runtimeExports: string[];
    mcpTools: string[];
    capabilityCount: number;
  };
}

export interface RetrievalRequest {
  query: string;
  includeCapabilities?: boolean | undefined;
  includeFindings?: boolean | undefined;
  includeTraces?: boolean | undefined;
  includeLogs?: boolean | undefined;
}

export function retrieveChatContext(
  request: RetrievalRequest,
  input: ChatRagSourceSet,
): RetrievedChatContext {
  return {
    capabilities: request.includeCapabilities ? rankCapabilities(request.query, input.capabilities) : [],
    findings: request.includeFindings ? rankFindings(request.query, input.findings) : [],
    traces: request.includeTraces ? rankTraces(request.query, input.traces) : [],
    logs: request.includeLogs ? rankLogs(request.query, input.logs) : [],
    artifactSummary: {
      runtimeGeneratedAt: input.runtimeArtifact.generatedAt,
      runtimeExports: input.runtimeArtifact.exportedSymbols,
      mcpTools: input.mcpArtifact.tools,
      capabilityCount: input.runtimeArtifact.capabilityCount,
    },
  };
}

function rankCapabilities(query: string, capabilities: Capability[]) {
  return rankItems(
    query,
    capabilities,
    (capability) =>
      [
        capability.key,
        capability.name,
        capability.summary,
        capability.description,
        capability.method,
        capability.path,
        capability.tags?.join(" "),
        capability.examples?.join(" "),
      ].filter(Boolean).join(" "),
    (capability) => {
      let score = 0;

      if (capability.method && capability.path) {
        score += 2;
      }

      if (capability.parameters.length > 0) {
        score += 0.5;
      }

      return score;
    },
  ).slice(0, 10);
}

function rankFindings(query: string, findings: ResearchFinding[]) {
  return rankItems(
    query,
    findings,
    (finding) =>
      [
        finding.kind,
        finding.title,
        finding.summary,
        finding.evidence.join(" "),
        finding.provenanceUrl,
      ].filter(Boolean).join(" "),
  ).slice(0, 8);
}

function rankTraces(query: string, traces: ExecutionTrace[]) {
  return rankItems(query, traces, (trace) =>
    [
      trace.capabilityKey,
      trace.error,
      JSON.stringify(trace.input),
      JSON.stringify(trace.output),
    ].filter(Boolean).join(" "),
  ).slice(0, 6);
}

function rankLogs(query: string, logs: RuntimeLogEntry[]) {
  return rankItems(query, logs, (log) => `${log.level} ${log.message}`).slice(0, 6);
}

function rankItems<T>(
  query: string,
  items: T[],
  buildText: (item: T) => string,
  scoreBoost?: ((item: T) => number) | undefined,
) {
  const normalizedTerms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (normalizedTerms.length === 0) {
    return items.slice(0, 6);
  }

  return [...items]
    .map((item) => ({
      item,
      score:
        normalizedTerms.reduce((score, term) => {
        const haystack = buildText(item).toLowerCase();
        return score + (haystack.includes(term) ? 1 : 0);
        }, 0) + (scoreBoost?.(item) ?? 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.item);
}
