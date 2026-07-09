"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useT, type Dict } from "@/lib/i18n";
import { Icon } from "@/components/shell/icons";

/**
 * Leichtgewichtiges Modal & Sheet für Detail-Ansichten:
 * Overlay auf getönter Tinte, Panel auf Surface mit shadow-pop.
 * Escape und Backdrop-Klick schließen; Fokus springt ins Panel.
 * Keine Dauer-Animationen (DESIGN-SYSTEM §2.8).
 */

const dict = {
  de: { close: "Schließen" },
  en: { close: "Close" },
} satisfies Dict;

function useDialogBehavior(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return panelRef;
}

function DialogHeader({
  titleId,
  eyebrow,
  title,
  onClose,
  closeLabel,
}: {
  titleId: string;
  eyebrow?: string;
  title: ReactNode;
  onClose: () => void;
  closeLabel: string;
}) {
  return (
    <header className="mb-4 flex items-start gap-3">
      <div className="grid min-w-0 gap-0.5">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 id={titleId} className="font-display text-h3 tracking-[-0.01em] text-ink">
          {title}
        </h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="ml-auto grid h-9 w-9 flex-none place-items-center rounded-full border border-line text-ink-soft transition-colors duration-150 hover:bg-sunken"
      >
        <Icon name="close" className="ic h-4 w-4" />
      </button>
    </header>
  );
}

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  /** Aktionsleiste unten — max. EINE Beere-Primäraktion */
  footer?: ReactNode;
};

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  maxWidthClass = "max-w-lg",
}: DialogProps & { maxWidthClass?: string }) {
  const panelRef = useDialogBehavior(open, onClose);
  const titleId = useId();
  const t = useT(dict);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/35 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${maxWidthClass} rounded-xl border border-line bg-surface p-6 shadow-pop`}
      >
        <DialogHeader
          titleId={titleId}
          eyebrow={eyebrow}
          title={title}
          onClose={onClose}
          closeLabel={t("close")}
        />
        <div className="text-body text-ink">{children}</div>
        {footer && <footer className="mt-5 flex flex-wrap justify-end gap-2.5">{footer}</footer>}
      </div>
    </div>
  );
}

/** Seitliches Panel (rechts) — für Detail-Ansichten mit mehr Inhalt. */
export function Sheet({ open, onClose, title, eyebrow, children, footer }: DialogProps) {
  const panelRef = useDialogBehavior(open, onClose);
  const titleId = useId();
  const t = useT(dict);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-ink/35"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex h-dvh w-full max-w-md flex-col overflow-y-auto border-l border-line bg-surface p-6 shadow-pop"
      >
        <DialogHeader
          titleId={titleId}
          eyebrow={eyebrow}
          title={title}
          onClose={onClose}
          closeLabel={t("close")}
        />
        <div className="flex-1 text-body text-ink">{children}</div>
        {footer && <footer className="mt-5 flex flex-wrap justify-end gap-2.5">{footer}</footer>}
      </div>
    </div>
  );
}
