import test from "node:test";
import assert from "node:assert/strict";
import type { Platform, PlatformShareInvite, WorkspaceRuntime } from "@mcpsurface/shared";
import { SharingService } from "./sharing.service.js";

test("creator can create invite for email", async () => {
    const platforms = [createPlatform()];
    const invitesRepository = new InMemorySharingRepository();
    const service = new SharingService(
        invitesRepository,
        new InMemoryPlatformsRepository(platforms),
        new FakeRuntimesService() as never,
    );

    const invite = await service.createInvite(platforms[0]!.id, "teammate@example.com", "owner-1");

    assert.equal(invite.email, "teammate@example.com");
    assert.equal(invite.platformId, platforms[0]!.id);
    assert.equal(invite.status, "pending");
    assert.ok(invite.inviteToken.length > 0);
});

test("wrong email cannot accept invite", async () => {
    const platforms = [createPlatform()];
    const invitesRepository = new InMemorySharingRepository();
    const runtimesService = new FakeRuntimesService();
    const service = new SharingService(
        invitesRepository,
        new InMemoryPlatformsRepository(platforms),
        runtimesService as never,
    );

    const invite = await service.createInvite(platforms[0]!.id, "teammate@example.com", "owner-1");

    await assert.rejects(
        service.acceptInvite(invite.inviteToken, "user-2", "wrong@example.com"),
        /not valid for your signed-in email/i,
    );
    assert.equal(runtimesService.calls.length, 0);
});

test("correct email can accept invite and provisioning reuses their runtime", async () => {
    const platforms = [createPlatform()];
    const invitesRepository = new InMemorySharingRepository();
    const runtimesService = new FakeRuntimesService();
    const service = new SharingService(
        invitesRepository,
        new InMemoryPlatformsRepository(platforms),
        runtimesService as never,
    );

    const invite = await service.createInvite(platforms[0]!.id, "teammate@example.com", "owner-1");
    const accepted = await service.acceptInvite(
        invite.inviteToken,
        "user-2",
        "teammate@example.com",
    );
    const acceptedAgain = await service.acceptInvite(
        invite.inviteToken,
        "user-2",
        "teammate@example.com",
    );

    assert.equal(accepted.invite.status, "accepted");
    assert.equal(accepted.runtime.ownerEmail, "teammate@example.com");
    assert.equal(accepted.runtime.platformId, platforms[0]!.id);
    assert.equal(accepted.runtime.id, acceptedAgain.runtime.id);
    assert.equal(runtimesService.calls.length, 2);
});

test("invited user does not use creator runtime", async () => {
    const platforms = [createPlatform()];
    const invitesRepository = new InMemorySharingRepository();
    const runtimesService = new FakeRuntimesService();
    const service = new SharingService(
        invitesRepository,
        new InMemoryPlatformsRepository(platforms),
        runtimesService as never,
    );

    const creatorRuntime = await runtimesService.getOrCreateRuntimeForUser(
        platforms[0]!.id,
        "owner-1",
        "owner@example.com",
    );
    const invite = await service.createInvite(platforms[0]!.id, "teammate@example.com", "owner-1");
    const accepted = await service.acceptInvite(
        invite.inviteToken,
        "user-2",
        "teammate@example.com",
    );

    assert.notEqual(accepted.runtime.id, creatorRuntime.id);
    assert.equal(accepted.runtime.ownerEmail, "teammate@example.com");
});

test("creator can revoke invite by id", async () => {
    const platforms = [createPlatform()];
    const invitesRepository = new InMemorySharingRepository();
    const service = new SharingService(
        invitesRepository,
        new InMemoryPlatformsRepository(platforms),
        new FakeRuntimesService() as never,
    );

    const invite = await service.createInvite(platforms[0]!.id, "teammate@example.com", "owner-1");
    const revoked = await service.revokeInvite(invite.id, "owner-1");

    assert.equal(revoked.status, "revoked");
});

function createPlatform(): Platform {
    return {
        id: "platform-1",
        name: "Cloudflare",
        slug: "cloudflare",
        sourceUrls: ["https://developers.cloudflare.com/api/"],
        sourceArtifacts: [],
        runtimeConfig: [],
        createdByUserId: "owner-1",
        ownerEmail: "owner@example.com",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

class InMemoryPlatformsRepository {
    constructor(private readonly platforms: Platform[]) {}

    async list() {
        return this.platforms;
    }
}

class InMemorySharingRepository {
    invites: PlatformShareInvite[] = [];

    async listInvites() {
        return this.invites;
    }

    async saveInvites(invites: PlatformShareInvite[]) {
        this.invites = invites;
    }
}

class FakeRuntimesService {
    private readonly runtimes = new Map<string, WorkspaceRuntime>();
    calls: Array<{ platformId: string; userId: string; ownerEmail: string }> = [];

    async getOrCreateRuntimeForUser(platformId: string, userId: string, ownerEmail: string) {
        this.calls.push({ platformId, userId, ownerEmail });
        const key = `${platformId}:${ownerEmail.toLowerCase()}`;
        const existing = this.runtimes.get(key);

        if (existing) {
            return existing;
        }

        const runtime: WorkspaceRuntime = {
            id: `runtime-${this.runtimes.size + 1}`,
            platformId,
            ownerEmail: ownerEmail.toLowerCase(),
            status: "created",
            executionTarget: "local",
            generatedMcpArtifactId: "mcp-1",
            generatedRuntimeArtifactId: "runtime-artifact-1",
            targetMetadata: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        this.runtimes.set(key, runtime);
        return runtime;
    }
}
