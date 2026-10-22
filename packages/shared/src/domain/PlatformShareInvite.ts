export const platformShareInviteStatuses = ["pending", "accepted", "revoked", "expired"] as const;

export type PlatformShareInviteStatus = (typeof platformShareInviteStatuses)[number];

export interface PlatformShareInvite {
    id: string;
    platformId: string;
    inviteToken: string;
    email: string;
    invitedByUserId: string;
    status: PlatformShareInviteStatus;
    createdAt: string;
    expiresAt: string;
    acceptedAt?: string | undefined;
}
