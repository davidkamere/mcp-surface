import type { ChatAttachment } from "@mcpsurface/shared";
import { createId } from "../../lib/ids.js";

export function createAttachment(
    type: ChatAttachment["type"],
    title: string,
    body: string,
    metadata: Record<string, unknown>,
): ChatAttachment {
    return {
        id: createId(),
        type,
        title,
        body,
        metadata,
    };
}

export function createApprovalAttachment(
    approval: {
        id: string;
        requesterEmail: string;
        capabilityKey: string;
        riskLevel: string;
        summary: string;
        input: Record<string, unknown>;
        status: string;
        traceId?: string | undefined;
    },
    title: string,
): ChatAttachment {
    return createAttachment("approval_request", title, approval.summary, {
        approvalId: approval.id,
        requesterEmail: approval.requesterEmail,
        capabilityKey: approval.capabilityKey,
        riskLevel: approval.riskLevel,
        input: approval.input,
        inputSummary: summarizeApprovalInput(approval.input),
        status: approval.status,
        traceId: approval.traceId,
    });
}

export function summarizeApprovalInput(input: Record<string, unknown>) {
    const preview = Object.entries(input)
        .slice(0, 4)
        .map(
            ([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`,
        );

    return preview.join(", ");
}
