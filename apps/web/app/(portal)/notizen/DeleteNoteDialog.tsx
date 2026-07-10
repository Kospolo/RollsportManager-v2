"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { data, errorMessage } from "@/lib/data";
import type { Note } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { notesDict } from "./i18n";

/**
 * Bestätigungs-Dialog für das Löschen einer privaten Notiz. Es wird BEWUSST
 * nie automatisch bestätigt — gelöscht wird ausschließlich über den expliziten
 * „Notiz löschen“-Klick. Erfolg: Toast + onDeleted() + schließen; ein Fehler
 * bleibt als Klartext-Toast, der Dialog bleibt offen.
 */
export function DeleteNoteDialog({
  note,
  onClose,
  onDeleted,
}: {
  note: Note | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(notesDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!note || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteNote(note.id);
      showToast(t("deletedToast", { title: note.title }), { tone: "success" });
      onDeleted();
      onClose();
    } catch (caught) {
      showToast(errorMessage(caught) || t("genericError"), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={note !== null}
      onClose={onClose}
      eyebrow={t("deleteEyebrow")}
      title={note ? t("deleteTitle", { title: note.title }) : ""}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={confirm} disabled={submitting}>
            {t("deleteConfirm")}
          </Button>
        </>
      }
    >
      <p className="text-body text-ink-soft">{t("deleteBody")}</p>
    </Modal>
  );
}
