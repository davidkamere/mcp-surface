import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
  type Context,
  type FC,
} from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info" | "loading";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
  dismissible?: boolean;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext: Context<ToastContextValue | undefined> = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";
  maxToasts?: number;
}

export const ToastProvider: FC<ToastProviderProps> = ({
  children,
  position = "top-right",
  maxToasts = 5,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((newToast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2, 9);
    const toastWithId = { ...newToast, id };

    setToasts((prev) => {
      const updated = [toastWithId, ...prev].slice(0, maxToasts);
      return updated;
    });

    if (newToast.duration !== 0) {
      const duration = newToast.duration ?? (newToast.type === "loading" ? 0 : 5000);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    }

    return id;
  }, [maxToasts]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const positionStyles = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-center": "top-4 left-1/2 -translate-x-1/2",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  };

  return (
    <>
      {children}
      <div
        className={`
          fixed z-[var(--z-index-80)]
          flex flex-col gap-2
          pointer-events-none
          ${positionStyles[position]}
        `}
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <ToastElement key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </>
  );
};

interface ToastElementProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastElement: FC<ToastElementProps> = ({ toast, onDismiss }) => {
  const iconMap = {
    success: <CheckCircle className="h-5 w-5 text-[var(--color-success-500)]" />,
    error: <AlertCircle className="h-5 w-5 text-[var(--color-danger-500)]" />,
    warning: <AlertTriangle className="h-5 w-5 text-[var(--color-warning-500)]" />,
    info: <Info className="h-5 w-5 text-[var(--color-info-500)]" />,
    loading: (
      <svg className="h-5 w-5 text-[var(--color-info-500)] animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    ),
  };

  const bgMap = {
    success: "bg-[var(--color-status-success-bg)] border-[var(--color-status-success-border)]",
    error: "bg-[var(--color-status-danger-bg)] border-[var(--color-status-danger-border)]",
    warning: "bg-[var(--color-status-warning-bg)] border-[var(--color-status-warning-border)]",
    info: "bg-[var(--color-status-info-bg)] border-[var(--color-status-info-border)]",
    loading: "bg-[var(--color-status-info-bg)] border-[var(--color-status-info-border)]",
  };

  return (
    <div
      className={`
        pointer-events-auto
        flex items-start gap-3
        p-4
        rounded-lg border
        shadow-lg
        min-w-[300px] max-w-[420px]
        animate-slide-in-from-right
        ${bgMap[toast.type]}
      `}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex-shrink-0 mt-0.5">{iconMap[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[var(--color-text-primary)]">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{toast.description}</p>
        )}
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-2 text-sm font-medium text-[var(--color-text-brand)] hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      {toast.dismissible !== false && (
        <button
          onClick={() => onDismiss(toast.id)}
          className="flex-shrink-0 p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

// Convenience hooks
export function useToastHelpers() {
  const { toast, dismiss, dismissAll } = useToast();

  return {
    success: (title: string, description?: string, action?: Toast["action"]) =>
      toast({ type: "success", title, description, action }),
    error: (title: string, description?: string, action?: Toast["action"]) =>
      toast({ type: "error", title, description, action }),
    warning: (title: string, description?: string, action?: Toast["action"]) =>
      toast({ type: "warning", title, description, action }),
    info: (title: string, description?: string, action?: Toast["action"]) =>
      toast({ type: "info", title, description, action }),
    loading: (title: string, description?: string) =>
      toast({ type: "loading", title, description, duration: 0, dismissible: false }),
    dismiss,
    dismissAll,
  };
}