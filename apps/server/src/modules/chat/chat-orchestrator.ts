import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import type {
    Capability,
    ChatMessage,
    ExecutionTrace,
    Platform,
    ResearchFinding,
    WorkspaceRuntime,
} from "@mcpsurface/shared";
import { env } from "../../lib/env.js";
import type { RuntimeLogEntry } from "./chat-rag.js";

const chatTurnStepSchema = z.enum([
    "conversation",
    "runtime_status",
    "runtime_start",
    "runtime_stop",
    "capabilities_overview",
    "diagnose_failure",
    "execute_code",
    "clarify",
]);

const chatTurnPlanSchema = z.object({
    steps: z.array(chatTurnStepSchema).min(1).max(4),
    primaryIntent: chatTurnStepSchema,
    needsRuntime: z.boolean().default(false),
    shouldExecute: z.boolean().default(false),
    shouldAskForClarification: z.boolean().default(false),
    clarificationQuestion: z.string().optional(),
    retrieval: z.object({
        capabilities: z.boolean().default(false),
        findings: z.boolean().default(false),
        traces: z.boolean().default(false),
        logs: z.boolean().default(false),
    }),
    retrievalQuery: z.string().default(""),
});

const executionPlanSchema = z.object({
    summary: z.string().min(1),
    capabilityKeys: z.array(z.string()).default([]),
    code: z.string().min(1),
    clarificationQuestion: z.string().optional(),
});

const workerSourceRewriteSchema = z.object({
    summary: z.string().min(1),
    source: z.string().min(1),
});

export type ChatTurnPlan = z.infer<typeof chatTurnPlanSchema>;
export type ExecutionPlan = z.infer<typeof executionPlanSchema>;

interface ComposeReplyInput {
    platform: Platform;
    runtime: WorkspaceRuntime;
    userEmail: string;
    userMessage: string;
    history: ChatMessage[];
    capabilities: Capability[];
    findings: ResearchFinding[];
    traces: ExecutionTrace[];
    logs: RuntimeLogEntry[];
    operationSummary: string;
}

export class ChatOrchestrator {
    private readonly client: ChatOpenAI;
    private readonly planningClient: ReturnType<ChatOpenAI["withStructuredOutput"]>;
    private readonly executionPlanClient: ReturnType<ChatOpenAI["withStructuredOutput"]>;
    private readonly workerRewriteClient: ReturnType<ChatOpenAI["withStructuredOutput"]>;

    constructor(client?: ChatOpenAI) {
        if (!env.OPENROUTER_API_KEY) {
            throw new Error("OPENROUTER_API_KEY is required for chat orchestration.");
        }

        this.client =
            client ??
            new ChatOpenAI({
                apiKey: env.OPENROUTER_API_KEY,
                model: env.CHAT_MODEL,
                temperature: 0.2,
                configuration: {
                    baseURL: env.OPENROUTER_BASE_URL,
                    defaultHeaders: {
                        "HTTP-Referer": env.OPENROUTER_HTTP_REFERER,
                        "X-Title": env.OPENROUTER_APP_NAME,
                    },
                },
            });
        this.planningClient = this.client.withStructuredOutput(chatTurnPlanSchema);
        this.executionPlanClient = this.client.withStructuredOutput(executionPlanSchema);
        this.workerRewriteClient = this.client.withStructuredOutput(workerSourceRewriteSchema);
    }

