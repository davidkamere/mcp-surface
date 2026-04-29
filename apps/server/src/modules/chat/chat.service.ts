import type { ChatAttachment, ChatMessage, ChatSession, CreateChatSessionInput } from "@mcpsurface/shared";
import { createId } from "../../lib/ids.js";
import { ApprovalsService } from "../approvals/approvals.service.js";
import { GenerationRepository } from "../generation/generation.repository.js";
import { PlatformsRepository } from "../platforms/platforms.repository.js";
import { ResearchRepository } from "../research/research.repository.js";
import { RuntimesRepository } from "../runtimes/runtimes.repository.js";
import { RuntimesService } from "../runtimes/runtimes.service.js";
import { SharingRepository } from "../sharing/sharing.repository.js";
import { ChatContextService } from "./chat-context-service.js";
import { ChatMemoryRepository } from "./chat-memory.repository.js";
import { ChatOrchestrator } from "./chat-orchestrator.js";
import { retrieveChatContext } from "./chat-rag.js";
import { createAttachment } from "./chat-attachments.js";
import { ChatApprovalFlow } from "./chat-approval-flow.js";
import {
  resolveApprovalDecision,
  resolveEffectiveUserMessage,
  resolveTraceCodeReply,
} from "./chat-intent.js";
import { coerceLifecyclePlan, fallbackPlanForTimeout, humanizeChatFailure } from "./chat-planning.js";
import { ChatExecutionFlow } from "./chat-execution-flow.js";
import type { ChatStreamEvent } from "./chat-types.js";
import { chunkText, withTimeout } from "./chat-utils.js";
import { ChatTurnRunner } from "./chat-turn-runner.js";

const CHAT_STEP_TIMEOUT_MS = 50_000;

export class ChatService {
  private readonly approvalFlow: ChatApprovalFlow;
  private readonly executionFlow: ChatExecutionFlow;
  private readonly turnRunner: ChatTurnRunner;

  constructor(
    private readonly memoryRepository: ChatMemoryRepository = new ChatMemoryRepository(),
    private readonly contextService: ChatContextService = new ChatContextService(),
    private readonly approvalsService: ApprovalsService = new ApprovalsService(),
    private readonly runtimesService: RuntimesService = new RuntimesService(
      new RuntimesRepository(),
      new GenerationRepository(),
      new ResearchRepository(),
      new PlatformsRepository(),
      new SharingRepository(),
      new ApprovalsService(),
    ),
    private readonly orchestrator: ChatOrchestrator = new ChatOrchestrator(),
  ) {
    this.approvalFlow = new ChatApprovalFlow(this.approvalsService, this.runtimesService, this.contextService);
    this.executionFlow = new ChatExecutionFlow(this.runtimesService, this.contextService, this.orchestrator);
    this.turnRunner = new ChatTurnRunner(
      this.runtimesService,
      this.orchestrator,
      this.contextService,
      this.executionFlow,
    );
  }

  async createSession(platformId: string, userId: string, userEmail: string, input: CreateChatSessionInput) {
    const context = await this.contextService.getPlatformContext(platformId, userId, userEmail);
    const sessions = await this.memoryRepository.listSessions();
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: createId(),
      platformId,
      runtimeId: context.runtime.id,
      userEmail,
      title: input.title?.trim() || `${context.platform.name} chat`,
      createdAt: now,
      updatedAt: now,
    };

