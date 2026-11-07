import { forwardRef, type HTMLAttributes } from "react";

export interface SeparatorProps extends HTMLAttributes<HTMLHRElement> {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}

export const Separator = forwardRef<HTMLHRElement, SeparatorProps>(
  ({ orientation = "horizontal", decorative = true, className = "", ...props }, ref) => (
    <hr
      ref={ref}
      className={`
        border-none bg-[var(--color-border-primary)]
        ${orientation === "horizontal" ? "w-full h-px" : "h-full w-px"}
        ${className}
      `}
      aria-orientation={orientation}
      role={decorative ? "none" : "separator"}
      {...props}
    />
  ),
);

Separator.displayName = "Separator";