import type {
  Capability,
  ChatAttachment,
  ChatMessage,
  ExecutionTrace,
  ResearchFinding,
} from "@mcpsurface/shared";
import type { ApprovalsService } from "../approvals/approvals.service.js";
import type { RuntimesService } from "../runtimes/runtimes.service.js";
import type { ChatContextService, ChatContextSnapshot } from "./chat-context-service.js";
import { createApprovalAttachment, createAttachment } from "./chat-attachments.js";
import { fallbackExecutionSummary, renderExecutionOutputDetails, summarizeExecutionResult } from "./chat-flow-shared.js";

export class ChatApprovalFlow {
  constructor(
    private readonly approvalsService: ApprovalsService,
    private readonly runtimesService: RuntimesService,
    private readonly contextService: ChatContextService,
  ) {}

  async runApprovalResolutionFlow(input: {
    context: ChatContextSnapshot;
    userEmail: string;
    approvalId: string;
    decision: "approve" | "reject";
    history: ChatMessage[];
    userMessage: string;
    streamAssistantText: (text: string) => Promise<void> | void;
    composeReply: (input: {
      platform: ChatContextSnapshot["platform"];
      runtime: ChatContextSnapshot["runtime"];
      userEmail: string;
      userMessage: string;
      history: ChatMessage[];
      capabilities: Capability[];
      findings: ResearchFinding[];
      traces: ExecutionTrace[];
      logs: ChatContextSnapshot["logs"];
      operationSummary: string;
      streamAssistantText: (text: string) => Promise<void> | void;
      fallback?: string;
    }) => Promise<string>;
  }) {
    if (input.decision === "reject") {
      const approval = await this.approvalsService.rejectRequest({
        approvalId: input.approvalId,
        currentUserEmail: input.userEmail,
      });
      const context = await this.contextService.getPlatformContext(
        input.context.platform.id,
        input.context.platform.createdByUserId,
        input.userEmail,
      );
      const assistantContent = "I rejected that approval request. No action was executed.";

      return {
        context,
        attachments: [createApprovalAttachment(approval, "Request rejected")] satisfies ChatAttachment[],
        assistantContent,
      };
    }

    const resolution = await this.approvalsService.approveRequest({
      approvalId: input.approvalId,
      currentUserEmail: input.userEmail,
      executeApprovedCapability: (approval) => this.runtimesService.executeApprovedCapability(approval, input.userEmail),
    });
    const context = await this.contextService.getPlatformContext(
      input.context.platform.id,
      input.context.platform.createdByUserId,
      input.userEmail,
    );
    const relevantCapabilities = context.capabilities.filter((capability) => capability.key === resolution.approval.capabilityKey);
    const trace = resolution.trace;
    const relevantTraces = [trace, ...context.traces.filter((entry) => entry.id !== trace.id)].slice(0, 6);
    const summary = [
      `Approved ${resolution.approval.capabilityKey} for ${resolution.approval.requesterEmail}.`,
      resolution.trace ? summarizeExecutionResult(resolution.trace.status, resolution.trace.error, resolution.output) : null,
      resolution.output ? renderExecutionOutputDetails(resolution.output) : null,
    ]
      .filter(Boolean)
      .join(" ");

    const assistantContent = await input.composeReply({
      platform: context.platform,
      runtime: resolution.runtime,
      userEmail: input.userEmail,
      userMessage: input.userMessage,
      history: input.history,
      capabilities: relevantCapabilities,
      findings: context.findings.slice(0, 10),
      traces: relevantTraces,
      logs: context.logs.slice(0, 10),
      operationSummary: summary,
      streamAssistantText: input.streamAssistantText,
      fallback: fallbackExecutionSummary(summary, relevantCapabilities),
    });

    return {
      context,
      attachments: [
        createApprovalAttachment(resolution.approval, "Request approved"),
        createAttachment("trace_link", "Execution trace recorded", trace.id, {
          traceId: trace.id,
          runtimeId: resolution.runtime.id,
        }),
      ] satisfies ChatAttachment[],
      assistantContent,
    };
  }
}
