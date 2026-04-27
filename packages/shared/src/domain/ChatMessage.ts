export const chatMessageRoles = ["user", "assistant", "system"] as const;
export const chatAttachmentTypes = [
  "execution_plan",
  "approval_request",
  "runtime_error",
  "trace_link",
  "context_note",
] as const;

export type ChatMessageRole = (typeof chatMessageRoles)[number];
export type ChatAttachmentType = (typeof chatAttachmentTypes)[number];

export interface ChatAttachment {
  id: string;
  type: ChatAttachmentType;
  title: string;
  body?: string | undefined;
  metadata: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  platformId: string;
  runtimeId: string;
  userEmail: string;
  role: ChatMessageRole;
  content: string;
  attachments: ChatAttachment[];
  createdAt: string;
}
