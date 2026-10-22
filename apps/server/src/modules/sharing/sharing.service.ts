import type { Platform, PlatformShareInvite } from "@mcpsurface/shared";
import { createId } from "../../lib/ids.js";
import { GenerationRepository } from "../generation/generation.repository.js";
import { PlatformsRepository } from "../platforms/platforms.repository.js";
import { ResearchRepository } from "../research/research.repository.js";
import { RuntimesRepository } from "../runtimes/runtimes.repository.js";
import { RuntimesService } from "../runtimes/runtimes.service.js";
import { SharingRepository } from "./sharing.repository.js";

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 14;

interface PlatformsRepositoryPort {
    list(): Promise<Platform[]>;
}

interface SharingRepositoryPort {
    listInvites(): Promise<PlatformShareInvite[]>;
    saveInvites(invites: PlatformShareInvite[]): Promise<void>;
}

export class SharingService {
    constructor(
        private readonly repository: SharingRepositoryPort = new SharingRepository(),
        private readonly platformsRepository: PlatformsRepositoryPort = new PlatformsRepository(),
        private readonly runtimesService: RuntimesService = new RuntimesService(
            new RuntimesRepository(),
            new GenerationRepository(),
            new ResearchRepository(),
            new PlatformsRepository(),
            new SharingRepository(),
        ),
    ) {}

    async listAccessiblePlatforms(userId: string, userEmail: string) {
        const [platforms, invites] = await Promise.all([
            this.platformsRepository.list(),
            this.getNormalizedInvites(),
        ]);
        const email = userEmail.toLowerCase();

        return platforms.filter(
            (platform) =>
                platform.createdByUserId === userId ||
                invites.some(
                    (invite) =>
                        invite.platformId === platform.id &&
                        invite.email === email &&
                        invite.status === "accepted" &&
                        !isInviteExpired(invite),
                ),
        );
    }

    async getAccessiblePlatform(platformId: string, userId: string, userEmail: string) {
        return (
            (await this.listAccessiblePlatforms(userId, userEmail)).find(
                (platform) => platform.id === platformId,
            ) ?? null
        );
    }

    async assertPlatformAccess(platformId: string, userId: string, userEmail: string) {
        const platform = await this.getAccessiblePlatform(platformId, userId, userEmail);

        if (!platform) {
            throw new Error("Platform not found.");
        }

        return platform;
    }

    async createInvite(platformId: string, invitedEmail: string, invitedByUserId: string) {
        const [platforms, invites] = await Promise.all([
            this.platformsRepository.list(),
            this.getNormalizedInvites(),
        ]);
        const platform = platforms.find(
            (entry) => entry.id === platformId && entry.createdByUserId === invitedByUserId,
        );

        if (!platform) {
            throw new Error("Platform not found.");
        }

        const email = invitedEmail.trim().toLowerCase();
        const existingInvite = invites.find(
            (invite) =>
                invite.platformId === platformId &&
                invite.email === email &&
                invite.status === "pending" &&
                !isInviteExpired(invite),
        );

        if (existingInvite) {
            return existingInvite;
        }

        const now = Date.now();
        const invite: PlatformShareInvite = {
            id: createId(),
            platformId,
            inviteToken: createId(),
            email,
            invitedByUserId,
            status: "pending",
            createdAt: new Date(now).toISOString(),
            expiresAt: new Date(now + INVITE_TTL_MS).toISOString(),
        };

        await this.repository.saveInvites([invite, ...invites]);
        return invite;
    }

    async listPlatformInvites(platformId: string, invitedByUserId: string) {
        const platforms = await this.platformsRepository.list();
        const platform = platforms.find(
            (entry) => entry.id === platformId && entry.createdByUserId === invitedByUserId,
        );

        if (!platform) {
            throw new Error("Platform not found.");
        }

        const invites = await this.getNormalizedInvites();
        return invites
            .filter((invite) => invite.platformId === platformId)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    }

    async revokeInvite(inviteId: string, invitedByUserId: string) {
        const [platforms, invites] = await Promise.all([
            this.platformsRepository.list(),
            this.getNormalizedInvites(),
        ]);
        const inviteIndex = invites.findIndex((entry) => entry.id === inviteId);
        const invite = invites[inviteIndex];

        if (inviteIndex < 0 || !invite) {
            throw new Error("Invite not found.");
        }

        const platform = platforms.find(
            (entry) => entry.id === invite.platformId && entry.createdByUserId === invitedByUserId,
        );

        if (!platform) {
            throw new Error("Platform not found.");
        }

        if (invite.status === "revoked") {
            return invite;
        }

        const revokedInvite: PlatformShareInvite = {
            ...invite,
            status: "revoked",
        };
        invites[inviteIndex] = revokedInvite;
        await this.repository.saveInvites(invites);
        return revokedInvite;
    }

    async getInviteByToken(inviteToken: string) {
        const [platforms, invites] = await Promise.all([
            this.platformsRepository.list(),
            this.getNormalizedInvites(),
        ]);
        const invite = invites.find((entry) => entry.inviteToken === inviteToken);

        if (!invite) {
            throw new Error("Invite not found.");
        }

        const platform = platforms.find((entry) => entry.id === invite.platformId);

        if (!platform) {
            throw new Error("Platform not found.");
        }

        return {
            invite,
            platform,
        };
    }

    async acceptInvite(inviteToken: string, userId: string, userEmail: string) {
        const [platforms, invites] = await Promise.all([
            this.platformsRepository.list(),
            this.getNormalizedInvites(),
        ]);
        const inviteIndex = invites.findIndex((entry) => entry.inviteToken === inviteToken);
        const invite = invites[inviteIndex];

        if (inviteIndex < 0 || !invite) {
            throw new Error("Invite not found.");
        }

        if (isInviteExpired(invite)) {
            invites[inviteIndex] = {
                ...invite,
                status: "expired",
            };
            await this.repository.saveInvites(invites);
            throw new Error("Invite has expired.");
        }

        const normalizedEmail = userEmail.trim().toLowerCase();

        if (invite.email !== normalizedEmail) {
            throw new Error("This invite is not valid for your signed-in email.");
        }

        if (invite.status === "revoked") {
            throw new Error("Invite is no longer active.");
        }

        const platform = platforms.find((entry) => entry.id === invite.platformId);

        if (!platform) {
            throw new Error("Platform not found.");
        }

        const acceptedInvite: PlatformShareInvite = {
            ...invite,
            status: "accepted",
            acceptedAt: invite.acceptedAt ?? new Date().toISOString(),
        };
        invites[inviteIndex] = acceptedInvite;
        await this.repository.saveInvites(invites);

        const runtime = await this.runtimesService.getOrCreateRuntimeForUser(
            platform.id,
            userId,
            normalizedEmail,
        );

        return {
            invite: acceptedInvite,
            platform,
            runtime,
        };
    }

    private async getNormalizedInvites() {
        const invites = await this.repository.listInvites();
        let changed = false;
        const normalized = invites.map((invite) => {
            const nextStatus =
                invite.status === "pending" && isInviteExpired(invite) ? "expired" : invite.status;
            const nextInvite = {
                ...invite,
                email: invite.email.toLowerCase(),
                status: nextStatus,
            };
            changed ||= nextInvite.email !== invite.email || nextStatus !== invite.status;
            return nextInvite;
        });

        if (changed) {
            await this.repository.saveInvites(normalized);
        }

        return normalized;
    }
}

function isInviteExpired(invite: PlatformShareInvite) {
    return Date.parse(invite.expiresAt) <= Date.now();
}
