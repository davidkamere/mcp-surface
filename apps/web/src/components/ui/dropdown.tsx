import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface DropdownItem {
  label?: string;
  onClick?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
  labelOnly?: boolean;
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  closeOnClick?: boolean;
}

export function Dropdown({ trigger, items, align = "right", closeOnClick = true }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleItemClick = (item: DropdownItem) => {
    if (!item.disabled && !item.divider && !item.labelOnly && item.onClick) {
      item.onClick();
      if (closeOnClick) {
        setIsOpen(false);
      }
    }
  };

  const dropdownContent = (
    <div
      ref={dropdownRef}
      className={`
        fixed z-[var(--z-index-50)]
        min-w-[160px] max-w-[280px]
        bg-[var(--color-surface-primary)]
        border border-[var(--color-border-primary)]
        rounded-lg shadow-lg
        py-1
        animate-fade-in
        ${align === "right" ? "right-0" : "left-0"}
      `}
      role="menu"
      aria-orientation="vertical"
    >
      {items.map((item, index) => {
        if (item.divider) {
          return (
            <hr key={index} className="my-1 border-[var(--color-border-primary)]" role="separator" />
          );
        }

        if (item.labelOnly) {
          return (
            <div
              key={index}
              className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide"
              role="none"
            >
              {item.label}
            </div>
          );
        }

        return (
          <button
            key={index}
            type="button"
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            className={`
              w-full px-3 py-2 text-left text-sm
              flex items-center gap-2
              transition-colors duration-fast
              ${item.disabled
                ? "text-[var(--color-text-tertiary)] cursor-not-allowed"
                : item.danger
                ? "text-[var(--color-text-danger)] hover:bg-[var(--color-status-danger-bg)]"
                : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
              }
              focus-visible:outline-none focus-visible:bg-[var(--color-surface-hover)]
            `}
            role="menuitem"
            aria-disabled={item.disabled}
          >
            {item.icon && <span className="h-4 w-4 flex-shrink-0" aria-hidden="true">{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="relative inline-block" onClick={() => setIsOpen((prev) => !prev)}>
      <button
        ref={triggerRef}
        type="button"
        className="flex items-center gap-1"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Open menu"
      >
        {trigger}
      </button>
      {isOpen && createPortal(dropdownContent, document.body)}
    </div>
  );
}

export interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    initials?: string;
  };
  onSignOut: () => void;
  onProfile?: () => void;
  onSettings?: () => void;
}

export function UserMenu({ user, onSignOut, onProfile, onSettings }: UserMenuProps) {
  const displayName = user.name || user.email || "User";
  const initials = user.initials || displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const items: DropdownItem[] = [
    { label: "Profile", onClick: onProfile || (() => {}), icon: <UserIcon /> },
    { label: "Settings", onClick: onSettings || (() => {}), icon: <SettingsIcon /> },
    { divider: true },
    { label: "Sign out", onClick: onSignOut, icon: <LogOutIcon />, danger: true },
  ];

  return (
    <Dropdown
      align="right"
      trigger={
        <button
          type="button"
          className="flex items-center gap-2 p-1 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
          aria-label="User menu"
        >
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-500)] flex items-center justify-center text-[var(--color-text-inverse)] font-medium text-sm">
            {user.image ? (
              <img src={user.image} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <span className="hidden sm:block text-sm font-medium text-[var(--color-text-primary)]">
            {displayName}
          </span>
          <svg className="h-4 w-4 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      }
      items={items}
    />
  );
}

function UserIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function SettingsIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function LogOutIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}