    await this.memoryRepository.saveSessions([session, ...sessions]);
    return session;
  }

  async listSessions(platformId: string, userId: string, userEmail: string) {
    await this.contextService.getPlatformContext(platformId, userId, userEmail);
    const sessions = await this.memoryRepository.listSessions();
    return sessions
      .filter((session) => session.platformId === platformId && session.userEmail === userEmail)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async listMessages(sessionId: string, userId: string, userEmail: string) {
    const session = await this.loadSession(sessionId, userEmail);
    await this.contextService.getPlatformContext(session.platformId, userId, userEmail);
    const messages = await this.memoryRepository.listMessages();
    return messages
      .filter((message) => message.sessionId === sessionId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async getContext(platformId: string, userId: string, userEmail: string) {
    const context = await this.contextService.getPlatformContext(platformId, userId, userEmail);
    return {
      platform: context.platform,
      runtime: context.runtime,
      capabilities: context.capabilities.slice(0, 20),
      findings: context.findings.slice(0, 20),
      traces: context.traces.slice(0, 10),
      logs: context.logs.slice(0, 10),
    };
  }

  async streamTurn(input: {
    sessionId: string;
    userId: string;
    userEmail: string;
    content: string;
    onEvent: (event: ChatStreamEvent) => Promise<void> | void;
  }) {
    const session = await this.loadSession(input.sessionId, input.userEmail);
    const history = await this.listMessages(session.id, input.userId, input.userEmail);
    const effectiveUserMessage = resolveEffectiveUserMessage(input.content, history);
    const userMessage = await this.appendMessage({
      session,
      role: "user",
      content: input.content,
      attachments: [],
    });

    await input.onEvent({ type: "status", data: { stage: "thinking", label: "Thinking" } });

    let context = await this.contextService.getPlatformContext(session.platformId, input.userId, input.userEmail);
    const latestPendingApproval = await this.approvalsService.getLatestPendingApprovalForPlatform(session.platformId);
    const approvalDecision = resolveApprovalDecision(input.content);
    const isRootUser = context.platform.ownerEmail.trim().toLowerCase() === input.userEmail.trim().toLowerCase();

    let assistantContent = "";
    let attachments: ChatAttachment[] = [];
    let streamedAssistantContent = "";

    const streamAssistantText = async (text: string) => {
      if (!text) {
        return;
      }

      streamedAssistantContent += text;
      await input.onEvent({ type: "assistant_delta", data: { text } });
    };

    try {
      const traceCodeReply = resolveTraceCodeReply(input.content, context.traces);

      if (traceCodeReply) {
        assistantContent = traceCodeReply;
      } else if (approvalDecision && latestPendingApproval && isRootUser) {
        await input.onEvent({
          type: "status",
          data: {
            stage: "executing",
            label: approvalDecision === "approve" ? "Running approved action" : "Rejecting approval request",
          },
        });

        assistantContent = await withTimeout(
          this.approvalFlow
            .runApprovalResolutionFlow({
              context,
              userEmail: input.userEmail,
              approvalId: latestPendingApproval.id,
              decision: approvalDecision,
              history: [...history, userMessage],
              userMessage: input.content,
              streamAssistantText,
              composeReply: (composeInput) => this.turnRunner.streamNaturalReply(composeInput),
            })
            .then((result) => {
              context = result.context;
              attachments = result.attachments;
              return result.assistantContent;
            }),
          CHAT_STEP_TIMEOUT_MS,
          "That action is taking longer than expected. Try again or ask me to narrow the task.",
        );
      } else {
        const modelPlan = await withTimeout(
          this.orchestrator.planTurn({
            platform: context.platform,
            runtime: context.runtime,
            userEmail: input.userEmail,
            history,
            userMessage: effectiveUserMessage,
          }),
          CHAT_STEP_TIMEOUT_MS,
          fallbackPlanForTimeout(effectiveUserMessage),
        );
        const plan = coerceLifecyclePlan(effectiveUserMessage, modelPlan, history);
        const retrieved = retrieveChatContext(
          {
            query: plan.retrievalQuery || effectiveUserMessage,
            includeCapabilities: plan.retrieval.capabilities,
            includeFindings: plan.retrieval.findings,
            includeTraces: plan.retrieval.traces,
            includeLogs: plan.retrieval.logs,
          },
          context,
        );

        const outcome = await withTimeout(
          this.turnRunner.handlePlan({
            plan,
            context,
            userId: input.userId,
            userEmail: input.userEmail,
            userMessage: effectiveUserMessage,
            history: [...history, userMessage],
            retrieved,
            onEvent: input.onEvent,
            streamAssistantText,
          }),
          CHAT_STEP_TIMEOUT_MS,
          {
            context,
            attachments: [
              createAttachment(
                "runtime_error",
                "Request timed out",
                "This took longer than expected. Try asking for a smaller step or a more specific action.",
                { sessionId: session.id },
              ),
            ],
            assistantContent:
              "That took longer than expected. Try again, or ask me for a smaller step so I can finish it cleanly.",
          },
        );

        context = outcome.context;
        attachments = outcome.attachments;
        assistantContent = outcome.assistantContent;
      }
    } catch (error) {
      const message = humanizeChatFailure(error);
      attachments = [createAttachment("runtime_error", "Chat orchestration failed", message, { sessionId: session.id })];
      assistantContent = message;
    }

    if (streamedAssistantContent) {
      assistantContent = streamedAssistantContent.trim() || assistantContent;
    } else {
      for (const chunk of chunkText(assistantContent)) {
        await input.onEvent({ type: "assistant_delta", data: { text: chunk } });
      }
    }

    const assistantMessage = await this.appendMessage({
      session,
      role: "assistant",
      content: assistantContent,
      attachments,
    });

    await input.onEvent({ type: "assistant_message", data: { message: assistantMessage } });
    await input.onEvent({ type: "done", data: { sessionId: session.id } });
  }

  private async appendMessage(input: {
    session: ChatSession;
    role: ChatMessage["role"];
    content: string;
    attachments: ChatAttachment[];
  }) {
    const messages = await this.memoryRepository.listMessages();
    const sessions = await this.memoryRepository.listSessions();
    const now = new Date().toISOString();
    const message: ChatMessage = {
      id: createId(),
      sessionId: input.session.id,
      platformId: input.session.platformId,
      runtimeId: input.session.runtimeId,
      userEmail: input.session.userEmail,
      role: input.role,
      content: input.content,
      attachments: input.attachments,
      createdAt: now,
    };
    const nextSessions = sessions.map((session) =>
      session.id === input.session.id ? { ...session, updatedAt: now, lastMessageAt: now } : session,
    );

    await Promise.all([
      this.memoryRepository.saveMessages([...messages, message]),
      this.memoryRepository.saveSessions(nextSessions),
    ]);

    return message;
  }

  private async loadSession(sessionId: string, userEmail: string) {
    const sessions = await this.memoryRepository.listSessions();
    const session = sessions.find((entry) => entry.id === sessionId && entry.userEmail === userEmail);

    if (!session) {
      throw new Error("Chat session not found.");
    }

    return session;
  }
}
