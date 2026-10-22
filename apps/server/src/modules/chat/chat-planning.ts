import type { Capability, ChatMessage } from "@mcpsurface/shared";
import type { ChatTurnPlan, ExecutionPlan } from "./chat-orchestrator.js";
import {
    isExecutionLikeRequest,
    normalizeRuntimeMessage,
    rankCapabilitiesForSearch,
} from "./chat-intent.js";
import type { RetrievedChatContext } from "./chat-rag.js";

export function buildExplanationSummary(
    step: ChatTurnPlan["steps"][number],
    retrieved: RetrievedChatContext,
) {
    if (step === "capabilities_overview") {
        return `The platform currently has ${retrieved.artifactSummary.capabilityCount} generated capabilities and the MCP surface exposes ${retrieved.artifactSummary.mcpTools.join(" and ")}.`;
    }

    if (step === "diagnose_failure") {
        const latestFailure = retrieved.traces.find((trace) => trace.status === "failed");
        return latestFailure
            ? `The latest relevant failure was ${latestFailure.capabilityKey}: ${latestFailure.error ?? "Unknown error."}`
            : "No recent failed execution traces were found.";
    }

    return `Runtime is ${step === "conversation" ? "available" : "being inspected"} on the generated platform surface.`;
}

export function fallbackPlanForTimeout(userMessage: string): ChatTurnPlan {
    const normalized = normalizeRuntimeMessage(userMessage);
    const wantsSearch = /\b(search|find|show|list|return)\b/.test(normalized);
    const wantsStart = /\b(start|boot|launch|spin up)\b/.test(normalized);
    const wantsExecution = isExecutionLikeRequest(normalized);

    if (wantsStart && wantsSearch) {
        return {
            steps: ["runtime_start", "execute_code"],
            primaryIntent: "execute_code",
            needsRuntime: true,
            shouldExecute: true,
            shouldAskForClarification: false,
            retrieval: {
                capabilities: true,
                findings: true,
                traces: false,
                logs: false,
            },
            retrievalQuery: userMessage,
        };
    }

    if (/\b(stop|end|kill|shut down|shutdown|turn off)\b/.test(normalized)) {
        return {
            steps: ["runtime_stop"],
            primaryIntent: "runtime_stop",
            needsRuntime: true,
            shouldExecute: false,
            shouldAskForClarification: false,
            retrieval: {
                capabilities: false,
                findings: false,
                traces: false,
                logs: false,
            },
            retrievalQuery: userMessage,
        };
    }

    if (wantsStart) {
        return {
            steps: ["runtime_start"],
            primaryIntent: "runtime_start",
            needsRuntime: true,
            shouldExecute: false,
            shouldAskForClarification: false,
            retrieval: {
                capabilities: false,
                findings: false,
                traces: false,
                logs: false,
            },
            retrievalQuery: userMessage,
        };
    }

    if (wantsExecution) {
        return {
            steps: ["execute_code"],
            primaryIntent: "execute_code",
            needsRuntime: true,
            shouldExecute: true,
            shouldAskForClarification: false,
            retrieval: {
                capabilities: true,
                findings: true,
                traces: false,
                logs: false,
            },
            retrievalQuery: userMessage,
        };
    }

    return {
        steps: ["conversation"],
        primaryIntent: "conversation",
        needsRuntime: false,
        shouldExecute: false,
        shouldAskForClarification: false,
        retrieval: {
            capabilities: false,
            findings: false,
            traces: false,
            logs: false,
        },
        retrievalQuery: userMessage,
    };
}

export function humanizeChatFailure(error: unknown) {
    if (error instanceof Error) {
        if (/timed out|longer than expected/i.test(error.message)) {
            return "That took longer than expected. Try again, or ask me for a smaller step.";
        }

        if (/runtime must be running/i.test(error.message)) {
            return "The runtime is not running yet. Start it first, then try again.";
        }

        if (/missing required input/i.test(error.message)) {
            return `I couldn't run that yet. ${error.message}`;
        }
    }

    return "I hit a planning issue behind the scenes. Try asking that a little more specifically.";
}

export function isCapabilitySearchRequest(userMessage: string) {
    const normalized = userMessage.toLowerCase();
    return (
        /\b(search|find|show|list|return|get)\b/.test(normalized) &&
        /\b(capability|capabilities|operation|operations)\b/.test(normalized)
    );
}

export function buildCapabilitySearchPlan(
    userMessage: string,
    capabilities: Capability[],
): ExecutionPlan {
    const query = extractCapabilitySearchQuery(userMessage);
    const limit = extractRequestedLimit(userMessage);
    const detailCandidates = rankCapabilitiesForSearch(query, capabilities).slice(0, 50);
    const rankedCapabilities = detailCandidates.slice(0, limit);
    const capabilityDetails = detailCandidates.map((capability) => ({
        key: capability.key,
        name: capability.name,
        method: capability.method ?? null,
        path: capability.path ?? null,
        parameters: capability.parameters.map((parameter) => ({
            name: parameter.name,
            in: parameter.in,
            required: parameter.required,
            type: parameter.type ?? null,
            description: parameter.description ?? null,
        })),
    }));

    return {
        summary:
            rankedCapabilities.length > 0
                ? `Search for ${query} capabilities and return the top ${rankedCapabilities.length} matches with their interface details.`
                : `Search for ${query} capabilities and report whether any strong matches were found.`,
        capabilityKeys: [],
        code: [
            `const matches = await runtime.search(${JSON.stringify(query)});`,
            `const details = ${JSON.stringify(capabilityDetails, null, 2)};`,
            `const merged = matches.slice(0, ${limit}).map((match) => {`,
            `  const detail = details.find((entry) => entry.key === match.key);`,
            `  return detail ?? { key: match.key, name: match.name, method: match.method ?? null, path: match.path ?? null, parameters: [] };`,
            `});`,
            `return {`,
            `  query: ${JSON.stringify(query)},`,
            `  matches: merged,`,
            `};`,
        ].join("\n"),
    };
}

