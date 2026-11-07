import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "link";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = "",
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles = `
      inline-flex items-center justify-center gap-2
      font-medium rounded-lg
      transition-all duration-fast ease-out
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
      select-none
    `;

    const variantStyles = {
      primary: `
        bg-[var(--color-bg-brand)] text-[var(--color-text-inverse)]
        hover:bg-[var(--color-bg-brand-hover)]
        active:bg-[var(--color-primary-700)]
        focus-visible:ring-[var(--color-primary-500)]
        shadow-sm
      `,
      secondary: `
        bg-[var(--color-surface-primary)] text-[var(--color-text-primary)]
        border border-[var(--color-border-primary)]
        hover:bg-[var(--color-surface-hover)]
        active:bg-[var(--color-surface-active)]
        focus-visible:ring-[var(--color-border-focus)]
      `,
      ghost: `
        bg-transparent text-[var(--color-text-primary)]
        hover:bg-[var(--color-surface-hover)]
        active:bg-[var(--color-surface-active)]
        focus-visible:ring-[var(--color-border-focus)]
      `,
      danger: `
        bg-[var(--color-danger-500)] text-[var(--color-text-inverse)]
        hover:bg-[var(--color-danger-600)]
        active:bg-[var(--color-danger-700)]
        focus-visible:ring-[var(--color-danger-500)]
        shadow-sm
      `,
      link: `
        bg-transparent text-[var(--color-text-link)]
        hover:text-[var(--color-text-link-hover)] hover:bg-transparent
        active:text-[var(--color-primary-700)]
        focus-visible:ring-[var(--color-primary-500)]
        p-0
      `,
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-sm gap-1.5",
      md: "h-10 px-4 text-sm gap-2",
      lg: "h-12 px-6 text-base gap-2",
    };

    const widthStyles = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : leftIcon ? (
          <span aria-hidden="true">{leftIcon}</span>
        ) : null}
        {children}
        {!isLoading && rightIcon && <span aria-hidden="true">{rightIcon}</span>}
      </button>
    );
  },
);

Button.displayName = "Button";