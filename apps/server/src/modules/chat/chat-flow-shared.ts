import type { Capability, ExecutionTrace } from "@mcpsurface/shared";

export function fallbackExecutionSummary(summary: string, capabilities: Capability[]) {
  const lead = capabilities.length > 0 ? `I used ${capabilities[0]?.name}` : "I ran the requested action";
  return `${lead}. ${summary}`;
}

export function buildExecutionFallbackReply(
  summary: string,
  output: Record<string, unknown> | undefined,
  capabilities: Capability[],
) {
  const searchMatches = Array.isArray(output?.matches) ? output.matches : null;

  if (searchMatches && searchMatches.length > 0) {
    const lines = searchMatches.slice(0, 5).map((match, index) => {
      if (!match || typeof match !== "object") {
        return `${index + 1}. Result unavailable.`;
      }

      const record = match as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name : "Unnamed capability";
      const method = typeof record.method === "string" ? record.method : null;
      const path = typeof record.path === "string" ? record.path : null;
      const parameters = Array.isArray(record.parameters)
        ? record.parameters
            .map((parameter) => {
              if (!parameter || typeof parameter !== "object") {
                return null;
              }

              const parameterRecord = parameter as Record<string, unknown>;
              const parameterName =
                typeof parameterRecord.name === "string" ? parameterRecord.name : "unknown";
              const required = parameterRecord.required === true ? "required" : "optional";
              return `${parameterName} (${required})`;
            })
            .filter((value): value is string => Boolean(value))
        : [];

      const details = [method, path].filter(Boolean).join(" ");
      const parameterText = parameters.length > 0 ? ` Inputs: ${parameters.join(", ")}.` : " Inputs: none.";
      return `${index + 1}. ${name}${details ? ` — ${details}.` : "."}${parameterText}`;
    });

    return `I found ${searchMatches.length} matching capabilities.\n\n${lines.join("\n")}`;
  }

  if (searchMatches && searchMatches.length === 0) {
    return "I ran the runtime search, but it didn't return any matching capabilities. Try a narrower query like `workers routes`, `worker scripts`, or `zones`.";
  }

  return fallbackExecutionSummary(summary, capabilities);
}

export function summarizeExecutionResult(
  status: ExecutionTrace["status"],
  error: string | undefined,
  output: Record<string, unknown> | undefined,
) {
  if (status === "failed") {
    return `Runtime execution failed: ${error ?? "Unknown error."}`;
  }

  return "Executed runtime code successfully.";
}

export function renderExecutionOutputDetails(output: Record<string, unknown>) {
  return `Output: ${JSON.stringify(output)}`;
}
