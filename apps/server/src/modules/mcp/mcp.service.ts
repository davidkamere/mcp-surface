import type { CreateMcpAccessTokenInput, McpAccessToken, Platform } from "@mcpsurface/shared";
import { createId } from "../../lib/ids.js";
import { ChatContextService } from "../chat/chat-context-service.js";
import { retrieveChatContext } from "../chat/chat-rag.js";
import { GenerationRepository } from "../generation/generation.repository.js";
import { PlatformsRepository } from "../platforms/platforms.repository.js";
import { ResearchRepository } from "../research/research.repository.js";
import { RuntimesRepository } from "../runtimes/runtimes.repository.js";
import { RuntimesService } from "../runtimes/runtimes.service.js";
import { McpRepository } from "./mcp.repository.js";
import { createRawMcpToken, findValidMcpToken, hashMcpToken } from "./mcp-auth.js";

interface McpRepositoryPort {
    listTokens(): Promise<McpAccessToken[]>;
    saveTokens(tokens: McpAccessToken[]): Promise<void>;
}

interface PlatformsRepositoryPort {
    list(): Promise<Platform[]>;
}

export class McpService {
    constructor(
        private readonly repository: McpRepositoryPort = new McpRepository(),
        private readonly platformsRepository: PlatformsRepositoryPort = new PlatformsRepository(),
        private readonly runtimesService: RuntimesService = new RuntimesService(
            new RuntimesRepository(),
            new GenerationRepository(),
            new ResearchRepository(),
            new PlatformsRepository(),
        ),
        private readonly chatContextService: ChatContextService = new ChatContextService(),
    ) {}

    async createToken(
        platformId: string,
        requesterEmail: string,
        input: CreateMcpAccessTokenInput,
    ) {
        const platform = await this.requireRootPlatform(platformId, requesterEmail);
        const tokens = await this.repository.listTokens();
        const rawToken = createRawMcpToken();
        const now = new Date().toISOString();
        const accessToken: McpAccessToken = {
            id: createId(),
            platformId: platform.id,
            userEmail: input.userEmail.trim().toLowerCase(),
            token: hashMcpToken(rawToken),
            createdAt: now,
        };

        await this.repository.saveTokens([accessToken, ...tokens]);

        return {
            token: rawToken,
            accessToken: omitRawToken(accessToken),
        };
    }

    async listTokensForPlatform(platformId: string, requesterEmail: string) {
        await this.requireRootPlatform(platformId, requesterEmail);
        const tokens = await this.repository.listTokens();
        return tokens
            .filter((token) => token.platformId === platformId)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .map(omitRawToken);
    }

    async revokeToken(tokenId: string, requesterEmail: string) {
        const tokens = await this.repository.listTokens();
        const tokenIndex = tokens.findIndex((entry) => entry.id === tokenId);
        const token = tokens[tokenIndex];

        if (tokenIndex < 0 || !token) {
            throw new Error("MCP token not found.");
        }

        await this.requireRootPlatform(token.platformId, requesterEmail);

        const revoked: McpAccessToken = {
            ...token,
            revokedAt: token.revokedAt ?? new Date().toISOString(),
        };
        tokens[tokenIndex] = revoked;
        await this.repository.saveTokens(tokens);
        return omitRawToken(revoked);
    }

    async search(platformId: string, userEmail: string, query: string) {
        const context = await this.chatContextService.getPlatformContextForEmail(
            platformId,
            userEmail,
        );
        const retrieved = retrieveChatContext(
            {
                query,
                includeCapabilities: true,
                includeFindings: true,
            },
            context,
        );

        return {
            results: retrieved.capabilities.map((capability) => ({
                capability,
                summary: capability.summary,
                findings: retrieved.findings
                    .filter((finding) => capability.provenance.includes(finding.provenanceUrl))
                    .slice(0, 3)
                    .map((finding) => ({
                        title: finding.title,
                        summary: finding.summary,
                        provenanceUrl: finding.provenanceUrl,
                    })),
            })),
        };
    }

    async execute(
        platformId: string,
        userEmail: string,
        request: { capabilityKey: string; input: Record<string, unknown> },
    ) {
        const result = await this.runtimesService.executeRuntimeForExternal(
            platformId,
            userEmail,
            {
                capabilityKey: request.capabilityKey,
                input: request.input,
            },
            "mcp",
        );

        if (result.outcome === "approval_pending") {
            return {
                status: "pending_approval" as const,
                approvalRequestId: result.approval.id,
                approval: result.approval,
            };
        }

        return {
            status: "executed" as const,
            trace: result.trace,
            output: result.output,
        };
    }

    async getValidTokenForPlatform(platformId: string, rawToken: string) {
        const tokens = await this.repository.listTokens();
        return findValidMcpToken(rawToken, platformId, tokens);
    }

    private async requireRootPlatform(platformId: string, requesterEmail: string) {
        const platforms = await this.platformsRepository.list();
        const platform = platforms.find((entry) => entry.id === platformId);

        if (!platform) {
            throw new Error("Platform not found.");
        }

        if (platform.ownerEmail.trim().toLowerCase() !== requesterEmail.trim().toLowerCase()) {
            throw new Error("Only the platform owner can manage MCP access.");
        }

        return platform;
    }
}

function omitRawToken(token: McpAccessToken) {
    return {
        id: token.id,
        platformId: token.platformId,
        userEmail: token.userEmail,
        createdAt: token.createdAt,
        ...(token.revokedAt ? { revokedAt: token.revokedAt } : {}),
    };
}
