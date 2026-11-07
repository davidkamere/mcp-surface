// @ts-nocheck
import { forwardRef, type HTMLAttributes, type ReactNode, isValidElement, cloneElement, type ReactElement } from "react";

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  shape?: "circle" | "square";
  fallback?: ReactNode;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getColorFromName(name: string): string {
  const colors = [
    "bg-[var(--color-primary-500)]",
    "bg-[var(--color-info-500)]",
    "bg-[var(--color-warning-500)]",
    "bg-[var(--color-danger-500)]",
    "bg-[var(--color-success-500)]",
    "bg-[var(--color-primary-600)]",
    "bg-[var(--color-info-600)]",
    "bg-[var(--color-warning-600)]",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const sizeStyles: Record<"xs" | "sm" | "md" | "lg" | "xl", string> = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-base",
  lg: "w-12 h-12 text-lg",
  xl: "w-16 h-16 text-xl",
};

const shapeStyles: Record<"circle" | "square", string> = {
  circle: "rounded-full",
  square: "rounded-lg",
};

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, alt, name, size = "md", shape = "circle", fallback, className = "", ...props }, ref) => {
    const sizeClass = sizeStyles[size] ?? sizeStyles.md;
    const shapeClass = shapeStyles[shape] ?? shapeStyles.circle;

    const hasImage = src && src.length > 0;
    const initials = name ? getInitials(name) : "?";
    const bgColor = name ? getColorFromName(name) : "bg-[var(--color-neutral-400)]";

    return (
      <div
        ref={ref}
        className={`${sizeClass} ${shapeClass} overflow-hidden flex items-center justify-center ${bgColor} text-[var(--color-text-inverse)] font-medium ${className}`}
        {...props}
      >
        {hasImage && !fallback ? (
          <img
            src={src!}
            alt={alt || name || "Avatar"}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : fallback ? (
          fallback
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
      </div>
    );
  },
);

Avatar.displayName = "Avatar";

export interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  max?: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  children: ReactNode;
}

export const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ max = 5, size = "md", className = "", children, ...props }, ref) => {
    const childArray = Array.isArray(children) ? children : [children];
    const visibleChildren = childArray.slice(0, max);
    const remainingCount = childArray.length - max;

    return (
      <div
        ref={ref}
        className={`flex -space-x-2 ${className}`}
        {...props}
      >
        {visibleChildren.map((child, index) => (
          <div key={index} className="flex-shrink-0 relative z-10">
            {isValidElement(child) ? cloneElement(child as ReactElement<{ size?: string }>, { size }) : child}
          </div>
        ))}
        {remainingCount > 0 && (
          <div className={`flex-shrink-0 relative z-0 ${sizeStyles[size] ?? sizeStyles.md} rounded-full bg-[var(--color-bg-tertiary)] border-2 border-[var(--color-bg-primary)] flex items-center justify-center text-[var(--color-text-secondary)] font-medium`}>
            +{remainingCount}
          </div>
        )}
      </div>
    );
  },
);

AvatarGroup.displayName = "AvatarGroup";