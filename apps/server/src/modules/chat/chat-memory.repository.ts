import type { ChatMessage, ChatSession } from "@mcpsurface/shared";
import { readJsonFile, writeJsonFile } from "../../infrastructure/file-store.js";

const CHAT_SESSIONS_FILE_NAME = "chat-sessions.json";
const CHAT_MESSAGES_FILE_NAME = "chat-messages.json";

export class ChatMemoryRepository {
    async listSessions(): Promise<ChatSession[]> {
        return readJsonFile<ChatSession[]>(CHAT_SESSIONS_FILE_NAME, []);
    }

    async saveSessions(sessions: ChatSession[]): Promise<void> {
        await writeJsonFile(CHAT_SESSIONS_FILE_NAME, sessions);
    }

    async listMessages(): Promise<ChatMessage[]> {
        return readJsonFile<ChatMessage[]>(CHAT_MESSAGES_FILE_NAME, []);
    }

    async saveMessages(messages: ChatMessage[]): Promise<void> {
        await writeJsonFile(CHAT_MESSAGES_FILE_NAME, messages);
    }
}
