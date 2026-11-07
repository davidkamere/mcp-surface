import { type HTMLAttributes, forwardRef } from "react";

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "brand" | "inverse";
}

export const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  ({ size = "md", variant = "default", className = "", ...props }, ref) => {
    const sizeStyles = {
      sm: "h-4 w-4 border-2",
      md: "h-6 w-6 border-2",
      lg: "h-8 w-8 border-3",
    };

    const variantStyles = {
      default: "border-[var(--color-border-primary)] border-t-[var(--color-text-brand)]",
      brand: "border-[var(--color-primary-200)] border-t-[var(--color-primary-500)]",
      inverse: "border-[var(--color-neutral-300)] border-t-[var(--color-text-inverse)]",
    };

    return (
      <div
        ref={ref}
        className={`${sizeStyles[size]} ${variantStyles[variant]} rounded-full animate-spin ${className}`}
        role="status"
        aria-label="Loading"
        {...props}
      >
        <span className="sr-only">Loading...</span>
      </div>
    );
  },
);

Spinner.displayName = "Spinner";

export interface LoadingOverlayProps extends HTMLAttributes<HTMLDivElement> {
  isVisible: boolean;
  message?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingOverlay({ isVisible, message, size = "md", className = "", ...props }: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed inset-0 z-[var(--z-index-70)]
        flex items-center justify-center
        bg-[var(--color-bg-primary)/80] backdrop-blur-sm
        ${className}
      `}
      {...props}
    >
      <div className="flex flex-col items-center gap-4 p-6 bg-[var(--color-surface-primary)] border border-[var(--color-border-primary)] rounded-xl shadow-lg">
        <Spinner size={size} />
        {message && <p className="text-sm text-[var(--color-text-secondary)]">{message}</p>}
      </div>
    </div>
  );
}

export function InlineSpinner({ size = "sm", className = "", ...props }: { size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <Spinner size={size} className={`inline-block ${className}`} {...props} />
  );
}