    async planTurn(input: {
        platform: Platform;
        runtime: WorkspaceRuntime;
        userEmail: string;
        history: ChatMessage[];
        userMessage: string;
    }) {
        try {
            const result = await this.planningClient.invoke([
                {
                    role: "system",
                    content: [
                        "You are the orchestration planner for a platform chat.",
                        "Return a short ordered plan for the current user turn.",
                        "A user turn can require more than one step.",
                        "Valid steps are: conversation, runtime_status, runtime_start, runtime_stop, capabilities_overview, diagnose_failure, execute_code, clarify.",
                        "If the user asks for compound work like 'start the runtime and then search', include both steps in order.",
                        "Prefer runtime_status for questions about whether the runtime is running or stopped.",
                        "Prefer runtime_start or runtime_stop for direct lifecycle requests.",
                        "Prefer diagnose_failure when the user is asking why something failed.",
                        "Prefer capabilities_overview when the user is asking what the platform can do.",
                        "Prefer execute_code when the user is clearly asking the platform to perform work or search inside the runtime.",
                        "Treat concrete webpage or Worker edit requests as execute_code, especially when the user names a workers.dev URL or asks to add, change, edit, update, remove, deploy, or publish something.",
                        "Set shouldExecute=true when execute_code is part of the plan.",
                        "Set needsRuntime=true when the requested work depends on the runtime.",
                        "Set shouldAskForClarification=true only when a clarification question is genuinely needed.",
                    ].join("\n"),
                },
                {
                    role: "user",
                    content: JSON.stringify({
                        platform: {
                            id: input.platform.id,
                            name: input.platform.name,
                            slug: input.platform.slug,
                        },
                        runtime: {
                            id: input.runtime.id,
                            status: input.runtime.status,
                            executionTarget: input.runtime.executionTarget,
                        },
                        userEmail: input.userEmail,
                        recentMessages: summarizeHistory(input.history),
                        userMessage: input.userMessage,
                    }),
                },
            ]);
            return normalizeStructuredResult(chatTurnPlanSchema, result);
        } catch {
            return fallbackPlan(input.userMessage);
        }
    }

    async generateExecutionPlan(input: {
        platform: Platform;
        runtime: WorkspaceRuntime;
        userEmail: string;
        userMessage: string;
        capabilities: Capability[];
        findings: ResearchFinding[];
        history: ChatMessage[];
    }) {
        try {
            const result = await this.executionPlanClient.invoke([
                {
                    role: "system",
                    content: [
                        "You are generating TypeScript for a platform runtime orchestrator.",
                        "Write small JS-compatible TypeScript snippets only.",
                        "You are given a runtime facade with:",
                        "- runtime.search(query)",
                        "- runtime.execute({ capabilityKey, input })",
                        "- runtime.capabilities.<generatedAccessor>(input)",
                        "Use only that facade.",
                        "Use the provided capabilities and runtime surface generated from ingestion.",
                        "For Worker or webpage edits, search for the relevant read and write capabilities, fetch the current script through the read capability, modify it in code, then send the updated script body back through the write capability.",
                        "For a workers.dev URL, you can usually derive script_name from the subdomain.",
                        "If the user gave a concrete page change, do not ask for clarification unless a required target is still missing.",
                        "Prefer using workers script content read/write capabilities when the request is to change a workers.dev page.",
                        "Only treat a write as successful if the execution result confirms ok: true or returns a successful HTTP status.",
                        "If the request is ambiguous, set clarificationQuestion and still provide a safe minimal code sample.",
                        "Never invent capability keys. Use only the capabilities provided.",
                    ].join("\n"),
                },
                {
                    role: "user",
                    content: JSON.stringify({
                        platform: {
                            id: input.platform.id,
                            name: input.platform.name,
                        },
                        runtime: {
                            id: input.runtime.id,
                            status: input.runtime.status,
                            executionTarget: input.runtime.executionTarget,
                        },
                        userEmail: input.userEmail,
                        recentMessages: summarizeHistory(input.history),
                        userMessage: input.userMessage,
                        capabilities: input.capabilities.map((capability) => ({
                            key: capability.key,
                            name: capability.name,
                            summary: capability.summary,
                            method: capability.method,
                            path: capability.path,
                            riskLevel: capability.riskLevel,
                            approvalMode: capability.approvalMode,
                            parameters: capability.parameters,
                        })),
                        findings: input.findings.slice(0, 6).map((finding) => ({
                            title: finding.title,
                            summary: finding.summary,
                            evidence: finding.evidence,
                            provenanceUrl: finding.provenanceUrl,
                        })),
                    }),
                },
            ]);
            return normalizeStructuredResult(executionPlanSchema, result);
        } catch {
            return fallbackExecutionPlan(input.userMessage);
        }
    }

