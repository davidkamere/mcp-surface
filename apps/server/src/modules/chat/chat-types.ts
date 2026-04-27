export interface ChatStreamEvent {
  type: "status" | "assistant_delta" | "assistant_message" | "error" | "done";
  data: unknown;
}
