import type { ChatAttachment, ResearchFinding } from "@mcpsurface/shared";
import type { ChatOrchestrator, ExecutionPlan } from "./chat-orchestrator.js";
import type { ChatContextService, ChatContextSnapshot } from "./chat-context-service.js";
import type { ChatStreamEvent } from "./chat-types.js";
import type { RuntimesService } from "../runtimes/runtimes.service.js";
import { createApprovalAttachment, createAttachment } from "./chat-attachments.js";
import { renderExecutionOutputDetails, summarizeExecutionResult } from "./chat-flow-shared.js";
import {
    buildWorkersSourceReadCode,
    buildWorkersSourceWriteCode,
    dedupeCapabilities,
    extractAccountId,
    resolveWorkersPageEditRequest,
    type WorkersPageEditRequest,
    validateWorkerSourceRewrite,
} from "./chat-workers-edit.js";

export { resolveWorkersPageEditRequest, type WorkersPageEditRequest } from "./chat-workers-edit.js";

export class ChatExecutionFlow {
    constructor(
        private readonly runtimesService: RuntimesService,
        private readonly contextService: ChatContextService,
        private readonly orchestrator: ChatOrchestrator,
    ) {}

    async runWorkersSourceRewriteFlow(input: {
        context: ChatContextSnapshot;
        userId: string;
        userEmail: string;
        userMessage: string;
        history: import("@mcpsurface/shared").ChatMessage[];
        request: WorkersPageEditRequest;
        onEvent: (event: ChatStreamEvent) => Promise<void> | void;
    }) {
        await input.onEvent({
            type: "status",
            data: {
                stage: "executing",
                label: "Reading current source",
            },
        });

        const readExecution = await this.runExecutionPlan({
            context: input.context,
            userId: input.userId,
            userEmail: input.userEmail,
            plan: {
                summary: `Read the current Worker source for ${input.request.url} before rewriting it.`,
                capabilityKeys: [
                    ...input.request.discoveryCapabilityKeys,
                    ...input.request.readCapabilityKeys,
                ],
                code: buildWorkersSourceReadCode(
                    input.request.url,
                    input.request.discoveryCapabilityKeys,
                    input.request.readCapabilityKeys,
                    input.userMessage,
                ),
            },
        });

        const currentSource =
            typeof readExecution.output?.normalizedSource === "string"
                ? readExecution.output.normalizedSource
                : null;
        const scriptName =
            typeof readExecution.output?.scriptName === "string"
                ? readExecution.output.scriptName
                : null;

        if (!currentSource || !scriptName) {
            return readExecution;
        }

        await input.onEvent({
            type: "status",
            data: {
                stage: "executing",
                label: "Generating rewrite",
            },
        });

        const rewrite = await this.orchestrator.rewriteWorkerSource({
            platform: readExecution.context.platform,
            runtime: readExecution.context.runtime,
            userEmail: input.userEmail,
            userMessage: input.userMessage,
            history: input.history,
            targetUrl: input.request.url,
            scriptName,
            currentSource,
        });

        await input.onEvent({
            type: "status",
            data: {
                stage: "executing",
                label: "Validating rewrite",
            },
        });

        validateWorkerSourceRewrite(rewrite.source);

        await input.onEvent({
            type: "status",
            data: {
                stage: "executing",
                label: "Deploying rewrite",
            },
        });

        const writeExecution = await this.runExecutionPlan({
            context: readExecution.context,
            userId: input.userId,
            userEmail: input.userEmail,
            plan: {
                summary: rewrite.summary,
                capabilityKeys: [input.request.writeCapabilityKey],
                code: buildWorkersSourceWriteCode(
                    scriptName,
                    input.request.writeCapabilityKey,
                    rewrite.source,
                    extractAccountId(input.userMessage),
                ),
            },
        });

        return {
            context: writeExecution.context,
            attachments: [
                ...readExecution.attachments,
                createAttachment("execution_plan", "Generated worker rewrite", rewrite.summary, {
                    scriptName,
                    source: rewrite.source,
                }),
                ...writeExecution.attachments,
            ] satisfies ChatAttachment[],
            relevantCapabilities: dedupeCapabilities([
                ...readExecution.relevantCapabilities,
                ...writeExecution.relevantCapabilities,
            ]),
            relevantFindings: dedupeFindings([
                ...readExecution.relevantFindings,
                ...writeExecution.relevantFindings,
            ]),
            relevantTraces: writeExecution.relevantTraces,
            relevantLogs: writeExecution.relevantLogs,
            output: writeExecution.output,
            summary: [
                `Read Worker source for ${scriptName}.`,
                "Generated a full source rewrite with the chat model and validated it before deploy.",
                writeExecution.summary,
            ].join(" "),
        };
    }

