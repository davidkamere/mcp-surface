import { useState, useRef, useEffect, type ReactNode, type ReactElement } from "react";
import { createPortal } from "react-dom";

export interface PopoverProps {
  trigger: ReactElement;
  content: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
}

export function Popover({
  trigger,
  content,
  position = "bottom",
  align = "center",
  closeOnClickOutside = true,
  closeOnEscape = true,
}: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && closeOnEscape) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeOnClickOutside, closeOnEscape]);

  const positionStyles = {
    top: "bottom-full",
    bottom: "top-full",
    left: "right-full",
    right: "left-full",
  };

  const alignStyles = {
    start: position === "top" || position === "bottom" ? "left-0" : "top-0",
    center:
      position === "top" || position === "bottom"
        ? "left-1/2 -translate-x-1/2"
        : "top-1/2 -translate-y-1/2",
    end: position === "top" || position === "bottom" ? "right-0" : "bottom-0",
  };

  const marginStyles = {
    top: "mb-2",
    bottom: "mt-2",
    left: "mr-2",
    right: "ml-2",
  };

  const arrowStyles = {
    top: "bottom-[-6px] left-1/2 -translate-x-1/2 border-t-[var(--color-bg-inverse)]",
    bottom: "top-[-6px] left-1/2 -translate-x-1/2 border-b-[var(--color-bg-inverse)]",
    left: "right-[-6px] top-1/2 -translate-y-1/2 border-l-[var(--color-bg-inverse)]",
    right: "left-[-6px] top-1/2 -translate-y-1/2 border-r-[var(--color-bg-inverse)]",
  };

  const handleTriggerClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsOpen((prev) => !prev);
    (trigger.props as { onClick?: (event: React.MouseEvent) => void }).onClick?.(event);
  };

  return (
    <>
      <div
        ref={triggerRef}
        onClick={handleTriggerClick}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="inline-block"
      >
        {trigger}
      </div>
      {isOpen && (
        createPortal(
          <div
            ref={popoverRef}
            className={`
              fixed z-[var(--z-index-60)]
              min-w-[200px] max-w-[320px]
              bg-[var(--color-bg-inverse)]
              border border-[var(--color-border-primary)]
              rounded-lg shadow-lg
              p-2
              animate-zoom-in
              ${positionStyles[position]} ${alignStyles[align]} ${marginStyles[position]}
            `}
            role="dialog"
            aria-label="Popover"
          >
            {content}
            <div
              className={`
                absolute w-0 h-0 border-6 border-transparent
                ${arrowStyles[position]}
              `}
              aria-hidden="true"
            />
          </div>,
          document.body,
        )
      )}
    </>
  );
}