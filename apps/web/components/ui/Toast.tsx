"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useT, type Dict } from "@/lib/i18n";
import { Icon } from "@/components/shell/icons";

/**
 * Einfacher Toast (DESIGN-SYSTEM §3.10): Klartext + optionale Aktion
 * („Wiederholen“) — nie stilles Scheitern. Farbpunkt + Wort statt
 * eingefärbter Fläche. ToastProvider hängt im Portal-Layout.
 */

const dict = {
  de: { close: "Hinweis schließen" },
  en: { close: "Dismiss notification" },
} satisfies Dict;

export type ToastTone = "neutral" | "success" | "danger" | "info";

const TONE_DOT: Record<ToastTone, string> = {
  neutral: "bg-ink-faint",
  success: "bg-success",
  danger: "bg-danger",
  info: "bg-info",
};

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
};

export type ToastOptions = {
  tone?: ToastTone;
  /** Aktions-Button im Toast, z. B. „Wiederholen“ */
  actionLabel?: string;
  onAction?: () => void;
  /** Anzeigedauer; Standard 5000 ms */
  durationMs?: number;
};

type ToastContextValue = {
  showToast: (message: string, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast muss innerhalb von <ToastProvider> verwendet werden");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const t = useT(dict);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = nextId.current++;
      setToasts((current) => [
        ...current,
        {
          id,
          message,
          tone: options?.tone ?? "neutral",
          actionLabel: options?.actionLabel,
          onAction: options?.onAction,
        },
      ]);
      window.setTimeout(() => dismiss(id), options?.durationMs ?? 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 shadow-pop"
          >
            <span aria-hidden="true" className={`h-2.5 w-2.5 flex-none rounded-full ${TONE_DOT[toast.tone]}`} />
            <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-ink">{toast.message}</span>
            {toast.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  dismiss(toast.id);
                }}
                className="flex-none rounded-full px-2 py-1 text-[13px] font-bold text-brand-ink transition-colors duration-150 hover:bg-brand-soft"
              >
                {toast.actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={t("close")}
              className="grid h-8 w-8 flex-none place-items-center rounded-full text-ink-faint transition-colors duration-150 hover:bg-sunken hover:text-ink"
            >
              <Icon name="close" className="ic h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
