import type {
    Capability,
    ChatAttachment,
    ChatMessage,
    ExecutionTrace,
    ResearchFinding,
} from "@mcpsurface/shared";
import type { ChatContextService } from "./chat-context-service.js";
import type { ChatExecutionFlow } from "./chat-execution-flow.js";
import type { ChatOrchestrator, ChatTurnPlan } from "./chat-orchestrator.js";
import { createAttachment } from "./chat-attachments.js";
import type { RetrievedChatContext } from "./chat-rag.js";
import type { ChatStreamEvent } from "./chat-types.js";
import { withDelayedStatus } from "./chat-utils.js";
import { buildExecutionFallbackReply } from "./chat-flow-shared.js";
import {
    buildLowConfidenceClarification,
    shouldClarifyLowConfidenceExecution,
} from "./chat-intent.js";
import {
    buildCapabilitySearchPlan,
    buildExplanationSummary,
    isCapabilitySearchRequest,
} from "./chat-planning.js";
import { resolveWorkersPageEditRequest } from "./chat-workers-edit.js";
import type { RuntimesService } from "../runtimes/runtimes.service.js";

export class ChatTurnRunner {
    constructor(
        private readonly runtimesService: RuntimesService,
        private readonly orchestrator: ChatOrchestrator,
        private readonly contextService: ChatContextService,
        private readonly executionFlow: ChatExecutionFlow,
    ) {}

    async handlePlan(input: {
        plan: ChatTurnPlan;
        context: Awaited<ReturnType<ChatContextService["getPlatformContext"]>>;
        userId: string;
        userEmail: string;
        userMessage: string;
        history: ChatMessage[];
        retrieved: RetrievedChatContext;
        onEvent: (event: ChatStreamEvent) => Promise<void> | void;
        streamAssistantText: (text: string) => Promise<void> | void;
    }) {
        if (input.plan.shouldAskForClarification && input.plan.clarificationQuestion) {
            return {
                context: input.context,
                attachments: [] as ChatAttachment[],
                assistantContent: input.plan.clarificationQuestion,
            };
        }

        let context = input.context;
        let attachments: ChatAttachment[] = [];
        const summaries: string[] = [];
        const lastStepIndex = input.plan.steps.length - 1;

        for (const [index, step] of input.plan.steps.entries()) {
            const outcome = await this.handleStep({
                step,
                isFinalStep: index === lastStepIndex,
                context,
                userId: input.userId,
                userEmail: input.userEmail,
                userMessage: input.userMessage,
                history: input.history,
                retrieved: input.retrieved,
                onEvent: input.onEvent,
                streamAssistantText: input.streamAssistantText,
            });
            context = outcome.context;
            attachments = [...attachments, ...outcome.attachments];

            if (outcome.summary) {
                summaries.push(outcome.summary);
            }

            if (index === lastStepIndex) {
                return {
                    context,
                    attachments,
                    assistantContent: outcome.assistantContent ?? summaries.join(" "),
                };
            }
        }

        return {
            context,
            attachments,
            assistantContent: summaries.join(" "),
        };
    }

