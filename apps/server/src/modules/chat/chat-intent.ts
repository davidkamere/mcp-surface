import type { Capability, ChatMessage, ExecutionTrace } from "@mcpsurface/shared";

export function resolveApprovalDecision(content: string): "approve" | "reject" | null {
    if (/\b(reject|decline|deny|do not run|don't run|cancel)\b/i.test(content)) {
        return "reject";
    }

    if (/\b(approve|approved|confirm|go ahead|do it|yes)\b/i.test(content)) {
        return "approve";
    }

    return null;
}

export function resolveTraceCodeReply(content: string, traces: ExecutionTrace[]) {
    if (!isTraceCodeQuestion(content)) {
        return null;
    }

    const traceId = extractTraceId(content);
    const trace = traceId
        ? traces.find((entry) => entry.id === traceId)
        : traces.find(
              (entry) =>
                  typeof entry.input.code === "string" &&
                  entry.capabilityKey === "runtime_code_execution",
          );

    if (!trace) {
        return traceId
            ? `I couldn't find execution trace \`${traceId}\` in your current runtime history.`
            : "I couldn't find a recent runtime code execution trace to show you.";
    }

    const code = typeof trace.input.code === "string" ? trace.input.code : null;

    if (!code) {
        return `I found execution trace \`${trace.id}\`, but it doesn't include stored runtime code.`;
    }

    return [
        `Yes. Here's the code I ran for execution \`${trace.id}\`:`,
        "",
        "```ts",
        code,
        "```",
    ].join("\n");
}

export function resolveEffectiveUserMessage(userMessage: string, history: ChatMessage[]) {
    const directUrl = extractWorkersDevUrl(userMessage);

    if (directUrl) {
        return userMessage;
    }

    const recentUrl = [...history]
        .reverse()
        .map((message) => (message.role === "user" ? extractWorkersDevUrl(message.content) : null))
        .find((value): value is string => Boolean(value));

    if (!recentUrl) {
        return userMessage;
    }

    if (!isLikelyWorkersEditFollowUp(userMessage)) {
        return userMessage;
    }

    return `For ${recentUrl}, ${userMessage}`;
}

export function extractWorkersDevUrl(value: string) {
    const match = value.match(/https?:\/\/[^\s"]+\.workers\.dev[^\s"]*/i);
    return match?.[0] ?? null;
}

export function isLikelyWorkersEditFollowUp(value: string) {
    const normalized = value.toLowerCase();
    return (
        /\b(button|text|style|color|red|blue|green|yellow|orange|purple|pink|black|white|gray|grey|brown|link|page|html|site|worker|script)\b/.test(
            normalized,
        ) ||
        /\b(add|update|edit|modify|change|insert|replace|remove|delete|make|set|turn|again|retry)\b/.test(
            normalized,
        )
    );
}

export function isExecutionLikeRequest(normalizedMessage: string) {
    return (
        /\b(search|find|look up|show|list|return|use the runtime|inside the runtime|run|execute)\b/.test(
            normalizedMessage,
        ) ||
        /\b(add|update|edit|modify|change|insert|replace|remove|delete|deploy|publish|create|make|set|turn|style)\b/.test(
            normalizedMessage,
        ) ||
        /\bhttps?:\/\/\S+\b/.test(normalizedMessage)
    );
}

export function normalizeRuntimeMessage(value: string) {
    return value.toLowerCase().replace(/\brun\s+time\b/g, "runtime");
}

export function rankCapabilitiesForSearch(query: string, capabilities: Capability[]) {
    const terms = query
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean);

    if (terms.length === 0) {
        return capabilities.slice(0, 10);
    }

    return [...capabilities]
        .map((capability) => ({
            capability,
            score:
                terms.reduce(
                    (score, term) =>
                        score + (capabilitySearchText(capability).includes(term) ? 1 : 0),
                    0,
                ) + capabilityExecutionSignal(capability),
        }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)
        .map((entry) => entry.capability);
}

export function shouldClarifyLowConfidenceExecution(
    userMessage: string,
    capabilities: Capability[],
) {
    const normalized = userMessage.toLowerCase();

    if (capabilities.length === 0 || /\bhttps?:\/\/\S+\b/.test(normalized)) {
        return false;
    }

    const topCapabilities = capabilities.slice(0, 3);
    const strongestSignal = Math.max(...topCapabilities.map(capabilityExecutionSignal), 0);

    return strongestSignal < 2;
}

export function buildLowConfidenceClarification(userMessage: string, capabilities: Capability[]) {
    const examples = capabilities
        .slice(0, 3)
        .map((capability) => capability.name)
        .filter(Boolean)
        .join(", ");

    return examples
        ? `I only found low-confidence matches for that request. Tell me the exact object, endpoint, or action you want, for example one of: ${examples}.`
        : `I only found low-confidence matches for that request. Tell me the exact object, endpoint, or action you want me to execute.`;
}

function isTraceCodeQuestion(content: string) {
    const normalized = content.toLowerCase();
    return (
        /\b(code|script|scripts|typescript|ts)\b/.test(normalized) &&
        /\b(execution|trace|ran|run|wrote|write)\b/.test(normalized)
    );
}

function extractTraceId(content: string) {
    const match = content.match(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
    );
    return match?.[0] ?? null;
}

function capabilitySearchText(capability: Capability) {
    return [
        capability.key,
        capability.name,
        capability.summary,
        capability.description,
        capability.method,
        capability.path,
        capability.tags?.join(" "),
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
}

function capabilityExecutionSignal(capability: Capability) {
    let score = 0;

    if (capability.method && capability.path) {
        score += 2;
    }

    if (capability.parameters.length > 0) {
        score += 0.5;
    }

    if (capability.authRequired) {
        score += 0.25;
    }

    return score;
}
