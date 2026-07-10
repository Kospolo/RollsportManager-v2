"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { data, errorMessage } from "@/lib/data";
import type { ChatMessage } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { chatDict } from "./i18n";

/**
 * Bestätigungs-Dialog für das Löschen einer eigenen Nachricht. Es wird BEWUSST
 * nie automatisch bestätigt — gelöscht wird ausschließlich über den expliziten
 * „Nachricht löschen"-Klick. Erfolg: Toast + onDeleted() + schließen; ein Fehler
 * bleibt als Klartext-Toast, der Dialog bleibt offen. Das serverseitige Recht
 * (Sender löscht die eigene Nachricht) ist die Wahrheit — die UI reicht nur durch.
 */
export function DeleteMessageDialog({
  message,
  onClose,
  onDeleted,
}: {
  message: ChatMessage | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(chatDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!message || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteChatMessage(message.id);
      showToast(t("deletedToast"), { tone: "success" });
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
      open={message !== null}
      onClose={onClose}
      eyebrow={t("deleteEyebrow")}
      title={t("deleteTitle")}
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
