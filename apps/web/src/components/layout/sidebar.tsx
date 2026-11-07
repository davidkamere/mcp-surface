import { Link, useLocation } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ChevronLeft, Menu, X, LogOut, Settings, User } from "lucide-react";
import { Button } from "../ui/button";
import { Avatar, AvatarGroup } from "../ui/avatar";
import { UserMenu } from "../ui/dropdown";
import { Tooltip } from "../ui/tooltip";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    initials?: string;
  };
  onSignOut: () => void;
}

const navigation = [
  { key: "platforms", label: "Platforms", href: "/platforms", icon: ServerIcon },
  { key: "create", label: "Create", href: "/platforms/new", icon: PlusIcon },
];

export function Sidebar({ isCollapsed, onToggle, user, onSignOut }: SidebarProps) {
  const location = useLocation();

  return (
    <aside
      className={`
        fixed left-0 top-0 z-[var(--z-index-40)]
        h-full bg-[var(--color-surface-primary)]
        border-r border-[var(--color-border-primary)]
        transition-all duration-normal ease-out
        flex flex-col
        ${isCollapsed ? "w-[72px]" : "w-[256px]"}
      `}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className={`
        flex items-center justify-between
        h-16 px-4 border-b border-[var(--color-border-primary)]
        ${isCollapsed ? "justify-center" : ""}
      `}>
        <Link to="/platforms" className="flex items-center gap-2" aria-label="MCP Surface">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-brand)] flex items-center justify-center flex-shrink-0">
            <McpIcon className="h-5 w-5 text-[var(--color-text-inverse)]" />
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-lg text-[var(--color-text-primary)] truncate">
              MCP Surface
            </span>
          )}
        </Link>
        {!isCollapsed && (
          <Tooltip content="Collapse sidebar" position="right">
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main">
        <ul className="space-y-1" role="list">
          {navigation.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <li key={item.key}>
                <Link
                  to={item.href}
                  className={`
                    flex items-center gap-3
                    px-3 py-2.5 rounded-lg
                    text-sm font-medium
                    transition-colors duration-fast
                    ${isActive
                      ? "bg-[var(--color-bg-brand-subtle)] text-[var(--color-text-brand)]"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                    }
                    ${isCollapsed ? "justify-center" : ""}
                  `}
                  title={isCollapsed ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-[var(--color-border-primary)]">
        {isCollapsed ? (
          <Tooltip content={user?.name ?? user?.email ?? "User"} position="right">
            <div className="flex justify-center">
              <Avatar
                src={user?.image ?? undefined}
                name={user?.name ?? undefined}
                size="md"
                alt={user?.name ?? "User"}
              />
            </div>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <AvatarGroup max={2} size="md">
                <Avatar src={user?.image ?? undefined} name={user?.name ?? undefined} alt={user?.name ?? "User"} />
              </AvatarGroup>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {user?.name ?? user?.email ?? "User"}
              </p>
              {user?.email && (
                <p className="text-xs text-[var(--color-text-tertiary)] truncate">{user.email}</p>
              )}
            </div>
            <UserMenu user={user ?? {}} onSignOut={onSignOut} />
          </div>
        )}
      </div>
    </aside>
  );
}

function ServerIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2 4h.01M17 16h.01" />
    </svg>
  );
}

function PlusIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function McpIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

export interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    initials?: string;
  };
  onSignOut: () => void;
}

export function MobileSidebar({ isOpen, onClose, user, onSignOut }: MobileSidebarProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[var(--z-index-95)] bg-black/50 backdrop-blur-sm animate-fade-in lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed left-0 top-0 z-[var(--z-index-100)] h-full w-[280px] max-w-full bg-[var(--color-surface-primary)] border-r border-[var(--color-border-primary)] shadow-2xl animate-slide-in-from-left lg:hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-[var(--color-border-primary)]">
          <Link to="/platforms" className="flex items-center gap-2" aria-label="MCP Surface">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-brand)] flex items-center justify-center flex-shrink-0">
              <McpIcon className="h-5 w-5 text-[var(--color-text-inverse)]" />
            </div>
            <span className="font-semibold text-lg text-[var(--color-text-primary)]">MCP Surface</span>
          </Link>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <ul className="space-y-1" role="list">
            {navigation.map((item) => (
              <li key={item.key}>
                <Link
                  to={item.href}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3
                    px-3 py-3 rounded-lg
                    text-base font-medium
                    transition-colors duration-fast
                    text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]
                  `}
                >
                  <item.icon className="h-6 w-6 flex-shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-[var(--color-border-primary)]">
          <div className="flex items-center gap-3">
            <Avatar src={user?.image ?? undefined} name={user?.name ?? undefined} size="md" alt={user?.name ?? "User"} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {user?.name ?? user?.email ?? "User"}
              </p>
              {user?.email && <p className="text-xs text-[var(--color-text-tertiary)] truncate">{user.email}</p>}
            </div>
          </div>
          <button
            onClick={() => { onSignOut(); onClose(); }}
            className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-[var(--color-text-danger)] hover:bg-[var(--color-status-danger-bg)] rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}