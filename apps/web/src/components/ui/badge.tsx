import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "brand";
  size?: "sm" | "md" | "lg";
  dot?: boolean;
  icon?: ReactNode;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = "default",
      size = "md",
      dot = false,
      icon,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles = `
      inline-flex items-center gap-1
      font-medium rounded-full
      border
      transition-colors duration-fast ease-out
    `;

    const variantStyles = {
      default: `
        bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]
        border-[var(--color-border-primary)]
      `,
      success: `
        bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)]
        border-[var(--color-status-success-border)]
      `,
      warning: `
        bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)]
        border-[var(--color-status-warning-border)]
      `,
      danger: `
        bg-[var(--color-status-danger-bg)] text-[var(--color-status-danger-text)]
        border-[var(--color-status-danger-border)]
      `,
      info: `
        bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)]
        border-[var(--color-status-info-border)]
      `,
      brand: `
        bg-[var(--color-bg-brand-subtle)] text-[var(--color-text-brand)]
        border-[var(--color-border-brand)]
      `,
    };

    const sizeStyles = {
      sm: "px-2 py-0.5 text-xs gap-0.5",
      md: "px-2.5 py-0.5 text-xs gap-1",
      lg: "px-3 py-1 text-sm gap-1",
    };

    const dotStyles = {
      sm: "w-1.5 h-1.5",
      md: "w-2 h-2",
      lg: "w-2.5 h-2.5",
    };

    return (
      <span
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {dot && (
          <span
            className={`${dotStyles[size]} rounded-full bg-current`}
            aria-hidden="true"
          />
        )}
        {icon && <span className="flex-shrink-0" aria-hidden="true">{icon}</span>}
        {children}
      </span>
    );
  },
);

Badge.displayName = "Badge";