    private async handleStep(input: {
        step: ChatTurnPlan["steps"][number];
        isFinalStep: boolean;
        context: Awaited<ReturnType<ChatContextService["getPlatformContext"]>>;
        userId: string;
        userEmail: string;
        userMessage: string;
        history: ChatMessage[];
        retrieved: RetrievedChatContext;
        onEvent: (event: ChatStreamEvent) => Promise<void> | void;
        streamAssistantText: (text: string) => Promise<void> | void;
    }) {
        switch (input.step) {
            case "runtime_status": {
                const summary =
                    input.context.runtime.status === "running"
                        ? `Runtime is running on ${input.context.runtime.executionTarget}.`
                        : `Runtime is currently ${input.context.runtime.status}.`;

                return {
                    context: input.context,
                    attachments: [] as ChatAttachment[],
                    summary,
                    assistantContent: input.isFinalStep
                        ? `Yes. ${summary}`.replace(
                              /^Yes\. Runtime is currently/,
                              "No. Your runtime is currently",
                          )
                        : undefined,
                };
            }
            case "runtime_start": {
                await input.onEvent({
                    type: "status",
                    data: { stage: "runtime", label: "Starting runtime" },
                });
                if (input.context.runtime.status !== "running") {
                    await this.runtimesService.startRuntime(
                        input.context.runtime.id,
                        input.userId,
                        input.userEmail,
                    );
                }
                const context = await this.contextService.getPlatformContext(
                    input.context.platform.id,
                    input.userId,
                    input.userEmail,
                );
                const summary =
                    context.runtime.status === "running"
                        ? `Runtime is now running on ${context.runtime.executionTarget}.`
                        : `I tried to start the runtime, but it is currently ${context.runtime.status}.`;
                return {
                    context,
                    attachments: [],
                    summary,
                    assistantContent: input.isFinalStep
                        ? summary.replace(/^Runtime is/, "Your runtime is")
                        : undefined,
                };
            }
            case "runtime_stop": {
                await input.onEvent({
                    type: "status",
                    data: { stage: "runtime", label: "Stopping runtime" },
                });
                if (input.context.runtime.status === "running") {
                    await this.runtimesService.stopRuntime(
                        input.context.runtime.id,
                        input.userId,
                        input.userEmail,
                    );
                }
                const context = await this.contextService.getPlatformContext(
                    input.context.platform.id,
                    input.userId,
                    input.userEmail,
                );
                const summary =
                    context.runtime.status === "stopped"
                        ? "Runtime is now stopped."
                        : `I tried to stop the runtime, but it is currently ${context.runtime.status}.`;
                return {
                    context,
                    attachments: [],
                    summary,
                    assistantContent: input.isFinalStep
                        ? summary.replace(/^Runtime is/, "Your runtime is")
                        : undefined,
                };
            }
            case "capabilities_overview":
            case "diagnose_failure":
            case "conversation":
            case "clarify": {
                const assistantContent = await this.streamNaturalReply({
                    platform: input.context.platform,
                    runtime: input.context.runtime,
                    userEmail: input.userEmail,
                    userMessage: input.userMessage,
                    history: input.history,
                    capabilities: input.retrieved.capabilities,
                    findings: input.retrieved.findings,
                    traces: input.retrieved.traces,
                    logs: input.retrieved.logs,
                    operationSummary: buildExplanationSummary(input.step, input.retrieved),
                    streamAssistantText: input.streamAssistantText,
                });
                return {
                    context: input.context,
                    attachments: [],
                    assistantContent,
                    summary: assistantContent,
                };
            }
            case "execute_code": {
                return this.handleExecutionStep(input);
            }
        }
    }

