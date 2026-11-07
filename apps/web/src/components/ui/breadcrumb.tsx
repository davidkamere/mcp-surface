import { Link } from "@tanstack/react-router";
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbProps extends HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
  separator?: ReactNode;
  className?: string;
}

export const Breadcrumb = forwardRef<HTMLElement, BreadcrumbProps>(
  ({ items, separator = <ChevronRight className="h-4 w-4" />, className = "", ...props }, ref) => (
    <nav
      ref={ref}
      aria-label="Breadcrumb"
      className={`flex items-center gap-2 text-sm ${className}`}
      {...props}
    >
      <ol className="flex items-center gap-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            {index > 0 && (
              <span className="text-[var(--color-text-tertiary)] flex-shrink-0" aria-hidden="true">
                {separator}
              </span>
            )}
            {item.href || item.onClick ? (
              <Link
                to={item.href || "/"}
                onClick={item.onClick}
                className={`
                  flex items-center gap-1.5
                  text-[var(--color-text-secondary)]
                  hover:text-[var(--color-text-primary)]
                  font-medium
                  transition-colors
                  ${index === 0 ? "hover:underline" : ""}
                `}
                aria-current={index === items.length - 1 ? "page" : undefined}
              >
                {index === 0 && <Home className="h-4 w-4" aria-hidden="true" />}
                {item.label}
              </Link>
            ) : (
              <span
                className="text-[var(--color-text-primary)] font-medium"
                aria-current={index === items.length - 1 ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  ),
);

Breadcrumb.displayName = "Breadcrumb";