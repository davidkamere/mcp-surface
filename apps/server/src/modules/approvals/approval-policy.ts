import type { ApprovalRequestRiskLevel, Capability, Platform } from "@mcpsurface/shared";

export function isRootPlatformUser(platform: Platform, userEmail: string) {
    return platform.ownerEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();
}

export function resolveCapabilityRiskLevel(capability: Capability): ApprovalRequestRiskLevel {
    return capability.riskLevel;
}

export function requiresApprovalForCapability(input: {
    platform: Platform;
    requesterEmail: string;
    capability: Capability;
}) {
    const isRoot = isRootPlatformUser(input.platform, input.requesterEmail);
    const riskLevel = resolveCapabilityRiskLevel(input.capability);

    return {
        isRoot,
        riskLevel,
        requiresApproval: !isRoot && riskLevel !== "read",
    };
}
