"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * Kleiner Bestätigungs-Dialog fürs (Soft-)Löschen. Löschen wird NIE still
 * ausgeführt — es braucht immer diesen expliziten Klick auf die Danger-Aktion.
 * Wiederverwendet für Beitragskategorien und Familienrabatte.
 */
export function ConfirmDeleteModal({
  eyebrow,
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  eyebrow: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open
      onClose={busy ? () => {} : onCancel}
      eyebrow={eyebrow}
      title={title}
      maxWidthClass="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-body text-ink-soft">{body}</p>
    </Modal>
  );
}