    async rewriteWorkerSource(input: {
        platform: Platform;
        runtime: WorkspaceRuntime;
        userEmail: string;
        userMessage: string;
        history: ChatMessage[];
        targetUrl: string;
        scriptName: string;
        currentSource: string;
    }) {
        const result = await this.workerRewriteClient.invoke([
            {
                role: "system",
                content: [
                    "You are rewriting a Cloudflare Worker source file for a platform runtime.",
                    "Return the full rewritten Worker source.",
                    "Preserve the current Worker style: if it is module syntax, keep module syntax; if it is service-worker syntax, keep that syntax.",
                    "Make only the changes required by the user's request.",
                    "Do not describe the changes. Return the full final source in the source field.",
                    "Do not invent external dependencies or change the deployment model.",
                    "The output must remain a valid Cloudflare Worker script.",
                ].join("\n"),
            },
            {
                role: "user",
                content: JSON.stringify({
                    platform: {
                        id: input.platform.id,
                        name: input.platform.name,
                    },
                    runtime: {
                        id: input.runtime.id,
                        status: input.runtime.status,
                        executionTarget: input.runtime.executionTarget,
                    },
                    userEmail: input.userEmail,
                    targetUrl: input.targetUrl,
                    scriptName: input.scriptName,
                    recentMessages: summarizeHistory(input.history),
                    userMessage: input.userMessage,
                    currentSource: input.currentSource,
                }),
            },
        ]);

        return normalizeStructuredResult(workerSourceRewriteSchema, result);
    }

    async composeReply(input: ComposeReplyInput) {
        const response = await this.client.invoke(buildComposeReplyMessages(input));

        return textFromResponse(response).trim();
    }

    async streamComposeReply(
        input: ComposeReplyInput,
        onToken: (text: string) => Promise<void> | void,
    ) {
        const stream = await this.client.stream(buildComposeReplyMessages(input));
        let fullText = "";

        for await (const chunk of stream) {
            const text = textFromResponse(chunk);

            if (!text) {
                continue;
            }

            fullText += text;
            await onToken(text);
        }

        return fullText.trim();
    }
}

function buildComposeReplyMessages(input: ComposeReplyInput) {
    return [
        {
            role: "system" as const,
            content: [
                "You are the user-facing assistant for a generated platform runtime.",
                "Reply naturally and directly, like a premium frontier chat product.",
                "Be concise, clear, and grounded in the supplied facts.",
                "Do not dump capability lists unless the user asked what the platform can do.",
                "When execution happened, explain what you did, what happened, and any next step.",
                "When runtime state changed, mention the new state clearly.",
                "Do not narrate future work. The final reply must describe completed work, a concrete failure, or a clarification that is still needed.",
                "Never say you are still working, that the user should hold on, or that you will update them later.",
                "Never claim a Worker or script was updated unless the supplied execution summary or trace output confirms a successful update.",
            ].join("\n"),
        },
        {
            role: "user" as const,
            content: JSON.stringify({
                platform: {
                    name: input.platform.name,
                    slug: input.platform.slug,
                },
                runtime: {
                    id: input.runtime.id,
                    status: input.runtime.status,
                    executionTarget: input.runtime.executionTarget,
                },
                userEmail: input.userEmail,
                userMessage: input.userMessage,
                recentMessages: summarizeHistory(input.history),
                relevantCapabilities: input.capabilities.map((capability) => ({
                    key: capability.key,
                    name: capability.name,
                    summary: capability.summary,
                    method: capability.method,
                    path: capability.path,
                })),
                relevantFindings: input.findings.map((finding) => ({
                    title: finding.title,
                    summary: finding.summary,
                })),
                traces: input.traces.map((trace) => ({
                    capabilityKey: trace.capabilityKey,
                    status: trace.status,
                    input: trace.input,
                    error: trace.error,
                    output: trace.output,
                })),
                logs: input.logs,
                operationSummary: input.operationSummary,
            }),
        },
    ];
}

