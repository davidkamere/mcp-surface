import { type ReactNode } from "react";
import { Button } from "./button";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary" | "ghost";
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  illustration?: ReactNode;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  className = "",
  illustration,
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center text-center py-12 px-4 ${className}`}>
      <div className="mb-6 flex-shrink-0">
        {illustration ? (
          <div className="w-48 h-48 mx-auto opacity-60">{illustration}</div>
        ) : icon ? (
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center text-[var(--color-text-tertiary)]">
            {icon}
          </div>
        ) : (
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center text-[var(--color-text-tertiary)]">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{title}</h3>
      {description && <p className="text-[var(--color-text-secondary)] max-w-sm mb-6">{description}</p>}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        {action && (
          <Button
            variant={action.variant || "primary"}
            onClick={action.onClick}
            className="w-full sm:w-auto"
          >
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button variant="ghost" onClick={secondaryAction.onClick} className="w-full sm:w-auto">
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}

// Predefined empty states
export function EmptyPlatforms(onCreate: () => void) {
  return (
    <EmptyState
      title="No platforms yet"
      description="Create your first platform to define source URLs and prepare for the upcoming research pipeline."
      icon={
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2M5 11V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      }
      action={{ label: "Create platform", onClick: onCreate }}
    />
  );
}

export function EmptySources(onAdd: () => void) {
  return (
    <EmptyState
      title="No sources configured"
      description="Add source URLs to start discovering capabilities and building your platform surface."
      icon={
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      }
      action={{ label: "Add source", onClick: onAdd }}
    />
  );
}

export function EmptyChat(onNewChat: () => void) {
  return (
    <EmptyState
      title="Start a conversation"
      description="Ask about the platform, the runtime state, or tell it to do work through the generated runtime surface."
      icon={
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      }
      action={{ label: "New chat", onClick: onNewChat, variant: "secondary" }}
    />
  );
}

export function EmptyResearch(onTrigger: () => void) {
  return (
    <EmptyState
      title="No research results"
      description="Run a research job to discover capabilities, operations, and findings from your platform sources."
      icon={
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      }
      action={{ label: "Run research", onClick: onTrigger }}
    />
  );
}