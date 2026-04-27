import { useUser } from "@clerk/clerk-react";
import { Link } from "@tanstack/react-router";
import { ChatWorkspace } from "../components/chat-workspace";
import { usePlatformChat } from "../hooks/use-platform-chat";
import { PlatformSharingPanel } from "../../sharing/components/platform-sharing-panel";

export function PlatformChatPage({ platformId }: { platformId: string }) {
  const { user } = useUser();
  const chat = usePlatformChat(platformId);
  const isOwner = chat.context?.platform.createdByUserId === user?.id;

  return (
    <div className="research-page-shell">
      <div className="research-page-header">
        <div>
          <p className="eyebrow">Conversation</p>
          <h1>Platform chat</h1>
        </div>
        <div className="runtime-actions-row">
          {isOwner ? (
            <Link className="button button-secondary" params={{ platformId }} to="/platforms/$platformId">
              Back to setup
            </Link>
          ) : null}
        </div>
      </div>

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
        onStartRuntime={chat.startRuntime}
        onStopRuntime={chat.stopRuntime}
        platformId={platformId}
        statusLabel={chat.statusLabel}
        isApproving={chat.isApproving}
      />
      {chat.context ? (
        <PlatformSharingPanel ownerUserId={chat.context.platform.createdByUserId} platformId={platformId} />
      ) : null}
    </div>
  );
}
