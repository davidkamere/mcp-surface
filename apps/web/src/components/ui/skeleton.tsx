import { forwardRef, type HTMLAttributes } from "react";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ variant = "text", width, height, lines = 1, className = "", ...props }, ref) => {
    const baseStyles = `
      bg-[var(--color-bg-tertiary)]
      rounded
      animate-pulse
      overflow-hidden
    `;

    if (variant === "circular") {
      return (
        <div
          ref={ref}
          className={`${baseStyles} rounded-full ${className}`}
          style={{ width: width || "1rem", height: height || "1rem", ...props.style }}
          {...props}
        />
      );
    }

    if (variant === "rectangular") {
      return (
        <div
          ref={ref}
          className={`${baseStyles} ${className}`}
          style={{ width: width || "100%", height: height || "1rem", ...props.style }}
          {...props}
        />
      );
    }

    // Text variant with multiple lines
    return (
      <div ref={ref} className={className} {...props}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`${baseStyles} ${index === lines - 1 && lines > 1 ? "w-3/4" : "w-full"} mb-2`}
            style={{
              height: "1rem",
              borderRadius: "0.25rem",
              ...(index === lines - 1 && lines > 1 ? { width: "75%" } : {}),
            }}
          />
        ))}
      </div>
    );
  },
);

Skeleton.displayName = "Skeleton";

export interface SkeletonCardProps extends HTMLAttributes<HTMLDivElement> {
  hasImage?: boolean;
  lines?: number;
}

export const SkeletonCard = forwardRef<HTMLDivElement, SkeletonCardProps>(
  ({ hasImage = true, lines = 3, className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={`bg-[var(--color-surface-primary)] border border-[var(--color-border-primary)] rounded-xl p-6 space-y-4 ${className}`}
      {...props}
    >
      {hasImage && (
        <Skeleton variant="rectangular" height="160px" width="100%" className="rounded-lg" />
      )}
      <Skeleton variant="text" lines={1} width="40%" />
      <Skeleton variant="text" lines={lines} />
      <div className="flex gap-2 pt-4">
        <Skeleton variant="rectangular" width="80px" height="36px" />
        <Skeleton variant="rectangular" width="80px" height="36px" />
      </div>
    </div>
  ),
);

SkeletonCard.displayName = "SkeletonCard";

export interface SkeletonTableProps extends HTMLAttributes<HTMLDivElement> {
  rows?: number;
  columns?: number;
}

export const SkeletonTable = forwardRef<HTMLDivElement, SkeletonTableProps>(
  ({ rows = 5, columns = 4, className = "", ...props }, ref) => (
    <div ref={ref} className={`space-y-3 ${className}`} {...props}>
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 font-medium text-[var(--color-text-secondary)] text-sm border-b border-[var(--color-border-primary)]">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" width={i === 0 ? "120px" : "100px"} height="14px" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 px-4 py-3 border-b border-[var(--color-border-primary)]">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              variant="text"
              width={colIndex === 0 ? "120px" : "100px"}
              height="16px"
            />
          ))}
        </div>
      ))}
    </div>
  ),
);

SkeletonTable.displayName = "SkeletonTable";

export interface SkeletonListProps extends HTMLAttributes<HTMLDivElement> {
  items?: number;
  hasAvatar?: boolean;
  lines?: number;
}

export const SkeletonList = forwardRef<HTMLDivElement, SkeletonListProps>(
  ({ items = 5, hasAvatar = true, lines = 2, className = "", ...props }, ref) => (
    <div ref={ref} className={`space-y-4 ${className}`} {...props}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex gap-4">
          {hasAvatar && <Skeleton variant="circular" width="40px" height="40px" />}
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton variant="text" lines={1} width="60%" />
            <Skeleton variant="text" lines={lines} />
          </div>
          <Skeleton variant="rectangular" width="80px" height="32px" />
        </div>
      ))}
    </div>
  ),
);

SkeletonList.displayName = "SkeletonList";