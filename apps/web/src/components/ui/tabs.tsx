import { useState, type ReactNode, type HTMLAttributes } from "react";

export interface TabItem {
  key: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  badge?: string | number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  variant?: "default" | "pills" | "underline";
  className?: string;
  fullWidth?: boolean;
}

export function Tabs({
  tabs,
  activeKey,
  onChange,
  variant = "default",
  className = "",
  fullWidth = false,
}: TabsProps) {
  const variantStyles = {
    default: `
      border-b border-[var(--color-border-primary)]
      [&_[role=tab]]:border-b-2 [&_[role=tab]]:border-transparent
      [&_[role=tab][aria-selected=true]]:border-[var(--color-bg-brand)] [&_[role=tab][aria-selected=true]]:text-[var(--color-text-brand)]
    `,
    pills: `
      bg-[var(--color-bg-tertiary)] p-1 rounded-lg
      [&_[role=tab]]:rounded-md [&_[role=tab]]:px-4 [&_[role=tab]]:py-2
      [&_[role=tab][aria-selected=true]]:bg-[var(--color-surface-primary)] [&_[role=tab][aria-selected=true]]:shadow-sm [&_[role=tab][aria-selected=true]]:text-[var(--color-text-brand)]
    `,
    underline: `
      border-b border-[var(--color-border-primary)]
      [&_[role=tab]]:border-b-2 [&_[role=tab]]:border-transparent [&_[role=tab]]:pb-3
      [&_[role=tab][aria-selected=true]]:border-[var(--color-bg-brand)] [&_[role=tab][aria-selected=true]]:text-[var(--color-text-brand)]
    `,
  };

  return (
    <div
      role="tablist"
      aria-label="Tabs"
      className={`
        flex ${fullWidth ? "w-full" : ""} gap-1
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          id={`tab-${tab.key}`}
          aria-selected={activeKey === tab.key}
          aria-controls={`tabpanel-${tab.key}`}
          tabIndex={activeKey === tab.key ? 0 : -1}
          onClick={() => !tab.disabled && onChange(tab.key)}
          disabled={tab.disabled}
          className={`
            flex items-center gap-2
            px-3 py-2 text-sm font-medium
            transition-all duration-fast
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] focus-visible:ring-offset-2
            ${tab.disabled ? "text-[var(--color-text-tertiary)] cursor-not-allowed" : ""}
            ${activeKey === tab.key ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}
            ${fullWidth ? "flex-1 justify-center" : ""}
          `}
        >
          {tab.icon && <span className="h-4 w-4" aria-hidden="true">{tab.icon}</span>}
          {tab.label}
          {tab.badge && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] rounded-full">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  key: string;
  activeKey: string;
  children: ReactNode;
}

export function TabPanel({ key, activeKey, children, className = "", ...props }: TabPanelProps) {
  if (activeKey !== key) return null;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${key}`}
      aria-labelledby={`tab-${key}`}
      tabIndex={0}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabSectionProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  children: (key: string) => ReactNode;
  variant?: "default" | "pills" | "underline";
  className?: string;
}

export function TabSection({
  tabs,
  activeKey,
  onChange,
  children,
  variant = "default",
  className = "",
}: TabSectionProps) {
  return (
    <div className={className}>
      <Tabs tabs={tabs} activeKey={activeKey} onChange={onChange} variant={variant} />
      <div className="mt-4" role="tabpanel" aria-labelledby={`tab-${activeKey}`}>
        {children(activeKey)}
      </div>
    </div>
  );
}