    async runExecutionPlan(input: {
        context: ChatContextSnapshot;
        userId: string;
        userEmail: string;
        plan: ExecutionPlan;
    }) {
        let runtime = input.context.runtime;
        const notes: string[] = [];

        if (runtime.status !== "running") {
            runtime = await this.runtimesService.startRuntime(
                runtime.id,
                input.userId,
                input.userEmail,
            );
            notes.push(`Started runtime ${runtime.id} automatically before execution.`);
        }

        const execution = await this.runtimesService.executeRuntimeCode(
            runtime.id,
            input.userId,
            input.userEmail,
            {
                code: input.plan.code,
                summary: input.plan.summary,
            },
        );
        const context = await this.contextService.getPlatformContext(
            input.context.platform.id,
            input.userId,
            input.userEmail,
        );
        const relevantCapabilities = context.capabilities.filter((capability) =>
            input.plan.capabilityKeys.includes(capability.key),
        );
        const relevantFindings = input.context.findings.filter((finding) =>
            relevantCapabilities.some((capability) =>
                capability.provenance.includes(finding.provenanceUrl),
            ),
        );
        const executionLogs = execution.logs ?? [];

        if (execution.outcome === "approval_pending") {
            const approval = execution.approval;
            if (!approval) {
                throw new Error("Approval request was not returned for a pending execution.");
            }

            return {
                context,
                attachments: [
                    createAttachment(
                        "execution_plan",
                        "Prepared runtime code",
                        input.plan.summary,
                        {
                            capabilityKeys: input.plan.capabilityKeys,
                            code: input.plan.code,
                        },
                    ),
                    createApprovalAttachment(approval, "Approval required"),
                ] satisfies ChatAttachment[],
                relevantCapabilities,
                relevantFindings,
                relevantTraces: context.traces.slice(0, 6),
                relevantLogs: context.logs.slice(0, 8),
                output: undefined,
                summary: `This action needs approval from the platform owner. I created an approval request for ${approval.capabilityKey}.`,
            };
        }

        const trace = execution.trace!;
        const relevantTraces = [
            trace,
            ...context.traces.filter((existingTrace) => existingTrace.id !== trace.id),
        ].slice(0, 6);
        const relevantLogs = [
            ...context.logs,
            ...executionLogs.map((line, index) => ({
                id: `${trace.id}:log:${index}`,
                level: "info" as const,
                message: line,
                createdAt: trace.completedAt,
            })),
        ].slice(0, 8);

        const attachments: ChatAttachment[] = [
            createAttachment("execution_plan", "Executed runtime code", input.plan.summary, {
                capabilityKeys: input.plan.capabilityKeys,
                code: input.plan.code,
            }),
            createAttachment("trace_link", "Execution trace recorded", trace.id, {
                traceId: trace.id,
                runtimeId: runtime.id,
            }),
        ];

        if (trace.status === "failed") {
            attachments.push(
                createAttachment(
                    "runtime_error",
                    "Runtime execution failed",
                    trace.error ?? "Execution failed.",
                    {
                        traceId: trace.id,
                    },
                ),
            );
        }

        return {
            context,
            attachments,
            relevantCapabilities,
            relevantFindings,
            relevantTraces,
            relevantLogs,
            output: execution.output,
            summary: [
                notes.join(" "),
                summarizeExecutionResult(trace.status, trace.error, execution.output),
                execution.output ? renderExecutionOutputDetails(execution.output) : null,
                executionLogs.length > 0 ? `Logs: ${executionLogs.join(" | ")}` : null,
            ]
                .filter(Boolean)
                .join(" "),
        };
    }
}

function dedupeFindings(findings: ResearchFinding[]) {
    const seen = new Set<string>();
    return findings.filter((finding) => {
        const key = `${finding.title}:${finding.provenanceUrl}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
