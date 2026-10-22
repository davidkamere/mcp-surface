import type {
    ApprovalRequest,
    Capability,
    ExecutionTrace,
    Platform,
    WorkspaceRuntime,
} from "@mcpsurface/shared";
import { createId } from "../../lib/ids.js";
import { PlatformsRepository } from "../platforms/platforms.repository.js";
import { ApprovalsRepository } from "./approvals.repository.js";
import { isRootPlatformUser, resolveCapabilityRiskLevel } from "./approval-policy.js";

interface PlatformsRepositoryPort {
    list(): Promise<Platform[]>;
}

interface ApprovalsRepositoryPort {
    listApprovals(): Promise<ApprovalRequest[]>;
    saveApprovals(approvals: ApprovalRequest[]): Promise<void>;
}

export class ApprovalsService {
    constructor(
        private readonly repository: ApprovalsRepositoryPort = new ApprovalsRepository(),
        private readonly platformsRepository: PlatformsRepositoryPort = new PlatformsRepository(),
    ) {}

    async listVisibleApprovals(platformId: string, userEmail: string) {
        const [platform, approvals] = await Promise.all([
            this.getPlatform(platformId),
            this.repository.listApprovals(),
        ]);
        const normalizedEmail = userEmail.trim().toLowerCase();

        if (isRootPlatformUser(platform, normalizedEmail)) {
            return approvals
                .filter((approval) => approval.platformId === platformId)
                .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        }

        return approvals
            .filter(
                (approval) =>
                    approval.platformId === platformId &&
                    approval.requesterEmail.trim().toLowerCase() === normalizedEmail,
            )
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    }

    async getApproval(approvalId: string) {
        const approvals = await this.repository.listApprovals();
        const approval = approvals.find((entry) => entry.id === approvalId);

        if (!approval) {
            throw new Error("Approval request not found.");
        }

        return approval;
    }

    async createApprovalRequest(input: {
        platform: Platform;
        runtime: WorkspaceRuntime;
        requesterEmail: string;
        capability: Capability;
        executionInput: Record<string, unknown>;
        summary: string;
        source: ApprovalRequest["source"];
    }) {
        const approvals = await this.repository.listApprovals();
        const now = new Date().toISOString();
        const requesterEmail = input.requesterEmail.trim().toLowerCase();
        const approverEmail = input.platform.ownerEmail.trim().toLowerCase();
        const riskLevel = resolveCapabilityRiskLevel(input.capability);

        const existing = approvals.find(
            (approval) =>
                approval.platformId === input.platform.id &&
                approval.runtimeId === input.runtime.id &&
                approval.requesterEmail === requesterEmail &&
                approval.capabilityKey === input.capability.key &&
                approval.status === "pending" &&
                JSON.stringify(approval.input) === JSON.stringify(input.executionInput),
        );

        if (existing) {
            return existing;
        }

        const approval: ApprovalRequest = {
            id: createId(),
            platformId: input.platform.id,
            runtimeId: input.runtime.id,
            requesterEmail,
            approverEmail,
            capabilityKey: input.capability.key,
            input: input.executionInput,
            summary: input.summary.trim(),
            riskLevel,
            source: input.source,
            status: "pending",
            createdAt: now,
        };

        await this.repository.saveApprovals([approval, ...approvals]);
        return approval;
    }

    async getLatestPendingApprovalForPlatform(platformId: string) {
        const approvals = await this.repository.listApprovals();
        return (
            approvals
                .filter(
                    (approval) =>
                        approval.platformId === platformId && approval.status === "pending",
                )
                .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
        );
    }

    async approveRequest(input: {
        approvalId: string;
        currentUserEmail: string;
        executeApprovedCapability: (approval: ApprovalRequest) => Promise<{
            runtime: WorkspaceRuntime;
            trace: ExecutionTrace;
            output: Record<string, unknown> | undefined;
        }>;
    }) {
        const approvals = await this.repository.listApprovals();
        const approvalIndex = approvals.findIndex((entry) => entry.id === input.approvalId);
        const approval = approvals[approvalIndex];

        if (approvalIndex < 0 || !approval) {
            throw new Error("Approval request not found.");
        }

        const platform = await this.getPlatform(approval.platformId);
        const currentUserEmail = input.currentUserEmail.trim().toLowerCase();

        if (!isRootPlatformUser(platform, currentUserEmail)) {
            throw new Error("Only the platform owner can approve requests.");
        }

        if (approval.status !== "pending") {
            throw new Error(`Approval request is already ${approval.status}.`);
        }

        const resolvedAt = new Date().toISOString();
        approvals[approvalIndex] = {
            ...approval,
            status: "approved",
            resolvedAt,
        };
        await this.repository.saveApprovals(approvals);

        const execution = await input.executeApprovedCapability(
            approvals[approvalIndex] as ApprovalRequest,
        );
        approvals[approvalIndex] = {
            ...(approvals[approvalIndex] as ApprovalRequest),
            traceId: execution.trace.id,
        };
        await this.repository.saveApprovals(approvals);

        return {
            approval: approvals[approvalIndex] as ApprovalRequest,
            runtime: execution.runtime,
            trace: execution.trace,
            output: execution.output,
        };
    }

    async rejectRequest(input: { approvalId: string; currentUserEmail: string }) {
        const approvals = await this.repository.listApprovals();
        const approvalIndex = approvals.findIndex((entry) => entry.id === input.approvalId);
        const approval = approvals[approvalIndex];

        if (approvalIndex < 0 || !approval) {
            throw new Error("Approval request not found.");
        }

        const platform = await this.getPlatform(approval.platformId);
        const currentUserEmail = input.currentUserEmail.trim().toLowerCase();

        if (!isRootPlatformUser(platform, currentUserEmail)) {
            throw new Error("Only the platform owner can reject requests.");
        }

        if (approval.status !== "pending") {
            throw new Error(`Approval request is already ${approval.status}.`);
        }

        const rejected: ApprovalRequest = {
            ...approval,
            status: "rejected",
            resolvedAt: new Date().toISOString(),
        };
        approvals[approvalIndex] = rejected;
        await this.repository.saveApprovals(approvals);
        return rejected;
    }

    private async getPlatform(platformId: string) {
        const platforms = await this.platformsRepository.list();
        const platform = platforms.find((entry) => entry.id === platformId);

        if (!platform) {
            throw new Error("Platform not found.");
        }

        return platform;
    }
}
