export interface ChatSession {
  id: string;
  platformId: string;
  runtimeId: string;
  userEmail: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | undefined;
}
