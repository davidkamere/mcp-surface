import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, Search, Sun, Moon, Monitor, Bell, HelpCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Avatar } from "../ui/avatar";
import { UserMenu } from "../ui/dropdown";
import { Tooltip } from "../ui/tooltip";
import { CommandPalette, CommandItem } from "../ui/command";

interface TopBarProps {
  onMenuClick: () => void;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    initials?: string;
  };
  onSignOut: () => void;
  onThemeToggle: () => void;
  theme: "light" | "dark" | "system";
  commandItems?: CommandItem[];
}

export function TopBar({
  onMenuClick,
  user,
  onSignOut,
  onThemeToggle,
  theme,
  commandItems = [],
}: TopBarProps) {
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const navigate = useNavigate();

  const handleCommandAction = (action: () => void) => {
    action();
    setShowCommandPalette(false);
  };

  const paletteItems: CommandItem[] = [
    { key: "platforms", label: "Platforms", description: "View all platforms", shortcut: "G P", icon: <ServerIcon />, action: () => navigate({ to: "/platforms" }) },
    { key: "create", label: "Create Platform", description: "Create a new platform", shortcut: "C", icon: <PlusIcon />, action: () => navigate({ to: "/platforms/new" }) },
    { key: "theme", label: "Toggle Theme", description: `Switch to ${theme === "dark" ? "light" : "dark"} mode`, shortcut: "T", icon: theme === "dark" ? <SunIcon /> : <MoonIcon />, action: onThemeToggle },
    { key: "help", label: "Help & Documentation", description: "Open help center", shortcut: "?", icon: <HelpCircleIcon />, action: () => window.open("/docs", "_blank") },
    ...commandItems,
  ];

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-[var(--z-index-30)] h-16 bg-[var(--color-surface-primary)] border-b border-[var(--color-border-primary)] lg:hidden">
        <div className="h-full px-4 flex items-center justify-between gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link to="/platforms" className="flex items-center gap-2 flex-1 justify-center" aria-label="MCP Surface">
            <div className="w-7 h-7 rounded-lg bg-[var(--color-bg-brand)] flex items-center justify-center flex-shrink-0">
              <McpIcon className="h-4 w-4 text-[var(--color-text-inverse)]" />
            </div>
            <span className="font-semibold text-base text-[var(--color-text-primary)]">MCP Surface</span>
          </Link>

          <div className="flex items-center gap-1">
            <Tooltip content="Command palette" position="bottom">
              <button
                onClick={() => setShowCommandPalette(true)}
                className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                aria-label="Open command palette (⌘K)"
              >
                <Search className="h-5 w-5" />
              </button>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* Desktop Top Bar */}
      <header className="hidden lg:fixed lg:top-0 lg:left-[256px] lg:right-0 lg:z-[var(--z-index-30)] lg:h-16 lg:bg-[var(--color-surface-primary)] lg:border-b lg:border-[var(--color-border-primary)]">
        <div className="h-full px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <Tooltip content="Command palette" position="bottom">
              <button
                onClick={() => setShowCommandPalette(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-secondary)] transition-all w-full max-w-md"
                aria-label="Search or run command (⌘K)"
              >
                <Search className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm truncate">Search platforms, commands...</span>
                <kbd className="px-1.5 py-0.5 text-xs font-mono text-[var(--color-text-tertiary)] bg-[var(--color-bg-primary)] rounded ml-auto">
                  ⌘K
                </kbd>
              </button>
            </Tooltip>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip content={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} position="bottom">
              <button
                onClick={onThemeToggle}
                className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              >
                {theme === "dark" ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
              </button>
            </Tooltip>

            <Tooltip content="Notifications" position="bottom">
              <button
                className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--color-danger-500)] rounded-full" aria-hidden="true" />
              </button>
            </Tooltip>

            <Tooltip content="Help" position="bottom">
              <button
                className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                aria-label="Help"
              >
                <HelpCircleIcon className="h-5 w-5" />
              </button>
            </Tooltip>

            <UserMenu user={user || {}} onSignOut={onSignOut} />
          </div>
        </div>
      </header>

      {/* Command Palette Portal */}
      {showCommandPalette && (
        <CommandPalette
          items={paletteItems}
          onClose={() => setShowCommandPalette(false)}
          placeholder="Search commands, platforms..."
        />
      )}
    </>
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

function McpIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function SunIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1m4 4h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MoonIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function HelpCircleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}