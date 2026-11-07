import { useUser } from "@clerk/clerk-react";
import { Link } from "@tanstack/react-router";
import { ChatWorkspace } from "../components/chat-workspace";
import { usePlatformChat } from "../hooks/use-platform-chat";
import { PlatformSharingPanel } from "../../sharing/components/platform-sharing-panel";
import { ResearchUnlockPanel } from "../../platforms/components/research-unlock-panel";
import { ChatRuntimeBar } from "../../runtimes/components/chat-runtime-bar";

export function PlatformChatPage({ platformId }: { platformId: string }) {
    const { user } = useUser();
    const chat = usePlatformChat(platformId);
    const isOwner = chat.context?.platform.createdByUserId === user?.id;

    if (
        !chat.isLoading &&
        chat.error?.toLowerCase().includes("generated artifacts are required")
    ) {
        return <ResearchUnlockPanel researchCompleted={false} backToPlatformId={platformId} />;
    }

    return (
        <div className="research-page-shell">
            <div className="research-page-header">
                <div>
                    <p className="eyebrow">Conversation</p>
                    <h1>Platform chat</h1>
                </div>
                <div className="runtime-actions-row">
                    {isOwner ? (
                        <Link
                            className="button button-secondary"
                            params={{ platformId }}
                            to="/platforms/$platformId"
                        >
                            Back to setup
                        </Link>
                    ) : null}
                </div>
            </div>

            <ChatRuntimeBar
                platformId={platformId}
                runtime={chat.context?.runtime ?? null}
                isLoading={chat.isLoading}
                isBusy={chat.isLoading || chat.isStreaming || chat.isApproving}
                error={chat.error}
                onStart={chat.startRuntime}
                onStop={chat.stopRuntime}
            />

            <ChatWorkspace
                context={chat.context}
                currentUserEmail={chat.currentUserEmail}
                approvals={chat.approvals}
                error={chat.error}
                activityStartedAt={chat.activityStartedAt}
                activitySteps={chat.activitySteps}
                isLoading={chat.isLoading}
                isStreaming={chat.isStreaming}
                messages={chat.messages}
                hasReceivedTerminalMessage={chat.hasReceivedTerminalMessage}
                onCreateSession={chat.createNewSession}
                onApprovalAction={chat.resolveApproval}
                onSendMessage={chat.sendMessage}
                statusLabel={chat.statusLabel}
                isApproving={chat.isApproving}
            />
            {chat.context ? (
                <PlatformSharingPanel
                    ownerUserId={chat.context.platform.createdByUserId}
                    platformId={platformId}
                />
            ) : null}
        </div>
    );
}