function summarizeHistory(messages: ChatMessage[]) {
    return messages.slice(-8).map((message) => ({
        role: message.role,
        content: message.content,
        attachments: message.attachments.map((attachment) => ({
            type: attachment.type,
            title: attachment.title,
        })),
        createdAt: message.createdAt,
    }));
}

function textFromResponse(value: { content: unknown }) {
    if (typeof value.content === "string") {
        return value.content;
    }

    if (Array.isArray(value.content)) {
        return value.content
            .map((part) => {
                if (typeof part === "string") {
                    return part;
                }

                if (
                    part &&
                    typeof part === "object" &&
                    "text" in part &&
                    typeof part.text === "string"
                ) {
                    return part.text;
                }

                return "";
            })
            .join("");
    }

    return "";
}

function fallbackPlan(userMessage: string): ChatTurnPlan {
    const text = normalizeRuntimePhrasing(userMessage.toLowerCase());
    const isSearchLike = /\b(search|find|look up|return|list|show|get)\b/.test(text);
    const isExecuteLike = /\b(use the runtime|inside the runtime|run|execute|search)\b/.test(text);
    const isMutationLike =
        /\b(add|update|edit|modify|change|insert|replace|remove|delete|deploy|publish|create)\b/.test(
            text,
        );
    const startRequested = /\b(start|boot|launch|spin up)\b/.test(text);
    const stopRequested = /\b(stop|end|kill|shut down|shutdown)\b/.test(text);

    if (/\b(is|status|running|stopped|alive)\b/.test(text) && /\bruntime\b/.test(text)) {
        return {
            steps: ["runtime_status"],
            primaryIntent: "runtime_status",
            needsRuntime: true,
            shouldExecute: false,
            shouldAskForClarification: false,
            retrieval: {
                capabilities: false,
                findings: false,
                traces: true,
                logs: true,
            },
            retrievalQuery: userMessage,
        };
    }

    if (startRequested && /\bruntime\b/.test(text) && (isSearchLike || isExecuteLike)) {
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

    if (startRequested && /\bruntime\b/.test(text)) {
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

    if (stopRequested && /\bruntime\b/.test(text)) {
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

    if (/\b(why|failed|error|broken|issue)\b/.test(text)) {
        return {
            steps: ["diagnose_failure"],
            primaryIntent: "diagnose_failure",
            needsRuntime: false,
            shouldExecute: false,
            shouldAskForClarification: false,
            retrieval: {
                capabilities: true,
                findings: true,
                traces: true,
                logs: true,
            },
            retrievalQuery: userMessage,
        };
    }

    if (/\b(can|what).*\b(do|capabilities|operations)\b/.test(text)) {
        return {
            steps: ["capabilities_overview"],
            primaryIntent: "capabilities_overview",
            needsRuntime: false,
            shouldExecute: false,
            shouldAskForClarification: false,
            retrieval: {
                capabilities: true,
                findings: false,
                traces: false,
                logs: false,
            },
            retrievalQuery: userMessage,
        };
    }

    if (isSearchLike || isExecuteLike || isMutationLike || /\bhttps?:\/\/\S+\b/.test(text)) {
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

function fallbackExecutionPlan(userMessage: string): ExecutionPlan {
    return {
        summary: "Ask for clarification before executing runtime code.",
        capabilityKeys: [],
        code: "return { ok: true, note: 'No execution ran because the request needs clarification.' };",
        clarificationQuestion: `I can help with that. What exactly do you want me to do in the runtime for "${userMessage}"?`,
    };
}

function normalizeStructuredResult<T extends z.ZodTypeAny>(schema: T, result: unknown): z.infer<T> {
    if (result && typeof result === "object" && "parsed" in result) {
        return schema.parse((result as { parsed: unknown }).parsed);
    }

    return schema.parse(result);
}

function normalizeRuntimePhrasing(value: string) {
    return value.replace(/\brun\s+time\b/g, "runtime");
}
