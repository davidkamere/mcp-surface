// @ts-nocheck
import { useState, useRef, useEffect, type ReactNode, type ReactElement, isValidElement } from "react";
import { createPortal } from "react-dom";

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

export function Tooltip({ content, children, position = "top", delay = 200 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<number>();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const childRef = useRef<HTMLElement>(null);

  const showTooltip = () => {
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const positionStyles = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowStyles = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-[var(--color-bg-inverse)]",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-[var(--color-bg-inverse)]",
    left: "left-full top-1/2 -translate-y-1/2 border-l-[var(--color-bg-inverse)]",
    right: "right-full top-1/2 -translate-y-1/2 border-r-[var(--color-bg-inverse)]",
  };

  const tooltipContent = isVisible ? (
    <div
      ref={tooltipRef}
      className={`
        fixed z-[var(--z-index-50)]
        px-2.5 py-1.5
        bg-[var(--color-bg-inverse)]
        text-[var(--color-text-inverse)]
        text-xs font-medium
        rounded-md shadow-lg
        whitespace-nowrap
        animate-fade-in
        ${positionStyles[position]}
      `}
      role="tooltip"
    >
      {content}
      <div
        className={`
          absolute w-0 h-0 border-4 border-transparent
          ${arrowStyles[position]}
        `}
        aria-hidden="true"
      />
    </div>
  ) : null;

  if (!isValidElement(children)) {
    return <>{children}</>;
  }

  const childProps = children.props;

  return (
    <>
      <div
        ref={childRef}
        onMouseEnter={() => {
          const currentTimeout = window.setTimeout(() => {
            setIsVisible(true);
          }, delay);
          timeoutRef.current = currentTimeout;
          childProps.onMouseEnter?.();
        }}
        onMouseLeave={() => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          setIsVisible(false);
          childProps.onMouseLeave?.();
        }}
        onFocus={() => {
          const currentTimeout = window.setTimeout(() => {
            setIsVisible(true);
          }, delay);
          timeoutRef.current = currentTimeout;
          childProps.onFocus?.();
        }}
        onBlur={() => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          setIsVisible(false);
          childProps.onBlur?.();
        }}
      >
        {children}
      </div>
      {isVisible && createPortal(
        <div
          ref={tooltipRef}
          className={`
            fixed z-[var(--z-index-50)]
            px-2.5 py-1.5
            bg-[var(--color-bg-inverse)]
            text-[var(--color-text-inverse)]
            text-xs font-medium
            rounded-md shadow-lg
            whitespace-nowrap
            animate-fade-in
            ${positionStyles[position]}
          `}
          role="tooltip"
        >
          {content}
          <div
            className={`
              absolute w-0 h-0 border-4 border-transparent
              ${arrowStyles[position]}
            `}
            aria-hidden="true"
          />
        </div>,
        document.body
      )}
    </>
  );
}