export function coerceLifecyclePlan(
    userMessage: string,
    plan: ChatTurnPlan,
    history: ChatMessage[],
): ChatTurnPlan {
    const text = normalizeRuntimeMessage(userMessage);
    const recentRuntimeContext = history
        .slice(-4)
        .some((message) => normalizeRuntimeMessage(message.content).includes("runtime"));
    const targetsRuntime =
        /\bruntime\b/.test(text) || (recentRuntimeContext && /\bit\b/.test(text));
    const wantsSearchOrExecution = isExecutionLikeRequest(text);

    if (targetsRuntime) {
        if (/\b(start|boot|launch|spin up)\b/.test(text) && wantsSearchOrExecution) {
            return {
                ...plan,
                steps: ["runtime_start", "execute_code"],
                primaryIntent: "execute_code",
                needsRuntime: true,
                shouldExecute: true,
                retrieval: {
                    capabilities: true,
                    findings: true,
                    traces: false,
                    logs: false,
                },
            };
        }

        if (/\b(start|boot|launch|spin up)\b/.test(text)) {
            return {
                ...plan,
                steps: ["runtime_start"],
                primaryIntent: "runtime_start",
                needsRuntime: true,
                shouldExecute: false,
            };
        }

        if (/\b(stop|end|kill|shut down|shutdown|turn off)\b/.test(text)) {
            return {
                ...plan,
                steps: ["runtime_stop"],
                primaryIntent: "runtime_stop",
                needsRuntime: true,
                shouldExecute: false,
            };
        }

        if (/\b(is|status|running|stopped|alive)\b/.test(text)) {
            return {
                ...plan,
                steps: ["runtime_status"],
                primaryIntent: "runtime_status",
                needsRuntime: true,
                shouldExecute: false,
            };
        }
    }

    if (wantsSearchOrExecution && !plan.steps.includes("execute_code")) {
        return {
            ...plan,
            steps: [...plan.steps.filter((step) => step !== "conversation"), "execute_code"],
            primaryIntent: "execute_code",
            needsRuntime: true,
            shouldExecute: true,
            retrieval: {
                capabilities: true,
                findings: true,
                traces: plan.retrieval.traces,
                logs: plan.retrieval.logs,
            },
        };
    }

    return plan;
}

function extractCapabilitySearchQuery(userMessage: string) {
    const normalized = userMessage.trim();
    const searchForMatch = normalized.match(
        /\b(?:inside the runtime,\s*)?(?:use the runtime to\s*)?(?:search|find|show|list|return|get)\s+for\s+(.+?)(?:\s+and\s+|\s+with\s+|\s*$)/i,
    );

    if (searchForMatch?.[1]) {
        return cleanCapabilitySearchQuery(searchForMatch[1]);
    }

    const searchMatch = normalized.match(
        /\b(?:inside the runtime,\s*)?(?:use the runtime to\s*)?(?:search|find|show|list|return|get)\s+(.+?)(?:\s+and\s+|\s+with\s+|\s*$)/i,
    );

    if (searchMatch?.[1]) {
        return cleanCapabilitySearchQuery(searchMatch[1]);
    }

    const relatedToMatch = normalized.match(/\brelated to\s+(.+?)(?:\s+and\s+|\s+with\s+|\s*$)/i);

    if (relatedToMatch?.[1]) {
        return cleanCapabilitySearchQuery(relatedToMatch[1]);
    }

    const forMatch = normalized.match(/\bfor\s+(.+?)(?:\s+and\s+|\s+with\s+|\s*$)/i);

    if (forMatch?.[1]) {
        return cleanCapabilitySearchQuery(forMatch[1]);
    }

    return cleanCapabilitySearchQuery(normalized);
}

function cleanCapabilitySearchQuery(value: string) {
    return value
        .replace(/\b([a-z0-9_-]+)-related\b/gi, "$1")
        .replace(/\brelated\b/gi, "")
        .replace(/\bcapabilities?\b/gi, "")
        .replace(/\boperations?\b/gi, "")
        .replace(/\brequired parameters?\b/gi, "")
        .replace(/\bmethod\b/gi, "")
        .replace(/\bpath\b/gi, "")
        .replace(/\btop\s+\d+\b/gi, "")
        .replace(/\breturn\b/gi, "")
        .replace(/\bthe best\b/gi, "")
        .replace(/\bthe top\b/gi, "")
        .replace(/[.,]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractRequestedLimit(userMessage: string) {
    const topMatch = userMessage.match(/\btop\s+(\d+)\b/i);
    const firstMatch = userMessage.match(/\bfirst\s+(\d+)\b/i);
    const limit = Number(topMatch?.[1] ?? firstMatch?.[1] ?? "5");

    return Number.isFinite(limit) && limit > 0 ? Math.min(limit, 10) : 5;
}