    private async handleExecutionStep(input: {
        isFinalStep: boolean;
        context: Awaited<ReturnType<ChatContextService["getPlatformContext"]>>;
        userId: string;
        userEmail: string;
        userMessage: string;
        history: ChatMessage[];
        retrieved: RetrievedChatContext;
        onEvent: (event: ChatStreamEvent) => Promise<void> | void;
        streamAssistantText: (text: string) => Promise<void> | void;
    }) {
        await input.onEvent({
            type: "status",
            data: { stage: "planning", label: "Preparing runtime action" },
        });

        const relevantCapabilities =
            input.retrieved.capabilities.length > 0
                ? input.retrieved.capabilities
                : input.context.capabilities.slice(0, 12);
        const workersPageEditRequest = resolveWorkersPageEditRequest(
            input.userMessage,
            input.context.capabilities,
        );

        if (workersPageEditRequest) {
            const execution = await withDelayedStatus(
                this.executionFlow.runWorkersSourceRewriteFlow({
                    context: input.context,
                    userId: input.userId,
                    userEmail: input.userEmail,
                    userMessage: input.userMessage,
                    history: input.history,
                    request: workersPageEditRequest,
                    onEvent: input.onEvent,
                }),
                async () => {
                    await input.onEvent({
                        type: "status",
                        data: { stage: "executing", label: "Searching for a better solution" },
                    });
                },
            );
            const assistantContent = await this.streamNaturalReply({
                platform: execution.context.platform,
                runtime: execution.context.runtime,
                userEmail: input.userEmail,
                userMessage: input.userMessage,
                history: input.history,
                capabilities: execution.relevantCapabilities,
                findings: execution.relevantFindings,
                traces: execution.relevantTraces,
                logs: execution.relevantLogs,
                operationSummary: execution.summary,
                streamAssistantText: input.streamAssistantText,
                fallback: buildExecutionFallbackReply(
                    execution.summary,
                    execution.output,
                    execution.relevantCapabilities,
                ),
            });
            return {
                context: execution.context,
                attachments: execution.attachments,
                assistantContent,
                summary: execution.summary,
            };
        }

        if (shouldClarifyLowConfidenceExecution(input.userMessage, relevantCapabilities)) {
            const clarificationQuestion = buildLowConfidenceClarification(
                input.userMessage,
                relevantCapabilities,
            );
            return {
                context: input.context,
                attachments: [
                    createAttachment(
                        "execution_plan",
                        "Low-confidence capability match",
                        "The current capability matches are too weak to execute safely without a more specific instruction.",
                        {
                            capabilityKeys: relevantCapabilities
                                .slice(0, 5)
                                .map((capability) => capability.key),
                            capabilityPreview: relevantCapabilities
                                .slice(0, 5)
                                .map((capability) => ({
                                    key: capability.key,
                                    method: capability.method ?? null,
                                    path: capability.path ?? null,
                                    parameterCount: capability.parameters.length,
                                })),
                        },
                    ),
                ],
                assistantContent: clarificationQuestion,
                summary: clarificationQuestion,
            };
        }

        const resolvedPlan = isCapabilitySearchRequest(input.userMessage)
            ? buildCapabilitySearchPlan(input.userMessage, input.context.capabilities)
            : await this.orchestrator.generateExecutionPlan({
                  platform: input.context.platform,
                  runtime: input.context.runtime,
                  userEmail: input.userEmail,
                  userMessage: input.userMessage,
                  capabilities: relevantCapabilities,
                  findings: input.retrieved.findings,
                  history: input.history,
              });

        if (resolvedPlan.clarificationQuestion) {
            return {
                context: input.context,
                attachments: [
                    createAttachment(
                        "execution_plan",
                        "Draft execution plan",
                        resolvedPlan.summary,
                        {
                            capabilityKeys: resolvedPlan.capabilityKeys,
                            code: resolvedPlan.code,
                        },
                    ),
                ],
                assistantContent: resolvedPlan.clarificationQuestion,
            };
        }

        await input.onEvent({
            type: "status",
            data: { stage: "executing", label: "Running in runtime" },
        });
        const execution = await withDelayedStatus(
            this.executionFlow.runExecutionPlan({
                context: input.context,
                userId: input.userId,
                userEmail: input.userEmail,
                plan: resolvedPlan,
            }),
            async () => {
                await input.onEvent({
                    type: "status",
                    data: { stage: "executing", label: "Searching for a better solution" },
                });
            },
        );
        const assistantContent = await this.streamNaturalReply({
            platform: execution.context.platform,
            runtime: execution.context.runtime,
            userEmail: input.userEmail,
            userMessage: input.userMessage,
            history: input.history,
            capabilities: execution.relevantCapabilities,
            findings: execution.relevantFindings,
            traces: execution.relevantTraces,
            logs: execution.relevantLogs,
            operationSummary: execution.summary,
            streamAssistantText: input.streamAssistantText,
            fallback: buildExecutionFallbackReply(
                execution.summary,
                execution.output,
                execution.relevantCapabilities,
            ),
        });
        return {
            context: execution.context,
            attachments: execution.attachments,
            assistantContent,
            summary: execution.summary,
        };
    }

    async streamNaturalReply(input: {
        platform: Awaited<ReturnType<ChatContextService["getPlatformContext"]>>["platform"];
        runtime: Awaited<ReturnType<ChatContextService["getPlatformContext"]>>["runtime"];
        userEmail: string;
        userMessage: string;
        history: ChatMessage[];
        capabilities: Capability[];
        findings: ResearchFinding[];
        traces: ExecutionTrace[];
        logs: Awaited<ReturnType<ChatContextService["getPlatformContext"]>>["logs"];
        operationSummary: string;
        streamAssistantText: (text: string) => Promise<void> | void;
        fallback?: string;
    }) {
        try {
            const assistantContent = await this.orchestrator.streamComposeReply(
                {
                    platform: input.platform,
                    runtime: input.runtime,
                    userEmail: input.userEmail,
                    userMessage: input.userMessage,
                    history: input.history,
                    capabilities: input.capabilities,
                    findings: input.findings,
                    traces: input.traces,
                    logs: input.logs,
                    operationSummary: input.operationSummary,
                },
                input.streamAssistantText,
            );

            return assistantContent || input.fallback || input.operationSummary;
        } catch {
            return input.fallback ?? input.operationSummary;
        }
    }
}
